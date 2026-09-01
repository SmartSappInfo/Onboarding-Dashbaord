import { describe, it, expect } from 'vitest';
import {
  getContrastRatio,
  evaluateCreativeHealth,
} from '../creative-health-engine';
import {
  applyHealthFix,
  applyImproveAllFixes,
} from '../creative-health-fixes';
import type {
  CreativeElement,
  BrandKit,
} from '../creative-types';

describe('Creative Health & Intelligence Engine (Phase 4)', () => {
  it('should calculate WCAG 2.1 contrast ratios accurately', () => {
    // Black on White
    expect(getContrastRatio('#000000', '#ffffff')).toBe(21);
    // White on White
    expect(getContrastRatio('#ffffff', '#ffffff')).toBe(1);
    // Yellow on White (very low contrast)
    expect(getContrastRatio('#facc15', '#ffffff')).toBeLessThan(2);
    // White on Dark Slate
    expect(getContrastRatio('#ffffff', '#0f172a')).toBeGreaterThan(15);
  });

  it('should flag missing headline as a critical readability issue', () => {
    const elements: CreativeElement[] = [
      {
        id: 'img-1',
        type: 'image',
        x: 20,
        y: 20,
        width: 60,
        height: 60,
        semanticRole: 'subject',
      },
    ];

    const report = evaluateCreativeHealth(elements, '#0f172a');
    expect(report.issues.some((i) => i.id === 'issue-no-headline')).toBe(true);
    const readabilityVec = report.vectors.find((v) => v.name === 'Readability');
    expect(readabilityVec?.score).toBeLessThanOrEqual(75);
  });

  it('should flag YouTube timestamp collisions in the bottom-right corner', () => {
    const elements: CreativeElement[] = [
      {
        id: 'txt-safezone-bad',
        type: 'text',
        x: 82,
        y: 80,
        width: 15,
        height: 10,
        text: 'Danger Text',
        semanticRole: 'headline',
        fontSize: 48,
      },
    ];

    const report = evaluateCreativeHealth(elements, '#0f172a');
    const safeZoneIssue = report.issues.find((i) => i.category === 'safe_zone');
    expect(safeZoneIssue).toBeDefined();
    expect(safeZoneIssue?.severity).toBe('critical');

    const platformVec = report.vectors.find((v) => v.name === 'Platform');
    expect(platformVec?.score).toBeLessThanOrEqual(75);
  });

  it('should evaluate brand typography conformity', () => {
    const elements: CreativeElement[] = [
      {
        id: 'txt-1',
        type: 'text',
        x: 10,
        y: 20,
        width: 80,
        height: 20,
        text: 'PROVEN SYSTEM',
        fontFamily: 'Arial',
        fontSize: 52,
        semanticRole: 'headline',
      },
    ];

    const mockBrandKit: BrandKit = {
      workspaceId: 'ws-test',
      name: 'SmartSapp Brand',
      colors: { primary: ['#10b981', '#0f172a'], secondary: [], accent: [], neutral: [] },
      typography: { displayFont: 'Impact', headingFont: 'Inter', bodyFont: 'Inter' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const report = evaluateCreativeHealth(elements, '#0f172a', undefined, mockBrandKit);
    const brandIssue = report.issues.find((i) => i.category === 'brand');
    expect(brandIssue).toBeDefined();
    expect(brandIssue?.fixActionType).toBe('apply_brand_font');
  });

  it('should produce saliency hotspots for heatmap rendering', () => {
    const elements: CreativeElement[] = [
      {
        id: 'txt-1',
        type: 'text',
        x: 10,
        y: 20,
        width: 80,
        height: 20,
        text: 'HEADLINE',
        semanticRole: 'headline',
      },
      {
        id: 'img-1',
        type: 'image',
        x: 50,
        y: 40,
        width: 40,
        height: 40,
        semanticRole: 'subject',
      },
    ];

    const report = evaluateCreativeHealth(elements, '#0f172a');
    expect(report.saliencyHotspots).toHaveLength(2);
    expect(report.saliencyHotspots[0].x).toBe(50); // 10 + 80/2
    expect(report.saliencyHotspots[0].y).toBe(30); // 20 + 20/2
  });

  it('should deterministically fix health issues with applyHealthFix', () => {
    const elements: CreativeElement[] = [
      {
        id: 'txt-1',
        type: 'text',
        x: 82,
        y: 80,
        width: 15,
        height: 10,
        text: 'Collision Text',
        fontSize: 32,
        fontFamily: 'Arial',
        semanticRole: 'headline',
      },
    ];

    const mockBrandKit: BrandKit = {
      workspaceId: 'ws-test',
      name: 'SmartSapp Brand',
      colors: { primary: ['#10b981', '#0f172a'], secondary: [], accent: [], neutral: [] },
      typography: { displayFont: 'Impact', headingFont: 'Inter', bodyFont: 'Inter' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const report = evaluateCreativeHealth(elements, '#0f172a', undefined, mockBrandKit);

    // Apply safe-zone fix
    const safeZoneIssue = report.issues.find((i) => i.category === 'safe_zone');
    expect(safeZoneIssue).toBeDefined();
    const fixedSafe = applyHealthFix(elements, safeZoneIssue!, mockBrandKit);
    expect(fixedSafe[0].x).toBeLessThan(80);
    expect(fixedSafe[0].y).toBeLessThan(80);

    // Apply Improve All Fixes
    const improvedAll = applyImproveAllFixes(elements, report.issues, mockBrandKit);
    expect(improvedAll[0].fontSize).toBeGreaterThanOrEqual(54);
    expect(improvedAll[0].fontFamily).toBe('Impact');
    expect(improvedAll[0].textStrokeWidth).toBeGreaterThanOrEqual(2);
  });
});
