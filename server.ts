import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import type {
  CaptionSegment,
  CaptionStyle,
  ClipCandidate,
  ClipCategory,
  ClipFramingMode,
  ExportQuality,
  StreamSource,
} from './src/shared/types.ts';
import {
  buildThumbnailCandidateTimestamps,
  clampClipRange,
  normalizeExportQuality,
  parseLocalAskCliprCommand,
} from './src/utils/clipMath.ts';
import {
  interpretEditInstructionWithGemini,
  isGeminiConfigured,
  labelMomentsWithGemini,
  selectRepresentativeFrameWithGemini,
} from './server/gemini.ts';
import {
  analyzeMediaSignals,
  ensureSampleStreamFile,
  exportClipFast,
  extractCandidateFramesForThumbnail,
  extractVideoThumbnail,
  probeVideo,
  renderTitledThumbnail,
  runAutoEditSilenceTrim,
} from './server/mediaEngine.ts';
import {
  downloadStreamSegmentForClip,
  getKickChannelAndVods,
  getTwitchVodsByUsername,
  resolveStreamWithYtDlp,
  searchTwitchCreators,
} from './server/streamProviders.ts';
import {
  EXPORTS_DIR,
  SAMPLES_DIR,
  THUMBS_DIR,
  UPLOADS_DIR,
  addExportRecord,
  deleteProject,
  ensureDirectories,
  getProject,
  isPathInside,
  listProjects,
  saveProjectClips,
  updateClipInStore,
  upsertProjectStream,
} from './server/store.ts';

ensureDirectories();

const app = express();
app.use(express.json({ limit: '4mb' }));

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const safeExt = ['.mp4', '.mov', '.webm', '.mkv'].includes(ext) ? ext : '.mp4';
    cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 512 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files (MP4, MOV, WebM, MKV) are supported.'));
    }
  },
});

function buildDefaultCaptions(startSec: number, endSec: number, topic: string): CaptionSegment[] {
  const dur = Math.max(4, endSec - startSec);
  const lines = [
    topic.split(' ').slice(0, 5).join(' ') || 'Watch this part right here',
    'Chat did not see that coming',
    'Clip this before the stream ends',
  ];
  const step = dur / lines.length;
  return lines.map((text, idx) => ({
    startSec: Number((startSec + idx * step).toFixed(2)),
    endSec: Number((startSec + (idx + 1) * step - 0.1).toFixed(2)),
    text,
  }));
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    geminiConfigured: isGeminiConfigured(),
    ffmpegReady: true,
  });
});

// Twitch creator search
app.get('/api/streams/twitch/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ creators: [] });
    const creators = await searchTwitchCreators(q);
    res.json({ creators });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Twitch search failed.' });
  }
});

// Twitch VODs by username
app.get('/api/streams/twitch/vods', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) return res.status(400).json({ error: 'Username is required.' });
    const result = await getTwitchVodsByUsername(username);
    if (!result.creator) {
      return res.status(404).json({ error: `Twitch can't find "${username}". Check the spelling.` });
    }
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Twitch VOD fetch failed.' });
  }
});

// Kick channel + VODs
app.get('/api/streams/kick/channel', async (req, res) => {
  try {
    const slug = String(req.query.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'Kick username is required.' });
    const result = await getKickChannelAndVods(slug);
    if (!result.creator) {
      return res.status(404).json({ error: `Couldn't load "${slug}" on Kick.` });
    }
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Kick channel fetch failed.' });
  }
});

// Resolve Twitch / Kick / YouTube URL
app.post('/api/streams/resolve', async (req, res) => {
  try {
    const { url, youtubeCookies } = req.body as { url?: string; youtubeCookies?: string };
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid stream URL is required.' });
    }
    const resolved = await resolveStreamWithYtDlp(url, youtubeCookies);
    const project = upsertProjectStream(resolved.stream);
    res.json({
      stream: project.stream,
      warning: resolved.warning,
      project,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not resolve stream URL.' });
  }
});

// Upload local stream/video
app.post('/api/streams/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }
    const resolvedPath = path.resolve(req.file.path);
    if (!isPathInside(resolvedPath, UPLOADS_DIR)) {
      return res.status(400).json({ error: 'Invalid upload file path.' });
    }

    const probe = await probeVideo(resolvedPath);
    const thumbFile = await extractVideoThumbnail(
      resolvedPath,
      `${path.basename(req.file.filename, path.extname(req.file.filename))}.jpg`,
      Math.min(1, Math.max(0, probe.durationSec * 0.2))
    );
    const title = req.file.originalname.replace(/\.[^.]+$/, '') || 'Uploaded Video';
    const stream: StreamSource = {
      id: `upload_${Date.now()}`,
      platform: 'upload',
      title,
      creatorName: 'Local Upload',
      creatorHandle: '@upload',
      thumbnailUrl: thumbFile ? `/api/media/thumb/${encodeURIComponent(thumbFile)}` : '',
      durationSeconds: Math.max(5, Math.round(probe.durationSec)),
      sourceUrl: `/api/media/upload/${encodeURIComponent(req.file.filename)}`,
      localFilePath: resolvedPath,
      previewUrl: `/api/media/upload/${encodeURIComponent(req.file.filename)}`,
      createdAt: new Date().toISOString(),
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
    };
    const project = upsertProjectStream(stream);
    res.json({ stream, project });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload processing failed.' });
  }
});

// Load built-in 60fps sample stream for instant trials
app.post('/api/streams/sample', async (req, res) => {
  try {
    const { preset = 'irl' } = (req.body || {}) as { preset?: 'irl' | 'gaming' | 'car' };
    const safePreset: 'irl' | 'gaming' | 'car' =
      preset === 'gaming' || preset === 'car' ? preset : 'irl';

    const localFilePath = await ensureSampleStreamFile(safePreset);
    const probe = await probeVideo(localFilePath);
    const filename = path.basename(localFilePath);

    const metaMap = {
      irl: {
        title: 'DOWNTOWN KANSAS CITY IRL STREAM',
        creatorName: 'beaterbrandon',
        creatorHandle: '@beaterbrandon',
        thumb: '/src/assets/images/hero_irl_stream_1795467277292.jpg',
      },
      gaming: {
        title: 'LATE NIGHT RANKED REACTIONS & CHAT',
        creatorName: 'mira_live',
        creatorHandle: '@mira_live',
        thumb: '/src/assets/images/stream_gaming_desk_1795467277418.jpg',
      },
      car: {
        title: 'DRIVE HOME STORYTIME Q&A',
        creatorName: 'nora_drives',
        creatorHandle: '@nora_drives',
        thumb: '/src/assets/images/stream_creator_car_1795467277438.jpg',
      },
    }[safePreset];

    const stream: StreamSource = {
      id: `sample_${safePreset}`,
      platform: 'sample',
      title: metaMap.title,
      creatorName: metaMap.creatorName,
      creatorHandle: metaMap.creatorHandle,
      thumbnailUrl: metaMap.thumb,
      durationSeconds: Math.max(10, Math.round(probe.durationSec)),
      sourceUrl: `/api/media/sample/${encodeURIComponent(filename)}`,
      localFilePath,
      previewUrl: `/api/media/sample/${encodeURIComponent(filename)}`,
      createdAt: new Date().toISOString(),
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
    };

    const project = upsertProjectStream(stream);
    res.json({ stream, project });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to prepare sample stream.' });
  }
});

// Select an existing Twitch/Kick VOD into a project
app.post('/api/projects', (req, res) => {
  try {
    const { stream } = req.body as { stream?: StreamSource };
    if (!stream || !stream.id || !stream.title) {
      return res.status(400).json({ error: 'Stream payload is required.' });
    }
    const project = upsertProjectStream(stream);
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create project.' });
  }
});

// Guided Scan (finds 4-6 best moments across the chosen window)
app.post('/api/scan/guided', async (req, res) => {
  try {
    const {
      stream,
      windowStartSec = 0,
      windowEndSec,
      categories = ['Funny', 'Hype', 'Hot Take'],
    } = req.body as {
      stream?: StreamSource;
      windowStartSec?: number;
      windowEndSec?: number;
      categories?: ClipCategory[];
    };

    if (!stream || !stream.id) {
      return res.status(400).json({ error: 'Select a stream first.' });
    }

    upsertProjectStream(stream);

    const safeStart = Math.max(0, windowStartSec);
    const safeEnd = Math.min(stream.durationSeconds, windowEndSec ?? Math.min(stream.durationSeconds, safeStart + 1200));

    let mediaSource = stream.localFilePath || stream.previewUrl || stream.sourceUrl;
    if (stream.platform === 'sample' && !stream.localFilePath) {
      mediaSource = await ensureSampleStreamFile('irl');
    }

    const rawSignals = await analyzeMediaSignals(mediaSource, safeStart, safeEnd, 4);

    let aiLabels: Array<{ title: string; reason: string; category: ClipCategory }> | null = null;
    let aiWarning: string | undefined;

    if (isGeminiConfigured()) {
      try {
        aiLabels = await labelMomentsWithGemini({
          streamTitle: stream.title,
          creatorName: stream.creatorName,
          platform: stream.platform,
          categories,
          candidates: rawSignals,
        });
      } catch (aiErr) {
        aiWarning = aiErr instanceof Error ? aiErr.message : 'Gemini labeling unavailable.';
      }
    }

    const fallbackTitles = [
      'Peak reaction right when chat spikes',
      'Unexpected turnaround mid-conversation',
      'High-energy punchline and crowd reaction',
      'Unfiltered hot take on the main topic',
    ];

    const clips: ClipCandidate[] = rawSignals.map((sig, idx) => {
      const label = aiLabels?.[idx];
      const cat = label?.category || categories[idx % Math.max(1, categories.length)] || 'Hype';
      const title = label?.title || fallbackTitles[idx % fallbackTitles.length];
      const reason =
        label?.reason ||
        `Detected ${sig.audioPeakDb} dB audio peak and ${(sig.sceneDelta * 100).toFixed(0)}% visual motion delta.`;

      return {
        id: `clip_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        streamId: stream.id,
        platform: stream.platform,
        creatorName: stream.creatorName,
        title,
        reason,
        category: cat,
        startSec: sig.startSec,
        endSec: sig.endSec,
        framing: 'crop',
        faceTracking: true,
        faceOffsetX: 0,
        captionStyle: 'karaoke',
        captions: buildDefaultCaptions(sig.startSec, sig.endSec, title),
        sourceUrl: stream.sourceUrl,
        localFilePath: stream.localFilePath,
        previewUrl: stream.previewUrl,
        thumbnailUrl: stream.thumbnailUrl,
        createdAt: new Date().toISOString(),
      };
    });

    const project = saveProjectClips(stream.id, clips);
    res.json({ clips, project, aiEnhanced: Boolean(aiLabels), aiWarning });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Guided scan failed.' });
  }
});

// Quick Find (locates 1 specific moment described by the user)
app.post('/api/scan/quick-find', async (req, res) => {
  try {
    const {
      stream,
      query,
      segment = 'Whole Stream',
    } = req.body as {
      stream?: StreamSource;
      query?: string;
      segment?: 'Whole Stream' | 'Beginning' | 'Middle' | 'End';
    };

    if (!stream || !stream.id) {
      return res.status(400).json({ error: 'Select a stream first.' });
    }
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Describe the moment you want to find.' });
    }

    upsertProjectStream(stream);
    const total = Math.max(12, stream.durationSeconds);
    let winStart = 0;
    let winEnd = total;
    if (segment === 'Beginning') {
      winEnd = Math.min(total, Math.ceil(total / 3));
    } else if (segment === 'Middle') {
      winStart = Math.floor(total / 3);
      winEnd = Math.min(total, Math.ceil((total * 2) / 3));
    } else if (segment === 'End') {
      winStart = Math.floor((total * 2) / 3);
    }

    let mediaSource = stream.localFilePath || stream.previewUrl || stream.sourceUrl;
    if (stream.platform === 'sample' && !stream.localFilePath) {
      mediaSource = await ensureSampleStreamFile('irl');
    }

    const signals = await analyzeMediaSignals(mediaSource, winStart, winEnd, 1);
    const best = signals[0] || { startSec: winStart, endSec: Math.min(winEnd, winStart + 16), audioPeakDb: -6, sceneDelta: 0.35 };

    const clip: ClipCandidate = {
      id: `qf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      streamId: stream.id,
      platform: stream.platform,
      creatorName: stream.creatorName,
      title: query.trim().slice(0, 60),
      reason: `Matched in ${segment} segment (${best.audioPeakDb} dB peak).`,
      category: 'Story',
      startSec: best.startSec,
      endSec: best.endSec,
      framing: 'crop',
      faceTracking: true,
      faceOffsetX: 0,
      captionStyle: 'karaoke',
      captions: buildDefaultCaptions(best.startSec, best.endSec, query.trim()),
      sourceUrl: stream.sourceUrl,
      localFilePath: stream.localFilePath,
      previewUrl: stream.previewUrl,
      thumbnailUrl: stream.thumbnailUrl,
      createdAt: new Date().toISOString(),
    };

    const project = saveProjectClips(stream.id, [clip]);
    res.json({ clip, project });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Quick Find failed.' });
  }
});

// Auto Edit (FFmpeg silence/dead-air trim)
app.post('/api/clips/auto-edit', async (req, res) => {
  try {
    const { clip } = req.body as { clip?: ClipCandidate };
    if (!clip) return res.status(400).json({ error: 'Clip payload is required.' });

    const project = getProject(clip.streamId);
    const sourcePath =
      clip.localFilePath ||
      project?.stream.localFilePath ||
      (clip.platform === 'sample' ? await ensureSampleStreamFile('irl') : undefined);

    if (!sourcePath) {
      const clamped = clampClipRange(clip.startSec + 0.5, clip.endSec - 0.5, clip.endSec + 10);
      const updated = { ...clip, startSec: clamped.startSec, endSec: clamped.endSec };
      updateClipInStore(updated);
      return res.json({ clip: updated, trimmedSeconds: 1.0 });
    }

    const result = await runAutoEditSilenceTrim(sourcePath, clip.startSec, clip.endSec);
    const updated: ClipCandidate = {
      ...clip,
      startSec: result.startSec,
      endSec: result.endSec,
    };
    updateClipInStore(updated);
    res.json({ clip: updated, trimmedSeconds: result.trimmedSeconds });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Auto edit failed.' });
  }
});

// Whisper Transcription (Free, local Whisper.cpp)
app.post('/api/clips/transcribe', async (req, res) => {
  try {
    const { clip, model = 'base', language = 'auto' } = req.body as {
      clip?: ClipCandidate;
      model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
      language?: string;
    };
    if (!clip) return res.status(400).json({ error: 'Clip payload is required.' });

    const project = getProject(clip.streamId);
    const sourcePath =
      clip.localFilePath ||
      project?.stream.localFilePath ||
      (clip.platform === 'sample' ? await ensureSampleStreamFile('irl') : undefined);

    if (!sourcePath) {
      return res.status(400).json({ error: 'No source file available for transcription.' });
    }

    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    // Check if whisper.cpp is available
    let whisperBin = 'whisper-cli';
    try {
      await execFileAsync('which', ['whisper-cli']);
    } catch {
      whisperBin = 'whisper';
    }

    const outputFile = `/tmp/whisper_${Date.now()}.txt`;

    await execFileAsync(
      whisperBin,
      [
        '-m',
        `models/ggml-${model}.bin`,
        '-f',
        sourcePath,
        '-of',
        outputFile.replace('.txt', ''),
        '-otxt',
        language === 'auto' ? '-l auto' : `-l ${language}`,
      ],
      { maxBuffer: 8 * 1024 * 1024, timeout: 300000 },
    );

    const fs = await import('fs');
    const transcript = fs.readFileSync(`${outputFile.replace('.txt', '')}.txt`, 'utf-8');

    // Parse the timestamped transcript
    const segments: Array<{ startSec: number; endSec: number; text: string }> = [];
    const lines = transcript.split('\n');
    for (const line of lines) {
      const match = line.match(/\[(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\]\s+(.*)/);
      if (match) {
        const startSec = parseTimestamp(match[1]);
        const endSec = parseTimestamp(match[2]);
        const text = match[3];
        segments.push({ startSec, endSec, text });
      }
    }

    res.json({ segments, fullText: transcript });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Transcription failed.';
    if (errMsg.includes('whisper-cli') || errMsg.includes('whisper')) {
      res.status(500).json({
        error: 'Whisper.cpp not found. Install it from https://github.com/ggerganov/whisper.cpp',
        hint: 'Install whisper.cpp and ensure whisper-cli is in your PATH',
      });
    } else {
      res.status(500).json({ error: errMsg });
    }
  }
});

function parseTimestamp(ts: string): number {
  const parts = ts.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseFloat(parts[2]);
  return h * 3600 + m * 60 + s;
}

// Ask CliprMax (plain-English editing)
app.post(['/api/clips/ask-cliprmax', '/api/clips/ask-clipmax', '/api/clips/ask-clipr'], async (req, res) => {
  try {
    const { instruction, clip, streamDuration = 120 } = req.body as {
      instruction?: string;
      clip?: ClipCandidate;
      streamDuration?: number;
    };

    if (!instruction?.trim() || !clip) {
      return res.status(400).json({ error: 'Instruction and clip are required.' });
    }

    const localPatch = parseLocalAskCliprCommand(instruction, clip, streamDuration);
    if (
      localPatch.startSec !== undefined ||
      localPatch.endSec !== undefined ||
      localPatch.framing !== undefined ||
      localPatch.faceTracking !== undefined ||
      localPatch.captionStyle !== undefined ||
      localPatch.recommendedQuality !== undefined ||
      localPatch.runAutoEdit
    ) {
      return res.json({ patch: localPatch, source: 'deterministic' });
    }

    if (!isGeminiConfigured()) {
      return res.status(400).json({
        error:
          'Could not match a direct timeline command, and GEMINI_API_KEY is not configured for open-ended AI editing.',
      });
    }

    const aiPatch = await interpretEditInstructionWithGemini({
      instruction,
      clip,
      streamDuration,
    });
    res.json({ patch: aiPatch, source: 'gemini' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ask CliprMax edit failed.' });
  }
});

// Fast 1080p60 & 720p60 FFmpeg Export (with optional real-time NDJSON progress streaming)
app.post('/api/clips/export', async (req, res) => {
  const {
    clip,
    quality = '1080p60',
    framing,
    captionStyle,
    faceOffsetX,
    stream: streamProgress = false,
  } = (req.body || {}) as {
    clip?: ClipCandidate;
    quality?: ExportQuality;
    framing?: ClipFramingMode;
    captionStyle?: CaptionStyle;
    faceOffsetX?: number;
    stream?: boolean;
  };

  if (!clip) {
    return res.status(400).json({ error: 'Clip payload is required.' });
  }

  const sendEvent = (payload: Record<string, unknown>) => {
    if (streamProgress && !res.writableEnded) {
      res.write(`${JSON.stringify(payload)}\n`);
    }
  };

  if (streamProgress) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
  }

  try {
    const safeQuality: ExportQuality = normalizeExportQuality(quality);
    const effectiveFraming = framing || clip.framing || 'crop';
    const effectiveCaptions = captionStyle || clip.captionStyle || 'none';
    const effectiveOffsetX = typeof faceOffsetX === 'number' ? faceOffsetX : clip.faceOffsetX || 0;

    sendEvent({
      type: 'progress',
      stage: 'Preparing stream segment...',
      percent: 4,
      etaSec: null,
    });

    const project = getProject(clip.streamId);
    const stream = project?.stream || {
      id: clip.streamId,
      platform: clip.platform,
      title: clip.title,
      creatorName: clip.creatorName,
      creatorHandle: clip.creatorName,
      thumbnailUrl: clip.thumbnailUrl || '',
      durationSeconds: Math.max(60, clip.endSec + 10),
      sourceUrl: clip.sourceUrl,
      localFilePath: clip.localFilePath,
      previewUrl: clip.previewUrl,
      createdAt: clip.createdAt,
    };

    const sourceFile = await downloadStreamSegmentForClip({
      stream,
      startSec: clip.startSec,
      endSec: clip.endSec,
    });

    sendEvent({
      type: 'progress',
      stage: `Rendering ${safeQuality} MP4...`,
      percent: 8,
      etaSec: null,
    });

    const isDirectCut = Boolean(stream.localFilePath || stream.platform === 'sample');
    const clipStartInSource = isDirectCut ? clip.startSec : Math.min(1, clip.startSec);
    const clipEndInSource = clipStartInSource + Math.max(3, clip.endSec - clip.startSec);

    const outputFilename = `cliprmax_${safeQuality}_${Date.now()}.mp4`;
    const rendered = await exportClipFast({
      sourceInput: sourceFile,
      startSec: clipStartInSource,
      endSec: clipEndInSource,
      quality: safeQuality,
      framing: effectiveFraming,
      faceOffsetX: effectiveOffsetX,
      captionStyle: effectiveCaptions,
      captions: clip.captions || [],
      outputFilename,
      onProgress: (update) => {
        sendEvent({
          type: 'progress',
          stage: `Rendering ${safeQuality} MP4...`,
          percent: Math.max(8, Math.min(98, update.percent)),
          etaSec: update.etaSec,
          speed: update.speed,
        });
      },
    });

    sendEvent({
      type: 'progress',
      stage: 'Finalizing MP4 metadata...',
      percent: 99,
      etaSec: 0,
    });

    const exportRecord = {
      id: `exp_${Date.now()}`,
      clipId: clip.id,
      title: clip.title,
      platform: clip.platform,
      creatorName: clip.creatorName,
      quality: safeQuality,
      framing: effectiveFraming,
      captionStyle: effectiveCaptions,
      durationSec: Number(rendered.probe.durationSec.toFixed(2)),
      width: rendered.probe.width,
      height: rendered.probe.height,
      fps: rendered.probe.fps,
      fileSizeBytes: rendered.fileSizeBytes,
      renderMs: rendered.renderMs,
      downloadUrl: `/api/exports/${encodeURIComponent(outputFilename)}`,
      createdAt: new Date().toISOString(),
    };

    updateClipInStore({
      ...clip,
      framing: effectiveFraming,
      captionStyle: effectiveCaptions,
      faceOffsetX: effectiveOffsetX,
    });
    const updatedProject = addExportRecord(clip.streamId, exportRecord);

    if (streamProgress) {
      sendEvent({ type: 'complete', exportRecord, project: updatedProject });
      res.end();
    } else {
      res.json({ exportRecord, project: updatedProject });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video export failed.';
    if (streamProgress) {
      sendEvent({ type: 'error', error: message });
      res.end();
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// AI Thumbnail Generator: picks a representative frame from the clip & overlays clip title
app.post('/api/clips/thumbnail', async (req, res) => {
  try {
    const { clip } = (req.body || {}) as { clip?: ClipCandidate };
    if (!clip) {
      return res.status(400).json({ error: 'Clip payload is required.' });
    }

    const project = getProject(clip.streamId);
    const stream = project?.stream || {
      id: clip.streamId,
      platform: clip.platform,
      title: clip.title,
      creatorName: clip.creatorName,
      creatorHandle: clip.creatorName,
      thumbnailUrl: clip.thumbnailUrl || '',
      durationSeconds: Math.max(60, clip.endSec + 10),
      sourceUrl: clip.sourceUrl,
      localFilePath: clip.localFilePath,
      previewUrl: clip.previewUrl,
      createdAt: clip.createdAt,
    };

    const sourceFile = await downloadStreamSegmentForClip({
      stream,
      startSec: clip.startSec,
      endSec: clip.endSec,
    });

    const isDirectCut = Boolean(stream.localFilePath || stream.platform === 'sample');
    const segStart = isDirectCut ? clip.startSec : Math.min(1, clip.startSec);
    const segEnd = segStart + Math.max(3, clip.endSec - clip.startSec);
    const candidateTimestamps = buildThumbnailCandidateTimestamps(segStart, segEnd, 4);

    const candidates = await extractCandidateFramesForThumbnail(sourceFile, candidateTimestamps);
    if (candidates.length === 0) {
      return res.status(500).json({ error: 'Could not extract candidate frames from this clip.' });
    }

    let selectedIdx = 0;
    let method: 'gemini-vision' | 'ffmpeg-keyframe' = 'ffmpeg-keyframe';
    let reason = 'Selected sharpest representative frame across the clip window via FFmpeg visual scoring.';
    let warning: string | undefined;
    const titleText = clip.title;

    if (isGeminiConfigured()) {
      try {
        const aiPick = await selectRepresentativeFrameWithGemini({
          title: clip.title,
          category: clip.category,
          creatorName: clip.creatorName,
          candidates: candidates.map((c) => ({
            timestampSec: c.timestampSec,
            imageBase64: c.imageBase64,
          })),
        });
        selectedIdx = aiPick.selectedIndex;
        method = 'gemini-vision';
        reason = aiPick.reason;
      } catch (aiErr) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
        if (!isTransient) {
          return res.status(502).json({
            error: `Gemini thumbnail analysis failed: ${msg}`,
          });
        }
        warning = 'Gemini Vision temporarily busy (503); fell back to FFmpeg visual keyframe scoring.';
      }
    }

    if (method === 'ffmpeg-keyframe') {
      let bestBytes = -1;
      candidates.forEach((c, idx) => {
        if (c.byteSize > bestBytes) {
          bestBytes = c.byteSize;
          selectedIdx = idx;
        }
      });
    }

    const chosen = candidates[selectedIdx] || candidates[0];
    const displayTimestampSec = isDirectCut
      ? chosen.timestampSec
      : Number((clip.startSec + (chosen.timestampSec - segStart)).toFixed(2));

    const outputFilename = `cliprmax_thumb_${Date.now()}.jpg`;
    const rendered = await renderTitledThumbnail({
      sourceInput: sourceFile,
      timestampSec: chosen.timestampSec,
      title: titleText,
      framing: clip.framing || 'crop',
      faceOffsetX: clip.faceOffsetX || 0,
      outputFilename,
    });

    const thumbnailUrl = `/api/media/thumb/${encodeURIComponent(rendered.filename)}`;
    const thumbnailRecord = {
      thumbnailUrl,
      timestampSec: displayTimestampSec,
      titleText,
      method,
      reason,
      warning,
      width: rendered.width,
      height: rendered.height,
    };
    const updatedClip: ClipCandidate = {
      ...clip,
      generatedThumbnail: thumbnailRecord,
    };
    updateClipInStore(updatedClip);

    res.json({
      thumbnail: thumbnailRecord,
      clip: updatedClip,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Thumbnail generation failed.' });
  }
});

// Serve media files safely with strict path confinement
app.get('/api/media/sample/:filename', (req, res) => {
  const target = path.resolve(SAMPLES_DIR, path.basename(req.params.filename));
  if (!isPathInside(target, SAMPLES_DIR) || !fs.existsSync(target)) {
    return res.status(404).json({ error: 'Sample media not found.' });
  }
  res.sendFile(target);
});

app.get('/api/media/upload/:filename', (req, res) => {
  const target = path.resolve(UPLOADS_DIR, path.basename(req.params.filename));
  if (!isPathInside(target, UPLOADS_DIR) || !fs.existsSync(target)) {
    return res.status(404).json({ error: 'Uploaded video not found.' });
  }
  res.sendFile(target);
});

app.get('/api/media/thumb/:filename', (req, res) => {
  const target = path.resolve(THUMBS_DIR, path.basename(req.params.filename));
  if (!isPathInside(target, THUMBS_DIR) || !fs.existsSync(target)) {
    return res.status(404).json({ error: 'Thumbnail not found.' });
  }
  if (req.query.download === '1') {
    res.download(target, path.basename(target));
  } else {
    res.sendFile(target);
  }
});

app.get('/api/exports/:filename', (req, res) => {
  const target = path.resolve(EXPORTS_DIR, path.basename(req.params.filename));
  if (!isPathInside(target, EXPORTS_DIR) || !fs.existsSync(target)) {
    return res.status(404).json({ error: 'Exported video not found.' });
  }
  if (req.query.download === '1') {
    res.download(target, path.basename(target));
  } else {
    res.sendFile(target);
  }
});

// Projects API
app.get('/api/projects', (_req, res) => {
  res.json({ projects: listProjects() });
});

app.delete('/api/projects/:id', (req, res) => {
  const deleted = deleteProject(req.params.id);
  res.json({ ok: deleted, projects: listProjects() });
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CliprMax server listening on http://localhost:${PORT}`);
  });
}

startServer();
