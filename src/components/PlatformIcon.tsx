import React from 'react';
import { Film, Upload } from 'lucide-react';
import type { Platform } from '../shared/types';

interface PlatformIconProps {
  platform: Platform;
  size?: 'sm' | 'md';
}

export const PlatformBadgeIcon: React.FC<PlatformIconProps> = ({ platform, size = 'md' }) => {
  const dim = size === 'sm' ? 'w-6 h-6 rounded-md' : 'w-8 h-8 rounded-lg';

  if (platform === 'twitch') {
    return (
      <span
        className={`${dim} inline-flex items-center justify-center bg-[#9146FF] text-white shrink-0`}
        aria-label="Twitch"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M4.2 2L2 5.6v14.8h5.2V22h3.2l2.4-2.4h3.8L22 14.2V2H4.2zm15.8 11.2l-3 3h-4.4l-2.4 2.4v-2.4H5.8V4h14.2v9.2zM15.8 7.2h-2v5.2h2V7.2zm-5.2 0h-2v5.2h2V7.2z" />
        </svg>
      </span>
    );
  }

  if (platform === 'kick') {
    return (
      <span
        className={`${dim} inline-flex items-center justify-center bg-[#0B0A0D] text-[#53FC18] shrink-0`}
        aria-label="Kick"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
          <path d="M4 3h5v6.2L14.5 3H20l-6.4 7.6L20.5 21h-5.8L9 13.5V21H4V3z" />
        </svg>
      </span>
    );
  }

  if (platform === 'youtube') {
    return (
      <span
        className={`${dim} inline-flex items-center justify-center bg-[#E5173F] text-white shrink-0`}
        aria-label="YouTube"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15.1V8.9l5.2 3.1-5.2 3.1z" />
        </svg>
      </span>
    );
  }

  if (platform === 'sample') {
    return (
      <span
        className={`${dim} inline-flex items-center justify-center bg-neutral-900 text-white shrink-0`}
        aria-label="Sample Stream"
      >
        <Film className="w-3.5 h-3.5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className={`${dim} inline-flex items-center justify-center bg-neutral-200 text-neutral-800 shrink-0`}
      aria-label="Upload"
    >
      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
    </span>
  );
};

export function platformLabel(platform: Platform): string {
  switch (platform) {
    case 'twitch':
      return 'Twitch';
    case 'kick':
      return 'Kick';
    case 'youtube':
      return 'YouTube';
    case 'sample':
      return 'Sample 60fps';
    case 'upload':
      return 'Upload';
  }
}
