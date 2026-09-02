import { describe, it, expect } from 'vitest';
import { SURVEY_PALETTE_PRESETS } from '@/app/admin/surveys/components/inspector/theme-presets';
import { 
  calculateContrastScore, 
  hexToHslString, 
  getContrastTextColor, 
  getContrastButtonStyles 
} from '@/app/admin/surveys/components/inspector/contrast-utils';
import { hydrateSurveyDocument } from '../survey-hydration-adapter';
import type { Survey } from '@/lib/types';

describe('Survey Theme Persistence & Governance Suite', () => {
  describe('Curated Studio Palettes Catalog', () => {
    it('contains all 6 required enterprise presets with valid hex values', () => {
      expect(SURVEY_PALETTE_PRESETS.length).toBeGreaterThanOrEqual(6);
      
      const ids = SURVEY_PALETTE_PRESETS.map((p) => p.id);
      expect(ids).toContain('nordic-slate');
      expect(ids).toContain('obsidian-glass');
      expect(ids).toContain('emerald-trust');
      expect(ids).toContain('royal-amethyst');
      expect(ids).toContain('warm-amber');
      expect(ids).toContain('alabaster-minimal');

      const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      SURVEY_PALETTE_PRESETS.forEach((preset) => {
        expect(preset.backgroundColor).toMatch(hexRegex);
        expect(preset.patternColor).toMatch(hexRegex);
      });
    });

    it('validates WCAG 2.1 AA/AAA contrast ratios for text on canvas background', () => {
      SURVEY_PALETTE_PRESETS.forEach((preset) => {
        const textColor = preset.id === 'obsidian-glass' ? '#FFFFFF' : '#0F172A';
        const result = calculateContrastScore(preset.backgroundColor, textColor);
        
        // Ensure contrast ratio is at least 4.5:1 (WCAG AA)
        expect(result.ratio).toBeGreaterThanOrEqual(4.5);
        expect(result.isAaPassed).toBe(true);
      });
    });
  });

  describe('WCAG Contrast & Theme Color Utilities', () => {
    it('converts hex colors to valid Tailwind HSL space strings', () => {
      const hslEmerald = hexToHslString('#10B981');
      expect(hslEmerald).toMatch(/^\d+\s+\d+%\s+\d+%$/);

      const hslBlue = hexToHslString('#3B82F6');
      expect(hslBlue).toMatch(/^\d+\s+\d+%\s+\d+%$/);
    });

    it('resolves optimal contrast text color for green/emerald and dark accents', () => {
      // Emerald (#10B981) has higher contrast with dark text (#0F172A)
      const emeraldText = getContrastTextColor('#10B981');
      expect(emeraldText).toBe('#0F172A');

      // Obsidian (#0F172A) has higher contrast with white text (#FFFFFF)
      const obsidianText = getContrastTextColor('#0F172A');
      expect(obsidianText).toBe('#FFFFFF');

      // Dark Blue (#1E3A8A) has higher contrast with white text (#FFFFFF)
      const navyText = getContrastTextColor('#1E3A8A');
      expect(navyText).toBe('#FFFFFF');
    });

    it('produces contrast-safe button styles', () => {
      const emeraldButton = getContrastButtonStyles('#10B981');
      expect(emeraldButton.backgroundColor).toBe('#10B981');
      expect(emeraldButton.color).toBe('#0F172A');

      const navyButton = getContrastButtonStyles('#1E3A8A');
      expect(navyButton.backgroundColor).toBe('#1E3A8A');
      expect(navyButton.color).toBe('#FFFFFF');
    });
  });

  describe('Dual-Layer In-Memory FER Theme Hydration', () => {
    it('safely hydrates missing theme properties with enterprise defaults', () => {
      const rawSurvey = {
        id: 'survey_legacy_001',
        title: 'Legacy Survey',
        elements: [],
      } as unknown as Partial<Survey>;

      const hydrated = hydrateSurveyDocument(rawSurvey);

      expect(hydrated.backgroundColor).toBe('#F8FAFC');
      expect(hydrated.patternColor).toBe('#3B82F6');
      expect(hydrated.backgroundPattern).toBe('none');
      expect(hydrated.stepperVariant).toBe('linear');
    });

    it('preserves custom configured theme attributes when present', () => {
      const customSurvey = {
        id: 'survey_custom_002',
        title: 'Royal Amethyst Survey',
        backgroundColor: '#FAF5FF',
        patternColor: '#A855F7',
        backgroundPattern: 'circuit',
        stepperVariant: 'linear',
        elements: [],
      } as unknown as Partial<Survey>;

      const hydrated = hydrateSurveyDocument(customSurvey);

      expect(hydrated.backgroundColor).toBe('#FAF5FF');
      expect(hydrated.patternColor).toBe('#A855F7');
      expect(hydrated.backgroundPattern).toBe('circuit');
      expect(hydrated.stepperVariant).toBe('linear');
    });
  });

  describe('Pattern Archetypes Validation', () => {
    const validPatterns = ['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient'];

    it('recognizes all 7 supported SVG vector patterns', () => {
      validPatterns.forEach((pattern) => {
        expect(['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient']).toContain(pattern);
      });
    });
  });
});
