import { describe, it, expect } from 'vitest';
import type { CampaignPageTheme, PageHeaderSettings } from '@/lib/types';
import { resolveTheme, themeToCssVars, DEFAULT_THEME, getNormalizedHeaderButtons } from '../resolve-theme';

const theme: CampaignPageTheme = {
  id: 't1',
  organizationId: 'o1',
  name: 'Brandy',
  colors: { primary: '#111111', secondary: '#222222', background: '#fafafa', text: '#000000', accent: '#eeeeee' },
  typography: { headingFont: 'Sora', bodyFont: 'Sora', baseSize: '18px' },
  ui: { borderRadius: '0.5rem', buttonStyle: 'glow' },
};

describe('resolveTheme precedence', () => {
  it('falls back to defaults when nothing is provided', () => {
    expect(resolveTheme()).toEqual(DEFAULT_THEME);
  });

  it('uses theme values over defaults', () => {
    const r = resolveTheme({ theme });
    expect(r.colors.primary).toBe('#111111');
    expect(r.typography.headingFont).toBe('Sora');
    expect(r.ui.buttonStyle).toBe('glow');
  });

  it('uses branding over defaults but below theme', () => {
    const r = resolveTheme({ branding: { brandPrimaryColor: '#abcabc' } });
    expect(r.colors.primary).toBe('#abcabc');
    const r2 = resolveTheme({ theme, branding: { brandPrimaryColor: '#abcabc' } });
    expect(r2.colors.primary).toBe('#111111'); // theme wins over branding
  });

  it('uses per-page override above everything', () => {
    const r = resolveTheme({
      theme,
      branding: { brandPrimaryColor: '#abcabc' },
      overrides: { primary: '#ff0000', typography: { primaryFont: 'Outfit' } },
    });
    expect(r.colors.primary).toBe('#ff0000');
    expect(r.typography.headingFont).toBe('Outfit');
    expect(r.typography.bodyFont).toBe('Outfit');
  });

  it('ignores empty-string overrides', () => {
    const r = resolveTheme({ theme, overrides: { primary: '' } });
    expect(r.colors.primary).toBe('#111111');
  });

  describe('dark mode overrides', () => {
    it('overrides light backgrounds to dark default in dark theme mode', () => {
      const res = resolveTheme({
        overrides: { themeMode: 'dark', background: '#ffffff' }
      });
      expect(res.colors.background).toBe('#09090b');
    });

    it('overrides dark text to light default in dark theme mode', () => {
      const res = resolveTheme({
        theme: { ...theme, colors: { ...theme.colors, text: '#000000' } },
        overrides: { themeMode: 'dark' }
      });
      expect(res.colors.text).toBe('#f8fafc');
    });

    it('keeps custom dark backgrounds as-is in dark theme mode', () => {
      const res = resolveTheme({
        overrides: { themeMode: 'dark', background: '#1e293b' }
      });
      expect(res.colors.background).toBe('#1e293b');
    });

    it('keeps custom light text as-is in dark theme mode', () => {
      const res = resolveTheme({
        theme: { ...theme, colors: { ...theme.colors, text: '#e2e8f0' } },
        overrides: { themeMode: 'dark' }
      });
      expect(res.colors.text).toBe('#e2e8f0');
    });
  });
});

describe('themeToCssVars', () => {
  it('emits prefixed custom properties', () => {
    const vars = themeToCssVars(resolveTheme({ theme }));
    expect(vars['--pb-color-primary']).toBe('#111111');
    expect(vars['--pb-font-heading']).toBe('Sora');
    expect(vars['--pb-radius']).toBe('0.5rem');
  });
});

describe('getNormalizedHeaderButtons', () => {
  it('should map legacy header settings correctly when no buttons array exists', () => {
    const legacyHeader: PageHeaderSettings = {
      preset: 'native',
      overlap: false,
      sticky: false,
      floating: false,
      showSearch: false,
      showCta: true,
      ctaText: 'Apply Now',
      ctaUrl: '/apply',
      ctaLinkType: 'url',
      showPhone: false,
      navItems: []
    };
    const buttons = getNormalizedHeaderButtons(legacyHeader);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].label).toBe('Apply Now');
    expect(buttons[0].url).toBe('/apply');
    expect(buttons[0].style).toBe('primary');
  });

  it('should return empty list when showCta is false and buttons array is empty', () => {
    const header: PageHeaderSettings = {
      preset: 'native',
      overlap: false,
      sticky: false,
      floating: false,
      showSearch: false,
      showCta: false,
      showPhone: false,
      navItems: []
    };
    const buttons = getNormalizedHeaderButtons(header);
    expect(buttons).toHaveLength(0);
  });

  it('should return buttons array directly if populated', () => {
    const header: PageHeaderSettings = {
      preset: 'native',
      overlap: false,
      sticky: false,
      floating: false,
      showSearch: false,
      showCta: true,
      showPhone: false,
      navItems: [],
      buttons: [
        { id: 'b1', label: 'B1', style: 'outline', linkType: 'url', url: '/b1' },
        { id: 'b2', label: 'B2', style: 'ghost', linkType: 'scroll', targetSectionId: 'sec-2' }
      ]
    };
    const buttons = getNormalizedHeaderButtons(header);
    expect(buttons).toHaveLength(2);
    expect(buttons[0].id).toBe('b1');
    expect(buttons[0].style).toBe('outline');
    expect(buttons[1].id).toBe('b2');
    expect(buttons[1].style).toBe('ghost');
  });
});
