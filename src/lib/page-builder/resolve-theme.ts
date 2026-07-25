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

/**
 * Evaluate color brightness to determine if a hex/rgb color is light-contrast.
 * This is used to adjust colors dynamically in dark mode to preserve readability (XSS-safe).
 * 
 * CAUTION: Ensure valid input parsing; defaults to true if unparseable.
 */
export function isColorLight(hex: string): boolean {
  if (!hex || hex === 'transparent') return true;
  const color = hex.replace('#', '').trim();
  if (color.length === 3) {
    const r = parseInt(color[0] + color[0], 16);
    const g = parseInt(color[1] + color[1], 16);
    const b = parseInt(color[2] + color[2], 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128;
  } else if (color.length === 6) {
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128;
  }
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 128;
    }
  }
  return true;
}

export function resolveTheme(input: ResolveThemeInput = {}): ResolvedTheme {
  const { theme, overrides, branding } = input;
  const font = overrides?.typography?.primaryFont;
  const d = DEFAULT_THEME;

  const isDark = overrides?.themeMode === 'dark';
  const defaultBg = isDark ? '#09090b' : d.colors.background;
  const defaultText = isDark ? '#f8fafc' : d.colors.text;

  // Resolve raw candidates based on precedence: override > selected theme > org branding > default
  const resolvedBg = pick(overrides?.background, theme?.colors.background) ?? defaultBg;
  const resolvedText = pick(theme?.colors.text) ?? defaultText;
  const resolvedAccent = pick(overrides?.accent, theme?.colors.accent) ?? (isDark ? '#27272a' : d.colors.accent);

  return {
    colors: {
      primary: pick(overrides?.primary, theme?.colors.primary, branding?.brandPrimaryColor) ?? d.colors.primary,
      secondary: pick(overrides?.secondary, theme?.colors.secondary, branding?.brandSecondaryColor) ?? d.colors.secondary,
      // Adjust background, text, and accent dynamically in dark mode to prevent contrast clashes
      background: isDark ? (isColorLight(resolvedBg) ? '#09090b' : resolvedBg) : resolvedBg,
      text: isDark ? (isColorLight(resolvedText) ? resolvedText : '#f8fafc') : resolvedText,
      accent: isDark ? (isColorLight(resolvedAccent) ? '#27272a' : resolvedAccent) : resolvedAccent,
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
