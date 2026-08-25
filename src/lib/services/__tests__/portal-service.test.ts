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
});
