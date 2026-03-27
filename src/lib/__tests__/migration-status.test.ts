import { describe, it, expect } from 'vitest';
import {
  isMigrated,
  isLegacy,
  isDualWrite,
  getMigrationStatusDescription,
} from '../migration-status-utils';
import type { MigrationStatus } from '../types';

/**
 * Test suite for migration status helper functions
 * 
 * Task: 16.2 - Add migrationStatus field to schools collection
 * Requirements: 18 (Backward Compatibility)
 * 
 * These tests verify that the migration status helper functions correctly
 * identify the migration state of school records.
 */
describe('Migration Status Helper Functions', () => {
  describe('isMigrated', () => {
    it('should return true for "migrated" status', () => {
      expect(isMigrated('migrated')).toBe(true);
    });

    it('should return false for "legacy" status', () => {
      expect(isMigrated('legacy')).toBe(false);
    });

    it('should return false for "dual-write" status', () => {
      expect(isMigrated('dual-write')).toBe(false);
    });

    it('should return false for undefined status', () => {
      expect(isMigrated(undefined)).toBe(false);
    });
  });

  describe('isLegacy', () => {
    it('should return true for "legacy" status', () => {
      expect(isLegacy('legacy')).toBe(true);
    });

    it('should return true for undefined status (default to legacy)', () => {
      expect(isLegacy(undefined)).toBe(true);
    });

    it('should return false for "migrated" status', () => {
      expect(isLegacy('migrated')).toBe(false);
    });

    it('should return false for "dual-write" status', () => {
      expect(isLegacy('dual-write')).toBe(false);
    });
  });

  describe('isDualWrite', () => {
    it('should return true for "dual-write" status', () => {
      expect(isDualWrite('dual-write')).toBe(true);
    });

    it('should return false for "legacy" status', () => {
      expect(isDualWrite('legacy')).toBe(false);
    });

    it('should return false for "migrated" status', () => {
      expect(isDualWrite('migrated')).toBe(false);
    });

    it('should return false for undefined status', () => {
      expect(isDualWrite(undefined)).toBe(false);
    });
  });

  describe('getMigrationStatusDescription', () => {
    it('should return correct description for "migrated" status', () => {
      expect(getMigrationStatusDescription('migrated')).toBe(
        'Fully migrated to new entities model'
      );
    });

    it('should return correct description for "legacy" status', () => {
      expect(getMigrationStatusDescription('legacy')).toBe(
        'Using legacy schools collection'
      );
    });

    it('should return correct description for "dual-write" status', () => {
      expect(getMigrationStatusDescription('dual-write')).toBe(
        'Transitional state - writes go to both old and new models'
      );
    });

    it('should return legacy description for undefined status', () => {
      expect(getMigrationStatusDescription(undefined)).toBe(
        'Using legacy schools collection'
      );
    });
  });

  describe('MigrationStatus type validation', () => {
    it('should accept all valid migration status values', () => {
      const validStatuses: MigrationStatus[] = ['legacy', 'migrated', 'dual-write'];
      
      validStatuses.forEach(status => {
        expect(['legacy', 'migrated', 'dual-write']).toContain(status);
      });
    });

    it('should correctly identify migration states', () => {
      const testCases: Array<{
        status: MigrationStatus | undefined;
        expectedLegacy: boolean;
        expectedMigrated: boolean;
        expectedDualWrite: boolean;
      }> = [
        {
          status: 'legacy',
          expectedLegacy: true,
          expectedMigrated: false,
          expectedDualWrite: false,
        },
        {
          status: 'migrated',
          expectedLegacy: false,
          expectedMigrated: true,
          expectedDualWrite: false,
        },
        {
          status: 'dual-write',
          expectedLegacy: false,
          expectedMigrated: false,
          expectedDualWrite: true,
        },
        {
          status: undefined,
          expectedLegacy: true,
          expectedMigrated: false,
          expectedDualWrite: false,
        },
      ];

      testCases.forEach(({ status, expectedLegacy, expectedMigrated, expectedDualWrite }) => {
        expect(isLegacy(status)).toBe(expectedLegacy);
        expect(isMigrated(status)).toBe(expectedMigrated);
        expect(isDualWrite(status)).toBe(expectedDualWrite);
      });
    });
  });

  describe('Migration status transitions', () => {
    it('should support legacy -> dual-write -> migrated transition', () => {
      const statuses: Array<MigrationStatus | undefined> = [undefined, 'dual-write', 'migrated'];
      
      // Initially legacy (undefined)
      expect(isLegacy(statuses[0])).toBe(true);
      expect(isDualWrite(statuses[0])).toBe(false);
      expect(isMigrated(statuses[0])).toBe(false);
      
      // Then dual-write
      expect(isLegacy(statuses[1])).toBe(false);
      expect(isDualWrite(statuses[1])).toBe(true);
      expect(isMigrated(statuses[1])).toBe(false);
      
      // Finally migrated
      expect(isLegacy(statuses[2])).toBe(false);
      expect(isDualWrite(statuses[2])).toBe(false);
      expect(isMigrated(statuses[2])).toBe(true);
    });

    it('should support direct legacy -> migrated transition', () => {
      const statuses: Array<MigrationStatus | undefined> = [undefined, 'migrated'];
      
      // Initially legacy (undefined)
      expect(isLegacy(statuses[0])).toBe(true);
      expect(isMigrated(statuses[0])).toBe(false);
      
      // Then migrated
      expect(isLegacy(statuses[1])).toBe(false);
      expect(isMigrated(statuses[1])).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple checks on same status', () => {
      const status: MigrationStatus = 'migrated';
      
      // Multiple calls should return consistent results
      expect(isMigrated(status)).toBe(true);
      expect(isMigrated(status)).toBe(true);
      expect(isLegacy(status)).toBe(false);
      expect(isLegacy(status)).toBe(false);
    });

    it('should ensure only one status is true at a time', () => {
      const allStatuses: Array<MigrationStatus | undefined> = [
        undefined,
        'legacy',
        'migrated',
        'dual-write',
      ];

      allStatuses.forEach(status => {
        const checks = [isLegacy(status), isMigrated(status), isDualWrite(status)];
        const trueCount = checks.filter(Boolean).length;
        
        // Exactly one check should be true
        expect(trueCount).toBe(1);
      });
    });
  });
});
