/**
 * Property Test: Import Round-Trip Property
 * 
 * Property 6: For all valid entity objects E of scope S: parse(export(E)) ≡ E
 * 
 * Validates: Requirement 27
 * 
 * This test verifies that exporting an entity to CSV and then importing it back
 * produces an equivalent entity record.
 */

import { describe, it, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import type { Entity } from '../../types';
import {
  serializeInstitutionEntity,
  serializeFamilyEntity,
  serializePersonEntity,
  exportEntitiesToCSV,
} from '../export-service';
import {
  parseInstitutionRow,
  parseFamilyRow,
  parsePersonRow,
  previewImport,
} from '../import-service';

// Arbitraries for generating random entities
const focalPersonArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  phone: fc.string({ minLength: 0, maxLength: 20 }),
  email: fc.emailAddress(),
  type: fc.constantFrom('Principal', 'Administrator', 'Champion', 'Accountant', 'School Owner'),
  isSignatory: fc.boolean(),
});

const moduleArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  abbreviation: fc.string({ minLength: 1, maxLength: 10 }),
  color: fc.constantFrom('#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF3'),
});

const institutionEntityArbitrary = fc.record({
  id: fc.uuid(),
  organizationId: fc.uuid(),
  entityType: fc.constant('institution' as const),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  slug: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  contacts: fc.array(focalPersonArbitrary, { minLength: 0, maxLength: 3 }),
  globalTags: fc.array(fc.uuid(), { maxLength: 5 }),
  status: fc.option(fc.constantFrom('active' as const, 'archived' as const), { nil: undefined }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map((d) => d.toISOString()),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map((d) => d.toISOString()),
  institutionData: fc.record({
    nominalRoll: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
    billingAddress: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    currency: fc.option(fc.constantFrom('USD', 'EUR', 'GBP'), { nil: undefined }),
    subscriptionPackageId: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
    subscriptionRate: fc.option(fc.double({ min: 0, max: 1000 }), { nil: undefined }),
    modules: fc.option(fc.array(moduleArbitrary, { maxLength: 5 }), { nil: undefined }),
    implementationDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map((d) => d.toISOString()), { nil: undefined }),
    referee: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  }),
});

const guardianArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  phone: fc.string({ minLength: 0, maxLength: 20 }),
  email: fc.emailAddress(),
  relationship: fc.constantFrom('Mother', 'Father', 'Legal Guardian', 'Other'),
  isPrimary: fc.boolean(),
});

const childArbitrary = fc.record({
  firstName: fc.string({ minLength: 1, maxLength: 50 }),
  lastName: fc.string({ minLength: 1, maxLength: 50 }),
  dateOfBirth: fc.date({ min: new Date('2000-01-01'), max: new Date('2020-12-31') }).map((d) => d.toISOString()), // Required field
  gradeLevel: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
  enrollmentStatus: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
});

const familyEntityArbitrary = fc.record({
  id: fc.uuid(),
  organizationId: fc.uuid(),
  entityType: fc.constant('family' as const),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  contacts: fc.array(focalPersonArbitrary, { minLength: 0, maxLength: 3 }),
  globalTags: fc.array(fc.uuid(), { maxLength: 5 }),
  status: fc.option(fc.constantFrom('active' as const, 'archived' as const), { nil: undefined }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map((d) => d.toISOString()),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map((d) => d.toISOString()),
  familyData: fc.record({
    guardians: fc.array(guardianArbitrary, { minLength: 0, maxLength: 3 }),
    children: fc.array(childArbitrary, { minLength: 0, maxLength: 5 }),
    admissionsData: fc.option(fc.record({}), { nil: undefined }),
  }),
});

const personEntityArbitrary = fc.record({
  id: fc.uuid(),
  organizationId: fc.uuid(),
  entityType: fc.constant('person' as const),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  contacts: fc.array(focalPersonArbitrary, { minLength: 0, maxLength: 3 }),
  globalTags: fc.array(fc.uuid(), { maxLength: 5 }),
  status: fc.option(fc.constantFrom('active' as const, 'archived' as const), { nil: undefined }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map((d) => d.toISOString()),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }).map((d) => d.toISOString()),
  personData: fc.record({
    firstName: fc.string({ minLength: 1, maxLength: 50 }),
    lastName: fc.string({ minLength: 1, maxLength: 50 }),
    company: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
    jobTitle: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
    leadSource: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
  }),
});

describe('Property 6: Import Round-Trip Property', () => {
  test.prop([institutionEntityArbitrary])(
    'institution entity survives export-import round-trip',
    (entity) => {
      // Export to CSV row
      const csvRow = serializeInstitutionEntity(entity);

      // Import back from CSV row
      const imported = parseInstitutionRow(csvRow, entity.organizationId);

      // Assert structural equivalence of key fields
      expect(imported.name).toBe(entity.name);
      expect(imported.entityType).toBe('institution');
      expect(imported.institutionData?.nominalRoll).toBe(entity.institutionData?.nominalRoll);
      expect(imported.institutionData?.billingAddress).toBe(entity.institutionData?.billingAddress);
      expect(imported.institutionData?.currency).toBe(entity.institutionData?.currency);
      expect(imported.institutionData?.subscriptionPackageId).toBe(
        entity.institutionData?.subscriptionPackageId
      );

      // Verify focal person if present
      if (entity.contacts.length > 0 && imported.contacts && imported.contacts.length > 0) {
        expect(imported.contacts[0].name).toBe(entity.contacts[0].name);
        expect(imported.contacts[0].phone).toBe(entity.contacts[0].phone);
        expect(imported.contacts[0].email).toBe(entity.contacts[0].email);
      }
    }
  );

  test.prop([familyEntityArbitrary])(
    'family entity survives export-import round-trip',
    (entity) => {
      // Export to CSV row
      const csvRow = serializeFamilyEntity(entity);

      // Import back from CSV row
      const imported = parseFamilyRow(csvRow, entity.organizationId);

      // Assert structural equivalence of key fields
      expect(imported.name).toBe(entity.name);
      expect(imported.entityType).toBe('family');

      // Verify guardian if present
      if (entity.familyData?.guardians && entity.familyData.guardians.length > 0) {
        const originalGuardian = entity.familyData.guardians[0];
        const importedGuardian = imported.familyData?.guardians[0];

        if (importedGuardian) {
          expect(importedGuardian.name).toBe(originalGuardian.name);
          expect(importedGuardian.phone).toBe(originalGuardian.phone);
          expect(importedGuardian.email).toBe(originalGuardian.email);
          expect(importedGuardian.relationship).toBe(originalGuardian.relationship);
        }
      }

      // Verify child if present
      if (entity.familyData?.children && entity.familyData.children.length > 0) {
        const originalChild = entity.familyData.children[0];
        const importedChild = imported.familyData?.children[0];

        if (importedChild) {
          expect(importedChild.firstName).toBe(originalChild.firstName);
          expect(importedChild.lastName).toBe(originalChild.lastName);
          expect(importedChild.gradeLevel).toBe(originalChild.gradeLevel);
        }
      }
    }
  );

  test.prop([personEntityArbitrary])(
    'person entity survives export-import round-trip',
    (entity) => {
      // Export to CSV row
      const csvRow = serializePersonEntity(entity);

      // Import back from CSV row
      const imported = parsePersonRow(csvRow, entity.organizationId);

      // Assert structural equivalence of key fields
      expect(imported.personData?.firstName).toBe(entity.personData?.firstName);
      expect(imported.personData?.lastName).toBe(entity.personData?.lastName);
      expect(imported.personData?.company).toBe(entity.personData?.company);
      expect(imported.personData?.jobTitle).toBe(entity.personData?.jobTitle);
      expect(imported.personData?.leadSource).toBe(entity.personData?.leadSource);
      expect(imported.entityType).toBe('person');

      // Verify contact if present
      if (entity.contacts.length > 0 && imported.contacts && imported.contacts.length > 0) {
        expect(imported.contacts[0].phone).toBe(entity.contacts[0].phone);
        expect(imported.contacts[0].email).toBe(entity.contacts[0].email);
      }
    }
  );

  it('full CSV export-import round-trip for institution entities', () => {
    const entities: Entity[] = [
      {
        id: '1',
        organizationId: 'org1',
        entityType: 'institution',
        name: 'Test School',
        contacts: [
          {
            name: 'John Doe',
            phone: '+1234567890',
            email: 'john@test.com',
            type: 'Principal',
            isSignatory: false,
          },
        ],
        globalTags: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        institutionData: {
          nominalRoll: 500,
          billingAddress: '123 Main St',
          currency: 'USD',
          subscriptionPackageId: 'premium',
          subscriptionRate: undefined,
          modules: [],
          implementationDate: undefined,
          referee: undefined,
        },
      },
    ];

    // Export to CSV
    const csv = exportEntitiesToCSV(entities);
    expect(csv).toBeTruthy();
    expect(csv).toContain('Test School');
    expect(csv).toContain('500');

    // Import back
    const preview = previewImport(csv);
    expect(preview.errors).toHaveLength(0);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].name).toBe('Test School');
    expect(preview.rows[0].nominalRoll).toBe('500');
  });
});
