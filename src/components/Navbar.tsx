import React from 'react';
import { ClipMaxLogo } from './ClipMaxLogo';

export type AppMode = 'landing' | 'studio';
export type StudioTab = 'pick' | 'scan' | 'editor' | 'projects';

interface NavbarProps {
  mode: AppMode;
  studioTab: StudioTab;
  onNavigateLanding: (anchorId?: string) => void;
  onOpenStudio: (tab?: StudioTab) => void;
  projectsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  mode,
  studioTab,
  onNavigateLanding,
  onOpenStudio,
  projectsCount,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-black/8 bg-[#FAFAF8]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: CliprMax brand mark */}
        <button
          type="button"
          onClick={() => onNavigateLanding()}
          aria-label="CliprMax home"
          className="inline-flex items-center text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900 rounded-md"
        >
          <ClipMaxLogo />
        </button>

        {/* Zone 2: 4 single-line navigation links */}
        {mode === 'landing' ? (
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-600" aria-label="Primary">
            <button
              type="button"
              onClick={() => onNavigateLanding('story')}
              className="hover:text-neutral-950 transition-colors whitespace-nowrap shrink-0"
            >
              Streams
            </button>
            <button
              type="button"
              onClick={() => onNavigateLanding('scan')}
              className="hover:text-neutral-950 transition-colors whitespace-nowrap shrink-0"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => onNavigateLanding('cut')}
              className="hover:text-neutral-950 transition-colors whitespace-nowrap shrink-0"
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => onNavigateLanding('faq')}
              className="hover:text-neutral-950 transition-colors whitespace-nowrap shrink-0"
            >
              FAQ
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2 sm:gap-6 text-sm font-medium text-neutral-600 overflow-x-auto" aria-label="Studio navigation">
            <button
              type="button"
              onClick={() => onOpenStudio('pick')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                studioTab === 'pick' ? 'bg-neutral-900 text-white' : 'hover:text-neutral-950'
              }`}
            >
              Pick Stream
            </button>
            <button
              type="button"
              onClick={() => onOpenStudio('scan')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                studioTab === 'scan' ? 'bg-neutral-900 text-white' : 'hover:text-neutral-950'
              }`}
            >
              Scan
            </button>
            <button
              type="button"
              onClick={() => onOpenStudio('editor')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                studioTab === 'editor' ? 'bg-neutral-900 text-white' : 'hover:text-neutral-950'
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => onOpenStudio('projects')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                studioTab === 'projects' ? 'bg-neutral-900 text-white' : 'hover:text-neutral-950'
              }`}
            >
              Projects ({projectsCount})
            </button>
          </nav>
        )}

        {/* Zone 3: 1 primary CTA */}
        <div className="shrink-0">
          {mode === 'landing' ? (
            <button
              type="button"
              onClick={() => onOpenStudio('pick')}
              className="rounded-full bg-[#0A0A0A] px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-150 ease-settle hover:bg-neutral-800 active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              Open Studio
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateLanding()}
              className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-neutral-50 whitespace-nowrap shrink-0"
            >
              Overview
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
