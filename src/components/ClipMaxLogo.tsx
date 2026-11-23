import React, { useId } from 'react';

export type ClipMaxLogoVariant = 'razor' | 'aperture' | 'stack';

interface ClipMaxMarkProps {
  size?: number;
  variant?: ClipMaxLogoVariant;
  className?: string;
}

export const ClipMaxMark: React.FC<ClipMaxMarkProps> = ({
  size = 28,
  variant = 'razor',
  className = '',
}) => {
  const gradId = useId();

  if (variant === 'aperture') {
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="#0A0A0A" />
        <path
          d="M6.5 11.5V8.5C6.5 7.4 7.4 6.5 8.5 6.5H11.5"
          stroke="#9146FF"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M25.5 20.5V23.5C25.5 24.6 24.6 25.5 23.5 25.5H20.5"
          stroke="#53FC18"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="11.2" y="6.8" width="9.6" height="18.4" rx="2.4" fill="#FFFFFF" />
        <path d="M14.5 12.8L19 16L14.5 19.2V12.8Z" fill="#0A0A0A" />
      </svg>
    );
  }

  if (variant === 'stack') {
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="#0A0A0A" />
        <rect x="5.5" y="9" width="15" height="14" rx="2.5" fill="#2A2A32" stroke="#9146FF" strokeWidth="1.4" />
        <rect x="13" y="6" width="11.5" height="20" rx="2.6" fill="#FFFFFF" />
        <path d="M17 12.6L21.8 16L17 19.4V12.6Z" fill="#0A0A0A" />
        <circle cx="22.8" cy="8.2" r="1.5" fill="#53FC18" />
      </svg>
    );
  }

  // Default active CliprMax Razor Cut monogram + 60fps blade logo
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9146FF" />
          <stop offset="100%" stopColor="#53FC18" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0A0A0A" />
      <path
        d="M20.5 8.2C18.9 7.1 17 6.5 14.8 6.5C9.7 6.5 6 10.4 6 16C6 21.6 9.7 25.5 14.8 25.5C17 25.5 18.9 24.9 20.5 23.8L17.9 20.4C17 21 16 21.3 14.9 21.3C12.2 21.3 10.6 19.2 10.6 16C10.6 12.8 12.2 10.7 14.9 10.7C16 10.7 17 11 17.9 11.6L20.5 8.2Z"
        fill="#FFFFFF"
      />
      <path d="M19.5 11.2L27 16L19.5 20.8V11.2Z" fill={`url(#${gradId})`} />
    </svg>
  );
};

interface ClipMaxLogoProps {
  markSize?: number;
  variant?: ClipMaxLogoVariant;
  textClassName?: string;
}

export const ClipMaxLogo: React.FC<ClipMaxLogoProps> = ({
  markSize = 28,
  variant = 'razor',
  textClassName = 'text-lg',
}) => {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ClipMaxMark size={markSize} variant={variant} />
      <span className={`font-display font-bold tracking-tight text-[#0A0A0A] whitespace-nowrap ${textClassName}`}>
        CliprMax
      </span>
    </span>
  );
};

export const CliprMaxMark = ClipMaxMark;
export const CliprMaxLogo = ClipMaxLogo;
