import React, { useState } from 'react';
import { ChevronRight, Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { ClipMaxMark } from './ClipMaxLogo';
import { PlatformBadgeIcon } from './PlatformIcon';

interface HeroSectionProps {
  onLaunchStudio: () => void;
  onScrollTo: (id: string) => void;
  onLoadSampleIntoStudio: (preset: 'irl' | 'gaming' | 'car') => void;
}

const SEGMENTS = [
  { label: '0:00', windowLabel: 'Beginning · 0:00 – 0:16', range: '0:00 – 0:16', progress: 14 },
  { label: '0:16', windowLabel: 'Rising · 0:16 – 0:32', range: '0:16 – 0:32', progress: 38 },
  { label: '0:32', windowLabel: 'Middle · 0:32 – 0:48', range: '0:32 – 0:48', progress: 64 },
  { label: '0:48', windowLabel: 'End · 0:48 – 1:04', range: '0:48 – 1:04', progress: 88 },
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  onLaunchStudio,
  onScrollTo,
  onLoadSampleIntoStudio,
}) => {
  const [activeSegIdx, setActiveSegIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const activeSeg = SEGMENTS[activeSegIdx];

  return (
    <section id="top" className="clipr-ambient-wash border-b border-black/8">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-12 lg:py-24">
        {/* Left: Interactive Stream Preview Card (exact cliprai.app hero anchor) */}
        <div className="lg:col-span-6">
          <div className="rounded-3xl border border-black/10 bg-white/90 p-3.5 shadow-[0_24px_64px_rgba(10,10,10,0.08)]">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-950">
              <img
                src="/src/assets/images/hero_irl_stream_1795467277292.jpg"
                alt="Downtown IRL stream preview frame"
                referrerPolicy="no-referrer"
                className={`h-full w-full object-cover transition-transform duration-500 ease-settle ${
                  playing ? 'scale-[1.03]' : 'scale-100'
                }`}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
              <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs font-medium text-white">
                <span className="font-mono-tabular rounded-md bg-black/60 px-2 py-1">
                  {activeSeg.range}
                </span>
                <span className="rounded-md bg-black/50 px-2 py-1">
                  1080p60 Ready
                </span>
              </div>
            </div>

            {/* Stream metadata row */}
            <div className="mt-3.5 flex items-center justify-between gap-3 px-1">
              <div className="flex min-w-0 items-center gap-3">
                <PlatformBadgeIcon platform="twitch" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#0A0A0A]">
                    DOWNTOWN KANSAS CITY IRL STREAM
                  </p>
                  <p className="text-xs text-neutral-500">
                    beaterbrandon <span aria-hidden="true">·</span> Twitch
                  </p>
                </div>
              </div>
              <span className="font-mono-tabular rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 shrink-0">
                1:04:27
              </span>
            </div>

            {/* Scrubber bar */}
            <div className="mt-4 px-1">
              <div className="relative h-1.5 w-full rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-[#9146FF] transition-all duration-200"
                  style={{ width: `${activeSeg.progress}%` }}
                />
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[#9146FF] bg-white shadow-sm transition-all duration-200"
                  style={{ left: `${activeSeg.progress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between font-mono-tabular text-[11px] text-neutral-500">
                <span>0:32:14</span>
                <span>0:48:20</span>
              </div>
            </div>

            {/* Player controls bar */}
            <div className="mt-3 flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? 'Pause preview' : 'Play preview'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 transition-colors hover:bg-neutral-200"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? 'Unmute preview' : 'Mute preview'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200"
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>

              <div className="rounded-full bg-[#EFEAFE] px-3 py-1.5 text-xs font-medium text-[#52279B]">
                Previewing {activeSeg.range}
              </div>

              <button
                type="button"
                onClick={() => onLoadSampleIntoStudio('irl')}
                aria-label="Open sample stream in studio"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 4-segment timeline switcher underneath */}
          <div className="mt-3 grid grid-cols-4 gap-1.5 rounded-2xl border border-black/10 bg-white/85 p-1.5 shadow-sm">
            {SEGMENTS.map((seg, idx) => {
              const active = idx === activeSegIdx;
              return (
                <button
                  key={seg.label}
                  type="button"
                  onClick={() => setActiveSegIdx(idx)}
                  className={`rounded-xl py-2.5 text-center font-mono-tabular text-xs font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-[#7A98FF] text-white shadow-sm'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {seg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Hero headline, concise summary, primary Studio CTA, and platform icons */}
        <div className="lg:col-span-6 lg:pl-4">
          <h1
            className="font-display text-5xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-6xl lg:text-[4.25rem] lg:leading-[1.03]"
            style={{ textWrap: 'balance' }}
          >
            Find the moments worth posting.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            CliprMax watches your Twitch and Kick streams, YouTube videos and uploads, finds the
            moments worth posting, and exports crisp vertical clips in 1080p60 and 720p60 —
            completely free, with zero watermarks.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onLaunchStudio}
              className="clipr-slide-track group inline-flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5 text-sm font-semibold text-[#0A0A0A] transition-transform duration-150 ease-settle hover:scale-[1.01] active:scale-[0.99]"
            >
              <ClipMaxMark size={40} className="rounded-full" />
              <span className="whitespace-nowrap">Launch CliprMax Studio</span>
              <ChevronRight className="h-4 w-4 text-neutral-500 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => onScrollTo('scan')}
              className="rounded-full bg-[#EAEAE6] px-5 py-3 text-sm font-semibold text-[#0A0A0A] transition-colors hover:bg-[#DFDFDA] whitespace-nowrap"
            >
              See how it works
            </button>
          </div>

          <div className="mt-7 flex items-center gap-3">
            <span className="text-sm text-neutral-500">Works with</span>
            <div className="flex items-center gap-2">
              <PlatformBadgeIcon platform="twitch" />
              <PlatformBadgeIcon platform="kick" />
              <PlatformBadgeIcon platform="youtube" />
              <PlatformBadgeIcon platform="upload" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
