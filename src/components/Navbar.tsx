import React, { useState } from 'react';
import { ClipMaxLogo } from './ClipMaxLogo';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../shared/theme';
import type { AppTheme, AccentColor } from '../shared/types';

export type AppMode = 'landing' | 'studio';
export type StudioTab = 'pick' | 'scan' | 'editor' | 'projects';


export interface NavbarProps {
  mode: AppMode;
  studioTab: StudioTab;
  onNavigateLanding: (anchorId?: string) => void;
  onOpenStudio: (tab?: StudioTab) => void;
  projectsCount: number;
}

const ACCENT_COLORS: AccentColor[] = ['maroon', 'emerald', 'amber', 'rose', 'indigo', 'sky'];

const ACCENT_LABELS: Record<AccentColor, string> = {
  maroon: 'Maroon',
  emerald: 'Emerald',
  amber: 'Amber',
  rose: 'Rose',
  indigo: 'Indigo',
  sky: 'Sky',
};

export const Navbar: React.FC<NavbarProps> = ({
  mode,
  studioTab,
  onNavigateLanding,
  onOpenStudio,
  projectsCount,
}) => {
  const { theme, setTheme } = useTheme();
  const [isAccentOpen, setIsAccentOpen] = useState(false);
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

        {/* Zone 3: Theme controls + CTA */}
        <div className="shrink-0 flex items-center gap-3">
          {/* Theme Mode Toggle */}
          <button
            type="button"
            onClick={() => setTheme({ ...theme, mode: theme.mode === 'light' ? 'dark' : 'light' })}
            aria-label="Toggle dark mode"
            className="rounded-full bg-[#FAFAF8] border border-black/10 px-3 py-2 text-sm text-[#0A0A0A] hover:bg-neutral-200 transition-colors"
          >
            {theme.mode === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* Accent Color Picker */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAccentOpen(!isAccentOpen);
              }}
              className="flex items-center gap-1.5 rounded-full border border-black/10 bg-[#FAFAF8] px-3 py-2 text-sm text-[#0A0A0A] hover:bg-neutral-200 transition-colors"
            >
              <div
                className={`w-3 h-3 rounded-full border border-white shadow-sm ${
                  theme.accentColor === 'maroon'
                    ? 'bg-[#9146FF]'
                    : theme.accentColor === 'emerald'
                    ? 'bg-[#10B981]'
                    : theme.accentColor === 'amber'
                    ? 'bg-[#F59E0B]'
                    : theme.accentColor === 'rose'
                    ? 'bg-[#F43F5E]'
                    : theme.accentColor === 'indigo'
                    ? 'bg-[#4F46E5]'
                    : 'bg-[#0EA5E9]'
                }`}
              />
              <svg
                className="w-3 h-3 text-neutral-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isAccentOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-black/10 bg-white p-2 shadow-lg z-50">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setTheme({ ...theme, accentColor: color })}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${theme.accentColor === color ? 'bg-[#0A0A0A] text-white' : 'bg-white text-neutral-700 hover:bg-neutral-100'}`}
                  >
                    <div className="w-3 h-3 rounded-full border border-white shadow-sm ${
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
                    }" />
                    <span>{ACCENT_LABELS[color]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
