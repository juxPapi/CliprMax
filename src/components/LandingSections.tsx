import React, { useState } from 'react';
import { ChevronDown, Crop, Layers, Scissors, Sparkles, Upload } from 'lucide-react';
import { CliprMaxLogo } from './ClipMaxLogo';
import { PlatformBadgeIcon } from './PlatformIcon';

interface LandingSectionsProps {
  onOpenStudioWithPlatform: (platform: 'twitch' | 'kick' | 'youtube' | 'upload') => void;
  onLoadSampleIntoStudio: (preset: 'irl' | 'gaming' | 'car') => void;
}

const FAQ_ITEMS = [
  {
    q: 'Is CliprMax free to use?',
    a: 'Yes. CliprMax is completely free to use right now with no paywall, no credit caps, and zero watermarks on 1080p60 and 720p60 exports.',
  },
  {
    q: 'What does CliprMax do?',
    a: 'CliprMax analyzes long Twitch, Kick, and YouTube VODs or uploaded videos, detects vocal spikes and visual moments, and formats vertical 9:16 clips with captions and 1080p60 or 720p60 export.',
  },
  {
    q: 'Which streams can I use?',
    a: 'Search any public Twitch or Kick creator to browse recent VODs, paste a YouTube link, or upload your own MP4, MOV, or WebM stream recording up to 8 hours.',
  },
  {
    q: 'What is Quick Find?',
    a: 'Describe one moment you remember in plain English—like when chat freaked out or the clutch win—and CliprMax locates that timestamp range and lines it up in the editor.',
  },
  {
    q: 'How fast does 1080p60 & 720p60 export run?',
    a: 'Exports are rendered server-side using multi-threaded H.264 FFmpeg pipelines at native 60 frames per second with zero watermarks and faststart MP4 streaming.',
  },
  {
    q: 'Can I edit the framing and captions?',
    a: 'Yes. Switch between 9:16 vertical crop, Blur Fill, Split Screen (facecam stacked above gameplay), or Whole Clip 16:9, adjust trim handles, or type plain-English commands into Ask CliprMax.',
  },
];

export const LandingSections: React.FC<LandingSectionsProps> = ({
  onOpenStudioWithPlatform,
  onLoadSampleIntoStudio,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [lang, setLang] = useState<'en' | 'es'>('en');

  return (
    <>
      {/* Section 1: Pick a stream */}
      <section id="story" className="mx-auto max-w-[1280px] px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-neutral-500">Pick a stream</p>
          <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-[#0A0A0A] sm:text-5xl">
            Search a streamer, paste a link, or upload.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            Search any Twitch or Kick streamer and pick a past stream, paste a YouTube link, or
            upload your own video directly into the clipping workspace.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => onOpenStudioWithPlatform('twitch')}
            className="group flex flex-col justify-between rounded-2xl border border-black/10 bg-white p-6 text-left transition-colors hover:border-black/25"
          >
            <div>
              <PlatformBadgeIcon platform="twitch" />
              <h3 className="mt-5 font-display text-xl font-bold text-[#0A0A0A]">Twitch VODs</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Search any creator handle to pull recent stream archives and thumbnails directly.
              </p>
            </div>
            <span className="mt-6 text-sm font-semibold text-[#0A0A0A] group-hover:underline">
              Search Twitch
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenStudioWithPlatform('kick')}
            className="group flex flex-col justify-between rounded-2xl border border-black/10 bg-white p-6 text-left transition-colors hover:border-black/25"
          >
            <div>
              <PlatformBadgeIcon platform="kick" />
              <h3 className="mt-5 font-display text-xl font-bold text-[#0A0A0A]">Kick Streams</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Load Kick channel profiles, live streams, and past VODs with one username lookup.
              </p>
            </div>
            <span className="mt-6 text-sm font-semibold text-[#0A0A0A] group-hover:underline">
              Search Kick
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenStudioWithPlatform('youtube')}
            className="group flex flex-col justify-between rounded-2xl border border-black/10 bg-white p-6 text-left transition-colors hover:border-black/25"
          >
            <div>
              <PlatformBadgeIcon platform="youtube" />
              <h3 className="mt-5 font-display text-xl font-bold text-[#0A0A0A]">YouTube Links</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Paste any YouTube video or livestream link to inspect metadata and extract clips.
              </p>
            </div>
            <span className="mt-6 text-sm font-semibold text-[#0A0A0A] group-hover:underline">
              Paste YouTube URL
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenStudioWithPlatform('upload')}
            className="group flex flex-col justify-between rounded-2xl border border-black/10 bg-white p-6 text-left transition-colors hover:border-black/25"
          >
            <div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-900">
                <Upload className="h-4 w-4" />
              </span>
              <h3 className="mt-5 font-display text-xl font-bold text-[#0A0A0A]">Local Recordings</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Drop an OBS recording in MP4, MOV, or WebM for immediate FFmpeg scene scanning.
              </p>
            </div>
            <span className="mt-6 text-sm font-semibold text-[#0A0A0A] group-hover:underline">
              Upload recording
            </span>
          </button>
        </div>
      </section>

      {/* Section 2: Guided Scan vs Quick Find */}
      <section id="scan" className="border-t border-black/8 bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-sm font-medium text-neutral-500">Scan</p>
              <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-[#0A0A0A] sm:text-5xl">
                Pick a window. CliprMax finds the moments.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-neutral-600">
                Choose up to 20 minutes of the stream—Beginning, Middle, or End. CliprMax detects
                audio loudness spikes and scene transitions, then cuts the moments worth posting.
              </p>

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-black/10 bg-[#FAFAF8] p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-[#0A0A0A]">Guided scan</h3>
                    <span className="text-xs font-semibold text-neutral-500">4–8 clips</span>
                  </div>
                  <p className="mt-1.5 text-sm text-neutral-600">
                    Finds the strongest reactions, hot takes, and funny exchanges across a 20-minute window.
                  </p>
                </div>

                <div className="rounded-2xl border border-black/10 bg-[#FAFAF8] p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-[#0A0A0A]">Quick Find</h3>
                    <span className="text-xs font-semibold text-neutral-500">1 exact clip</span>
                  </div>
                  <p className="mt-1.5 text-sm text-neutral-600">
                    Remember a specific moment? Describe it in your own words and jump straight to the cut.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-black/10 bg-[#FAFAF8] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4">
                  <div>
                    <p className="text-xs text-neutral-500">mira_live · Twitch Archive</p>
                    <p className="font-display text-xl font-bold text-[#0A0A0A]">
                      Set up your scan window
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLoadSampleIntoStudio('gaming')}
                    className="rounded-full bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 whitespace-nowrap"
                  >
                    Try this stream live
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-12">
                  <div className="md:col-span-7">
                    <div className="aspect-video overflow-hidden rounded-2xl border border-black/10 bg-neutral-900">
                      <img
                        src="/src/assets/images/stream_gaming_desk_1795467277418.jpg"
                        alt="Streamer laughing at studio microphone"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {['Beginning · 0:00', 'Middle · 18:20', 'End · 36:40'].map((lbl, i) => (
                        <div
                          key={lbl}
                          className={`rounded-xl border px-3 py-2 text-center font-mono-tabular text-xs font-medium ${
                            i === 0
                              ? 'border-[#9146FF] bg-[#F3EDFF] text-[#4C1D95]'
                              : 'border-black/8 bg-white text-neutral-600'
                          }`}
                        >
                          {lbl}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between md:col-span-5">
                    <div>
                      <p className="text-xs font-semibold text-neutral-500">Categories</p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {['Funny', 'Hype', 'Hot Take', 'Story', 'Chat'].map((cat, idx) => (
                          <span
                            key={cat}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                              idx < 3
                                ? 'border-neutral-900 bg-neutral-900 text-white'
                                : 'border-black/10 bg-white text-neutral-700'
                            }`}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4">
                      <p className="text-xs font-semibold text-neutral-900">
                        Window 1 of 3 · Beginning
                      </p>
                      <p className="mt-1 font-mono-tabular text-xs text-neutral-500">
                        0:00 – 20:00 · 60fps source
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Plain-English Edit & Fast 1080p60 / 720p60 Export */}
      <section id="cut" className="border-t border-black/8 bg-[#FAFAF8]">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-sm font-medium text-neutral-500">Edit & Export</p>
              <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-[#0A0A0A] sm:text-5xl">
                Fix it in plain English.
              </h2>
            </div>
            <p className="text-base leading-relaxed text-neutral-600 lg:col-span-7">
              Auto edit trims dead air automatically. Ask CliprMax handles natural-language edits
              like &ldquo;trim 3s off the end&rdquo; or &ldquo;switch to split screen&rdquo;,
              burns in word-by-word captions, and renders vertical MP4s free in 1080p60 or 720p60.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left card: AI Edit */}
            <div className="rounded-3xl border border-black/10 bg-white p-6 lg:col-span-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0A0A0A]">
                <Sparkles className="h-4 w-4" />
                <span>AI Edit</span>
              </div>
              <div className="mt-4 rounded-2xl border border-[#C9B0FF] bg-[#FAF7FF] p-4">
                <p className="text-sm font-semibold text-[#0A0A0A]">Auto edit</p>
                <p className="mt-1 text-xs text-neutral-600">
                  Cuts dead air and trailing silence via FFmpeg silencedetect.
                </p>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-neutral-700">Ask CliprMax</p>
                <div className="mt-2 rounded-full border border-black/12 bg-[#FAFAF8] px-4 py-2.5 text-xs text-neutral-500">
                  Try &ldquo;trim 3s off the end&rdquo;
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-black/10 bg-[#FAFAF8] p-3 text-center">
                  <Crop className="mx-auto h-4 w-4 text-neutral-700" />
                  <p className="mt-1.5 text-xs font-medium text-neutral-800">Face Track</p>
                </div>
                <div className="rounded-xl border border-black/10 bg-[#FAFAF8] p-3 text-center">
                  <Layers className="mx-auto h-4 w-4 text-neutral-700" />
                  <p className="mt-1.5 text-xs font-medium text-neutral-800">Split Screen</p>
                </div>
              </div>
            </div>

            {/* Center card: 16:9 Source + Trim */}
            <div className="rounded-3xl border border-black/10 bg-white p-6 lg:col-span-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold text-[#0A0A0A]">
                  Drive home storytime moment
                </p>
                <span className="font-mono-tabular text-xs text-neutral-500">0:06.5 / 0:30.6</span>
              </div>
              <div className="relative mt-4 aspect-video overflow-hidden rounded-2xl bg-neutral-900">
                <img
                  src="/src/assets/images/stream_creator_car_1795467277438.jpg"
                  alt="Creator recording inside car"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                {/* 9:16 crop guide */}
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[31.6%] -translate-x-1/2 border-x-2 border-white/90 bg-white/5" />
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5" />
                  Trim handles synced
                </span>
                <button
                  type="button"
                  onClick={() => onLoadSampleIntoStudio('car')}
                  className="font-semibold text-[#0A0A0A] hover:underline"
                >
                  Open in Editor
                </button>
              </div>
            </div>

            {/* Right card: Vertical Output & 1080p60 / 720p60 */}
            <div className="rounded-3xl border border-black/10 bg-white p-6 lg:col-span-4">
              <div className="flex items-center justify-between">
                <span className="font-mono-tabular text-xs font-semibold text-neutral-700">
                  1080p60 · 720p60
                </span>
                <button
                  type="button"
                  onClick={() => onLoadSampleIntoStudio('irl')}
                  className="rounded-full bg-[#0A0A0A] px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                >
                  Export Clip
                </button>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative aspect-[9/16] w-36 overflow-hidden rounded-2xl border border-black/10 bg-neutral-950 shrink-0">
                  <img
                    src="/src/assets/images/hero_irl_stream_1795467277292.jpg"
                    alt="Vertical 9:16 clip preview"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-2 bottom-4 rounded-md bg-black/70 px-2 py-1 text-center text-[11px] font-bold text-[#53FC18]">
                    WAIT FOR IT
                  </div>
                </div>
                <div className="space-y-2 text-xs font-medium text-neutral-700">
                  <div className="rounded-xl border border-black/10 bg-[#FAFAF8] px-3 py-2">
                    Crop 9:16
                  </div>
                  <div className="rounded-xl border border-black/10 bg-[#FAFAF8] px-3 py-2">
                    Blur Fill
                  </div>
                  <div className="rounded-xl border border-black/10 bg-[#FAFAF8] px-3 py-2">
                    Split Screen
                  </div>
                  <div className="rounded-xl border border-black/10 bg-[#FAFAF8] px-3 py-2">
                    Whole Clip
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: FAQ (Paywall removed — completely free for now) */}
      <section id="faq" className="border-t border-black/8 bg-white">
        <div className="mx-auto max-w-[900px] px-6 py-24">
          <p className="text-sm font-medium text-neutral-500">FAQ</p>
          <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-[#0A0A0A]">
            Questions, answered.
          </h2>

          <div className="mt-10 divide-y divide-black/10 border-y border-black/10">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left font-display text-lg font-semibold text-[#0A0A0A]"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-neutral-500 transition-transform duration-150 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="pb-5 text-sm leading-relaxed text-neutral-600">{item.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/8 bg-[#FAFAF8]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-6 px-6 py-8 text-sm text-neutral-500">
          <div className="flex flex-wrap items-center gap-4">
            <CliprMaxLogo markSize={22} textClassName="text-base" />
            <span aria-hidden="true">·</span>
            <span>{lang === 'en' ? '© 2026 CliprMax · Free Access' : '© 2026 CliprMax · Gratis'}</span>
            <span aria-hidden="true">·</span>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={lang === 'en' ? 'font-semibold text-[#0A0A0A]' : 'hover:text-[#0A0A0A]'}
              >
                English
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setLang('es')}
                className={lang === 'es' ? 'font-semibold text-[#0A0A0A]' : 'hover:text-[#0A0A0A]'}
              >
                Español
              </button>
            </div>
          </div>
          <a href="mailto:support@cliprmax.app" className="hover:text-[#0A0A0A]">
            support@cliprmax.app
          </a>
        </div>
      </footer>
    </>
  );
};
