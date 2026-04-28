// @ts-nocheck
/**
 * Property-Based Tests: Dual-Read Adapter
 *
 * Feature: industry-scoped-entity-expansion
 *
 * Validates: Requirements 11.8–11.10, Design Properties 5, 6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  mapSchoolToSaaSEntity,
  readFromLegacySchools,
  readFromEntities,
  getEntity,
} from '@/lib/contact-adapter';
import type { School, Entity, MigrationStatus } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Firebase Admin
// ─────────────────────────────────────────────────────────────────────────────

// Mock the firebase-admin module
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Shared arbitraries
// ─────────────────────────────────────────────────────────────────────────────

const migrationStatusArb = fc.constantFrom<MigrationStatus>(
  'legacy',
  'migrated',
  'dual-write'
);

// Helper to generate valid hex colors
const hexColorArbitrary = fc.integer({ min: 0, max: 0xFFFFFF }).map(n => `#${n.toString(16).padStart(6, '0')}`);

// Helper to generate valid ISO date strings
const isoDateArbitrary = fc.integer({ min: 1577836800000, max: 1767225600000 }).map(ms => new Date(ms).toISOString());

/**
 * Generates a minimal valid legacy School document.
 */
const legacySchoolArb = fc.record({
  id: fc.uuid(),
  organizationId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  slug: fc.string({ minLength: 1, maxLength: 50 }),
  workspaceIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
  status: fc.constantFrom('Active', 'Inactive', 'Archived'),
  schoolStatus: fc.constantFrom('Lead', 'Onboarding', 'Active', 'Churned'),
  pipelineId: fc.uuid(),
  nominalRoll: fc.integer({ min: 0, max: 10000 }),
  subscriptionPackageName: fc.option(fc.string(), { nil: undefined }),
  subscriptionPackageId: fc.option(fc.uuid(), { nil: undefined }),
  subscriptionRate: fc.option(fc.float({ min: 0, max: 100000 }), { nil: undefined }),
  billingAddress: fc.option(fc.string(), { nil: undefined }),
  currency: fc.option(fc.constantFrom('GHS', 'USD', 'EUR'), { nil: undefined }),
  modules: fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.string(),
      abbreviation: fc.string(),
      color: hexColorArbitrary,
    }),
    { maxLength: 5 }
  ),
  implementationDate: fc.option(isoDateArbitrary, { nil: undefined }),
  referee: fc.option(fc.string(), { nil: undefined }),
  lifecycleStatus: fc.option(
    fc.constantFrom('Lead', 'Onboarding', 'Active', 'Churned'),
    { nil: undefined }
  ),
  createdAt: isoDateArbitrary,
  updatedAt: fc.option(isoDateArbitrary, { nil: undefined }),
  migrationStatus: fc.option(migrationStatusArb, { nil: undefined }),
  entityId: fc.option(fc.uuid(), { nil: undefined }),
  focalPersons: fc.option(fc.array(fc.record({
    id: fc.uuid(),
    name: fc.string(),
    email: fc.option(fc.emailAddress(), { nil: undefined }),
    phone: fc.option(fc.string(), { nil: undefined }),
    typeKey: fc.string(),
    isPrimary: fc.boolean(),
    isSignatory: fc.option(fc.boolean(), { nil: undefined }),
    createdAt: fc.option(isoDateArbitrary, { nil: undefined }),
    updatedAt: fc.option(isoDateArbitrary, { nil: undefined }),
  })), { nil: undefined }),
  entityContacts: fc.option(fc.array(fc.record({
    id: fc.uuid(),
    name: fc.string(),
    email: fc.option(fc.emailAddress(), { nil: undefined }),
    phone: fc.option(fc.string(), { nil: undefined }),
    typeKey: fc.string(),
    isPrimary: fc.boolean(),
    isSignatory: fc.option(fc.boolean(), { nil: undefined }),
    createdAt: fc.option(isoDateArbitrary, { nil: undefined }),
    updatedAt: fc.option(isoDateArbitrary, { nil: undefined }),
  })), { nil: undefined }),
  logoUrl: fc.option(fc.webUrl(), { nil: undefined }),
  heroImageUrl: fc.option(fc.webUrl(), { nil: undefined }),
  initials: fc.option(fc.string({ maxLength: 5 }), { nil: undefined }),
  slogan: fc.option(fc.string(), { nil: undefined }),
  discountPercentage: fc.option(fc.float({ min: 0, max: 100 }), { nil: undefined }),
  arrearsBalance: fc.option(fc.float({ min: 0, max: 100000 }), { nil: undefined }),
  creditBalance: fc.option(fc.float({ min: 0, max: 100000 }), { nil: undefined }),
  location: fc.option(fc.string(), { nil: undefined }),
  zone: fc.option(
    fc.record({
      id: fc.uuid(),
      name: fc.string(),
    }),
    { nil: undefined }
  ),
  stage: fc.option(
    fc.record({
      id: fc.uuid(),
      name: fc.string(),
      order: fc.integer({ min: 0, max: 10 }),
    }),
    { nil: undefined }
  ),
  assignedTo: fc.option(
    fc.record({
      userId: fc.uuid(),
      name: fc.string(),
      email: fc.emailAddress(),
    }),
    { nil: undefined }
  ),
  tags: fc.option(fc.array(fc.uuid()), { nil: undefined }),
}) as fc.Arbitrary<School>;

/**
 * Generates a minimal valid Entity document.
 */
const entityArb = fc.record({
  id: fc.uuid(),
  organizationId: fc.uuid(),
  entityType: fc.constantFrom('institution', 'family', 'person'),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  slug: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  entityContacts: fc.array(fc.record({
    id: fc.uuid(),
    name: fc.string(),
    email: fc.option(fc.emailAddress(), { nil: undefined }),
    phone: fc.option(fc.string(), { nil: undefined }),
    typeKey: fc.string(),
    isPrimary: fc.boolean(),
    isSignatory: fc.option(fc.boolean(), { nil: undefined }),
    createdAt: fc.option(isoDateArbitrary, { nil: undefined }),
    updatedAt: fc.option(isoDateArbitrary, { nil: undefined }),
  })),
  entityType: 'institution',
    entityContacts: [],
    globalTags: fc.array(fc.uuid()),
  status: fc.option(fc.constantFrom('active', 'archived'), { nil: undefined }),
  createdAt: isoDateArbitrary,
  updatedAt: isoDateArbitrary,
  industry: fc.option(
    fc.constantFrom('SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy'),
    { nil: undefined }
  ),
  industryData: fc.option(fc.oneof(
    fc.record({
      industry: fc.constant('SaaS' as const),
      entityType: fc.constant('institution' as const),
      capacity: fc.integer({ min: 0, max: 10000 }),
      // planType: fc.string(),
      // features: fc.array(fc.string()),
      // signupDate: isoDateArbitrary,
      accountStatus: fc.constantFrom('lead', 'trial', 'active', 'suspended', 'churned'),
    }),
    fc.record({
      industry: fc.constant('SchoolEnrollment' as const),
      entityType: fc.constant('institution' as const),
      gradeOfferings: fc.array(fc.string()),
      academicYear: fc.string(),
    })
  ), { nil: undefined }),
  migrationStatus: fc.option(migrationStatusArb, { nil: undefined }),
  legacySchoolId: fc.option(fc.uuid(), { nil: undefined }),
  institutionData: fc.option(fc.record({
    nominalRoll: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
    subscriptionPackageId: fc.option(fc.uuid(), { nil: undefined }),
    subscriptionRate: fc.option(fc.float({ min: 0, max: 100000 }), { nil: undefined }),
    billingAddress: fc.option(fc.string(), { nil: undefined }),
    currency: fc.option(fc.string(), { nil: undefined }),
  }), { nil: undefined }),
  familyData: fc.option(fc.record({
    guardians: fc.array(fc.record({
      name: fc.string(),
      relationship: fc.string(),
      email: fc.option(fc.emailAddress(), { nil: undefined }),
      phone: fc.option(fc.string(), { nil: undefined }),
    })),
    children: fc.array(fc.record({
      name: fc.string(),
      dateOfBirth: fc.option(isoDateArbitrary, { nil: undefined }),
    })),
    admissionsData: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
  }), { nil: undefined }),
  personData: fc.option(fc.record({
    firstName: fc.string(),
    lastName: fc.string(),
    company: fc.option(fc.string(), { nil: undefined }),
    jobTitle: fc.option(fc.string(), { nil: undefined }),
    leadSource: fc.option(fc.string(), { nil: undefined }),
  }), { nil: undefined }),
}) as fc.Arbitrary<Entity>;

// ─────────────────────────────────────────────────────────────────────────────
// Property 7: Backward compatibility
// Feature: industry-scoped-entity-expansion, Property 7: Any entity with
// migrationStatus: 'legacy' must be readable via the adapter and return a valid
// Entity shape with industry: 'SaaS'.
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 7: Backward compatibility', () => {
  it('mapSchoolToSaaSEntity always returns an Entity with industry: SaaS', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        const entity = await await mapSchoolToSaaSEntity(school);

        // Must return a valid Entity shape
        expect(entity).toBeDefined();
        expect(entity.id).toBe(school.id);
        expect(entity.organizationId).toBeDefined();
        expect(entity.entityType).toBe('institution');
        expect(entity.name).toBe(school.name);

        // Must have industry: 'SaaS'
        expect(entity.industry).toBe('SaaS');

        // Must have SaaS industry data
        expect(entity.industryData).toBeDefined();
        expect(entity.industryData?.industry).toBe('SaaS');
        expect(entity.industryData?.entityType).toBe('institution');

        // Must preserve migration tracking
        expect(entity.legacySchoolId).toBe(school.id);
      }),
      { numRuns: 100 }
    );
  });

  it('mapSchoolToSaaSEntity correctly maps legacy fields to SaaS fields', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        const entity = await await mapSchoolToSaaSEntity(school);
        const saasData = entity.industryData as any;

        // Requirement 11.4 — Field mappings
        expect(saasData.companySize).toBe(school.nominalRoll || 0);
        expect(saasData.planType).toBeDefined();
        expect(saasData.features).toBeInstanceOf(Array);
        expect(saasData.signupDate).toBeDefined();

        // Billing fields preserved
        expect(saasData.billingAddress).toBe(school.billingAddress);
        expect(saasData.currency).toBe(school.currency || 'GHS');
        expect(saasData.subscriptionRate).toBe(school.subscriptionRate);

        // Account status inferred
        expect(saasData.accountStatus).toMatch(
          /^(lead|trial|active|suspended|churned)$/
        );
      }),
      { numRuns: 100 }
    );
  });

  it('mapSchoolToSaaSEntity preserves all institution data for backward compatibility', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        const entity = await await mapSchoolToSaaSEntity(school);

        // Must have institutionData for backward compatibility
        expect(entity.institutionData).toBeDefined();
        expect(entity.institutionData?.nominalRoll).toBe(school.nominalRoll);
        expect(entity.institutionData?.subscriptionPackageId).toBe(
          school.subscriptionPackageId
        );
        expect(entity.institutionData?.subscriptionRate).toBe(school.subscriptionRate);
        expect(entity.institutionData?.billingAddress).toBe(school.billingAddress);
        expect(entity.institutionData?.currency).toBe(school.currency);
        expect(entity.institutionData?.modules).toEqual(school.modules);
        expect(entity.institutionData?.implementationDate).toBe(
          school.implementationDate
        );
        expect(entity.institutionData?.referee).toBe(school.referee);
      }),
      { numRuns: 100 }
    );
  });

  it('mapSchoolToSaaSEntity handles missing optional fields gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        // Remove optional fields
        const minimalSchool: School = {
          ...school,
          subscriptionPackageName: undefined,
          subscriptionPackageId: undefined,
          subscriptionRate: undefined,
          billingAddress: undefined,
          currency: undefined,
          modules: undefined,
          implementationDate: undefined,
          referee: undefined,
          lifecycleStatus: undefined,
          logoUrl: undefined,
          heroImageUrl: undefined,
          initials: undefined,
          slogan: undefined,
          discountPercentage: undefined,
          arrearsBalance: undefined,
          creditBalance: undefined,
          location: undefined,
          zone: undefined,
        };

        const entity = await mapSchoolToSaaSEntity(minimalSchool);

        // Must still return a valid Entity
        expect(entity).toBeDefined();
        expect(entity.industry).toBe('SaaS');
        expect(entity.industryData).toBeDefined();

        // Must handle missing fields with defaults
        const saasData = entity.industryData as any;
        expect(saasData.companySize).toBe(school.nominalRoll || 0);
        expect(saasData.planType).toBeDefined(); // Should default to 'unknown'
        expect(saasData.features).toBeInstanceOf(Array);
        expect(saasData.currency).toBe('GHS'); // Default currency
      }),
      { numRuns: 50 }
    );
  });

  it('entities with migrationStatus: legacy must have industry: SaaS after mapping', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        // Force legacy migration status
        const legacySchool: School = {
          ...school,
          migrationStatus: 'legacy',
        };

        const entity = await mapSchoolToSaaSEntity(legacySchool);

        // Legacy entities must always be SaaS
        expect(entity.industry).toBe('SaaS');
        expect(entity.migrationStatus).toBe('legacy');
      }),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 8: Migration idempotency
// Feature: industry-scoped-entity-expansion, Property 8: Running the migration
// transformation on an already-migrated entity produces the same result as
// running it once.
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 8: Migration idempotency', () => {
  it('mapSchoolToSaaSEntity is idempotent when applied to the same school', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        const entity1 = await await mapSchoolToSaaSEntity(school);
        const entity2 = await await mapSchoolToSaaSEntity(school);

        // Both transformations must produce identical results
        expect(entity1.id).toBe(entity2.id);
        expect(entity1.organizationId).toBe(entity2.organizationId);
        expect(entity1.entityType).toBe(entity2.entityType);
        expect(entity1.name).toBe(entity2.name);
        expect(entity1.industry).toBe(entity2.industry);
        expect(entity1.migrationStatus).toBe(entity2.migrationStatus);
        expect(entity1.legacySchoolId).toBe(entity2.legacySchoolId);

        // Industry data must be identical
        expect(JSON.stringify(entity1.industryData)).toBe(
          JSON.stringify(entity2.industryData)
        );

        // Institution data must be identical
        expect(JSON.stringify(entity1.institutionData)).toBe(
          JSON.stringify(entity2.institutionData)
        );
      }),
      { numRuns: 100 }
    );
  });

  it('mapSchoolToSaaSEntity produces deterministic output for the same input', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        // Run transformation multiple times
        const entities = await Promise.all(
          Array.from({ length: 5 }, () => mapSchoolToSaaSEntity(school))
        );

        // All results must be identical
        const firstEntity = entities[0];
        for (const entity of entities.slice(1)) {
          expect(entity.id).toBe(firstEntity.id);
          expect(entity.name).toBe(firstEntity.name);
          expect(entity.industry).toBe(firstEntity.industry);
          expect(JSON.stringify(entity.industryData)).toBe(
            JSON.stringify(firstEntity.industryData)
          );
        }
      }),
      { numRuns: 50 }
    );
  });

  it('re-mapping an already-mapped entity preserves all fields', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        const entity1 = await mapSchoolToSaaSEntity(school);

        // Simulate re-mapping by converting entity back to school-like shape
        // (This is a theoretical scenario to test idempotency)
        const schoolFromEntity: School = {
          ...school,
          id: entity1.id,
          name: entity1.name,
          nominalRoll: entity1.institutionData?.nominalRoll || 0,
          subscriptionPackageId: entity1.institutionData?.subscriptionPackageId,
          subscriptionRate: entity1.institutionData?.subscriptionRate,
          billingAddress: entity1.institutionData?.billingAddress,
          currency: entity1.institutionData?.currency,
          modules: entity1.institutionData?.modules,
          implementationDate: entity1.institutionData?.implementationDate,
          referee: entity1.institutionData?.referee,
        };

        const entity2 = await mapSchoolToSaaSEntity(schoolFromEntity);

        // Re-mapping must produce the same result
        expect(entity2.id).toBe(entity1.id);
        expect(entity2.name).toBe(entity1.name);
        expect(entity2.industry).toBe(entity1.industry);

        // Industry data must be preserved
        const saasData1 = entity1.industryData as any;
        const saasData2 = entity2.industryData as any;
        expect(saasData2.companySize).toBe(saasData1.companySize);
        expect(saasData2.planType).toBe(saasData1.planType);
        expect(saasData2.accountStatus).toBe(saasData1.accountStatus);
      }),
      { numRuns: 50 }
    );
  });

  it('mapSchoolToSaaSEntity does not mutate the input school object', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        // Create a deep copy of the school for comparison
        const schoolCopy = JSON.parse(JSON.stringify(school));

        // Run transformation
        await mapSchoolToSaaSEntity(school);

        // Original school must remain unchanged
        expect(JSON.stringify(school)).toBe(JSON.stringify(schoolCopy));
      }),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional validation tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Dual-read adapter validation', () => {
  it('mapSchoolToSaaSEntity always returns an entity with required fields', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        const entity = await await mapSchoolToSaaSEntity(school);

        // Required Entity fields
        expect(entity.id).toBeDefined();
        expect(entity.organizationId).toBeDefined();
        expect(entity.entityType).toBeDefined();
        expect(entity.name).toBeDefined();
        expect(entity.entityContacts).toBeDefined();
        expect(entity.globalTags).toBeDefined();
        expect(entity.createdAt).toBeDefined();
        expect(entity.updatedAt).toBeDefined();

        // Industry-specific fields
        expect(entity.industry).toBe('SaaS');
        expect(entity.industryData).toBeDefined();

        // Migration tracking
        expect(entity.legacySchoolId).toBe(school.id);
      }),
      { numRuns: 100 }
    );
  });

  it('mapSchoolToSaaSEntity preserves entity contacts', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        const entity = await await mapSchoolToSaaSEntity(school);

        // Entity contacts must be defined (even if empty)
        expect(entity.entityContacts).toBeDefined();
        expect(Array.isArray(entity.entityContacts)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('mapSchoolToSaaSEntity sets correct entity type', async () => {
    await fc.assert(
      fc.asyncProperty(legacySchoolArb, async (school) => {
        const entity = await await mapSchoolToSaaSEntity(school);

        // Schools always map to institution entities
        expect(entity.entityType).toBe('institution');

        // Industry data must also reflect institution type
        expect(entity.industryData?.entityType).toBe('institution');
      }),
      { numRuns: 100 }
    );
  });
});
