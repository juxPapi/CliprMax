import React, { useMemo, useState } from 'react';
import { ArrowRight, Loader2, Search, Sparkles } from 'lucide-react';
import type { ClipCandidate, ClipCategory, ProjectRecord, StreamSource } from '../../shared/types';
import { buildScanWindows, formatTimecode } from '../../utils/clipMath';
import { PlatformBadgeIcon, platformLabel } from '../PlatformIcon';

interface ScanWorkspaceProps {
  stream: StreamSource;
  clips: ClipCandidate[];
  onClipsFound: (clips: ClipCandidate[], project?: ProjectRecord) => void;
  onOpenClipInEditor: (clip: ClipCandidate) => void;
  onChangeStream: () => void;
}

const CATEGORIES: ClipCategory[] = ['Funny', 'Hype', 'Hot Take', 'Story', 'Chat'];

export const ScanWorkspace: React.FC<ScanWorkspaceProps> = ({
  stream,
  clips,
  onClipsFound,
  onOpenClipInEditor,
  onChangeStream,
}) => {
  const windows = useMemo(() => buildScanWindows(stream.durationSeconds), [stream.durationSeconds]);
  const [selectedWindowIdx, setSelectedWindowIdx] = useState(0);
  const [scanMode, setScanMode] = useState<'guided' | 'quick-find'>('guided');
  const [selectedCategories, setSelectedCategories] = useState<ClipCategory[]>([
    'Funny',
    'Hype',
    'Hot Take',
  ]);
  const [quickQuery, setQuickQuery] = useState('');
  const [quickSegment, setQuickSegment] = useState<'Whole Stream' | 'Beginning' | 'Middle' | 'End'>(
    'Whole Stream'
  );

  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const activeWindow = windows[selectedWindowIdx] || windows[0];

  const toggleCategory = (cat: ClipCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? (prev.length > 1 ? prev.filter((c) => c !== cat) : prev) : [...prev, cat]
    );
  };

  const handleRunGuidedScan = async () => {
    setScanning(true);
    setErrorMsg(null);
    setStatusNote(null);
    try {
      const resp = await fetch('/api/scan/guided', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream,
          windowStartSec: activeWindow.startSec,
          windowEndSec: activeWindow.endSec,
          categories: selectedCategories,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Guided scan failed.');
      onClipsFound(data.clips || [], data.project);
      setStatusNote(
        data.aiEnhanced
          ? `Found ${(data.clips || []).length} clips with FFmpeg signal + Gemini highlight ranking.`
          : `Found ${(data.clips || []).length} clips via FFmpeg audio/scene peak detection.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Guided scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleRunQuickFind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) {
      setErrorMsg('Describe the moment you want Quick Find to locate.');
      return;
    }
    setScanning(true);
    setErrorMsg(null);
    setStatusNote(null);
    try {
      const resp = await fetch('/api/scan/quick-find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream,
          query: quickQuery.trim(),
          segment: quickSegment,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Quick Find failed.');
      if (data.clip) {
        onClipsFound([data.clip, ...clips], data.project);
        setStatusNote(`Quick Find queued "${data.clip.title}" in ${quickSegment}.`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Quick Find failed.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PlatformBadgeIcon platform={stream.platform} />
          <div>
            <p className="text-xs text-neutral-500">
              {stream.creatorName} <span aria-hidden="true">·</span> {platformLabel(stream.platform)}{' '}
              <span aria-hidden="true">·</span>{' '}
              <span className="font-mono-tabular">{formatTimecode(stream.durationSeconds)}</span>
            </p>
            <h1 className="font-display text-2xl font-bold text-[#0A0A0A]">{stream.title}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={onChangeStream}
          className="rounded-full border border-black/12 bg-white px-4 py-2 text-xs font-semibold text-[#0A0A0A] hover:bg-neutral-50"
        >
          Switch Stream
        </button>
      </div>

      {/* Main Scan Setup Grid */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Preview & Window Timeline */}
        <div className="rounded-3xl border border-black/10 bg-white p-6 lg:col-span-7">
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-neutral-950">
            {stream.previewUrl && !stream.previewUrl.includes('.m3u8') ? (
              <video
                src={stream.previewUrl}
                controls
                playsInline
                poster={stream.thumbnailUrl || undefined}
                className="h-full w-full object-contain"
              />
            ) : stream.thumbnailUrl ? (
              <img
                src={stream.thumbnailUrl}
                alt={stream.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                Stream preview ready for FFmpeg scan
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-neutral-700">
                Scan windows (up to 20 min each)
              </p>
              <span className="font-mono-tabular text-xs text-neutral-500">
                {formatTimecode(activeWindow.startSec)} – {formatTimecode(activeWindow.endSec)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {windows.map((win, idx) => {
                const active = idx === selectedWindowIdx;
                return (
                  <button
                    key={win.label}
                    type="button"
                    onClick={() => setSelectedWindowIdx(idx)}
                    className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                        : 'border-black/10 bg-[#FAFAF8] text-neutral-700 hover:border-black/25'
                    }`}
                  >
                    <p className="text-xs font-semibold">
                      Window {idx + 1} · {win.label}
                    </p>
                    <p
                      className={`mt-0.5 font-mono-tabular text-xs ${
                        active ? 'text-neutral-300' : 'text-neutral-500'
                      }`}
                    >
                      {formatTimecode(win.startSec)} – {formatTimecode(win.endSec)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Guided Scan vs Quick Find Controls */}
        <div className="rounded-3xl border border-black/10 bg-white p-6 lg:col-span-5">
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#F3F2EE] p-1">
            <button
              type="button"
              onClick={() => setScanMode('guided')}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                scanMode === 'guided' ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-neutral-600'
              }`}
            >
              Guided Scan
            </button>
            <button
              type="button"
              onClick={() => setScanMode('quick-find')}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                scanMode === 'quick-find' ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-neutral-600'
              }`}
            >
              Quick Find
            </button>
          </div>

          {scanMode === 'guided' ? (
            <div className="mt-6">
              <h2 className="font-display text-xl font-bold text-[#0A0A0A]">
                Find the best moments automatically
              </h2>
              <p className="mt-1.5 text-sm text-neutral-600">
                Scans audio peaks and scene cuts inside {activeWindow.label} to pull ready-to-edit clips.
              </p>

              <div className="mt-5">
                <p className="text-xs font-semibold text-neutral-700">Pick categories</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const active = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                          active
                            ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                            : 'border-black/10 bg-[#FAFAF8] text-neutral-700 hover:border-black/25'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={scanning}
                onClick={handleRunGuidedScan}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>{scanning ? 'Scanning Stream...' : 'Scan Selected Window'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleRunQuickFind} className="mt-6 space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-[#0A0A0A]">
                  Quick Find one moment
                </h2>
                <p className="mt-1.5 text-sm text-neutral-600">
                  Describe what happened and pick the part of the stream to search.
                </p>
              </div>

              <div>
                <label htmlFor="qf-query" className="block text-xs font-semibold text-neutral-700">
                  What happened?
                </label>
                <input
                  id="qf-query"
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="e.g. when chat freaked out over the boss fight"
                  className="mt-1.5 w-full rounded-xl border border-black/12 bg-[#FAFAF8] px-4 py-3 text-sm text-[#0A0A0A] placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-neutral-700">Where in the stream?</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['Whole Stream', 'Beginning', 'Middle', 'End'] as const).map((seg) => (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => setQuickSegment(seg)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        quickSegment === seg
                          ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                          : 'border-black/10 bg-[#FAFAF8] text-neutral-700 hover:border-black/25'
                      }`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={scanning}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>{scanning ? 'Searching Stream...' : 'Find & Cut Moment'}</span>
              </button>
            </form>
          )}

          {errorMsg && (
            <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              {errorMsg}
            </div>
          )}
          {statusNote && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
              {statusNote}
            </div>
          )}
        </div>
      </div>

      {/* Detected Clips Grid */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-[#0A0A0A]">
            Detected Clips ({clips.length})
          </h2>
        </div>

        {clips.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-10 text-center">
            <p className="text-sm font-medium text-neutral-700">No clips scanned from this stream yet.</p>
            <p className="mt-1 text-xs text-neutral-500">
              Run a Guided Scan or Quick Find above to extract highlight clips ready for 1080p60 export.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="flex flex-col justify-between rounded-2xl border border-black/10 bg-white p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                    <span>{clip.category}</span>
                    <span className="font-mono-tabular font-medium text-neutral-800">
                      {formatTimecode(clip.startSec)} – {formatTimecode(clip.endSec)}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-base font-bold text-[#0A0A0A]">
                    {clip.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">{clip.reason}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenClipInEditor(clip)}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0A0A0A] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
                >
                  <span>Edit & Export</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
