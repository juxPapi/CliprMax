import React from 'react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AccentColor, AppTheme } from './types';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: React.Dispatch<React.SetStateAction<AppTheme>>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>({
    mode: 'light',
    accentColor: 'maroon',
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.setProperty('--accent-color', getAccentColorValue(theme.accentColor));
  }, [theme]);

  const getAccentColorValue = (color: AccentColor): string => {
    const colors: Record<AccentColor, string> = {
      maroon: '#9146FF',
      emerald: '#10B981',
      amber: '#F59E0B',
      rose: '#F43F5E',
      indigo: '#4F46E5',
      sky: '#0EA5E9',
    };
    return colors[color];
  };

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, setTheme } },
    children
  );
}

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
