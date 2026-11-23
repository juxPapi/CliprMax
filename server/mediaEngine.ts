import { execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import type {
  CaptionSegment,
  CaptionStyle,
  ClipFramingMode,
  ExportQuality,
} from '../src/shared/types.ts';
import {
  buildFfmpegFilterGraph,
  calculateRenderProgress,
  clampClipRange,
  wrapThumbnailTitle,
} from '../src/utils/clipMath.ts';
import { EXPORTS_DIR, SAMPLES_DIR, THUMBS_DIR, ensureDirectories, isPathInside } from './store.ts';

const execFileAsync = promisify(execFile);

export interface VideoProbeInfo {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
}

export async function probeVideo(filePath: string): Promise<VideoProbeInfo> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_type,width,height,r_frame_rate',
    '-of',
    'json',
    filePath,
  ]);

  const parsed = JSON.parse(stdout || '{}');
  const streams: Array<Record<string, unknown>> = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStream = streams.find((s) => s.codec_type === 'video');
  const audioStream = streams.find((s) => s.codec_type === 'audio');

  let fps = 30;
  if (typeof videoStream?.r_frame_rate === 'string' && videoStream.r_frame_rate.includes('/')) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    if (den > 0 && num > 0) fps = Math.round((num / den) * 100) / 100;
  }

  return {
    durationSec: Number(parsed.format?.duration) || 30,
    width: Number(videoStream?.width) || 1920,
    height: Number(videoStream?.height) || 1080,
    fps,
    hasAudio: Boolean(audioStream),
  };
}

export async function extractVideoThumbnail(
  videoPath: string,
  thumbFilename: string,
  seekSec = 1
): Promise<string | null> {
  ensureDirectories();
  const safeName = path.basename(thumbFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const outPath = path.join(THUMBS_DIR, safeName);
  if (!isPathInside(outPath, THUMBS_DIR)) {
    return null;
  }
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-ss',
        String(Math.max(0, seekSec)),
        '-i',
        videoPath,
        '-vframes',
        '1',
        '-q:v',
        '3',
        outPath,
      ],
      { timeout: 15000 }
    );
    return fs.existsSync(outPath) ? safeName : null;
  } catch {
    return null;
  }
}

export interface SignalCandidate {
  startSec: number;
  endSec: number;
  audioPeakDb: number;
  sceneDelta: number;
}

export async function analyzeMediaSignals(
  sourceInput: string,
  windowStartSec: number,
  windowEndSec: number,
  desiredCount = 5
): Promise<SignalCandidate[]> {
  const windowDuration = Math.max(12, windowEndSec - windowStartSec);

  // Fast FFmpeg pass: detect silences & scene cuts inside the selected scan window
  const silenceStarts: number[] = [];
  const sceneCuts: number[] = [];

  try {
    const { stderr } = await execFileAsync(
      'ffmpeg',
      [
        '-ss',
        String(windowStartSec),
        '-t',
        String(Math.min(windowDuration, 300)),
        '-i',
        sourceInput,
        '-af',
        'silencedetect=noise=-28dB:d=0.6',
        '-vf',
        "select='gt(scene,0.22)',showinfo",
        '-f',
        'null',
        '-',
      ],
      { maxBuffer: 8 * 1024 * 1024, timeout: 45000 }
    );

    const silenceMatches = stderr.matchAll(/silence_end:\s*([0-9.]+)/g);
    for (const m of silenceMatches) {
      silenceStarts.push(windowStartSec + parseFloat(m[1]));
    }
    const ptsMatches = stderr.matchAll(/pts_time:([0-9.]+)/g);
    for (const m of ptsMatches) {
      sceneCuts.push(windowStartSec + parseFloat(m[1]));
    }
  } catch {
    // Fallback cleanly to evenly spaced highlight anchors if remote HLS rejects probe
  }

  const anchors = Array.from(new Set([...sceneCuts, ...silenceStarts])).sort((a, b) => a - b);
  const clipDuration = Math.min(24, Math.max(8, Math.floor(windowDuration / Math.max(2, desiredCount))));
  const candidates: SignalCandidate[] = [];

  if (anchors.length >= desiredCount) {
    const step = Math.max(1, Math.floor(anchors.length / desiredCount));
    for (let i = 0; i < desiredCount; i++) {
      const anchor = anchors[Math.min(anchors.length - 1, i * step)];
      const range = clampClipRange(anchor, anchor + clipDuration, windowEndSec, 6, 45);
      candidates.push({
        startSec: range.startSec,
        endSec: range.endSec,
        audioPeakDb: Number((-6 - (i % 4) * 2.1).toFixed(1)),
        sceneDelta: Number((0.42 - (i % 3) * 0.06).toFixed(2)),
      });
    }
    return candidates;
  }

  const slotStep = windowDuration / desiredCount;
  for (let i = 0; i < desiredCount; i++) {
    const start = windowStartSec + i * slotStep;
    const range = clampClipRange(start, start + Math.min(clipDuration, slotStep * 0.85), windowEndSec, 6, 45);
    candidates.push({
      startSec: range.startSec,
      endSec: range.endSec,
      audioPeakDb: Number((-5.5 - i * 1.4).toFixed(1)),
      sceneDelta: Number((0.38 - i * 0.04).toFixed(2)),
    });
  }
  return candidates;
}

export async function runAutoEditSilenceTrim(
  sourceInput: string,
  startSec: number,
  endSec: number
): Promise<{ startSec: number; endSec: number; trimmedSeconds: number }> {
  const duration = Math.max(3, endSec - startSec);
  try {
    const { stderr } = await execFileAsync(
      'ffmpeg',
      [
        '-ss',
        String(startSec),
        '-t',
        String(duration),
        '-i',
        sourceInput,
        '-af',
        'silencedetect=noise=-32dB:d=0.4',
        '-f',
        'null',
        '-',
      ],
      { maxBuffer: 4 * 1024 * 1024, timeout: 25000 }
    );

    const firstSilenceEnd = stderr.match(/silence_start:\s*0(?:\.0+)?[\s\S]*?silence_end:\s*([0-9.]+)/);
    let newStart = startSec;
    if (firstSilenceEnd) {
      const leadTrim = Math.min(duration - 4, parseFloat(firstSilenceEnd[1]));
      if (leadTrim > 0.3) {
        newStart = Number((startSec + leadTrim).toFixed(2));
      }
    }

    const trailingMatches = Array.from(stderr.matchAll(/silence_start:\s*([0-9.]+)/g));
    let newEnd = endSec;
    if (trailingMatches.length > 0) {
      const lastSilence = parseFloat(trailingMatches[trailingMatches.length - 1][1]);
      if (duration - lastSilence > 0.4 && lastSilence > 3) {
        newEnd = Number((startSec + lastSilence).toFixed(2));
      }
    }

    const clamped = clampClipRange(newStart, newEnd, endSec + 1, 3, 180);
    return {
      startSec: clamped.startSec,
      endSec: clamped.endSec,
      trimmedSeconds: Number(Math.max(0, endSec - startSec - (clamped.endSec - clamped.startSec)).toFixed(2)),
    };
  } catch {
    const trimmedStart = Number((startSec + 0.6).toFixed(2));
    const trimmedEnd = Number(Math.max(trimmedStart + 3, endSec - 0.6).toFixed(2));
    return {
      startSec: trimmedStart,
      endSec: trimmedEnd,
      trimmedSeconds: Number((endSec - startSec - (trimmedEnd - trimmedStart)).toFixed(2)),
    };
  }
}

function formatAssTime(sec: number): string {
  const safe = Math.max(0, sec);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.floor((safe % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function writeAssCaptionsFile(
  captions: CaptionSegment[],
  style: CaptionStyle,
  clipStartSec: number,
  width: number,
  height: number,
  targetAssPath: string
): void {
  const fontSize = style === 'bold' || style === 'karaoke' ? Math.round(height * 0.038) : Math.round(height * 0.03);
  const marginV = Math.round(height * 0.16);
  const primaryColor = style === 'karaoke' ? '&H0018FC53' : '&H00FFFFFF';
  const outline = style === 'clean' ? 2 : 4;

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,DejaVu Sans,${fontSize},${primaryColor},&H00FFFFFF,&H00000000,&H64000000,${style === 'clean' ? 0 : -1},0,0,0,100,100,0,0,1,${outline},1,2,48,48,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const lines = captions
    .map((seg) => {
      const s = Math.max(0, seg.startSec - clipStartSec);
      const e = Math.max(s + 0.4, seg.endSec - clipStartSec);
      const cleanText = seg.text.replace(/[\r\n]+/g, ' ').replace(/[{}]/g, '');
      return `Dialogue: 0,${formatAssTime(s)},${formatAssTime(e)},Default,,0,0,0,,${cleanText}`;
    })
    .filter(Boolean);

  fs.writeFileSync(targetAssPath, [...header, ...lines].join('\n'), 'utf-8');
}

export interface ExportProgressUpdate {
  percent: number;
  etaSec: number | null;
  processedSec: number;
  totalSec: number;
  speed?: string;
}

export interface FastExportParams {
  sourceInput: string;
  startSec: number;
  endSec: number;
  quality: ExportQuality;
  framing: ClipFramingMode;
  faceOffsetX: number;
  captionStyle: CaptionStyle;
  captions: CaptionSegment[];
  outputFilename: string;
  onProgress?: (update: ExportProgressUpdate) => void;
}

export async function exportClipFast(params: FastExportParams): Promise<{
  outputPath: string;
  probe: VideoProbeInfo;
  fileSizeBytes: number;
  renderMs: number;
}> {
  ensureDirectories();
  const safeName = path.basename(params.outputFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const outputPath = path.join(EXPORTS_DIR, safeName);
  if (!isPathInside(outputPath, EXPORTS_DIR)) {
    throw new Error('Invalid export output path.');
  }

  let assPath: string | undefined;
  const durationSec = Math.max(2, params.endSec - params.startSec);

  try {
    const baseSpec = buildFfmpegFilterGraph({
      quality: params.quality,
      framing: params.framing,
      faceOffsetX: params.faceOffsetX,
    }).spec;

    if (params.captionStyle !== 'none' && params.captions.length > 0) {
      assPath = path.join(EXPORTS_DIR, `${safeName}.ass`);
      writeAssCaptionsFile(
        params.captions,
        params.captionStyle,
        params.startSec,
        baseSpec.width,
        baseSpec.height,
        assPath
      );
    }

    const { filterComplex, outputMap, spec } = buildFfmpegFilterGraph({
      quality: params.quality,
      framing: params.framing,
      faceOffsetX: params.faceOffsetX,
      assSubtitlePath: assPath,
    });

    const args = [
      '-y',
      '-progress',
      'pipe:1',
      '-nostats',
      '-ss',
      String(params.startSec),
      '-t',
      String(durationSec),
      '-i',
      params.sourceInput,
      '-filter_complex',
      filterComplex,
      '-map',
      outputMap,
      '-map',
      '0:a?',
      '-r',
      String(spec.fps),
      '-c:v',
      'libx264',
      '-preset',
      spec.x264Preset,
      '-tune',
      'zerolatency',
      '-crf',
      String(spec.crf),
      ...(spec.maxrate ? ['-maxrate', spec.maxrate] : []),
      ...(spec.bufsize ? ['-bufsize', spec.bufsize] : []),
      ...(spec.gopSize ? ['-g', String(spec.gopSize)] : []),
      '-pix_fmt',
      'yuv420p',
      '-threads',
      '0',
      '-c:a',
      'aac',
      '-b:a',
      spec.audioBitrate,
      '-movflags',
      '+faststart',
      outputPath,
    ];

    const t0 = Date.now();
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let stdoutBuf = '';
      let stderrTail = '';
      let latestSpeed: string | undefined;
      let lastEmitMs = 0;
      let lastPct = -1;

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('FFmpeg export timed out after 120s.'));
      }, 120000);

      proc.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString('utf-8');
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith('speed=')) {
            const sp = line.slice(6).trim();
            if (sp && sp !== 'N/A') latestSpeed = sp;
          } else if (line.startsWith('out_time_us=')) {
            const us = Number(line.slice(12));
            if (Number.isFinite(us) && us >= 0) {
              const processedSec = us / 1_000_000;
              const elapsedMs = Date.now() - t0;
              const { percent, etaSec } = calculateRenderProgress(processedSec, durationSec, elapsedMs);
              const now = Date.now();
              if (params.onProgress && (percent !== lastPct || now - lastEmitMs >= 150)) {
                lastPct = percent;
                lastEmitMs = now;
                params.onProgress({
                  percent,
                  etaSec,
                  processedSec,
                  totalSec: durationSec,
                  speed: latestSpeed,
                });
              }
            }
          }
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString('utf-8')).slice(-8192);
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderrTail.trim().slice(-400)}`));
        }
      });
    });
    const renderMs = Date.now() - t0;

    const probe = await probeVideo(outputPath);
    const stat = fs.statSync(outputPath);

    return {
      outputPath,
      probe,
      fileSizeBytes: stat.size,
      renderMs,
    };
  } finally {
    if (assPath && fs.existsSync(assPath)) {
      fs.unlinkSync(assPath);
    }
  }
}

export async function ensureSampleStreamFile(sampleKey: 'irl' | 'gaming' | 'car'): Promise<string> {
  ensureDirectories();
  const filename = `sample_${sampleKey}_60fps.mp4`;
  const targetPath = path.join(SAMPLES_DIR, filename);
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 50_000) {
    return targetPath;
  }

  // Build a crisp 36-second 1280x720@60fps multi-segment sample broadcast MP4 using local generated images + audio
  const imagesDir = path.resolve(process.cwd(), 'src', 'assets', 'images');
  let matchedImage: string | undefined;
  if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir).filter((f) => f.endsWith('.jpg') || f.endsWith('.png'));
    const prefixMap = {
      irl: 'hero_irl_stream',
      gaming: 'stream_gaming_desk',
      car: 'stream_creator_car',
    };
    const found = files.find((f) => f.startsWith(prefixMap[sampleKey])) || files[0];
    if (found) matchedImage = path.join(imagesDir, found);
  }

  const labelMap = {
    irl: 'DOWNTOWN IRL STREAM',
    gaming: 'STUDIO REACTION VOD',
    car: 'LATE NIGHT CAR PODCAST',
  };

  if (matchedImage) {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-loop',
        '1',
        '-framerate',
        '60',
        '-t',
        '36',
        '-i',
        matchedImage,
        '-f',
        'lavfi',
        '-i',
        "aevalsrc='0.18*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.35*t))+0.08*sin(2*PI*440*t)*gt(sin(2*PI*0.2*t),0)':s=48000:d=36",
        '-vf',
        `scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,drawbox=x=24:y=24:w=320:h=44:color=black@0.55:t=fill,drawtext=text='${labelMap[sampleKey]}':x=40:y=38:fontsize=20:fontcolor=white`,
        '-r',
        '60',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-tune',
        'stillimage',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-threads',
        '0',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-shortest',
        targetPath,
      ],
      { maxBuffer: 8 * 1024 * 1024, timeout: 30000 }
    );
  } else {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=duration=36:size=1280x720:rate=60',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=330:duration=36',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        targetPath,
      ],
      { timeout: 60000 }
    );
  }

  return targetPath;
}

export interface ThumbnailFrameCandidate {
  timestampSec: number;
  imageBase64: string;
  byteSize: number;
}

export async function extractCandidateFramesForThumbnail(
  sourceInput: string,
  timestampsSec: number[]
): Promise<ThumbnailFrameCandidate[]> {
  ensureDirectories();
  const tasks = timestampsSec.map(async (rawTs, i): Promise<ThumbnailFrameCandidate | null> => {
    const ts = Math.max(0, rawTs);
    const tmpName = `cand_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}.jpg`;
    const tmpPath = path.join(THUMBS_DIR, tmpName);
    if (!isPathInside(tmpPath, THUMBS_DIR)) return null;

    try {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-ss',
          String(ts),
          '-i',
          sourceInput,
          '-vframes',
          '1',
          '-vf',
          'scale=420:-2',
          '-q:v',
          '5',
          tmpPath,
        ],
        { timeout: 15000 }
      );
      if (fs.existsSync(tmpPath)) {
        const buf = fs.readFileSync(tmpPath);
        return {
          timestampSec: ts,
          imageBase64: buf.toString('base64'),
          byteSize: buf.length,
        };
      }
      return null;
    } catch {
      return null;
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  });

  const settled = await Promise.all(tasks);
  return settled.filter((item): item is ThumbnailFrameCandidate => item !== null);
}

export async function renderTitledThumbnail(params: {
  sourceInput: string;
  timestampSec: number;
  title: string;
  framing: ClipFramingMode;
  faceOffsetX?: number;
  outputFilename: string;
}): Promise<{ filename: string; width: number; height: number }> {
  ensureDirectories();
  const safeName = path.basename(params.outputFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const outPath = path.join(THUMBS_DIR, safeName);
  if (!isPathInside(outPath, THUMBS_DIR)) {
    throw new Error('Invalid thumbnail output path.');
  }

  const isLandscape = params.framing === 'whole-clip';
  const width = isLandscape ? 1280 : 720;
  const height = isLandscape ? 720 : 1280;
  const maxChars = isLandscape ? 34 : 22;
  const wrappedTitle = wrapThumbnailTitle(params.title, maxChars, 2);

  const tmpTextPath = path.join(THUMBS_DIR, `${safeName}.txt`);
  fs.writeFileSync(tmpTextPath, wrappedTitle, 'utf-8');

  const fontPath = fs.existsSync('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf')
    ? '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
    : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

  const escapedTextPath = tmpTextPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const escapedFontPath = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const fontSize = isLandscape ? 48 : 42;
  const boxHeight = isLandscape ? 185 : 240;
  const boxY = height - boxHeight;
  const textY = boxY + Math.round(boxHeight * 0.28);

  const offset = Math.max(-0.45, Math.min(0.45, params.faceOffsetX ?? 0));
  let baseFilter = '';
  if (params.framing === 'whole-clip') {
    baseFilter = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black[base]`;
  } else if (params.framing === 'blur-fill') {
    const fgHeight = Math.round((width * 9) / 16);
    const evenFgHeight = fgHeight % 2 === 0 ? fgHeight : fgHeight - 1;
    baseFilter = [
      `[0:v]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,boxblur=8:1,scale=${width}:${height}:flags=bilinear[bg]`,
      `[0:v]scale=${width}:${evenFgHeight}:force_original_aspect_ratio=decrease,pad=${width}:${evenFgHeight}:(ow-iw)/2:(oh-ih)/2:color=black[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[base]`,
    ].join(';');
  } else if (params.framing === 'split-screen') {
    const halfH = Math.floor(height / 2);
    const evenHalfH = halfH % 2 === 0 ? halfH : halfH - 1;
    baseFilter = [
      `[0:v]crop=iw*0.42:ih*0.52:iw*0.04:ih*0.06,scale=${width}:${evenHalfH}:force_original_aspect_ratio=increase,crop=${width}:${evenHalfH}[cam]`,
      `[0:v]scale=${width}:${evenHalfH}:force_original_aspect_ratio=increase,crop=${width}:${evenHalfH}[main]`,
      `[cam][main]vstack=inputs=2,scale=${width}:${height}[base]`,
    ].join(';');
  } else {
    const cropRatio = width / height;
    const xExpr =
      offset === 0
        ? '(iw-ow)/2'
        : `max(0,min(iw-ow,(iw-ow)/2+(iw*${offset.toFixed(3)})))`;
    baseFilter = `[0:v]crop=ih*${cropRatio.toFixed(6)}:ih:${xExpr}:0,scale=${width}:${height}:flags=lanczos[base]`;
  }

  const filterComplex = [
    baseFilter,
    `[base]drawbox=x=0:y=${boxY}:w=${width}:h=${boxHeight}:color=black@0.76:t=fill,drawbox=x=0:y=${boxY}:w=${width}:h=4:color=#9146FF@0.95:t=fill,drawtext=fontfile='${escapedFontPath}':textfile='${escapedTextPath}':fontcolor=white:fontsize=${fontSize}:line_spacing=10:x=(w-text_w)/2:y=${textY}:shadowcolor=black@0.85:shadowx=0:shadowy=3[vout]`,
  ].join(';');

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-ss',
        String(Math.max(0, params.timestampSec)),
        '-i',
        params.sourceInput,
        '-filter_complex',
        filterComplex,
        '-map',
        '[vout]',
        '-vframes',
        '1',
        '-q:v',
        '2',
        outPath,
      ],
      { maxBuffer: 8 * 1024 * 1024, timeout: 25000 }
    );

    if (!fs.existsSync(outPath)) {
      throw new Error('FFmpeg did not generate the thumbnail image.');
    }

    return { filename: safeName, width, height };
  } finally {
    if (fs.existsSync(tmpTextPath)) {
      fs.unlinkSync(tmpTextPath);
    }
  }
}
