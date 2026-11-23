import React, { useState } from 'react';
import { Film, Link2, Loader2, Search, Upload } from 'lucide-react';
import type { ProjectRecord, StreamSource } from '../../shared/types';
import { formatTimecode } from '../../utils/clipMath';
import { PlatformBadgeIcon, platformLabel } from '../PlatformIcon';

export type PickerPlatformTab = 'twitch' | 'kick' | 'youtube' | 'upload' | 'sample';

interface CreatorItem {
  platform: 'twitch' | 'kick';
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

interface StreamPickerProps {
  initialTab?: PickerPlatformTab;
  onSelectStream: (stream: StreamSource, project?: ProjectRecord) => void;
}

export const StreamPicker: React.FC<StreamPickerProps> = ({
  initialTab = 'twitch',
  onSelectStream,
}) => {
  const [tab, setTab] = useState<PickerPlatformTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [youtubeCookies, setYoutubeCookies] = useState('');
  const [showCookiesField, setShowCookiesField] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const [creators, setCreators] = useState<CreatorItem[]>([]);
  const [vods, setVods] = useState<StreamSource[]>([]);
  const [activeCreatorName, setActiveCreatorName] = useState<string | null>(null);

  const handleSearchTwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setWarningMsg(null);
    try {
      const resp = await fetch(`/api/streams/twitch/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Twitch search failed.');
      setCreators(data.creators || []);
      setVods([]);
      setActiveCreatorName(null);
      if ((data.creators || []).length === 0) {
        setErrorMsg(`No Twitch creators matched "${searchQuery.trim()}".`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Twitch search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTwitchVods = async (username: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const resp = await fetch(`/api/streams/twitch/vods?username=${encodeURIComponent(username)}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to load Twitch VODs.');
      setVods(data.vods || []);
      setActiveCreatorName(data.creator?.displayName || username);
      if ((data.vods || []).length === 0) {
        setErrorMsg(`${username} has no public archive VODs available.`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load Twitch VODs.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setWarningMsg(null);
    try {
      const resp = await fetch(`/api/streams/kick/channel?slug=${encodeURIComponent(searchQuery.trim())}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Kick channel lookup failed.');
      setCreators(data.creator ? [data.creator] : []);
      setVods(data.vods || []);
      setActiveCreatorName(data.creator?.displayName || searchQuery.trim());
      if ((data.vods || []).length === 0) {
        setErrorMsg(`No public VODs found for Kick channel "${searchQuery.trim()}".`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Kick lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setWarningMsg(null);
    try {
      const resp = await fetch('/api/streams/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          youtubeCookies: youtubeCookies.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Could not resolve stream URL.');
      if (data.warning) {
        setWarningMsg(data.warning);
      }
      onSelectStream(data.stream, data.project);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to resolve URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setErrorMsg(null);
    setWarningMsg(null);
    try {
      const form = new FormData();
      form.append('video', file);
      const resp = await fetch('/api/streams/upload', {
        method: 'POST',
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Upload failed.');
      onSelectStream(data.stream, data.project);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = async (preset: 'irl' | 'gaming' | 'car') => {
    setLoading(true);
    setErrorMsg(null);
    setWarningMsg(null);
    try {
      const resp = await fetch('/api/streams/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to load sample stream.');
      onSelectStream(data.stream, data.project);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load sample stream.');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseVod = async (vod: StreamSource) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream: vod }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to open VOD.');
      onSelectStream(vod, data.project);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to open VOD.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1160px] px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-neutral-500">Step 1</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-[#0A0A0A]">
            Pick a stream or upload a video
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Search Twitch or Kick creators, paste any stream link, upload a local recording, or run
            an instant 60fps trial stream.
          </p>
        </div>
      </div>

      {/* Platform Segmented Tabs */}
      <div
        role="tablist"
        aria-label="Stream source platform"
        className="mt-7 inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-black/10 bg-white p-1.5"
      >
        {(
          [
            { id: 'twitch', label: 'Twitch' },
            { id: 'kick', label: 'Kick' },
            { id: 'youtube', label: 'YouTube' },
            { id: 'upload', label: 'Upload Video' },
            { id: 'sample', label: 'Sample 60fps' },
          ] as Array<{ id: PickerPlatformTab; label: string }>
        ).map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(item.id);
                setErrorMsg(null);
                setWarningMsg(null);
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#0A0A0A] text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-[#0A0A0A]'
              }`}
            >
              <PlatformBadgeIcon platform={item.id} size="sm" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Source Panel */}
      <div className="mt-6 rounded-3xl border border-black/10 bg-white p-6 sm:p-8">
        {tab === 'twitch' && (
          <div>
            <form onSubmit={handleSearchTwitch} className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <label htmlFor="twitch-search" className="sr-only">
                  Search Twitch creator
                </label>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="twitch-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Twitch creator (e.g. kaicenat, pokimane, shroud)..."
                  className="w-full rounded-xl border border-black/12 bg-[#FAFAF8] py-3 pl-11 pr-4 text-sm text-[#0A0A0A] placeholder:text-neutral-400 focus:border-[#9146FF] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9146FF] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#7C2BF5] disabled:opacity-60 whitespace-nowrap"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Search Creators</span>
              </button>
            </form>

            <form onSubmit={handleResolveUrl} className="mt-4 flex flex-col gap-3 border-t border-black/8 pt-4 sm:flex-row">
              <div className="relative flex-1">
                <label htmlFor="twitch-url" className="sr-only">
                  Paste Twitch VOD URL
                </label>
                <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="twitch-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Or paste a Twitch VOD / Clip link (https://www.twitch.tv/videos/...)"
                  className="w-full rounded-xl border border-black/12 bg-[#FAFAF8] py-2.5 pl-11 pr-4 text-sm text-[#0A0A0A] placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-[#0A0A0A] hover:bg-neutral-50 whitespace-nowrap"
              >
                Load Link
              </button>
            </form>
          </div>
        )}

        {tab === 'kick' && (
          <div>
            <form onSubmit={handleSearchKick} className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <label htmlFor="kick-search" className="sr-only">
                  Kick channel username
                </label>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="kick-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter exact Kick username (e.g. xqc, adinross, trainwreckstv)..."
                  className="w-full rounded-xl border border-black/12 bg-[#FAFAF8] py-3 pl-11 pr-4 text-sm text-[#0A0A0A] placeholder:text-neutral-400 focus:border-[#175C05] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B0A0D] px-6 py-3 text-sm font-semibold text-[#53FC18] transition-colors hover:bg-neutral-800 disabled:opacity-60 whitespace-nowrap"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Load Kick VODs</span>
              </button>
            </form>

            <form onSubmit={handleResolveUrl} className="mt-4 flex flex-col gap-3 border-t border-black/8 pt-4 sm:flex-row">
              <div className="relative flex-1">
                <label htmlFor="kick-url" className="sr-only">
                  Paste Kick stream URL
                </label>
                <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="kick-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Or paste a Kick VOD link (https://kick.com/xqc/videos/...)"
                  className="w-full rounded-xl border border-black/12 bg-[#FAFAF8] py-2.5 pl-11 pr-4 text-sm text-[#0A0A0A] placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold text-[#0A0A0A] hover:bg-neutral-50 whitespace-nowrap"
              >
                Load Link
              </button>
            </form>
          </div>
        )}

        {tab === 'youtube' && (
          <form onSubmit={handleResolveUrl} className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <label htmlFor="youtube-url" className="sr-only">
                  Paste YouTube URL
                </label>
                <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="youtube-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste YouTube video or livestream link (https://www.youtube.com/watch?v=...)"
                  className="w-full rounded-xl border border-black/12 bg-[#FAFAF8] py-3 pl-11 pr-4 text-sm text-[#0A0A0A] placeholder:text-neutral-400 focus:border-[#E5173F] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5173F] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#C81235] disabled:opacity-60 whitespace-nowrap"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Load YouTube Video</span>
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowCookiesField((s) => !s)}
                className="text-xs font-medium text-neutral-600 hover:text-[#0A0A0A] underline"
              >
                {showCookiesField ? 'Hide optional YouTube cookies' : 'Optional: Add Netscape cookies.txt if YouTube blocks cloud IP'}
              </button>
              {showCookiesField && (
                <div className="mt-2">
                  <label htmlFor="yt-cookies" className="block text-xs font-medium text-neutral-600">
                    Netscape-format cookies (used only for yt-dlp extraction, never stored)
                  </label>
                  <textarea
                    id="yt-cookies"
                    rows={3}
                    value={youtubeCookies}
                    onChange={(e) => setYoutubeCookies(e.target.value)}
                    placeholder="# Netscape HTTP Cookie File..."
                    className="mt-1.5 w-full rounded-xl border border-black/12 bg-[#FAFAF8] p-3 font-mono text-xs text-[#0A0A0A]"
                  />
                </div>
              )}
            </div>
          </form>
        )}

        {tab === 'upload' && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/15 bg-[#FAFAF8] px-6 py-12 text-center">
            <Upload className="h-8 w-8 text-neutral-700" />
            <h2 className="mt-3 font-display text-lg font-bold text-[#0A0A0A]">
              Upload a local stream recording
            </h2>
            <p className="mt-1 max-w-md text-sm text-neutral-600">
              Supports MP4, MOV, WebM, and MKV up to 512 MB. Scanned and rendered directly at 1080p60 or 720p60.
            </p>
            <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0A0A0A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800">
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{loading ? 'Uploading & Probing...' : 'Choose Video File'}</span>
            </label>
          </div>
        )}

        {tab === 'sample' && (
          <div>
            <p className="text-sm text-neutral-600">
              Run a full FFmpeg highlight scan, Auto Edit, Ask CliprMax, and 1080p60 / 720p60 MP4 export immediately on a 60fps broadcast sample:
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  key: 'irl' as const,
                  title: 'Downtown Kansas City IRL',
                  creator: 'beaterbrandon · 60fps',
                  img: '/src/assets/images/hero_irl_stream_1795467277292.jpg',
                },
                {
                  key: 'gaming' as const,
                  title: 'Late Night Ranked Reactions',
                  creator: 'mira_live · 60fps',
                  img: '/src/assets/images/stream_gaming_desk_1795467277418.jpg',
                },
                {
                  key: 'car' as const,
                  title: 'Drive Home Storytime Q&A',
                  creator: 'nora_drives · 60fps',
                  img: '/src/assets/images/stream_creator_car_1795467277438.jpg',
                },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  disabled={loading}
                  onClick={() => handleLoadSample(s.key)}
                  className="group overflow-hidden rounded-2xl border border-black/10 bg-[#FAFAF8] text-left transition-colors hover:border-black/30 disabled:opacity-60"
                >
                  <div className="aspect-video w-full overflow-hidden bg-neutral-900">
                    <img
                      src={s.img}
                      alt={s.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-display text-base font-bold text-[#0A0A0A]">{s.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{s.creator}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}
        {warningMsg && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {warningMsg}
          </div>
        )}

        {/* Creator matches (Twitch / Kick) */}
        {creators.length > 0 && (
          <div className="mt-6 border-t border-black/8 pt-6">
            <h2 className="text-sm font-semibold text-neutral-700">Matching creators</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {creators.map((c) => (
                <button
                  key={`${c.platform}_${c.id}`}
                  type="button"
                  onClick={() =>
                    c.platform === 'twitch'
                      ? handleLoadTwitchVods(c.username)
                      : handleSearchKick({ preventDefault: () => {} } as React.FormEvent)
                  }
                  className="inline-flex items-center gap-3 rounded-2xl border border-black/10 bg-[#FAFAF8] px-4 py-2.5 text-left transition-colors hover:border-black/30"
                >
                  {c.avatarUrl ? (
                    <img
                      src={c.avatarUrl}
                      alt={c.displayName}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full object-cover bg-neutral-200"
                    />
                  ) : (
                    <PlatformBadgeIcon platform={c.platform} size="sm" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[#0A0A0A]">{c.displayName}</p>
                    <p className="text-xs text-neutral-500">
                      @{c.username} · {platformLabel(c.platform)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VOD results grid */}
        {vods.length > 0 && (
          <div className="mt-6 border-t border-black/8 pt-6">
            <h2 className="text-sm font-semibold text-neutral-700">
              Past streams {activeCreatorName ? `for ${activeCreatorName}` : ''}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vods.map((vod) => (
                <button
                  key={vod.id}
                  type="button"
                  onClick={() => handleChooseVod(vod)}
                  className="group overflow-hidden rounded-2xl border border-black/10 bg-[#FAFAF8] text-left transition-colors hover:border-black/30"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
                    {vod.thumbnailUrl ? (
                      <img
                        src={vod.thumbnailUrl}
                        alt={vod.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-neutral-400">
                        <Film className="h-8 w-8" />
                      </div>
                    )}
                    <span className="font-mono-tabular absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-0.5 text-xs font-medium text-white">
                      {formatTimecode(vod.durationSeconds)}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-2 text-sm font-bold text-[#0A0A0A]">{vod.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {vod.creatorName} <span aria-hidden="true">·</span> {platformLabel(vod.platform)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
