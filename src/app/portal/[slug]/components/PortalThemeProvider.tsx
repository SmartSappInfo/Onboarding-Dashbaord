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

/**
 * Safely reads stored portal theme preference from localStorage by slug or portalId.
 */
function readStoredTheme(slug?: string, id?: string): 'light' | 'dark' | null {
  if (typeof window === 'undefined') return null;
  try {
    if (slug) {
      const bySlug = localStorage.getItem(`portal_theme_${slug}`);
      if (bySlug === 'light' || bySlug === 'dark') return bySlug;
    }
    if (id) {
      const byId = localStorage.getItem(`portal_theme_${id}`);
      if (byId === 'light' || byId === 'dark') return byId;
    }
  } catch {
    // Ignore localStorage access errors (e.g. strict security / iframe)
  }
  return null;
}

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
  portalSlug?: string;
  theme: PortalThemeConfig;
  forcedMode?: 'light' | 'dark';
  className?: string;
  children: React.ReactNode;
}

export function PortalThemeProvider({
  portalId,
  portalSlug,
  theme,
  forcedMode,
  className,
  children,
}: PortalThemeProviderProps) {
  const policy = theme?.colorMode || 'user_choice';
  const canToggle = policy === 'user_choice' || policy === 'system';

  // ── Determine Initial Theme Mode (SSR Hydration Safe) ─────────────────────
  const [internalMode, setInternalMode] = React.useState<'light' | 'dark'>(() => {
    if (forcedMode) return forcedMode;
    if (policy === 'light') return 'light';
    if (policy === 'dark') return 'dark';

    // Synchronous client-side check of stored member preference
    if (canToggle) {
      const stored = readStoredTheme(portalSlug, portalId);
      if (stored) return stored;
    }

    // Only follow OS system preference if colorMode policy is explicitly 'system'
    if (policy === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Default to 'light' for clean, consistent initial experience without dark flicker
    return 'light';
  });

  // Client-side hydration from localStorage if portalId/portalSlug wasn't available at initial tick
  React.useEffect(() => {
    if (forcedMode || policy === 'light' || policy === 'dark') return;

    if (canToggle) {
      const stored = readStoredTheme(portalSlug, portalId);
      if (stored) {
        setInternalMode(stored);
        return;
      }
    }

    if (policy === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      setInternalMode(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
  }, [forcedMode, policy, portalId, portalSlug, canToggle]);

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

  // Listen to OS prefers-color-scheme changes ONLY when policy is explicitly 'system'
  React.useEffect(() => {
    if (forcedMode || policy !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setInternalMode(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [policy, forcedMode]);

  // Effective mode resolves forcedMode first, then internalMode
  const effectiveMode = forcedMode || internalMode;

  // ── Synchronize HTML Document and Body Classes (Eliminates Dark Flicker & Modal Inversion) ──
  React.useEffect(() => {
    // Never mutate document.documentElement if rendered inside Studio Preview Canvas
    if (forcedMode) return;
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    if (effectiveMode === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }

    root.setAttribute('data-portal-theme', effectiveMode);

    return () => {
      root.removeAttribute('data-portal-theme');
      body.classList.remove('dark');
    };
  }, [effectiveMode, forcedMode]);

  const setThemeMode = React.useCallback(
    (newMode: 'light' | 'dark') => {
      if (policy === 'light' || policy === 'dark') return; // Locked by policy
      setInternalMode(newMode);
      if (typeof window !== 'undefined' && canToggle) {
        try {
          if (portalSlug) {
            localStorage.setItem(`portal_theme_${portalSlug}`, newMode);
          }
          if (portalId) {
            localStorage.setItem(`portal_theme_${portalId}`, newMode);
          }
        } catch {
          // Ignore
        }
      }
    },
    [policy, portalId, portalSlug, canToggle]
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
