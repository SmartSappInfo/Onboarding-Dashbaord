/**
 * @fileOverview Unit & Contract Tests for State Version & Optimistic Concurrency Engine (Phase 14 Milestone 2)
 *
 * Rules verified:
 * - Rule 4 (Strict Typing): Zero any, strict Zod v4 schemas
 * - Rule 11 (Mathematical Determinism): Version sequence validation
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard): Version contracts
 * - Rule 22 (Cryptographic Hash Binding): 64-char SHA-256 state hash validation
 * - Rule 48 (Sanitized Error Taxonomy): Status code mapping
 */

import { describe, it, expect } from 'vitest';
import {
  ConcurrencyViolationTypeSchema,
  ResourceSnapshotSchema,
  VersionValidationResultSchema,
  StateVersionMatrixEntrySchema,
  CONCURRENCY_ERROR_CODES,
  StateConcurrencyError,
  type ConcurrencyViolationType,
  type ResourceSnapshot,
  type VersionValidationResult,
  type StateVersionMatrixEntry,
} from '@/platform/verification/concurrency';

describe('Phase 14 Milestone 2 - Concurrency Contracts & Schemas', () => {
  describe('ConcurrencyViolationTypeSchema', () => {
    it('accepts valid violation types', () => {
      const validTypes: ConcurrencyViolationType[] = [
        'NONE',
        'STALE_READ',
        'CONCURRENT_MUTATION',
        'DELETED_RESOURCE',
        'HASH_DRIFT',
      ];

      for (const vt of validTypes) {
        expect(ConcurrencyViolationTypeSchema.parse(vt)).toBe(vt);
      }
    });

    it('rejects unrecognized violation types', () => {
      expect(() => ConcurrencyViolationTypeSchema.parse('UNRECOGNIZED')).toThrow();
      expect(() => ConcurrencyViolationTypeSchema.parse('')).toThrow();
    });
  });

  describe('ResourceSnapshotSchema', () => {
    const validSnapshot: ResourceSnapshot = {
      resourceId: 'entity_123',
      resourceType: 'crm_entity',
      organizationId: 'org_enterprise_001',
      workspaceId: 'ws_sales_001',
      version: 3,
      stateHash: 'a'.repeat(64),
      capturedAt: '2026-10-08T12:00:00.000Z',
      attributes: {
        firstName: 'John',
        lastName: 'Doe',
        stage: 'PROSPECT',
      },
    };

    it('parses a valid resource snapshot with numeric version', () => {
      const parsed = ResourceSnapshotSchema.parse(validSnapshot);
      expect(parsed.resourceId).toBe('entity_123');
      expect(parsed.version).toBe(3);
      expect(parsed.stateHash).toHaveLength(64);
    });

    it('parses a valid resource snapshot with string version', () => {
      const parsed = ResourceSnapshotSchema.parse({
        ...validSnapshot,
        version: 'v3.2.1',
      });
      expect(parsed.version).toBe('v3.2.1');
    });

    it('rejects snapshot with invalid stateHash length', () => {
      expect(() =>
        ResourceSnapshotSchema.parse({
          ...validSnapshot,
          stateHash: 'invalid_short_hash',
        })
      ).toThrow();
    });

    it('rejects snapshot with missing Anti-IDOR tenant identifiers', () => {
      expect(() =>
        ResourceSnapshotSchema.parse({
          ...validSnapshot,
          organizationId: '',
        })
      ).toThrow();

      expect(() =>
        ResourceSnapshotSchema.parse({
          ...validSnapshot,
          workspaceId: '',
        })
      ).toThrow();
    });

    it('rejects snapshot with invalid ISO datetime', () => {
      expect(() =>
        ResourceSnapshotSchema.parse({
          ...validSnapshot,
          capturedAt: 'not-a-datetime',
        })
      ).toThrow();
    });
  });

  describe('VersionValidationResultSchema', () => {
    const validResult: VersionValidationResult = {
      isCurrent: true,
      resourceId: 'deal_789',
      resourceType: 'deal',
      expectedVersion: 2,
      actualVersion: 2,
      driftDetected: false,
      violationType: 'NONE',
      message: 'Resource version is current and unmodified',
      capturedAt: '2026-10-08T12:00:00.000Z',
    };

    it('parses a clean validation result without drift', () => {
      const parsed = VersionValidationResultSchema.parse(validResult);
      expect(parsed.isCurrent).toBe(true);
      expect(parsed.driftDetected).toBe(false);
      expect(parsed.violationType).toBe('NONE');
    });

    it('parses a stale read violation result', () => {
      const staleResult: VersionValidationResult = {
        ...validResult,
        isCurrent: false,
        actualVersion: 4,
        driftDetected: true,
        violationType: 'STALE_READ',
        message: 'Resource was updated by another actor (expected 2, actual 4)',
      };
      const parsed = VersionValidationResultSchema.parse(staleResult);
      expect(parsed.isCurrent).toBe(false);
      expect(parsed.violationType).toBe('STALE_READ');
      expect(parsed.actualVersion).toBe(4);
    });

    it('parses a deleted resource result with null actualVersion', () => {
      const deletedResult: VersionValidationResult = {
        ...validResult,
        isCurrent: false,
        actualVersion: null,
        driftDetected: true,
        violationType: 'DELETED_RESOURCE',
        message: 'Target resource has been deleted',
      };
      const parsed = VersionValidationResultSchema.parse(deletedResult);
      expect(parsed.isCurrent).toBe(false);
      expect(parsed.actualVersion).toBeNull();
      expect(parsed.violationType).toBe('DELETED_RESOURCE');
    });
  });

  describe('StateVersionMatrixEntrySchema', () => {
    it('validates a correct matrix registry entry', () => {
      const entry: StateVersionMatrixEntry = {
        resourceType: 'crm_entity',
        collectionPath: '/entities',
        versionField: 'version',
        leaseDurationMs: 30000,
        requiresHashValidation: true,
      };
      const parsed = StateVersionMatrixEntrySchema.parse(entry);
      expect(parsed.resourceType).toBe('crm_entity');
      expect(parsed.leaseDurationMs).toBe(30000);
      expect(parsed.requiresHashValidation).toBe(true);
    });

    it('rejects negative or zero lease duration', () => {
      expect(() =>
        StateVersionMatrixEntrySchema.parse({
          resourceType: 'deal',
          collectionPath: '/deals',
          versionField: 'stageVersion',
          leaseDurationMs: 0,
          requiresHashValidation: true,
        })
      ).toThrow();
    });
  });

  describe('CONCURRENCY_ERROR_CODES & StateConcurrencyError', () => {
    it('verifies all canonical error codes are defined', () => {
      expect(CONCURRENCY_ERROR_CODES.STALE_VERSION_DETECTED).toBe('STALE_VERSION_DETECTED');
      expect(CONCURRENCY_ERROR_CODES.CONCURRENT_MUTATION_CONFLICT).toBe('CONCURRENT_MUTATION_CONFLICT');
      expect(CONCURRENCY_ERROR_CODES.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
      expect(CONCURRENCY_ERROR_CODES.STATE_HASH_MISMATCH).toBe('STATE_HASH_MISMATCH');
      expect(CONCURRENCY_ERROR_CODES.CONCURRENCY_DEAD_MAN_PAUSED).toBe('CONCURRENCY_DEAD_MAN_PAUSED');
      expect(CONCURRENCY_ERROR_CODES.CONCURRENCY_TIMEOUT).toBe('CONCURRENCY_TIMEOUT');
      expect(CONCURRENCY_ERROR_CODES.INVALID_SNAPSHOT_CONTEXT).toBe('INVALID_SNAPSHOT_CONTEXT');
      expect(CONCURRENCY_ERROR_CODES.IDOR_VIOLATION).toBe('IDOR_VIOLATION');
    });

    it('resolves expected HTTP status codes for each error', () => {
      const errStale = new StateConcurrencyError('STALE_VERSION_DETECTED', 'Version stale');
      expect(errStale.statusCode).toBe(409);

      const errConcurrent = new StateConcurrencyError('CONCURRENT_MUTATION_CONFLICT', 'Conflict');
      expect(errConcurrent.statusCode).toBe(409);

      const errHash = new StateConcurrencyError('STATE_HASH_MISMATCH', 'Hash mismatch');
      expect(errHash.statusCode).toBe(409);

      const errNotFound = new StateConcurrencyError('RESOURCE_NOT_FOUND', 'Not found');
      expect(errNotFound.statusCode).toBe(404);

      const errIdor = new StateConcurrencyError('IDOR_VIOLATION', 'Cross-tenant probe');
      expect(errIdor.statusCode).toBe(403);

      const errDeadMan = new StateConcurrencyError('CONCURRENCY_DEAD_MAN_PAUSED', 'Paused');
      expect(errDeadMan.statusCode).toBe(503);

      const errTimeout = new StateConcurrencyError('CONCURRENCY_TIMEOUT', 'Timeout');
      expect(errTimeout.statusCode).toBe(504);

      const errInvalid = new StateConcurrencyError('INVALID_SNAPSHOT_CONTEXT', 'Bad context');
      expect(errInvalid.statusCode).toBe(400);
    });

    it('allows custom status code override', () => {
      const customErr = new StateConcurrencyError('STALE_VERSION_DETECTED', 'Stale', 412);
      expect(customErr.statusCode).toBe(412);
      expect(customErr instanceof Error).toBe(true);
      expect(customErr instanceof StateConcurrencyError).toBe(true);
      expect(customErr.name).toBe('StateConcurrencyError');
    });
  });
});
