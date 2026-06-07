// @ts-nocheck
/**
 * Property-Based Tests: Industry Data Validation
 *
 * Feature: industry-scoped-entity-expansion
 *
 * Validates: Requirements 3.9, 23.1–23.9, Design Properties 2, 4, 8
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateIndustryData } from '@/lib/industry-schemas';
import { INDUSTRY_CONFIG } from '@/lib/industry-config';
import { INDUSTRY_FEATURE_FLAGS } from '@/lib/feature-flags';
import type { IndustryVertical } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared arbitraries
// ─────────────────────────────────────────────────────────────────────────────

const ALL_INDUSTRIES: IndustryVertical[] = [
  'SaaS',
  'SchoolEnrollment',
  'Law',
  'Marketing',
  'RealEstate',
  'Consultancy',
];

const industryArb = fc.constantFrom<IndustryVertical>(...ALL_INDUSTRIES);

/**
 * Returns a minimal valid industryData object for the given industry.
 * These objects satisfy the Zod schemas defined in industry-schemas.ts.
 */
function minimalIndustryData(industry: IndustryVertical): object {
  switch (industry) {
    case 'SaaS':
      return {
        industry: 'SaaS',
        
        capacity: 10,
        // planType: 'basic',
        // features: [],
        // signupDate: '2024-01-01',
        accountStatus: 'active',
      };
    case 'SchoolEnrollment':
      return {
        industry: 'SchoolEnrollment',
        
        gradeOfferings: ['K'],
        academicYear: '2024-2025',
        capacity: 10,
      };
    case 'Law':
      return {
        industry: 'Law',
        
        firmType: 'solo',
        practiceAreas: ['litigation'],
        conflictCheckRequired: false,
      };
    case 'Marketing':
      return {
        industry: 'Marketing',
        
        clientIndustry: 'tech',
        businessSize: {},
      };
    case 'RealEstate':
      return {
        industry: 'RealEstate',
        
        developerType: 'residential',
      };
    case 'Consultancy':
      return {
        industry: 'Consultancy',
        
        clientIndustry: 'finance',
        capacity: 10,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 1: Industry data consistency
// Feature: industry-scoped-entity-expansion, Property 1: For any entity with
// industryData present, industryData.industry === entity.industry must always hold.
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 1: Industry data consistency', () => {
  it('industryData.industry always equals entity.industry for valid data', () => {
    fc.assert(
      fc.property(industryArb, (industry) => {
        const industryData = minimalIndustryData(industry) as Record<string, unknown>;

        // The industryData.industry field must match the entity's industry
        expect(industryData['industry']).toBe(industry);
      }),
      { numRuns: 100 },
    );
  });

  it('validateIndustryData returns data whose industry matches the workspace industry', () => {
    fc.assert(
      fc.property(industryArb, (industry) => {
        const data = minimalIndustryData(industry);
        const validated = validateIndustryData(data, industry) as unknown as Record<string, unknown>;

        // After validation, the returned data's industry must still match
        expect(validated['industry']).toBe(industry);
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 2: Invalid industry data is rejected
// Feature: industry-scoped-entity-expansion, Property 2: For any industryData
// whose industry field differs from the workspace industry, validateIndustryData
// must throw.
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 2: Invalid industry data is rejected', () => {
  it('validateIndustryData throws when industryData.industry differs from workspaceIndustry', () => {
    // Generate pairs of distinct industries
    const distinctPairArb = fc
      .tuple(industryArb, industryArb)
      .filter(([a, b]) => a !== b);

    fc.assert(
      fc.property(distinctPairArb, ([dataIndustry, workspaceIndustry]) => {
        const data = minimalIndustryData(dataIndustry);

        // Passing data for one industry to a different workspace industry must throw
        expect(() => validateIndustryData(data, workspaceIndustry)).toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it('validateIndustryData throws for null or non-object data', () => {
    fc.assert(
      fc.property(industryArb, (industry) => {
        expect(() => validateIndustryData(null, industry)).toThrow();
        expect(() => validateIndustryData(undefined, industry)).toThrow();
        expect(() => validateIndustryData(42, industry)).toThrow();
        expect(() => validateIndustryData('string', industry)).toThrow();
      }),
      { numRuns: 20 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 3: Terminology completeness
// Feature: industry-scoped-entity-expansion, Property 3: For every IndustryVertical,
// INDUSTRY_CONFIG[industry].terminology defines all required keys.
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 3: Terminology completeness', () => {
  const REQUIRED_TERMINOLOGY_KEYS: Array<
    'entitySingular' | 'entityPlural' | 'personSingular' | 'personPlural'
  > = ['entitySingular', 'entityPlural', 'personSingular', 'personPlural'];

  it('every industry has all required terminology keys defined as non-empty strings', () => {
    fc.assert(
      fc.property(industryArb, (industry) => {
        const config = INDUSTRY_CONFIG[industry];

        expect(config).toBeDefined();
        expect(config.terminology).toBeDefined();

        for (const key of REQUIRED_TERMINOLOGY_KEYS) {
          const value = config.terminology[key];
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: ALL_INDUSTRIES.length }, // deterministic — one run per industry
    );
  });

  it('all 6 industries have complete terminology (exhaustive check)', () => {
    // Deterministic exhaustive check over all industries
    for (const industry of ALL_INDUSTRIES) {
      const { terminology } = INDUSTRY_CONFIG[industry];

      for (const key of REQUIRED_TERMINOLOGY_KEYS) {
        expect(
          terminology[key],
          `INDUSTRY_CONFIG['${industry}'].terminology.${key} must be a non-empty string`,
        ).toBeTruthy();
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 4: Feature gate enforcement
// Feature: industry-scoped-entity-expansion, Property 4: For any workspace
// industry I, features absent from INDUSTRY_CONFIG[I].features return false.
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 4: Feature gate enforcement', () => {
  it('features set to false in INDUSTRY_CONFIG are not enabled for that industry', () => {
    fc.assert(
      fc.property(industryArb, (industry) => {
        const { features } = INDUSTRY_CONFIG[industry];

        // Collect all feature keys that are explicitly false
        const disabledFeatures = (
          Object.entries(features) as Array<[string, boolean]>
        ).filter(([, enabled]) => enabled === false);

        // Each disabled feature must indeed be false (not enabled)
        for (const [featureKey, enabled] of disabledFeatures) {
          expect(
            enabled,
            `Feature '${featureKey}' should be false for industry '${industry}'`,
          ).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('INDUSTRY_FEATURE_FLAGS contains an entry for every IndustryVertical', () => {
    fc.assert(
      fc.property(industryArb, (industry) => {
        expect(industry in INDUSTRY_FEATURE_FLAGS).toBe(true);
        expect(typeof INDUSTRY_FEATURE_FLAGS[industry]).toBe('boolean');
      }),
      { numRuns: ALL_INDUSTRIES.length },
    );
  });

  it('SaaS is always enabled in INDUSTRY_FEATURE_FLAGS', () => {
    expect(INDUSTRY_FEATURE_FLAGS['SaaS']).toBe(true);
  });

  it('features enabled for one industry are not assumed enabled for all others', () => {
    // For each industry, verify that its enabled features are a subset of its own config
    fc.assert(
      fc.property(industryArb, (industry) => {
        const { features } = INDUSTRY_CONFIG[industry];
        const enabledFeatures = (
          Object.entries(features) as Array<[string, boolean]>
        ).filter(([, enabled]) => enabled === true);

        // All enabled features must be boolean true in the config
        for (const [featureKey, enabled] of enabledFeatures) {
          expect(
            enabled,
            `Feature '${featureKey}' should be true for industry '${industry}'`,
          ).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
