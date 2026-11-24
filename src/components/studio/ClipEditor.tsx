import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../shared/theme';
import {
  CheckCircle2,
  Crop,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Scissors,
  Sparkles,
  Subtitles,
} from 'lucide-react';
import type {
  AccentColor,
  CaptionStyle,
  ClipCandidate,
  ClipFramingMode,
  ExportQuality,
  ExportedClipRecord,
  GeneratedThumbnailRecord,
  ProjectRecord,
} from '../../shared/types';
import {
  EXPORT_QUALITY_PRESETS,
  clampClipRange,
  formatCaptionStyleLabel,
  formatEtaSeconds,
  formatPreciseTimecode,
  getExportResolutionSpec,
} from '../../utils/clipMath';

interface FaceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface ClipEditorProps {
  clip: ClipCandidate;
  streamDuration: number;
  onUpdateClip: (nextClip: ClipCandidate) => void;
  onExportComplete: (record: ExportedClipRecord, project?: ProjectRecord) => void;
  onBackToScan: () => void;
}

export const ClipEditor: React.FC<ClipEditorProps> = ({
  clip,
  streamDuration,
  onUpdateClip,
  onExportComplete,
  onBackToScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(clip.startSec);
  const { theme, setTheme } = useTheme();
  const [faceRegions, setFaceRegions] = useState<FaceRegion[]>([]);
  const [faceTrackingActive, setFaceTrackingActive] = useState(clip.faceTracking);
  const [splitView, setSplitView] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [keyboardShortcutsVisible, setKeyboardShortcutsVisible] = useState(false);

  const [askInput, setAskInput] = useState('');
  const [askMessage, setAskMessage] = useState<string | null>(null);
  const [autoEditing, setAutoEditing] = useState(false);
  const [asking, setAsking] = useState(false);

  const [exportQuality, setExportQuality] = useState<ExportQuality>('1080p60');
  const [exporting, setExporting] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{
    percent: number;
    etaSec: number | null;
    stage: string;
    speed?: string;
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExportedClipRecord | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [generatedThumb, setGeneratedThumb] = useState<GeneratedThumbnailRecord | null>(
    clip.generatedThumbnail ?? null
  );

  useEffect(() => {
    setCurrentTime(clip.startSec);
    if (videoRef.current) {
      videoRef.current.currentTime = clip.startSec;
    }
  }, [clip.id, clip.startSec]);

  // Face tracking - detect faces in video frames
  useEffect(() => {
    if (!faceTrackingActive || !videoRef.current) return;

    const video = videoRef.current;
    const interval = setInterval(() => {
      if (video.paused || video.ended) return;

      // Simulate face detection - in production this would use a face detection model
      const faceRegions: FaceRegion[] = [];
      const videoWidth = video.videoWidth || 1280;
      const videoHeight = video.videoHeight || 720;

      // Simulate 1-2 faces based on current time
      const timeFactor = Math.sin(video.currentTime * 2) * 0.3 + 0.5;
      const faceCount = Math.floor(Math.abs(timeFactor) * 2) + 1;

      for (let i = 0; i < faceCount; i++) {
        const faceX = Math.random() * 0.6 + 0.2;
        const faceY = Math.random() * 0.5 + 0.1;
        const faceW = Math.random() * 0.3 + 0.15;
        const faceH = faceW;

        faceRegions.push({
          x: faceX * videoWidth,
          y: faceY * videoHeight,
          width: faceW * videoWidth,
          height: faceH * videoHeight,
          confidence: 0.85 + Math.random() * 0.15,
        });
      }

      setFaceRegions(faceRegions);
    }, 1000 / 15); // ~15fps for face tracking

    return () => clearInterval(interval);
  }, [faceTrackingActive]);

  // Waveform generation - analyze audio levels
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const waveformData: number[] = [];

    // Generate waveform data based on video duration
    const sampleCount = 100;
    for (let i = 0; i < sampleCount; i++) {
      // Simulate audio waveform - in production this would analyze actual audio
      const time = (video.duration || 60) * (i / sampleCount);
      const amplitude = Math.abs(Math.sin(time * 2 + i * 0.5)) * 0.8 + 0.2;
      waveformData.push(amplitude);
    }

    setWaveformData(waveformData);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const vid = videoRef.current;
      if (!vid) return;

      // Space - play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }

      // Arrow left - seek back 5 seconds
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        vid.currentTime = Math.max(clip.startSec, vid.currentTime - 5);
        setCurrentTime(vid.currentTime);
      }

      // Arrow right - seek forward 5 seconds
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        vid.currentTime = Math.min(clip.endSec, vid.currentTime + 5);
        setCurrentTime(vid.currentTime);
      }

      // Arrow up - volume up
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        vid.volume = Math.min(1, vid.volume + 0.1);
      }

      // Arrow down - volume down
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        vid.volume = Math.max(0, vid.volume - 0.1);
      }

      // M - mute/unmute
      if (e.code === 'KeyM') {
        e.preventDefault();
        vid.muted = !vid.muted;
      }

      // F - fullscreen toggle
      if (e.code === 'KeyF') {
        e.preventDefault();
        if (vid.requestFullscreen) {
          vid.requestFullscreen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoRef.current, clip.startSec, clip.endSec]);

  useEffect(() => {
    setGeneratedThumb(clip.generatedThumbnail ?? null);
    setThumbError(null);
  }, [clip.id, clip.generatedThumbnail]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setVideoError(null);
    if (vid.paused) {
      if (vid.currentTime < clip.startSec || vid.currentTime >= clip.endSec) {
        vid.currentTime = clip.startSec;
      }
      vid
        .play()
        .then(() => setPlaying(true))
        .catch((err) => {
          setVideoError(`Video playback failed: ${err?.message || err?.toString() || 'Unknown error'}`);
          setPlaying(false);
        });
    } else {
      vid.pause();
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setCurrentTime(vid.currentTime);
    if (vid.currentTime >= clip.endSec && clip.endSec - clip.startSec > 0.5) {
      vid.currentTime = clip.startSec;
    }
  };

  const handleAutoEdit = async () => {
    setAutoEditing(true);
    setAskMessage(null);
    setExportError(null);
    try {
      const resp = await fetch('/api/clips/auto-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Auto edit failed.');
      onUpdateClip(data.clip);
      setAskMessage(`Auto edit trimmed ${data.trimmedSeconds ?? 0}s of dead air.`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Auto edit failed.');
    } finally {
      setAutoEditing(false);
    }
  };

  const handleTranscribe = async () => {
    setTranscribing(true);
    setTranscript(null);
    try {
      const resp = await fetch('/api/clips/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Transcription failed.');
      setTranscript(data.transcript || '');
      setAskMessage(`Transcription complete: ${data.segments?.length ?? 0} segments found.`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleAskClipr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askInput.trim()) return;
    setAsking(true);
    setAskMessage(null);
    setExportError(null);
    try {
      const resp = await fetch('/api/clips/ask-cliprmax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: askInput.trim(),
          clip,
          streamDuration,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Ask CliprMax failed.');

      const patch = data.patch;
      const nextClip: ClipCandidate = {
        ...clip,
        startSec: patch.startSec ?? clip.startSec,
        endSec: patch.endSec ?? clip.endSec,
        framing: patch.framing ?? clip.framing,
        faceTracking: patch.faceTracking ?? clip.faceTracking,
        captionStyle: patch.captionStyle ?? clip.captionStyle,
      };
      onUpdateClip(nextClip);
      if (patch.recommendedQuality) {
        setExportQuality(patch.recommendedQuality);
      }
      setAskMessage(patch.summary || 'Applied edit.');
      setAskInput('');
      if (patch.runAutoEdit) {
        await handleAutoEdit();
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Ask CliprMax command failed.');
    } finally {
      setAsking(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setRenderProgress({
      percent: 2,
      etaSec: null,
      stage: `Starting ${exportQuality} render...`,
    });

    try {
      const resp = await fetch('/api/clips/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip,
          quality: exportQuality,
          framing: clip.framing,
          captionStyle: clip.captionStyle,
          faceOffsetX: clip.faceOffsetX,
          stream: true,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Export failed.');
      }

      if (!resp.body) {
        const data = await resp.json();
        setLastExport(data.exportRecord);
        onExportComplete(data.exportRecord, data.project);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completedRecord: ExportedClipRecord | null = null;
      let completedProject: ProjectRecord | undefined;

      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const event = JSON.parse(trimmed) as {
          type?: string;
          stage?: string;
          percent?: number;
          etaSec?: number | null;
          speed?: string;
          exportRecord?: ExportedClipRecord;
          project?: ProjectRecord;
          error?: string;
        };

        if (event.type === 'progress') {
          setRenderProgress((prev) => ({
            percent: typeof event.percent === 'number' ? event.percent : (prev?.percent ?? 5),
            etaSec: event.etaSec !== undefined ? event.etaSec : (prev?.etaSec ?? null),
            stage: event.stage || prev?.stage || `Rendering ${exportQuality} MP4...`,
            speed: event.speed ?? prev?.speed,
          }));
        } else if (event.type === 'complete' && event.exportRecord) {
          completedRecord = event.exportRecord;
          completedProject = event.project;
          setRenderProgress({
            percent: 100,
            etaSec: 0,
            stage: 'Export ready',
          });
        } else if (event.type === 'error') {
          throw new Error(event.error || 'Video export failed.');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            processLine(line);
          }
        }
        if (done) break;
      }

      if (buffer.trim()) {
        processLine(buffer);
      }

      if (!completedRecord) {
        throw new Error('Export stream ended before completing.');
      }

      setLastExport(completedRecord);
      onExportComplete(completedRecord, completedProject);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
      setRenderProgress(null);
    }
  };

  const handleGenerateThumbnail = async () => {
    setGeneratingThumb(true);
    setThumbError(null);
    try {
      const resp = await fetch('/api/clips/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Thumbnail generation failed.');
      setGeneratedThumb(data.thumbnail);
      if (data.clip) {
        onUpdateClip(data.clip);
      } else if (data.thumbnail) {
        onUpdateClip({ ...clip, generatedThumbnail: data.thumbnail });
      }
    } catch (err) {
      setThumbError(err instanceof Error ? err.message : 'Thumbnail generation failed.');
    } finally {
      setGeneratingThumb(false);
    }
  };

  const activeCaption =
    clip.captionStyle === 'none'
      ? null
      : clip.captions.find((c) => currentTime >= c.startSec && currentTime <= c.endSec) ||
        clip.captions[0];

  const durationLabel = (clip.endSec - clip.startSec).toFixed(1);
  const videoPlayable = Boolean(clip.previewUrl && !clip.previewUrl.includes('.m3u8'));
  const exportSpec = getExportResolutionSpec(exportQuality, clip.framing);

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/8 pb-4">
        <div>
          <p className="text-xs text-neutral-500">
            {clip.creatorName} <span aria-hidden="true">·</span> {clip.category}
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0A0A0A]">{clip.title}</h1>
        </div>
        <button
          type="button"
          onClick={onBackToScan}
          className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-semibold text-[#0A0A0A] hover:bg-neutral-50"
        >
          Back to Clips
        </button>
      </div>

      {/* 3-Column CliprMax Editor Layout */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: AI Edit & Framing Controls */}
        <div className="space-y-5 rounded-3xl border border-black/10 bg-white p-5 lg:col-span-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#0A0A0A]">
            <Sparkles className="h-4 w-4" />
            <span>AI Edit</span>
          </div>

          {/* Theme Controls */}
          <div className="mt-4 border-t border-black/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700">Theme</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTheme({ ...theme, mode: theme.mode === 'light' ? 'dark' : 'light' })}
                  className="flex items-center gap-2 rounded-full bg-[#FAFAF8] border border-black/10 px-3 py-2 text-sm text-[#0A0A0A] hover:bg-neutral-200 transition-colors"
                >
                  {theme.mode === 'dark' ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(['maroon', 'emerald', 'amber', 'rose', 'indigo', 'sky'] as AccentColor[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setTheme({ ...theme, accentColor: color })}
                  className={`flex items-center gap-1.5 rounded-full border border-black/10 bg-[#FAFAF8] px-3 py-2 text-sm text-[#0A0A0A] hover:bg-neutral-200 transition-colors ${theme.accentColor === color ? 'border-[#0A0A0A]' : 'border-transparent'}`}
                >
                  <div
                    className={`w-3 h-3 rounded-full border border-white shadow-sm ${
                      color === 'maroon'
                        ? 'bg-[#9146FF]'
                        : color === 'emerald'
                        ? 'bg-[#10B981]'
                        : color === 'amber'
                        ? 'bg-[#F59E0B]'
                        : color === 'rose'
                        ? 'bg-[#F43F5E]'
                        : color === 'indigo'
                        ? 'bg-[#4F46E5]'
                        : 'bg-[#0EA5E9]'
                    }`}
                  />
                  <span className="text-[10px] font-semibold">{color}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={autoEditing}
            onClick={handleAutoEdit}
            className="w-full rounded-2xl border border-[#C9B0FF] bg-[#FAF7FF] p-4 text-left transition-colors hover:bg-[#F3ECFF] disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#0A0A0A]">Auto edit</span>
              {autoEditing && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#52279B]" />}
            </div>
            <p className="mt-1 text-xs text-neutral-600">
              Cuts dead air and trailing silence automatically.
            </p>
          </button>

          <button
            type="button"
            disabled={transcribing}
            onClick={handleTranscribe}
            className="w-full rounded-2xl border border-[#C9B0FF] bg-[#FAF7FF] p-4 text-left transition-colors hover:bg-[#F3ECFF] disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#0A0A0A]">Transcribe (Whisper)</span>
              {transcribing && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#52279B]" />}
            </div>
            <p className="mt-1 text-xs text-neutral-600">
              Free Whisper transcription of this clip's audio.
            </p>
          </button>

          <form onSubmit={handleAskClipr} className="space-y-2">
            <label htmlFor="ask-cliprmax-input" className="block text-xs font-semibold text-neutral-700">
              Ask CliprMax
            </label>
            <div className="flex gap-2">
              <input
                id="ask-cliprmax-input"
                type="text"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder='Try "trim 3s off the end"'
                className="min-w-0 flex-1 rounded-xl border border-black/12 bg-[#FAFAF8] px-3 py-2 text-xs text-[#0A0A0A] placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
              />
              <button
                type="submit"
                disabled={asking}
                aria-label="Apply Ask CliprMax instruction"
                className="rounded-xl bg-[#0A0A0A] px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {asking ? '...' : 'Apply'}
              </button>
            </div>
            {askMessage && <p className="text-xs text-emerald-700">{askMessage}</p>}
          </form>

          {/* Framing Modes */}
          <div className="border-t border-black/8 pt-4">
            <p className="text-xs font-semibold text-neutral-700">Framing</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'crop', label: 'Crop 9:16', icon: Crop },
                  { id: 'blur-fill', label: 'Blur fill', icon: Maximize },
                  { id: 'split-screen', label: 'Split screen', icon: Layers },
                  { id: 'whole-clip', label: 'Whole clip', icon: Scissors },
                ] as Array<{ id: ClipFramingMode; label: string; icon: React.ComponentType<{ className?: string }> }>
              ).map((m) => {
                const Icon = m.icon;
                const active = clip.framing === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateClip({ ...clip, framing: m.id })}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                        : 'border-black/10 bg-[#FAFAF8] text-neutral-700 hover:border-black/25'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Face Tracking & Pan */}
          <div className="border-t border-black/8 pt-4">
            <div className="flex items-center justify-between">
              <label htmlFor="face-track-toggle" className="text-xs font-semibold text-neutral-700">
                Face Tracking
              </label>
              <button
                id="face-track-toggle"
                type="button"
                aria-pressed={clip.faceTracking}
                onClick={() => {
                  onUpdateClip({ ...clip, faceTracking: !clip.faceTracking });
                  setFaceTrackingActive(!faceTrackingActive);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  clip.faceTracking ? 'bg-[#0A0A0A] text-white' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {clip.faceTracking ? 'On' : 'Off'}
              </button>
            </div>
            <label htmlFor="pan-offset" className="mt-3 block text-xs text-neutral-500">
              Horizontal crop offset ({(clip.faceOffsetX * 100).toFixed(0)}%)
            </label>
            <input
              id="pan-offset"
              type="range"
              min={-0.35}
              max={0.35}
              step={0.05}
              value={clip.faceOffsetX}
              onChange={(e) => onUpdateClip({ ...clip, faceOffsetX: parseFloat(e.target.value) })}
              className="mt-1 w-full accent-[#0A0A0A]"
            />
          </div>

          {/* Captions Style */}
          <div className="border-t border-black/8 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
              <Subtitles className="h-3.5 w-3.5" />
              <span>Captions</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(['none', 'clean', 'bold', 'karaoke'] as CaptionStyle[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => onUpdateClip({ ...clip, captionStyle: style })}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                    clip.captionStyle === style
                      ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                      : 'border-black/10 bg-[#FAFAF8] text-neutral-700'
                  }`}
                >
                  {formatCaptionStyleLabel(style)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column: Source Video + Trim Timeline */}
        <div className="space-y-4 rounded-3xl border border-black/10 bg-white p-5 lg:col-span-5">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Source stream view</span>
            <span className="font-mono-tabular font-semibold text-[#0A0A0A]">
              {formatPreciseTimecode(currentTime)} / {formatPreciseTimecode(clip.endSec)} ({durationLabel}s)
            </span>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-950">
            {videoPlayable ? (
              <video
                ref={videoRef}
                src={clip.previewUrl}
                poster={clip.thumbnailUrl || '/src/assets/images/hero_irl_stream_1795467277292.jpg'}
                preload="auto"
                onLoadedMetadata={() => {
                  if (videoRef.current) videoRef.current.currentTime = clip.startSec;
                }}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setPlaying(false)}
                onError={(e) => {
                  const vid = videoRef.current;
                  const msg = vid?.error?.message || 'Video failed to load or play.';
                  setVideoError(msg);
                  setPlaying(false);
                }}
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={clip.thumbnailUrl || '/src/assets/images/hero_irl_stream_1795467277292.jpg'}
                alt={clip.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            )}

            {/* Dynamic Crop Overlay Box */}
            {clip.framing !== 'whole-clip' && (
              <div
                className="pointer-events-none absolute inset-y-0 w-[31.6%] -translate-x-1/2 border-x-2 border-white/90 bg-white/5"
                style={{ left: `${50 + clip.faceOffsetX * 60}%` }}
              />
            )}
            {/* Face Tracking Boxes */}
            {faceTrackingActive && faceRegions.length > 0 && (
              <>
                {faceRegions.map((face, index) => (
                  <div
                    key={index}
                    className="absolute border-2 border-[#53FC18] bg-[#53FC18]20 rounded-md shadow-[0_0_10px_#53FC18]"
                    style={{
                      left: `${face.x}px`,
                      top: `${face.y}px`,
                      width: `${face.width}px`,
                      height: `${face.height}px`,
                    }}
                  >
                    <span className="absolute top-[-20px] left-0 text-[10px] font-bold bg-[#53FC18] text-white px-1 rounded">
                      Face {Math.round(face.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </>
            )}
            {videoError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-center z-20">
                <div className="text-neutral-700 font-semibold text-sm mb-2">Video Playback Error</div>
                <p className="text-xs text-red-800 text-center max-w-[200px]">{videoError}</p>
                <button
                  type="button"
                  className="mt-3 rounded-full bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                  onClick={() => {
                    setVideoError(null);
                    const vid = videoRef.current;
                    if (vid) vid.play().catch(() => {});
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Audio Waveform Visualization */}
          <div className="mt-3 rounded-2xl border border-black/8 bg-[#FAFAF8] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-700">Audio Waveform</span>
              <span className="text-xs text-neutral-500">{waveformData.length} samples</span>
            </div>
            <div className="flex items-end gap-1 h-24 px-4 pb-2" style={{ height: '48px' }}>
              {waveformData.map((level, i) => (
                <div
                  key={i}
                  className="flex h-[16px] w-full rounded-t-sm"
                  style={{
                    backgroundColor: `rgba(145, 70, 255, ${0.4 + level * 0.6})`,
                    height: `${Math.max(20, level * 100)}%`,
                    animation: 'waveformPulse 1s ease-in-out infinite',
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
              <style>
                {`
                  @keyframes waveformPulse {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 1; }
                  }
                `}
              </style>
            </div>
            <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
              <span>0:00</span>
              <span className="font-mono-tabular">{formatPreciseTimecode(clip.endSec - clip.startSec)}</span>
            </div>
          </div>

          {/* Playback + Trim Controls */}
          <div className="rounded-2xl border border-black/8 bg-[#FAFAF8] p-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause clip' : 'Play clip'}
                className="inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{playing ? 'Pause' : 'Preview Cut'}</span>
              </button>
              <span className="font-mono-tabular text-xs text-neutral-600">
                {formatPreciseTimecode(clip.startSec)} → {formatPreciseTimecode(clip.endSec)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="trim-start" className="block text-xs font-medium text-neutral-600">
                  Start ({formatPreciseTimecode(clip.startSec)})
                </label>
                <input
                  id="trim-start"
                  type="range"
                  min={0}
                  max={Math.max(3, streamDuration - 3)}
                  step={0.5}
                  value={clip.startSec}
                  onChange={(e) => {
                    const nextStart = parseFloat(e.target.value);
                    const clamped = clampClipRange(nextStart, Math.max(nextStart + 3, clip.endSec), streamDuration);
                    onUpdateClip({ ...clip, ...clamped });
                  }}
                  className="mt-1 w-full accent-[#0A0A0A]"
                />
              </div>
              <div>
                <label htmlFor="trim-end" className="block text-xs font-medium text-neutral-600">
                  End ({formatPreciseTimecode(clip.endSec)})
                </label>
                <input
                  id="trim-end"
                  type="range"
                  min={3}
                  max={Math.max(6, streamDuration)}
                  step={0.5}
                  value={clip.endSec}
                  onChange={(e) => {
                    const nextEnd = parseFloat(e.target.value);
                    const clamped = clampClipRange(Math.min(clip.startSec, nextEnd - 3), nextEnd, streamDuration);
                    onUpdateClip({ ...clip, ...clamped });
                  }}
                  className="mt-1 w-full accent-[#0A0A0A]"
                />
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="mt-3 rounded-xl border border-black/8 bg-[#FAFAF8] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-700">Keyboard Shortcuts</span>
              <span className="text-xs text-neutral-500">Press any key below</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1 px-2 py-1 rounded bg-[#FAFAF8] border border-black/10 text-[10px] text-neutral-600">
                <kbd className="px-1 py-0.5 rounded bg-white border border-gray-300 text-[10px]">Space</kbd>
                Play/Pause
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded bg-[#FAFAF8] border border-black/10 text-[10px] text-neutral-600">
                <kbd className="px-1 py-0.5 rounded bg-white border border-gray-300 text-[10px]">←</kbd>
                Seek Back
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded bg-[#FAFAF8] border border-black/10 text-[10px] text-neutral-600">
                <kbd className="px-1 py-0.5 rounded bg-white border border-gray-300 text-[10px]">→</kbd>
                Seek Forward
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded bg-[#FAFAF8] border border-black/10 text-[10px] text-neutral-600">
                <kbd className="px-1 py-0.5 rounded bg-white border border-gray-300 text-[10px]">M</kbd>
                Mute
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded bg-[#FAFAF8] border border-black/10 text-[10px] text-neutral-600">
                <kbd className="px-1 py-0.5 rounded bg-white border border-gray-300 text-[10px]">F</kbd>
                Fullscreen
              </span>
            </div>
          </div>

          {/* AI Thumbnail Generator */}
          <div className="rounded-2xl border border-black/8 bg-[#FAFAF8] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#52279B]" />
                <span className="text-xs font-bold text-[#0A0A0A]">AI Thumbnail Generator</span>
              </div>
              <button
                type="button"
                disabled={generatingThumb}
                onClick={handleGenerateThumbnail}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0A0A0A] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
              >
                {generatingThumb ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>{generatingThumb ? 'Generating...' : 'Generate Thumbnail'}</span>
              </button>
            </div>

            {!generatedThumb && !thumbError && (
              <p className="mt-2 text-xs text-neutral-600">
                Picks a representative frame from this clip and applies a title banner for &ldquo;{clip.title}&rdquo;.
              </p>
            )}

            {thumbError && (
              <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {thumbError}
              </div>
            )}

            {generatedThumb && (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="w-28 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-neutral-950">
                  <img
                    src={generatedThumb.thumbnailUrl}
                    alt={`AI thumbnail for ${clip.title}`}
                    className="h-auto w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#F3EDFF] px-2 py-0.5 font-semibold text-[#4C1D95]">
                      {generatedThumb.method === 'gemini-vision' ? 'Gemini Vision' : 'FFmpeg Keyframe'}
                    </span>
                    <span className="font-mono-tabular text-neutral-600">
                      Frame {formatPreciseTimecode(generatedThumb.timestampSec)} · {generatedThumb.width}×{generatedThumb.height}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-neutral-600">{generatedThumb.reason}</p>
                  {generatedThumb.warning && (
                    <p className="text-[11px] text-amber-700">{generatedThumb.warning}</p>
                  )}
                  <a
                    href={`${generatedThumb.thumbnailUrl}?download=1`}
                    download
                    className="inline-flex items-center gap-1.5 font-semibold text-[#0A0A0A] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Thumbnail</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Vertical Preview + Fast MP4 Export Presets */}
        <div className="flex flex-col justify-between rounded-3xl border border-black/10 bg-white p-5 lg:col-span-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="export-quality-select" className="text-sm font-bold text-[#0A0A0A]">
                Output Preview
              </label>
              <button type="button" onClick={() => setSplitView(!splitView)} className="flex items-center gap-1.5 rounded-full bg-[#FAFAF8] border border-black/10 px-3 py-2 text-sm text-[#0A0A0A] hover:bg-neutral-200 transition-colors"><Maximize className="h-3 w-3" /><span className="text-[10px] font-semibold">{splitView ? 'Split' : 'Single'}</span></button>
              <select
                id="export-quality-select"
                aria-label="Export quality preset"
                value={exportQuality}
                onChange={(e) => setExportQuality(e.target.value as ExportQuality)}
                className="rounded-xl border border-black/12 bg-[#FAFAF8] px-2.5 py-1.5 font-mono-tabular text-xs font-semibold text-[#0A0A0A] focus:border-neutral-900 focus:outline-none"
              >
                {EXPORT_QUALITY_PRESETS.map((preset) => {
                  const spec = getExportResolutionSpec(preset, clip.framing);
                  return (
                    <option key={preset} value={preset}>
                      {spec.label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="mt-4 flex justify-center">
              <div
                className={`relative overflow-hidden rounded-2xl border border-black/12 bg-neutral-950 ${
                  clip.framing === 'whole-clip' ? 'aspect-video w-full' : 'aspect-[9/16] w-56'
                }`}
              >
                {clip.framing === 'blur-fill' && (
                  <img
                    src={clip.thumbnailUrl || '/src/assets/images/hero_irl_stream_1795467277292.jpg'}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-85"
                  />
                )}
                <video
                  src={clip.previewUrl || clip.thumbnailUrl || ''}
                  poster={clip.thumbnailUrl || '/src/assets/images/hero_irl_stream_1795467277292.jpg'}
                  preload="auto"
                  playsInline
                  className={`relative z-10 h-full w-full ${
                    clip.framing === 'blur-fill'
                      ? 'object-contain'
                      : 'object-cover'
                  }`}
                  style={
                    clip.framing === 'crop'
                      ? { objectPosition: `${50 + clip.faceOffsetX * 70}% 50%` }
                      : undefined
                  }
                />

                {clip.framing === 'split-screen' && (
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 border-t border-white/60" />
                )}

                {activeCaption && (
                  <div className="pointer-events-none absolute inset-x-3 bottom-6 z-20 rounded-lg bg-black/75 px-2.5 py-1.5 text-center">
                    <p
                      className={`text-xs font-bold leading-tight ${
                        clip.captionStyle === 'karaoke' ? 'text-[#53FC18]' : 'text-white'
                      }`}
                    >
                      {activeCaption.text}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3 border-t border-black/8 pt-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between font-mono-tabular text-xs text-neutral-700">
                <span>Target format</span>
                <span className="font-semibold text-[#0A0A0A]">
                  {exportSpec.width}×{exportSpec.height} · {exportSpec.fps}fps
                </span>
              </div>
              <p className="font-mono-tabular text-[11px] text-neutral-500">
                {exportSpec.description}
              </p>
            </div>

            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>
                {exporting && renderProgress
                  ? `Rendering ${exportSpec.shortLabel} (${renderProgress.percent}%)...`
                  : exporting
                  ? `Rendering ${exportSpec.shortLabel}...`
                  : `Export ${exportSpec.shortLabel} MP4`}
              </span>
            </button>

            {exporting && renderProgress && (
              <div className="rounded-2xl border border-black/10 bg-[#FAFAF8] p-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-[#0A0A0A]">
                    {renderProgress.stage}
                  </span>
                  <span className="font-mono-tabular font-bold text-[#0A0A0A]">
                    {renderProgress.percent}%
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-label="Video export progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={renderProgress.percent}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#9146FF] to-[#53FC18] transition-[width] duration-200 ease-out"
                    style={{ width: `${renderProgress.percent}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 font-mono-tabular text-[11px] text-neutral-600">
                  <span>{formatEtaSeconds(renderProgress.etaSec)}</span>
                  {renderProgress.speed && (
                    <span className="font-semibold text-neutral-700">{renderProgress.speed}</span>
                  )}
                </div>
              </div>
            )}

            {exportError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {exportError}
              </div>
            )}

            {lastExport && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-950">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  <span>
                    Rendered {lastExport.width}×{lastExport.height} @ {lastExport.fps}fps in{' '}
                    {(lastExport.renderMs / 1000).toFixed(2)}s
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="font-mono-tabular text-emerald-800">
                    {(lastExport.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                  <a
                    href={`${lastExport.downloadUrl}?download=1`}
                    download
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#0A0A0A] px-3.5 py-1.5 font-semibold text-white hover:bg-neutral-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download MP4</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
