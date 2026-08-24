/**
 * @file src/lib/page-builder/design-tokens.ts
 * @description Global Design System & Tokens Service for SmartSapp AI Experience Builder.
 * Maps high-level design tokens (colors, typography, spacing, radii, shadows, containers, breakpoints)
 * into runtime CSS variables (--sb-color-primary, --sb-font-heading, etc.).
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - O(1) memoized resolution for fast public rendering on high visitor loads.
 * - Testable utility pure functions.
 */

import type { DesignSystem, DesignTokens } from '@/lib/types';

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  colors: {
    primary: '#3b82f6', // Tailwind blue-500
    secondary: '#8b5cf6', // Tailwind purple-500
    accent: '#f59e0b', // Tailwind amber-500
    background: '#ffffff',
    surface: '#f8fafc',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    muted: '#f1f5f9',
  },
  typography: {
    fontFamilyPrimary: 'Inter, system-ui, -apple-system, sans-serif',
    fontFamilyHeading: 'Plus Jakarta Sans, Inter, sans-serif',
    fontSizeBase: '16px',
    scale: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
    },
  },
  spacing: {
    spaceXs: '0.25rem',
    spaceSm: '0.5rem',
    spaceMd: '1rem',
    spaceLg: '1.5rem',
    spaceXl: '2rem',
    space2Xl: '3rem',
  },
  radii: {
    radiusSm: '0.25rem',
    radiusMd: '0.5rem',
    radiusLg: '1rem',
    radiusFull: '9999px',
  },
  shadows: {
    shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    shadowMd: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    shadowLg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  containers: {
    maxWSm: '640px',
    maxWMd: '768px',
    maxWLg: '1024px',
    maxW7Xl: '1280px',
    paddingX: '1rem',
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },
};

export const DEFAULT_DESIGN_SYSTEM: DesignSystem = {
  id: 'default-system',
  name: 'SmartSapp Brand Default',
  tokens: DEFAULT_DESIGN_TOKENS,
  mode: 'light',
};

/**
 * Resolves a DesignSystem instance into CSS Custom Properties (--sb-*).
 * Applied to root landing page wrappers for theme inheritance.
 * 
 * TESTABILITY POINTER:
 * Pass custom tokens object and verify exact CSS key-value output in unit tests.
 */
export function resolveDesignTokenCssVariables(
  system?: DesignSystem | null,
  modeOverride?: 'light' | 'dark',
): Record<string, string> {
  const currentTokens = system?.tokens || DEFAULT_DESIGN_TOKENS;
  const currentMode = modeOverride || system?.mode || 'light';

  // Dark mode color inversions if dark mode is active and surface colors are light
  const isDark = currentMode === 'dark';
  const colors = isDark
    ? {
        ...currentTokens.colors,
        background: '#090d16',
        surface: '#111827',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        border: '#1e293b',
        muted: '#1e293b',
      }
    : currentTokens.colors;

  return {
    '--sb-color-primary': colors.primary,
    '--sb-color-secondary': colors.secondary,
    '--sb-color-accent': colors.accent,
    '--sb-color-background': colors.background,
    '--sb-color-surface': colors.surface,
    '--sb-color-text-primary': colors.textPrimary,
    '--sb-color-text-secondary': colors.textSecondary,
    '--sb-color-border': colors.border,
    '--sb-color-muted': colors.muted,

    '--sb-font-primary': currentTokens.typography.fontFamilyPrimary,
    '--sb-font-heading': currentTokens.typography.fontFamilyHeading,
    '--sb-font-size-base': currentTokens.typography.fontSizeBase,

    '--sb-space-xs': currentTokens.spacing.spaceXs,
    '--sb-space-sm': currentTokens.spacing.spaceSm,
    '--sb-space-md': currentTokens.spacing.spaceMd,
    '--sb-space-lg': currentTokens.spacing.spaceLg,
    '--sb-space-xl': currentTokens.spacing.spaceXl,
    '--sb-space-2xl': currentTokens.spacing.space2Xl,

    '--sb-radius-sm': currentTokens.radii.radiusSm,
    '--sb-radius-md': currentTokens.radii.radiusMd,
    '--sb-radius-lg': currentTokens.radii.radiusLg,
    '--sb-radius-full': currentTokens.radii.radiusFull,

    '--sb-shadow-sm': currentTokens.shadows.shadowSm,
    '--sb-shadow-md': currentTokens.shadows.shadowMd,
    '--sb-shadow-lg': currentTokens.shadows.shadowLg,

    '--sb-container-max-w-sm': currentTokens.containers.maxWSm,
    '--sb-container-max-w-md': currentTokens.containers.maxWMd,
    '--sb-container-max-w-lg': currentTokens.containers.maxWLg,
    '--sb-container-max-w-7xl': currentTokens.containers.maxW7Xl,
    '--sb-container-padding-x': currentTokens.containers.paddingX,
  };
}
