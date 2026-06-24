/**
 * Resolve a page's effective theme by merging, in precedence order:
 *   per-page override  >  selected theme  >  org branding  >  built-in default
 *
 * The renderer consumes the `ResolvedTheme` (never a raw `CampaignPageTheme`)
 * and emits it as CSS variables via `themeToCssVars`, so every block can read
 * `var(--pb-color-primary)` etc. regardless of where the value originated.
 */
import type { CampaignPage, CampaignPageTheme, ResolvedTheme } from '@/lib/types';

type ThemeOverrides = NonNullable<CampaignPage['settings']['themeOverrides']>;

export interface ResolveThemeInput {
  theme?: CampaignPageTheme | null;
  overrides?: ThemeOverrides | null;
  branding?: {
    brandPrimaryColor?: string;
    brandSecondaryColor?: string;
    brandFontFamily?: string;
  } | null;
}

export const DEFAULT_THEME: ResolvedTheme = {
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    background: '#ffffff',
    text: '#0f172a',
    accent: '#e2e8f0',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    baseSize: '16px',
  },
  ui: {
    borderRadius: '1rem',
    buttonStyle: 'flat',
  },
};

/** First non-empty string from the candidates, or `undefined`. */
function pick(...candidates: Array<string | undefined | null>): string | undefined {
  for (const value of candidates) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

export function resolveTheme(input: ResolveThemeInput = {}): ResolvedTheme {
  const { theme, overrides, branding } = input;
  const font = overrides?.typography?.primaryFont;
  const d = DEFAULT_THEME;

  return {
    colors: {
      primary: pick(overrides?.primary, theme?.colors.primary, branding?.brandPrimaryColor) ?? d.colors.primary,
      secondary: pick(overrides?.secondary, theme?.colors.secondary, branding?.brandSecondaryColor) ?? d.colors.secondary,
      background: pick(overrides?.background, theme?.colors.background) ?? d.colors.background,
      text: pick(theme?.colors.text) ?? d.colors.text,
      accent: pick(overrides?.accent, theme?.colors.accent) ?? d.colors.accent,
    },
    typography: {
      headingFont: pick(font, theme?.typography.headingFont, branding?.brandFontFamily) ?? d.typography.headingFont,
      bodyFont: pick(font, theme?.typography.bodyFont, branding?.brandFontFamily) ?? d.typography.bodyFont,
      baseSize: pick(theme?.typography.baseSize) ?? d.typography.baseSize,
    },
    ui: {
      borderRadius: pick(theme?.ui.borderRadius) ?? d.ui.borderRadius,
      buttonStyle: theme?.ui.buttonStyle ?? d.ui.buttonStyle,
    },
  };
}

/** Flatten a resolved theme into CSS custom properties (prefixed `--pb-`). */
export function themeToCssVars(theme: ResolvedTheme): Record<string, string> {
  return {
    '--pb-color-primary': theme.colors.primary,
    '--pb-color-secondary': theme.colors.secondary,
    '--pb-color-background': theme.colors.background,
    '--pb-color-text': theme.colors.text,
    '--pb-color-accent': theme.colors.accent,
    '--pb-font-heading': theme.typography.headingFont,
    '--pb-font-body': theme.typography.bodyFont,
    '--pb-font-size': theme.typography.baseSize,
    '--pb-radius': theme.ui.borderRadius,
  };
}
