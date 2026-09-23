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
  // Must return the exact same deterministic value on SSR and during initial client hydration
  const [internalMode, setInternalMode] = React.useState<'light' | 'dark'>(() => {
    if (forcedMode) return forcedMode;
    if (policy === 'light') return 'light';
    if (policy === 'dark') return 'dark';
    return 'light'; // Deterministic default ensuring server/client hydration match
  });

  // Client-side hydration from localStorage after mount
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

  // ── Resolve Portal Typography with Figtree as Standard Default ────────────
  const resolvedTheme = React.useMemo(() => {
    return {
      ...theme,
      typography: {
        ...theme?.typography,
        headingFont: theme?.typography?.headingFont || 'Figtree',
        bodyFont: theme?.typography?.bodyFont || 'Figtree',
      },
    };
  }, [theme]);

  // Compute resolved active colors & CSS variables dictionary
  const activeColors = React.useMemo(
    () => resolveActivePortalColors(resolvedTheme, effectiveMode),
    [resolvedTheme, effectiveMode]
  );

  const themeStyles = React.useMemo(
    () => resolvePortalThemeStyles(resolvedTheme, effectiveMode),
    [resolvedTheme, effectiveMode]
  );

  // ── Synchronize HTML Document and Body Classes & Variables (Fixes Dialog / Modal Portals) ──
  React.useEffect(() => {
    // Never mutate document.documentElement if rendered inside Studio Preview Canvas
    if (forcedMode || typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    if (effectiveMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.add('dark');
      body.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      body.classList.remove('dark');
      body.classList.add('light');
    }

    root.setAttribute('data-portal-theme', effectiveMode);

    // Synchronize portal CSS variables to root element so Radix UI Dialog portals inherit them
    const entries = Object.entries(themeStyles);
    for (const [prop, val] of entries) {
      if (typeof val === 'string') {
        root.style.setProperty(prop, val);
      }
    }

    return () => {
      root.removeAttribute('data-portal-theme');
      root.classList.remove('dark', 'light');
      body.classList.remove('dark', 'light');
      for (const [prop] of entries) {
        root.style.removeProperty(prop);
      }
    };
  }, [effectiveMode, forcedMode, themeStyles]);

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

  const contextValue: PortalThemeContextValue = React.useMemo(
    () => ({
      mode: effectiveMode,
      theme: resolvedTheme,
      activeColors,
      colorMode: policy,
      canToggle,
      toggleTheme,
      setThemeMode,
    }),
    [effectiveMode, resolvedTheme, activeColors, policy, canToggle, toggleTheme, setThemeMode]
  );

  return (
    <PortalThemeContext.Provider value={contextValue}>
      <div
        suppressHydrationWarning
        data-portal-theme={effectiveMode}
        className={cn(
          'portal-theme-root font-figtree transition-colors duration-200 text-[var(--portal-text)] bg-[var(--portal-bg)]',
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
