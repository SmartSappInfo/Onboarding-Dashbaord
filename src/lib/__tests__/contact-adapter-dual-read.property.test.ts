/**
 * Property-Based Test: Contact Adapter Dual-Read Migration Pattern
 * 
 * **Property 7: Backward Compatibility**
 * **Validates: Requirements 11.8–11.10, Design Properties 5, 6**
 * 
 * For any entity with migrationStatus: 'legacy':
 * - The adapter must be able to read it via getEntity()
 * - The returned Entity must have a valid shape
 * - The returned Entity must have industry: 'SaaS'
 * 
 * **Property 8: Migration Idempotency**
 * **Validates: Requirements 11.8–11.10, Design Properties 5, 6**
 * 
 * For any legacy School S:
 * - mapSchoolToSaaSEntity(S) = mapSchoolToSaaSEntity(mapSchoolToSaaSEntity(S))
 * 
 * Running the migration transformation on an already-migrated entity produces
 * the same result as running it once.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  mapSchoolToSaaSEntity,
  readFromLegacySchools,
  readFromEntities,
  getEntity,
} from '../contact-adapter';
import type { School, Entity, FocalPerson, InstitutionData } from '../types';

// Mock Next.js cache module
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// In-memory storage for testing
const schools = new Map<string, any>();
const entities = new Map<string, any>();

// Mock Firestore
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = schools.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
            })),
          };
        } else if (collectionName === 'entities') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const data = entities.get(id);
                return {
                  exists: !!data,
                  id,
                  data: () => data,
                };
              }),
            })),
          };
        }
        return {};
      }),
    },
  };
});

// Import after mocks
import { adminDb } from '../firebase-admin';

// Test storage access
const __testStorage = {
  schools,
  entities,
  reset: () => {
    schools.clear();
    entities.clear();
  },
};

// Fast-check arbitraries for generating test data
const focalPersonArbitrary = fc.record({
  name: fc.string({ minLength: 5, maxLength: 50 }),
  phone: fc.string({ minLength: 10, maxLength: 15 }),
  email: fc.emailAddress(),
  type: fc.constantFrom('Champion', 'Accountant', 'Administrator', 'Principal', 'School Owner'),
  isSignatory: fc.boolean(),
});

const moduleArbitrary = fc.record({
  id: fc.string({ minLength: 5, maxLength: 20 }),
  name: fc.string({ minLength: 5, maxLength: 30 }),
  abbreviation: fc.string({ minLength: 2, maxLength: 5 }),
  color: fc.string({ minLength: 7, maxLength: 7 }),
});

const schoolArbitrary = fc.record({
  id: fc.string({ minLength: 10, maxLength: 20 }),
  organizationId: fc.string({ minLength: 10, maxLength: 20 }),
  name: fc.string({ minLength: 5, maxLength: 50 }),
  slug: fc.string({ minLength: 5, maxLength: 50 }),
  workspaceIds: fc.array(fc.string({ minLength: 10, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
  status: fc.constantFrom('Active', 'Inactive', 'Archived', 'archived'),
  schoolStatus: fc.constantFrom('Lead', 'Onboarding', 'Active', 'Churned'),
  pipelineId: fc.string({ minLength: 10, maxLength: 20 }),
  stage: fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    name: fc.string({ minLength: 5, maxLength: 30 }),
    order: fc.integer({ min: 0, max: 10 }),
  }),
  focalPersons: fc.array(focalPersonArbitrary, { minLength: 0, maxLength: 3 }),
  nominalRoll: fc.option(fc.integer({ min: 10, max: 1000 }), { nil: undefined }),
  subscriptionPackageId: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: undefined }),
  subscriptionPackageName: fc.option(fc.constantFrom('Basic', 'Pro', 'Enterprise'), { nil: undefined }),
  subscriptionRate: fc.option(fc.float({ min: 100, max: 10000 }), { nil: undefined }),
  billingAddress: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: undefined }),
  currency: fc.option(fc.constantFrom('USD', 'EUR', 'GBP', 'GHS', 'NGN'), { nil: undefined }),
  implementationDate: fc.option(
    fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() })
      .map(timestamp => new Date(timestamp).toISOString()),
    { nil: undefined }
  ),
  referee: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
  createdAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() })
    .map(timestamp => new Date(timestamp).toISOString()),
  updatedAt: fc.option(
    fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() })
      .map(timestamp => new Date(timestamp).toISOString()),
    { nil: undefined }
  ),
  modules: fc.option(fc.array(moduleArbitrary, { minLength: 0, maxLength: 5 }), { nil: undefined }),
  logoUrl: fc.option(fc.webUrl(), { nil: undefined }),
  heroImageUrl: fc.option(fc.webUrl(), { nil: undefined }),
  initials: fc.option(fc.string({ minLength: 2, maxLength: 5 }), { nil: undefined }),
  slogan: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
  discountPercentage: fc.option(fc.float({ min: 0, max: 100 }), { nil: undefined }),
  arrearsBalance: fc.option(fc.float({ min: 0, max: 100000 }), { nil: undefined }),
  creditBalance: fc.option(fc.float({ min: 0, max: 100000 }), { nil: undefined }),
  zone: fc.option(fc.record({
    id: fc.string({ minLength: 10, maxLength: 20 }),
    name: fc.string({ minLength: 5, maxLength: 30 }),
  }), { nil: undefined }),
  location: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
  lifecycleStatus: fc.option(fc.constantFrom('Lead', 'Onboarding', 'Active', 'Churned'), { nil: undefined }),
  migrationStatus: fc.option(fc.constantFrom('legacy', 'migrated', 'dual-write'), { nil: undefined }),
}) as fc.Arbitrary<School>;

describe('Property 7: Backward Compatibility - Legacy Entity Reading', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
  });

  it('should read any legacy school and return a valid Entity with industry: SaaS', async () => {
    await fc.assert(
      fc.asyncProperty(schoolArbitrary, async (school) => {
        // Setup: Add school to mock storage
        __testStorage.schools.set(school.id, school);

        // Act: Read from legacy schools collection
        const entity = await readFromLegacySchools(school.id);

        // Assert: Entity exists
        expect(entity).not.toBeNull();
        expect(entity).toBeDefined();

        // Assert: Entity has valid shape
        expect(entity!.id).toBe(school.id);
        expect(entity!.organizationId).toBe(school.organizationId || '');
        expect(entity!.entityType).toBe('institution');
        expect(entity!.name).toBe(school.name);
        expect(entity!.slug).toBe(school.slug);

        // Assert: Entity has industry: 'SaaS'
        expect(entity!.industry).toBe('SaaS');

        // Assert: Entity has SaaS industry data
        expect(entity!.industryData).toBeDefined();
        expect(entity!.industryData?.industry).toBe('SaaS');
        expect(entity!.industryData?.entityType).toBe('institution');

        // Assert: SaaS-specific fields are mapped correctly
        const saasData = entity!.industryData as any;
        expect(saasData.companySize).toBe(school.nominalRoll || 0);
        expect(saasData.planType).toBe(
          school.subscriptionPackageName || school.subscriptionPackageId || 'unknown'
        );
        expect(saasData.signupDate).toBe(school.implementationDate || school.createdAt);

        // Assert: Features are mapped from modules
        if (school.modules && school.modules.length > 0) {
          expect(saasData.features).toBeDefined();
          expect(Array.isArray(saasData.features)).toBe(true);
          expect(saasData.features.length).toBe(school.modules.length);
        }

        // Assert: Billing fields are preserved
        expect(saasData.billingAddress).toBe(school.billingAddress);
        expect(saasData.currency).toBe(school.currency || 'GHS');
        expect(saasData.subscriptionRate).toBe(school.subscriptionRate);

        // Assert: Account status is inferred
        expect(saasData.accountStatus).toBeDefined();
        expect(['lead', 'trial', 'active', 'suspended', 'churned']).toContain(saasData.accountStatus);

        // Assert: Entity contacts are mapped from focal persons
        expect(entity!.entityContacts).toBeDefined();
        expect(Array.isArray(entity!.entityContacts)).toBe(true);

        // Assert: Institution data is preserved for backward compatibility
        expect(entity!.institutionData).toBeDefined();
        expect(entity!.institutionData?.nominalRoll).toBe(school.nominalRoll);
        expect(entity!.institutionData?.subscriptionPackageId).toBe(school.subscriptionPackageId);
        expect(entity!.institutionData?.logoUrl).toBe(school.logoUrl);

        // Assert: Migration status is set
        expect(entity!.migrationStatus).toBe(school.migrationStatus || 'legacy');
        expect(entity!.legacySchoolId).toBe(school.id);

        // Assert: Timestamps are preserved
        expect(entity!.createdAt).toBe(school.createdAt);
        expect(entity!.updatedAt).toBeDefined();
      }),
      { numRuns: 100 } // Run 100 iterations as specified
    );
  });

  it('should handle getEntity with migrationStatus: legacy correctly', async () => {
    await fc.assert(
      fc.asyncProperty(schoolArbitrary, async (school) => {
        // Setup: Add school to mock storage
        __testStorage.schools.set(school.id, school);

        // Act: Get entity with legacy migration status
        const entity = await getEntity(school.id, 'legacy');

        // Assert: Entity exists and is read from schools collection
        expect(entity).not.toBeNull();
        expect(entity!.id).toBe(school.id);
        expect(entity!.industry).toBe('SaaS');
        expect(entity!.legacySchoolId).toBe(school.id);

        // Assert: Entity has valid SaaS data
        expect(entity!.industryData).toBeDefined();
        expect(entity!.industryData?.industry).toBe('SaaS');
      }),
      { numRuns: 100 }
    );
  });

  it('should handle getEntity with migrationStatus: dual-write with fallback', async () => {
    await fc.assert(
      fc.asyncProperty(schoolArbitrary, async (school) => {
        // Setup: Add school to mock storage (no entity in entities collection)
        __testStorage.schools.set(school.id, school);

        // Act: Get entity with dual-write migration status (should fallback to schools)
        const entity = await getEntity(school.id, 'dual-write');

        // Assert: Entity exists and is read from schools collection (fallback)
        expect(entity).not.toBeNull();
        expect(entity!.id).toBe(school.id);
        expect(entity!.industry).toBe('SaaS');
      }),
      { numRuns: 100 }
    );
  });

  it('should return null for non-existent legacy schools', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 10, maxLength: 20 }), async (nonExistentId) => {
        // Ensure the ID doesn't exist in storage
        __testStorage.schools.delete(nonExistentId);

        // Act: Try to read non-existent school
        const entity = await readFromLegacySchools(nonExistentId);

        // Assert: Returns null
        expect(entity).toBeNull();
      }),
      { numRuns: 50 }
    );
  });
});

describe('Property 8: Migration Idempotency - Transformation Consistency', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
  });

  it('should produce identical results when mapSchoolToSaaSEntity is run twice', async () => {
    await fc.assert(
      fc.asyncProperty(schoolArbitrary, async (school) => {
        // Act: Transform school to entity twice
        const entity1 = await mapSchoolToSaaSEntity(school);
        const entity2 = await mapSchoolToSaaSEntity(school);

        // Assert: Core fields are identical
        expect(entity1.id).toBe(entity2.id);
        expect(entity1.organizationId).toBe(entity2.organizationId);
        expect(entity1.entityType).toBe(entity2.entityType);
        expect(entity1.name).toBe(entity2.name);
        expect(entity1.slug).toBe(entity2.slug);
        expect(entity1.industry).toBe(entity2.industry);
        expect(entity1.industry).toBe('SaaS');

        // Assert: Industry data is identical
        expect(entity1.industryData).toEqual(entity2.industryData);

        // Assert: SaaS-specific fields are identical
        const saasData1 = entity1.industryData as any;
        const saasData2 = entity2.industryData as any;
        expect(saasData1.companySize).toBe(saasData2.companySize);
        expect(saasData1.planType).toBe(saasData2.planType);
        expect(saasData1.features).toEqual(saasData2.features);
        expect(saasData1.signupDate).toBe(saasData2.signupDate);
        expect(saasData1.accountStatus).toBe(saasData2.accountStatus);
        expect(saasData1.customerTier).toBe(saasData2.customerTier);

        // Assert: Billing fields are identical
        expect(saasData1.billingAddress).toBe(saasData2.billingAddress);
        expect(saasData1.currency).toBe(saasData2.currency);
        expect(saasData1.subscriptionRate).toBe(saasData2.subscriptionRate);

        // Assert: Institution data is identical
        expect(entity1.institutionData).toEqual(entity2.institutionData);

        // Assert: Entity contacts are identical
        expect(entity1.entityContacts).toEqual(entity2.entityContacts);

        // Assert: Migration fields are identical
        expect(entity1.migrationStatus).toBe(entity2.migrationStatus);
        expect(entity1.legacySchoolId).toBe(entity2.legacySchoolId);

        // Assert: Timestamps are identical
        expect(entity1.createdAt).toBe(entity2.createdAt);
      }),
      { numRuns: 100 }
    );
  });

  it('should produce identical results when transforming an already-transformed entity', async () => {
    await fc.assert(
      fc.asyncProperty(schoolArbitrary, async (school) => {
        // Act: Transform school to entity
        const entity1 = await mapSchoolToSaaSEntity(school);

        // Get the accountStatus from the first transformation
        const saasData1 = entity1.industryData as any;
        const accountStatus = saasData1.accountStatus;

        // Map accountStatus back to lifecycleStatus for round-trip
        let lifecycleStatus: string | undefined;
        if (accountStatus === 'lead') lifecycleStatus = 'Lead';
        else if (accountStatus === 'trial') lifecycleStatus = 'Onboarding';
        else if (accountStatus === 'active') lifecycleStatus = 'Active';
        else if (accountStatus === 'churned') lifecycleStatus = 'Churned';
        else lifecycleStatus = school.lifecycleStatus;

        // Determine status based on accountStatus
        const status = accountStatus === 'churned' ? 'Inactive' : (entity1.status === 'archived' ? 'Archived' : 'Active');

        // Create a "school" representation of the entity (simulating round-trip)
        const entityAsSchool: School = {
          id: entity1.id,
          organizationId: entity1.organizationId,
          name: entity1.name,
          slug: entity1.slug || '',
          logoUrl: entity1.institutionData?.logoUrl || '',
          workspaceIds: school.workspaceIds,
          status: status as any,
          schoolStatus: school.schoolStatus,
          pipelineId: school.pipelineId,
          stage: school.stage,
          focalPersons: school.focalPersons,
          nominalRoll: entity1.institutionData?.nominalRoll,
          subscriptionPackageId: entity1.institutionData?.subscriptionPackageId,
          subscriptionPackageName: school.subscriptionPackageName,
          subscriptionRate: entity1.institutionData?.subscriptionRate,
          billingAddress: entity1.institutionData?.billingAddress,
          currency: entity1.institutionData?.currency,
          modules: entity1.institutionData?.modules,
          implementationDate: entity1.institutionData?.implementationDate,
          referee: entity1.institutionData?.referee,
          createdAt: entity1.createdAt,
          updatedAt: entity1.updatedAt,
          migrationStatus: entity1.migrationStatus,
          lifecycleStatus: lifecycleStatus,
        };

        // Act: Transform again
        const entity2 = await mapSchoolToSaaSEntity(entityAsSchool);

        // Assert: Core fields remain identical
        expect(entity2.id).toBe(entity1.id);
        expect(entity2.name).toBe(entity1.name);
        expect(entity2.industry).toBe('SaaS');
        expect(entity2.entityType).toBe('institution');

        // Assert: SaaS data remains consistent
        const saasData2 = entity2.industryData as any;
        expect(saasData2.companySize).toBe(saasData1.companySize);
        expect(saasData2.planType).toBe(saasData1.planType);
        expect(saasData2.accountStatus).toBe(saasData1.accountStatus);

        // Assert: Transformation is idempotent
        expect(entity2.industryData).toEqual(entity1.industryData);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle schools with minimal data idempotently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 10, maxLength: 20 }),
          organizationId: fc.string({ minLength: 10, maxLength: 20 }),
          name: fc.string({ minLength: 5, maxLength: 50 }),
          slug: fc.string({ minLength: 5, maxLength: 50 }),
          workspaceIds: fc.array(fc.string({ minLength: 10, maxLength: 20 }), { minLength: 1, maxLength: 1 }),
          status: fc.constantFrom('Active', 'Inactive'),
          schoolStatus: fc.string({ minLength: 5, maxLength: 30 }),
          pipelineId: fc.string({ minLength: 10, maxLength: 20 }),
          focalPersons: fc.constant([] as any[]),
          createdAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() })
            .map(timestamp => new Date(timestamp).toISOString()),
        }),
        async (minimalSchool) => {
          // Act: Transform minimal school twice
          const entity1 = await mapSchoolToSaaSEntity(minimalSchool as any);
          const entity2 = await mapSchoolToSaaSEntity(minimalSchool as any);

          // Assert: Results are identical
          expect(entity1).toEqual(entity2);

          // Assert: Default values are consistent
          const saasData1 = entity1.industryData as any;
          const saasData2 = entity2.industryData as any;
          expect(saasData1.companySize).toBe(0); // Default for undefined nominalRoll
          expect(saasData2.companySize).toBe(0);
          expect(saasData1.planType).toBe('unknown'); // Default for undefined subscription
          expect(saasData2.planType).toBe('unknown');
          expect(saasData1.features).toEqual([]); // Default for undefined modules
          expect(saasData2.features).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all SaaS-specific fields through transformation', async () => {
    await fc.assert(
      fc.asyncProperty(schoolArbitrary, async (school) => {
        // Act: Transform school to entity
        const entity = await mapSchoolToSaaSEntity(school);

        // Assert: All expected SaaS fields are present
        const saasData = entity.industryData as any;
        expect(saasData).toHaveProperty('industry');
        expect(saasData).toHaveProperty('entityType');
        expect(saasData).toHaveProperty('companySize');
        expect(saasData).toHaveProperty('planType');
        expect(saasData).toHaveProperty('features');
        expect(saasData).toHaveProperty('signupDate');
        expect(saasData).toHaveProperty('accountStatus');
        expect(saasData).toHaveProperty('billingAddress');
        expect(saasData).toHaveProperty('currency');
        expect(saasData).toHaveProperty('subscriptionRate');
        expect(saasData).toHaveProperty('customerTier');
        expect(saasData).toHaveProperty('trialIds');
        expect(saasData).toHaveProperty('onboardingIds');
        expect(saasData).toHaveProperty('subscriptionIds');
        expect(saasData).toHaveProperty('supportTicketIds');
        expect(saasData).toHaveProperty('healthScoreIds');

        // Assert: Collection references are initialized as empty arrays
        expect(Array.isArray(saasData.trialIds)).toBe(true);
        expect(Array.isArray(saasData.onboardingIds)).toBe(true);
        expect(Array.isArray(saasData.subscriptionIds)).toBe(true);
        expect(Array.isArray(saasData.supportTicketIds)).toBe(true);
        expect(Array.isArray(saasData.healthScoreIds)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 7 & 8: Integration - End-to-End Dual-Read Pattern', () => {
  beforeEach(() => {
    __testStorage.reset();
    vi.clearAllMocks();
  });

  it('should read legacy entities consistently through getEntity', async () => {
    await fc.assert(
      fc.asyncProperty(schoolArbitrary, async (school) => {
        // Setup: Add school to mock storage
        __testStorage.schools.set(school.id, school);

        // Act: Read entity multiple times with different migration statuses
        const entityLegacy = await getEntity(school.id, 'legacy');
        const entityDualWrite = await getEntity(school.id, 'dual-write');

        // Assert: Both return valid entities
        expect(entityLegacy).not.toBeNull();
        expect(entityDualWrite).not.toBeNull();

        // Assert: Both have industry: 'SaaS'
        expect(entityLegacy!.industry).toBe('SaaS');
        expect(entityDualWrite!.industry).toBe('SaaS');

        // Assert: Core data is consistent
        expect(entityLegacy!.name).toBe(school.name);
        expect(entityDualWrite!.name).toBe(school.name);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle migrated entities correctly', async () => {
    await fc.assert(
      fc.asyncProperty(schoolArbitrary, async (school) => {
        // Setup: Create a migrated entity
        const migratedEntity = await mapSchoolToSaaSEntity(school);
        migratedEntity.migrationStatus = 'migrated';
        __testStorage.entities.set(school.id, migratedEntity);

        // Act: Read entity with migrated status
        const entity = await getEntity(school.id, 'migrated');

        // Assert: Entity is read from entities collection
        expect(entity).not.toBeNull();
        expect(entity!.id).toBe(school.id);
        expect(entity!.industry).toBe('SaaS');
        expect(entity!.migrationStatus).toBe('migrated');
      }),
      { numRuns: 100 }
    );
  });

  it('should return null for non-existent entities in migrated mode', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 10, maxLength: 20 }), async (nonExistentId) => {
        // Ensure the ID doesn't exist in storage
        __testStorage.entities.delete(nonExistentId);

        // Act: Try to read non-existent entity
        const entity = await getEntity(nonExistentId, 'migrated');

        // Assert: Returns null
        expect(entity).toBeNull();
      }),
      { numRuns: 50 }
    );
  });
});
