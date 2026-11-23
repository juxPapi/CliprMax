import type {
  AskCliprEditPatch,
  CaptionStyle,
  ClipCandidate,
  ClipFramingMode,
  ExportQuality,
  Platform,
  ScanWindow,
} from '../shared/types.ts';

export interface ParsedStreamUrl {
  valid: boolean;
  platform: Platform | null;
  normalizedUrl: string;
  videoId?: string;
  channelSlug?: string;
  error?: string;
}

export function parseStreamUrl(rawInput: string): ParsedStreamUrl {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, platform: null, normalizedUrl: '', error: 'Paste a Twitch, Kick, or YouTube URL.' };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { valid: false, platform: null, normalizedUrl: trimmed, error: 'Invalid URL format.' };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const pathParts = url.pathname.split('/').filter(Boolean);

  // YouTube (youtube.com/watch?v=..., youtu.be/..., youtube.com/live/..., youtube.com/shorts/...)
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
    let videoId = '';
    if (host === 'youtu.be') {
      videoId = pathParts[0] || '';
    } else if (url.searchParams.get('v')) {
      videoId = url.searchParams.get('v') || '';
    } else if (pathParts[0] === 'live' || pathParts[0] === 'shorts' || pathParts[0] === 'embed') {
      videoId = pathParts[1] || '';
    }

    if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return {
        valid: false,
        platform: 'youtube',
        normalizedUrl: url.toString(),
        error: 'Could not find a valid YouTube video or livestream ID.',
      };
    }

    return {
      valid: true,
      platform: 'youtube',
      normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
    };
  }

  // Twitch (twitch.tv/videos/123456, twitch.tv/channel, clips.twitch.tv/Slug)
  if (host === 'twitch.tv' || host === 'm.twitch.tv' || host === 'clips.twitch.tv') {
    if (host === 'clips.twitch.tv' && pathParts[0]) {
      return {
        valid: true,
        platform: 'twitch',
        normalizedUrl: `https://clips.twitch.tv/${pathParts[0]}`,
        videoId: pathParts[0],
      };
    }
    if (pathParts[0] === 'videos' && pathParts[1]) {
      return {
        valid: true,
        platform: 'twitch',
        normalizedUrl: `https://www.twitch.tv/videos/${pathParts[1]}`,
        videoId: pathParts[1],
      };
    }
    if (pathParts[0] && pathParts[1] === 'clip' && pathParts[2]) {
      return {
        valid: true,
        platform: 'twitch',
        normalizedUrl: `https://www.twitch.tv/${pathParts[0]}/clip/${pathParts[2]}`,
        channelSlug: pathParts[0],
        videoId: pathParts[2],
      };
    }
    if (pathParts[0]) {
      return {
        valid: true,
        platform: 'twitch',
        normalizedUrl: `https://www.twitch.tv/${pathParts[0]}`,
        channelSlug: pathParts[0],
      };
    }
    return {
      valid: false,
      platform: 'twitch',
      normalizedUrl: url.toString(),
      error: 'Include a Twitch channel or VOD URL (e.g. twitch.tv/videos/12345).',
    };
  }

  // Kick (kick.com/channel, kick.com/channel/videos/uuid, kick.com/video/uuid)
  if (host === 'kick.com') {
    if ((pathParts[1] === 'videos' || pathParts[0] === 'video') && (pathParts[2] || pathParts[1])) {
      const videoId = pathParts[1] === 'videos' ? pathParts[2] : pathParts[1];
      return {
        valid: true,
        platform: 'kick',
        normalizedUrl: url.toString(),
        channelSlug: pathParts[1] === 'videos' ? pathParts[0] : undefined,
        videoId,
      };
    }
    if (pathParts[0]) {
      return {
        valid: true,
        platform: 'kick',
        normalizedUrl: `https://kick.com/${pathParts[0]}`,
        channelSlug: pathParts[0],
      };
    }
    return {
      valid: false,
      platform: 'kick',
      normalizedUrl: url.toString(),
      error: 'Include a Kick channel or stream URL (e.g. kick.com/xqc).',
    };
  }

  return {
    valid: false,
    platform: null,
    normalizedUrl: url.toString(),
    error: 'Supported platforms are Twitch, Kick, and YouTube.',
  };
}

export function formatTimecode(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

export function formatPreciseTimecode(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = (safe % 60).toFixed(1).padStart(4, '0');
  return `${String(mins).padStart(2, '0')}:${secs}`;
}

export function buildScanWindows(durationSeconds: number, maxWindowSeconds = 1200): ScanWindow[] {
  const safeDuration = Math.max(10, Math.floor(durationSeconds));
  if (safeDuration <= maxWindowSeconds) {
    return [
      {
        index: 0,
        label: 'Beginning',
        startSec: 0,
        endSec: safeDuration,
        durationSec: safeDuration,
      },
    ];
  }

  const chunk = Math.min(maxWindowSeconds, Math.floor(safeDuration / 3));
  const midStart = Math.max(0, Math.floor((safeDuration - chunk) / 2));
  const endStart = Math.max(0, safeDuration - chunk);

  return [
    {
      index: 0,
      label: 'Beginning',
      startSec: 0,
      endSec: chunk,
      durationSec: chunk,
    },
    {
      index: 1,
      label: 'Middle',
      startSec: midStart,
      endSec: midStart + chunk,
      durationSec: chunk,
    },
    {
      index: 2,
      label: 'End',
      startSec: endStart,
      endSec: safeDuration,
      durationSec: safeDuration - endStart,
    },
  ];
}

export function clampClipRange(
  startSec: number,
  endSec: number,
  totalDuration: number,
  minLengthSec = 3,
  maxLengthSec = 180
): { startSec: number; endSec: number } {
  const safeTotal = Math.max(minLengthSec, Number.isFinite(totalDuration) ? totalDuration : 60);
  let start = Math.max(0, Math.min(startSec, safeTotal - minLengthSec));
  let end = Math.min(safeTotal, Math.max(start + minLengthSec, endSec));
  if (end - start > maxLengthSec) {
    end = start + maxLengthSec;
  }
  return {
    startSec: Number(start.toFixed(2)),
    endSec: Number(end.toFixed(2)),
  };
}

export interface ExportResolutionSpec {
  quality: ExportQuality;
  label: string;
  shortLabel: string;
  description: string;
  width: number;
  height: number;
  fps: 60 | 30;
  crf: number;
  audioBitrate: string;
  x264Preset: 'superfast' | 'veryfast' | 'faster';
  maxrate?: string;
  bufsize?: string;
  gopSize?: number;
}

export const EXPORT_QUALITY_PRESETS: ExportQuality[] = [
  '1080p60',
  '720p60',
  'high-quality',
  'streaming-optimized',
  'small-file',
];

export function normalizeExportQuality(raw?: string): ExportQuality {
  if (raw && (EXPORT_QUALITY_PRESETS as string[]).includes(raw)) {
    return raw as ExportQuality;
  }
  return '1080p60';
}

export function getExportResolutionSpec(
  quality: ExportQuality,
  framing: ClipFramingMode
): ExportResolutionSpec {
  const isLandscape = framing === 'whole-clip';
  switch (quality) {
    case '720p60':
      return {
        quality,
        label: 'Standard 720p60',
        shortLabel: '720p60',
        description: 'Fast HD at 60fps · CRF 21',
        width: isLandscape ? 1280 : 720,
        height: isLandscape ? 720 : 1280,
        fps: 60,
        crf: 21,
        audioBitrate: '160k',
        x264Preset: 'superfast',
      };
    case 'high-quality':
      return {
        quality,
        label: 'High Quality (1080p60)',
        shortLabel: 'High Quality',
        description: 'Master crispness · CRF 16 · 256k audio',
        width: isLandscape ? 1920 : 1080,
        height: isLandscape ? 1080 : 1920,
        fps: 60,
        crf: 16,
        audioBitrate: '256k',
        x264Preset: 'faster',
      };
    case 'streaming-optimized':
      return {
        quality,
        label: 'Streaming Optimized (1080p60)',
        shortLabel: 'Streaming Optimized',
        description: '6 Mbps VBV · 2s keyframes for social feeds',
        width: isLandscape ? 1920 : 1080,
        height: isLandscape ? 1080 : 1920,
        fps: 60,
        crf: 21,
        audioBitrate: '160k',
        x264Preset: 'veryfast',
        maxrate: '6000k',
        bufsize: '12000k',
        gopSize: 120,
      };
    case 'small-file':
      return {
        quality,
        label: 'Small File Size (720p30)',
        shortLabel: 'Small File Size',
        description: 'Compact MP4 · 720p30 · CRF 27',
        width: isLandscape ? 1280 : 720,
        height: isLandscape ? 720 : 1280,
        fps: 30,
        crf: 27,
        audioBitrate: '112k',
        x264Preset: 'veryfast',
        maxrate: '2200k',
        bufsize: '4400k',
        gopSize: 60,
      };
    case '1080p60':
    default:
      return {
        quality: '1080p60',
        label: 'Standard 1080p60',
        shortLabel: '1080p60',
        description: 'Crisp Full HD at 60fps · CRF 20',
        width: isLandscape ? 1920 : 1080,
        height: isLandscape ? 1080 : 1920,
        fps: 60,
        crf: 20,
        audioBitrate: '192k',
        x264Preset: 'superfast',
      };
  }
}

export function buildFfmpegFilterGraph(options: {
  quality: ExportQuality;
  framing: ClipFramingMode;
  faceOffsetX?: number;
  assSubtitlePath?: string;
}): { filterComplex: string; outputMap: string; spec: ExportResolutionSpec } {
  const spec = getExportResolutionSpec(options.quality, options.framing);
  const { width, height, fps } = spec;
  const offset = Math.max(-0.45, Math.min(0.45, options.faceOffsetX ?? 0));
  const subtitleFilter = options.assSubtitlePath
    ? `,ass='${options.assSubtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")}'`
    : '';

  if (options.framing === 'whole-clip') {
    return {
      spec,
      filterComplex: `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${fps}${subtitleFilter}[vout]`,
      outputMap: '[vout]',
    };
  }

  if (options.framing === 'blur-fill') {
    const fgHeight = Math.round((width * 9) / 16);
    const evenFgHeight = fgHeight % 2 === 0 ? fgHeight : fgHeight - 1;
    return {
      spec,
      filterComplex: [
        `[0:v]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,boxblur=8:1,scale=${width}:${height}:flags=bilinear[bg]`,
        `[0:v]scale=${width}:${evenFgHeight}:force_original_aspect_ratio=decrease,pad=${width}:${evenFgHeight}:(ow-iw)/2:(oh-ih)/2:color=black[fg]`,
        `[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=${fps}${subtitleFilter}[vout]`,
      ].join(';'),
      outputMap: '[vout]',
    };
  }

  if (options.framing === 'split-screen') {
    const halfH = Math.floor(height / 2);
    const evenHalfH = halfH % 2 === 0 ? halfH : halfH - 1;
    // Top half: tighter facecam crop from upper-left/center; Bottom half: main action feed
    return {
      spec,
      filterComplex: [
        `[0:v]crop=iw*0.42:ih*0.52:iw*0.04:ih*0.06,scale=${width}:${evenHalfH}:force_original_aspect_ratio=increase,crop=${width}:${evenHalfH}[cam]`,
        `[0:v]scale=${width}:${evenHalfH}:force_original_aspect_ratio=increase,crop=${width}:${evenHalfH}[main]`,
        `[cam][main]vstack=inputs=2,scale=${width}:${height},fps=${fps}${subtitleFilter}[vout]`,
      ].join(';'),
      outputMap: '[vout]',
    };
  }

  // Default: 'crop' (9:16 vertical crop with optional faceOffsetX horizontal shift)
  const cropRatio = width / height;
  const xExpr =
    offset === 0
      ? '(iw-ow)/2'
      : `max(0,min(iw-ow,(iw-ow)/2+(iw*${offset.toFixed(3)})))`;
  return {
    spec,
    filterComplex: `[0:v]crop=ih*${cropRatio.toFixed(6)}:ih:${xExpr}:0,scale=${width}:${height}:flags=lanczos,fps=${fps}${subtitleFilter}[vout]`,
    outputMap: '[vout]',
  };
}

export function parseLocalAskCliprCommand(
  instruction: string,
  clip: Pick<ClipCandidate, 'startSec' | 'endSec' | 'framing' | 'faceTracking' | 'captionStyle'>,
  streamDuration: number
): AskCliprEditPatch {
  const lower = instruction.toLowerCase().trim();
  const patch: AskCliprEditPatch = { summary: '' };
  const notes: string[] = [];

  // Trim seconds off end: "trim 3s off the end", "cut 4 seconds from end", "end 2s earlier"
  const trimEndMatch = lower.match(/(?:trim|cut|shave|end)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)\s*(?:off|from)?\s*(?:the\s*)?(?:end|earlier)?/);
  if (trimEndMatch && (lower.includes('end') || lower.includes('earlier') || lower.includes('off'))) {
    const delta = parseFloat(trimEndMatch[1]);
    const nextRange = clampClipRange(clip.startSec, clip.endSec - delta, streamDuration);
    patch.endSec = nextRange.endSec;
    notes.push(`Trimmed ${delta}s off the end`);
  }

  // Trim/start earlier or later: "start 2s earlier", "add 3s to start"
  const startEarlierMatch = lower.match(/(?:start|begin|add)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)\s*(?:earlier|before|to\s*start)/);
  if (startEarlierMatch) {
    const delta = parseFloat(startEarlierMatch[1]);
    const nextRange = clampClipRange(clip.startSec - delta, clip.endSec, streamDuration);
    patch.startSec = nextRange.startSec;
    notes.push(`Started ${delta}s earlier`);
  }

  const trimStartMatch = lower.match(/(?:trim|cut|start)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)\s*(?:off\s*the\s*start|later|into)/);
  if (trimStartMatch) {
    const delta = parseFloat(trimStartMatch[1]);
    const nextRange = clampClipRange(clip.startSec + delta, clip.endSec, streamDuration);
    patch.startSec = nextRange.startSec;
    notes.push(`Trimmed ${delta}s off the start`);
  }

  // Framing modes
  if (lower.includes('split screen') || lower.includes('split-screen') || lower.includes('facecam')) {
    patch.framing = 'split-screen';
    notes.push('Switched framing to Split Screen');
  } else if (lower.includes('blur fill') || lower.includes('blur-fill') || lower.includes('blur')) {
    patch.framing = 'blur-fill';
    notes.push('Switched framing to Blur Fill');
  } else if (lower.includes('whole clip') || lower.includes('landscape') || lower.includes('16:9')) {
    patch.framing = 'whole-clip';
    notes.push('Switched framing to Whole Clip (16:9)');
  } else if (lower.includes('vertical') || lower.includes('9:16') || lower.includes('crop')) {
    patch.framing = 'crop';
    notes.push('Switched framing to Vertical Crop (9:16)');
  }

  // Face tracking
  if (lower.includes('face track') || lower.includes('track face') || lower.includes('face detect')) {
    patch.faceTracking = !lower.includes('off') && !lower.includes('disable');
    notes.push(patch.faceTracking ? 'Enabled Face Tracking' : 'Disabled Face Tracking');
  }

  // Captions
  if (lower.includes('caption') || lower.includes('subtitle')) {
    if (
      /(?:captions?|subtitles?)\s+(?:off|disabled?|none)|(?:turn\s+off|remove|disable|hide|no)\s+(?:the\s+)?(?:captions?|subtitles?)/i.test(
        lower
      )
    ) {
      patch.captionStyle = 'none';
      notes.push('Turned captions off');
    } else if (lower.includes('karaoke') || lower.includes('word')) {
      patch.captionStyle = 'karaoke';
      notes.push('Set captions to Karaoke word-by-word');
    } else if (lower.includes('bold')) {
      patch.captionStyle = 'bold';
      notes.push('Set captions to Bold');
    } else {
      patch.captionStyle = 'clean';
      notes.push('Enabled Clean captions');
    }
  }

  // Auto edit
  if (lower.includes('auto edit') || lower.includes('dead air') || lower.includes('silence')) {
    patch.runAutoEdit = true;
    notes.push('Queued Auto Edit silence trim');
  }

  // Quality
  if (lower.includes('high quality') || lower.includes('master')) {
    patch.recommendedQuality = 'high-quality';
    notes.push('Set export preset to High Quality');
  } else if (lower.includes('streaming optimized') || lower.includes('stream optimized')) {
    patch.recommendedQuality = 'streaming-optimized';
    notes.push('Set export preset to Streaming Optimized');
  } else if (lower.includes('small file') || lower.includes('compact') || lower.includes('smaller size')) {
    patch.recommendedQuality = 'small-file';
    notes.push('Set export preset to Small File Size');
  } else if (lower.includes('1080')) {
    patch.recommendedQuality = '1080p60';
    notes.push('Set export preset to 1080p60');
  } else if (lower.includes('720')) {
    patch.recommendedQuality = '720p60';
    notes.push('Set export preset to 720p60');
  }

  patch.summary = notes.length > 0 ? notes.join(' · ') : 'No direct timeline change detected.';
  return patch;
}

export function formatCaptionStyleLabel(style: CaptionStyle): string {
  switch (style) {
    case 'none':
      return 'Off';
    case 'clean':
      return 'Clean';
    case 'bold':
      return 'Bold';
    case 'karaoke':
      return 'Word-by-word';
  }
}

export function calculateRenderProgress(
  processedSec: number,
  totalSec: number,
  elapsedMs: number
): { percent: number; etaSec: number | null } {
  const safeTotal = Math.max(0.5, Number.isFinite(totalSec) ? totalSec : 1);
  const safeProcessed = Math.max(0, Math.min(safeTotal, Number.isFinite(processedSec) ? processedSec : 0));
  const rawPct = Math.round((safeProcessed / safeTotal) * 100);
  const percent = Math.min(99, Math.max(1, rawPct));

  let etaSec: number | null = null;
  if (safeProcessed >= 0.25 && elapsedMs >= 200) {
    const rate = safeProcessed / (elapsedMs / 1000);
    if (rate > 0.01) {
      etaSec = Number(Math.max(0, (safeTotal - safeProcessed) / rate).toFixed(1));
    }
  }

  return { percent, etaSec };
}

export function formatEtaSeconds(etaSec: number | null): string {
  if (etaSec === null || !Number.isFinite(etaSec)) {
    return 'Estimating time remaining...';
  }
  const rounded = Math.max(0, Math.ceil(etaSec));
  if (rounded === 0) {
    return 'Less than 1s remaining';
  }
  if (rounded < 60) {
    return `~${rounded}s remaining`;
  }
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `~${mins}m ${secs}s remaining`;
}

export function buildThumbnailCandidateTimestamps(
  startSec: number,
  endSec: number,
  count = 4
): number[] {
  const safeStart = Math.max(0, Number.isFinite(startSec) ? startSec : 0);
  const safeEnd = Math.max(safeStart + 1, Number.isFinite(endSec) ? endSec : safeStart + 5);
  const span = safeEnd - safeStart;
  const safeCount = Math.max(1, Math.min(8, Math.floor(count)));

  if (safeCount === 1) {
    return [Number((safeStart + span * 0.5).toFixed(2))];
  }

  const pad = Math.min(0.4, span * 0.12);
  const usable = Math.max(0.4, span - pad * 2);
  const result: number[] = [];
  for (let i = 0; i < safeCount; i++) {
    const ratio = safeCount === 1 ? 0.5 : i / (safeCount - 1);
    result.push(Number((safeStart + pad + usable * ratio).toFixed(2)));
  }
  return result;
}

export function wrapThumbnailTitle(
  rawTitle: string,
  maxCharsPerLine = 26,
  maxLines = 2
): string {
  const cleaned = rawTitle.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'CLIPRMAX HIGHLIGHT';

  const words = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const chunk = word.length > maxCharsPerLine ? `${word.slice(0, maxCharsPerLine - 1)}…` : word;
    if (!current) {
      current = chunk;
    } else if (current.length + 1 + chunk.length <= maxCharsPerLine) {
      current += ` ${chunk}`;
    } else {
      lines.push(current);
      current = chunk;
      if (lines.length === maxLines) {
        break;
      }
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (current && lines.length === maxLines) {
    const lastIdx = lines.length - 1;
    lines[lastIdx] = `${lines[lastIdx].slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd()}…`;
  }

  return lines.join('\n');
}
