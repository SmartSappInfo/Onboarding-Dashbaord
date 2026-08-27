import { describe, it, expect } from 'vitest';
import { PortalService, PORTAL_MODE_PRESETS } from '../portal-service';
import type { PortalMode } from '../../types/portal';

describe('PortalService', () => {
  describe('Presets Catalog', () => {
    it('provides all 17 standard mode presets', () => {
      const presets = PortalService.listAllPresets();
      expect(presets.length).toBe(17);

      const presetIds = presets.map(p => p.id);
      expect(presetIds).toContain('academy');
      expect(presetIds).toContain('course');
      expect(presetIds).toContain('membership');
      expect(presetIds).toContain('community');
      expect(presetIds).toContain('classroom');
      expect(presetIds).toContain('documentation');
      expect(presetIds).toContain('knowledge_base');
      expect(presetIds).toContain('blog');
      expect(presetIds).toContain('news');
      expect(presetIds).toContain('resource_center');
      expect(presetIds).toContain('customer_academy');
      expect(presetIds).toContain('certification');
      expect(presetIds).toContain('coaching');
      expect(presetIds).toContain('product_training');
      expect(presetIds).toContain('internal_academy');
      expect(presetIds).toContain('waitlist');
      expect(presetIds).toContain('custom');
    });

    it('returns tailored preset configuration for academy mode', () => {
      const academyPreset = PortalService.getPresetConfiguration('academy');
      expect(academyPreset.id).toBe('academy');
      expect(academyPreset.name).toBe('Learning Academy');
      expect(academyPreset.defaultFeatures.enableCourses).toBe(true);
      expect(academyPreset.defaultFeatures.enableCommunity).toBe(true);
      expect(academyPreset.recommendedLayout).toBe('course_catalog');
      expect(academyPreset.defaultNavItems.length).toBeGreaterThan(0);
    });

    it('returns tailored preset configuration for documentation mode', () => {
      const docsPreset = PortalService.getPresetConfiguration('documentation');
      expect(docsPreset.id).toBe('documentation');
      expect(docsPreset.defaultFeatures.enableDocs).toBe(true);
      expect(docsPreset.defaultFeatures.enableCourses).toBe(false);
      expect(docsPreset.recommendedLayout).toBe('document_reader');
    });
  });

  describe('Slug Sanitization', () => {
    it('converts titles to clean kebab-case slugs', () => {
      expect(PortalService.sanitizeSlug('SmartSapp Academy')).toBe('smartsapp-academy');
      expect(PortalService.sanitizeSlug('Fee Collection 101: Masterclass & Q/A!')).toBe('fee-collection-101-masterclass-qa');
      expect(PortalService.sanitizeSlug('   leading and trailing spaces   ')).toBe('leading-and-trailing-spaces');
      expect(PortalService.sanitizeSlug('Multiple----Dashes---Here')).toBe('multiple-dashes-here');
      expect(PortalService.sanitizeSlug('Special @#$$% Characters')).toBe('special-characters');
    });
  });

  describe('Theme Token & Style Resolvers', () => {
    it('resolves CSS radius accurately for all presets', () => {
      expect(PortalService.getPortalRadiusCss('none')).toBe('0px');
      expect(PortalService.getPortalRadiusCss('sm')).toBe('0.375rem');
      expect(PortalService.getPortalRadiusCss('md')).toBe('0.75rem');
      expect(PortalService.getPortalRadiusCss('lg')).toBe('1rem');
      expect(PortalService.getPortalRadiusCss('full')).toBe('9999px');
      expect(PortalService.getPortalRadiusCss(undefined)).toBe('0.75rem');
    });

    it('generates valid Google Fonts URL', () => {
      const url = PortalService.getGoogleFontsUrl('Plus Jakarta Sans', 'Inter');
      expect(url).toContain('https://fonts.googleapis.com/css2?');
      expect(url).toContain('family=Plus+Jakarta+Sans');
      expect(url).toContain('family=Inter');
    });

    it('handles system fonts without unnecessary webfont calls', () => {
      const emptyUrl = PortalService.getGoogleFontsUrl('sans-serif', 'system-ui');
      expect(emptyUrl).toBe('');
    });

    it('resolves complete CSS variable dictionary for themes', () => {
      const themeVars = PortalService.getPortalThemeVariables({
        colorMode: 'light',
        colors: {
          primary: '#3B82F6',
          secondary: '#1E293B',
          accent: '#6366F1',
          background: '#FFFFFF',
          surface: '#F8FAFC',
          text: '#0F172A',
          mutedText: '#64748B',
          border: '#E2E8F0',
        },
        typography: {
          headingFont: 'Plus Jakarta Sans',
          bodyFont: 'Inter',
          baseSize: 'md',
        },
        ui: {
          borderRadius: 'lg',
          buttonStyle: 'glow',
        },
      });

      expect(themeVars['--portal-primary']).toBe('#3B82F6');
      expect(themeVars['--portal-radius']).toBe('1rem');
      expect(themeVars['--portal-heading-font']).toBe('Plus Jakarta Sans, sans-serif');
      expect(themeVars['--portal-body-font']).toBe('Inter, sans-serif');
    });

    it('computes correct button styles for flat, glow, glass, and pill presets', () => {
      const flat = PortalService.getPortalButtonInlineStyle('flat', '#10B981', '0.75rem');
      expect(flat.backgroundColor).toBe('#10B981');
      expect(flat.boxShadow).toBe('none');
      expect(flat.borderRadius).toBe('0.75rem');

      const glow = PortalService.getPortalButtonInlineStyle('glow', '#10B981', '0.75rem');
      expect(glow.boxShadow).toContain('0 0 20px #10B98166');

      const glass = PortalService.getPortalButtonInlineStyle('glass', '#10B981', '0.75rem');
      expect(glass.backdropFilter).toBe('blur(12px)');

      const pill = PortalService.getPortalButtonInlineStyle('pill', '#10B981', '0.75rem');
      expect(pill.borderRadius).toBe('9999px');
    });
  });
});
