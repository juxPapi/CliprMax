export type Platform = 'twitch' | 'kick' | 'youtube' | 'upload' | 'sample';

export type ClipCategory = 'Funny' | 'Hype' | 'Hot Take' | 'Story' | 'Chat';

export type ClipFramingMode = 'crop' | 'blur-fill' | 'split-screen' | 'whole-clip';

export type ExportQuality =
  | '1080p60'
  | '720p60'
  | 'high-quality'
  | 'streaming-optimized'
  | 'small-file';

export type CaptionStyle = 'none' | 'clean' | 'bold' | 'karaoke';

export interface StreamSource {
  id: string;
  platform: Platform;
  title: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar?: string;
  thumbnailUrl: string;
  durationSeconds: number;
  sourceUrl: string;
  localFilePath?: string;
  previewUrl?: string;
  createdAt: string;
  width?: number;
  height?: number;
  fps?: number;
}

export interface ScanWindow {
  index: number;
  label: 'Beginning' | 'Middle' | 'End';
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface CaptionSegment {
  startSec: number;
  endSec: number;
  text: string;
}

export interface ClipCandidate {
  id: string;
  streamId: string;
  platform: Platform;
  creatorName: string;
  title: string;
  reason: string;
  category: ClipCategory;
  startSec: number;
  endSec: number;
  framing: ClipFramingMode;
  faceTracking: boolean;
  faceOffsetX: number; // -0.5 to 0.5 normalized horizontal pan offset
  captionStyle: CaptionStyle;
  captions: CaptionSegment[];
  sourceUrl: string;
  localFilePath?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  generatedThumbnail?: GeneratedThumbnailRecord;
  createdAt: string;
}

export interface ExportedClipRecord {
  id: string;
  clipId: string;
  title: string;
  platform: Platform;
  creatorName: string;
  quality: ExportQuality;
  framing: ClipFramingMode;
  captionStyle: CaptionStyle;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  fileSizeBytes: number;
  renderMs: number;
  downloadUrl: string;
  createdAt: string;
}

export interface GeneratedThumbnailRecord {
  thumbnailUrl: string;
  timestampSec: number;
  titleText: string;
  method: 'gemini-vision' | 'ffmpeg-keyframe';
  reason: string;
  warning?: string;
  width: number;
  height: number;
}

export interface ProjectRecord {
  id: string;
  stream: StreamSource;
  clips: ClipCandidate[];
  exports: ExportedClipRecord[];
  updatedAt: string;
}

export interface AskCliprEditPatch {
  summary: string;
  startSec?: number;
  endSec?: number;
  framing?: ClipFramingMode;
  faceTracking?: boolean;
  captionStyle?: CaptionStyle;
  recommendedQuality?: ExportQuality;
  runAutoEdit?: boolean;
}
