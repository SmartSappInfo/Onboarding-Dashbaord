import { describe, it, expect } from 'vitest';
import {
  evaluateBrandCompliance,
  applyBrandRulesToElements,
} from '../brand-intelligence';
import {
  STARTER_BLUEPRINTS,
} from '@/app/actions/creative-template-actions';
import type {
  CreativeElement,
  BrandKit,
} from '../creative-types';
import { makeUniqueId } from '../creative-types';

describe('Creative Templates & Brand Intelligence Engine (Phase 5)', () => {
  const mockBrandKit: BrandKit = {
    workspaceId: 'ws-brand-test',
    name: 'Acme Pro Brand',
    colors: {
      primary: ['#10b981', '#0f172a'],
      secondary: ['#06b6d4'],
      accent: ['#facc15'],
      neutral: ['#ffffff', '#000000'],
    },
    typography: {
      displayFont: 'Impact',
      headingFont: 'Inter',
      bodyFont: 'Inter',
    },
    watermarkUrl: 'https://cdn.smartsapp.com/acme-logo.png',
    aiRules: [
      {
        id: 'rule-1',
        type: 'font',
        rule: 'Headline must use Impact.',
        severity: 'required',
        active: true,
      },
    ],
  };

  it('should include 4 production starter blueprints with baseline health >= 90', () => {
    expect(STARTER_BLUEPRINTS.length).toBeGreaterThanOrEqual(4);
    for (const blueprint of STARTER_BLUEPRINTS) {
      expect(blueprint.baselineHealthScore).toBeGreaterThanOrEqual(90);
      expect(blueprint.elements.length).toBeGreaterThan(0);
      expect(blueprint.scope).toBe('global');
    }
  });

  it('should deep-clone template elements and assign new unique IDs', () => {
    const sourceTemplate = STARTER_BLUEPRINTS[0];
    const clonedElements: CreativeElement[] = sourceTemplate.elements.map((el) => ({
      ...el,
      id: makeUniqueId(),
    }));

    expect(clonedElements).toHaveLength(sourceTemplate.elements.length);
    for (let i = 0; i < clonedElements.length; i++) {
      expect(clonedElements[i].id).not.toBe(sourceTemplate.elements[i].id);
      expect(clonedElements[i].type).toBe(sourceTemplate.elements[i].type);
      expect(clonedElements[i].text).toBe(sourceTemplate.elements[i].text);
    }
  });

  it('should evaluate brand compliance and detect font deviations', () => {
    const compliantElements: CreativeElement[] = [
      {
        id: 'el-1',
        type: 'text',
        x: 10,
        y: 20,
        width: 80,
        height: 20,
        text: 'PROVEN SYSTEM',
        fontFamily: 'Impact',
        fill: '#10b981',
        semanticRole: 'headline',
      },
      {
        id: 'el-2',
        type: 'image',
        x: 80,
        y: 80,
        width: 15,
        height: 15,
        imageSrc: 'https://cdn.smartsapp.com/acme-logo.png',
        semanticRole: 'brand_logo',
      },
    ];

    const report = evaluateBrandCompliance(compliantElements, mockBrandKit);
    expect(report.isCompliant).toBe(true);
    expect(report.overallScore).toBe(100);
    expect(report.violations).toHaveLength(0);

    // Non-compliant font
    const nonCompliantElements: CreativeElement[] = [
      {
        id: 'el-1',
        type: 'text',
        x: 10,
        y: 20,
        width: 80,
        height: 20,
        text: 'BAD FONT HEADLINE',
        fontFamily: 'Arial',
        fill: '#10b981',
        semanticRole: 'headline',
      },
    ];

    const badReport = evaluateBrandCompliance(nonCompliantElements, mockBrandKit);
    expect(badReport.isCompliant).toBe(false);
    expect(badReport.overallScore).toBeLessThan(100);
    expect(badReport.violations.some((v) => v.ruleType === 'font')).toBe(true);
  });

  it('should selectively apply brand rules without overriding urgent badge colors', () => {
    const elements: CreativeElement[] = [
      {
        id: 'el-1',
        type: 'text',
        x: 10,
        y: 20,
        width: 80,
        height: 20,
        text: 'HEADLINE',
        fontFamily: 'Arial',
        fill: '#ffffff',
        semanticRole: 'headline',
      },
      {
        id: 'el-2',
        type: 'text',
        x: 10,
        y: 60,
        width: 30,
        height: 10,
        text: 'URGENT',
        fontFamily: 'Arial',
        fill: '#ffffff',
        badgeColor: '#dc2626',
        semanticRole: 'badge',
      },
    ];

    const enforced = applyBrandRulesToElements(elements, mockBrandKit);
    expect(enforced[0].fontFamily).toBe('Impact');
    expect(enforced[0].fill).toBe('#10b981'); // Primary brand color applied

    // Badge should retain badge fill
    expect(enforced[1].fontFamily).toBe('Impact');
    expect(enforced[1].fill).toBe('#ffffff');
  });
});
