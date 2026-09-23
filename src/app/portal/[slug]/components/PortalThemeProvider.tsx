'use client';

/**
 * @fileOverview Independent Scoped Portal Theme Provider
 *
 * Provides isolated, dual-palette light/dark theme management for the public
 * portal runtime and studio preview canvas. Completely shields portal components
 * from admin dashboard theme leakage.
 *
 * Zero `any`, `any[]`, or `unknown` typing.
 *
 * MAINTAINER GUIDANCE (Rule 10):
 * - `forcedMode` allows PortalLivePreviewCanvas to simulate light/dark modes
 *   independent of both the admin's theme and the member's stored preference.
 * - `colorMode` policy from the portal owner ('user_choice' | 'light' | 'dark' | 'system')
 *   is strictly enforced: if owner locks to 'light' or 'dark', local storage is overridden.
 */

import * as React from 'react';
import type { PortalThemeConfig, PortalThemeColors } from '@/lib/types/portal';
import { DEFAULT_THEME } from '@/lib/portal-presets';
import {
  resolveActivePortalColors,
  resolvePortalThemeStyles,
} from '@/lib/utils/portal-theme-generator';
import { cn } from '@/lib/utils';

export interface PortalThemeContextValue {
  mode: 'light' | 'dark';
  theme: PortalThemeConfig;
  activeColors: PortalThemeColors;
  colorMode: 'user_choice' | 'light' | 'dark' | 'system';
  canToggle: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: 'light' | 'dark') => void;
}

const DEFAULT_FALLBACK_CONTEXT: PortalThemeContextValue = {
  mode: 'light',
  theme: DEFAULT_THEME,
  activeColors: DEFAULT_THEME.colors,
  colorMode: 'user_choice',
  canToggle: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
};

const PortalThemeContext = React.createContext<PortalThemeContextValue | null>(null);

export interface PortalThemeProviderProps {
  portalId?: string;
  theme: PortalThemeConfig;
  forcedMode?: 'light' | 'dark';
  className?: string;
  children: React.ReactNode;
}

export function PortalThemeProvider({
  portalId,
  theme,
  forcedMode,
  className,
  children,
}: PortalThemeProviderProps) {
  const policy = theme.colorMode || 'user_choice';
  const canToggle = policy === 'user_choice' || policy === 'system';

  // ── Determine Initial Theme Mode (SSR Hydration Safe) ─────────────────────
  const [internalMode, setInternalMode] = React.useState<'light' | 'dark'>(() => {
    if (forcedMode) return forcedMode;
    if (policy === 'light') return 'light';
    if (policy === 'dark') return 'dark';
    return 'light'; // Deterministic server-safe default
  });

  // Client-side hydration from localStorage or system preference
  React.useEffect(() => {
    if (forcedMode || policy === 'light' || policy === 'dark') return;

    if (portalId && canToggle) {
      try {
        const stored = localStorage.getItem(`portal_theme_${portalId}`);
        if (stored === 'light' || stored === 'dark') {
          setInternalMode(stored);
          return;
        }
      } catch {
        // Ignore localStorage errors (private browsing, quotas)
      }
    }

    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setInternalMode('dark');
    }
  }, [forcedMode, policy, portalId, canToggle]);

  // Keep internal mode synced with forcedMode if provided (e.g. Studio Canvas)
  React.useEffect(() => {
    if (forcedMode) {
      setInternalMode(forcedMode);
    }
  }, [forcedMode]);

  // Enforce portal owner policy strictly if locked to light or dark
  React.useEffect(() => {
    if (!forcedMode) {
      if (policy === 'light') {
        setInternalMode('light');
      } else if (policy === 'dark') {
        setInternalMode('dark');
      }
    }
  }, [policy, forcedMode]);

  // Listen to OS prefers-color-scheme changes when policy is system or fallback
  React.useEffect(() => {
    if (forcedMode || policy === 'light' || policy === 'dark') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    // Check if user has an explicit stored preference
    if (portalId && canToggle) {
      try {
        const stored = localStorage.getItem(`portal_theme_${portalId}`);
        if (stored) return; // User has explicitly chosen, don't auto-switch with OS
      } catch {
        // Ignore
      }
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setInternalMode(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [policy, portalId, forcedMode, canToggle]);

  // Effective mode resolves forcedMode first, then internalMode
  const effectiveMode = forcedMode || internalMode;

  const setThemeMode = React.useCallback(
    (newMode: 'light' | 'dark') => {
      if (policy === 'light' || policy === 'dark') return; // Locked by policy
      setInternalMode(newMode);
      if (typeof window !== 'undefined' && portalId && canToggle) {
        try {
          localStorage.setItem(`portal_theme_${portalId}`, newMode);
        } catch {
          // Ignore
        }
      }
    },
    [policy, portalId, canToggle]
  );

  const toggleTheme = React.useCallback(() => {
    const nextMode = effectiveMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  }, [effectiveMode, setThemeMode]);

  // Compute resolved active colors & CSS variables dictionary
  const activeColors = React.useMemo(
    () => resolveActivePortalColors(theme, effectiveMode),
    [theme, effectiveMode]
  );

  const themeStyles = React.useMemo(
    () => resolvePortalThemeStyles(theme, effectiveMode),
    [theme, effectiveMode]
  );

  const contextValue: PortalThemeContextValue = React.useMemo(
    () => ({
      mode: effectiveMode,
      theme,
      activeColors,
      colorMode: policy,
      canToggle,
      toggleTheme,
      setThemeMode,
    }),
    [effectiveMode, theme, activeColors, policy, canToggle, toggleTheme, setThemeMode]
  );

  return (
    <PortalThemeContext.Provider value={contextValue}>
      <div
        suppressHydrationWarning
        data-portal-theme={effectiveMode}
        className={cn(
          'portal-theme-root transition-colors duration-200 text-[var(--portal-text)] bg-[var(--portal-bg)]',
          effectiveMode === 'dark' ? 'dark' : '',
          className
        )}
        style={themeStyles}
      >
        {children}
      </div>
    </PortalThemeContext.Provider>
  );
}

/**
 * Hook to access the scoped portal theme context.
 * Returns safe fallback defaults if invoked outside a <PortalThemeProvider>
 * to prevent runtime crashes during hydration or isolated canvas rendering.
 */
export function usePortalTheme(): PortalThemeContextValue {
  const context = React.useContext(PortalThemeContext);
  return context || DEFAULT_FALLBACK_CONTEXT;
}
