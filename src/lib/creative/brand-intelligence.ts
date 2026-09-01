/**
 * ARCHITECTURE:
 * Brand Studio Intelligence & Compliance Engine (Phase 5)
 * 
 * Analyzes creative elements against workspace Brand Kit guidelines and AI rules,
 * calculating Brand Health scores and enforcing selective design system tokens.
 * 
 * CAUTION:
 * Selective brand enforcement preserves functional status accents (e.g. #dc2626 badges).
 * Strict typing (0% any / any[]).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-templates.test.ts
 */

import type {
  CreativeElement,
  BrandKit,
  BrandComplianceReport,
} from './creative-types';
import { normalizeCanvasElements } from './creative-ai-gateway';

export const DEFAULT_BRAND_KIT: BrandKit = {
  workspaceId: 'default',
  name: 'Default Brand Palette',
  colors: {
    primary: ['#0f172a', '#1e293b', '#334155'],
    secondary: ['#10b981', '#06b6d4', '#3b82f6'],
    accent: ['#facc15', '#f97316', '#ef4444'],
    neutral: ['#ffffff', '#f8fafc', '#64748b', '#020617'],
  },
  typography: {
    displayFont: 'Impact',
    headingFont: 'Montserrat',
    bodyFont: 'Inter',
  },
  watermarkUrl: '',
  aiRules: [
    {
      id: 'rule-high-contrast',
      type: 'accessibility',
      rule: 'Headlines must maintain a minimum contrast ratio of 4.5:1 against the canvas background.',
      severity: 'required',
      active: true,
    },
    {
      id: 'rule-brand-accent',
      type: 'color',
      rule: 'Use high-vibrancy accent colors (#facc15 or #10b981) on focal text badges.',
      severity: 'recommended',
      active: true,
    },
  ],
  isDefault: true,
};

/**
 * Evaluates Brand Kit compliance across design elements.
 */
export function evaluateBrandCompliance(
  elements: CreativeElement[],
  brandKit?: BrandKit | null
): BrandComplianceReport {
  const violations: BrandComplianceReport['violations'] = [];

  if (!brandKit) {
    return {
      overallScore: 100,
      isCompliant: true,
      violations: [],
      evaluatedAt: new Date().toISOString(),
    };
  }

  const expectedDisplayFont = (brandKit.typography?.displayFont || '').toLowerCase().trim();
  const brandPrimaryColors = (brandKit.colors?.primary || []).map((c) => c.toLowerCase());
  const brandAccentColors = (brandKit.colors?.accent || []).map((c) => c.toLowerCase());
  const allAllowedColors = new Set([
    ...brandPrimaryColors,
    ...brandAccentColors,
    '#ffffff',
    '#000000',
    '#dc2626', // Urgent badge red
    '#facc15', // Contrast highlight yellow
  ]);

  let brandScore = 100;

  // 1. Font Family Compliance
  const headlineEl = elements.find((el) => el.semanticRole === 'headline' || el.type === 'text');
  if (headlineEl && expectedDisplayFont) {
    const currentFont = (headlineEl.fontFamily || '').toLowerCase().trim();
    if (currentFont !== expectedDisplayFont) {
      brandScore -= 20;
      violations.push({
        ruleType: 'font',
        severity: 'required',
        message: `Headline typography is "${headlineEl.fontFamily}". Workspace brand standard requires "${brandKit.typography.displayFont}".`,
      });
    }
  }

  // 2. Color Palette Alignment
  for (const el of elements) {
    if (el.type === 'text' && el.fill) {
      const fill = el.fill.toLowerCase();
      if (!allAllowedColors.has(fill)) {
        brandScore -= 10;
        violations.push({
          ruleType: 'color',
          severity: 'recommended',
          message: `Text color "${el.fill}" is outside the registered workspace brand palette.`,
        });
        break;
      }
    }
  }

  // 3. Watermark / Logo Presence Rule
  if (brandKit.watermarkUrl) {
    const hasWatermark = elements.some(
      (el) => el.semanticRole === 'brand_logo' || el.imageSrc === brandKit.watermarkUrl
    );
    if (!hasWatermark) {
      brandScore -= 15;
      violations.push({
        ruleType: 'watermark',
        severity: 'recommended',
        message: 'Workspace brand logo watermark is missing from the canvas.',
      });
    }
  }

  const finalScore = Math.max(0, Math.min(100, brandScore));

  return {
    overallScore: finalScore,
    isCompliant: violations.filter((v) => v.severity === 'required').length === 0,
    violations,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Selectively applies Brand Kit tokens (Display font, primary color) to canvas elements.
 */
export function applyBrandRulesToElements(
  elements: CreativeElement[],
  brandKit: BrandKit
): CreativeElement[] {
  const brandFont = brandKit.typography?.displayFont || 'Impact';
  const brandPrimaryColor = brandKit.colors?.primary?.[0] || '#10b981';

  const updated = elements.map((el) => {
    if (el.type === 'text') {
      // Don't override badge colors if urgent badge
      const isBadge = el.semanticRole === 'badge';
      return {
        ...el,
        fontFamily: brandFont,
        fill: isBadge ? el.fill : brandPrimaryColor,
      };
    }
    if (el.type === 'rect' || el.type === 'circle' || el.type === 'arrow') {
      return {
        ...el,
        shapeFill: brandPrimaryColor,
      };
    }
    return el;
  });

  return normalizeCanvasElements(updated);
}
