/**
 * @fileOverview Unit & Policy Tests for State Version Matrix (Phase 14 Milestone 2)
 *
 * Rules verified:
 * - Rule 10 (Inline Architectural Documentation): Clear matrix lookups
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard): Registered resources
 * - Rule 23 (Resource Governance & Quotas): Lease durations
 */

import { describe, it, expect } from 'vitest';
import {
  STATE_VERSION_MATRIX,
  getStateVersionPolicy,
  assertStateVersionPolicy,
  getAllStateVersionPolicies,
  isHashValidationRequired,
  getVersionFieldName,
  getLeaseDurationMs,
  StateConcurrencyError,
} from '@/platform/verification/concurrency';

describe('Phase 14 Milestone 2 - State Version Matrix Registry', () => {
  it('contains all required core business resources in STATE_VERSION_MATRIX', () => {
    const requiredResources = [
      'crm_entity',
      'deal',
      'invoice',
      'installment_plan',
      'knowledge_fact',
      'mesh_task',
    ];

    for (const rType of requiredResources) {
      const entry = STATE_VERSION_MATRIX[rType];
      expect(entry).toBeDefined();
      expect(entry.resourceType).toBe(rType);
      expect(entry.collectionPath).toBeTruthy();
      expect(entry.versionField).toBeTruthy();
      expect(entry.leaseDurationMs).toBeGreaterThan(0);
      expect(entry.requiresHashValidation).toBe(true);
    }
  });

  describe('getStateVersionPolicy & assertStateVersionPolicy', () => {
    it('retrieves policy for registered crm_entity', () => {
      const policy = getStateVersionPolicy('crm_entity');
      expect(policy).not.toBeNull();
      expect(policy?.versionField).toBe('version');
      expect(policy?.leaseDurationMs).toBe(30000);
    });

    it('retrieves policy for deal with stageVersion field', () => {
      const policy = getStateVersionPolicy('deal');
      expect(policy).not.toBeNull();
      expect(policy?.versionField).toBe('stageVersion');
      expect(policy?.leaseDurationMs).toBe(15000);
    });

    it('retrieves policy for invoice with 60s lease', () => {
      const policy = getStateVersionPolicy('invoice');
      expect(policy).not.toBeNull();
      expect(policy?.versionField).toBe('version');
      expect(policy?.leaseDurationMs).toBe(60000);
    });

    it('returns null for unregistered resource in getStateVersionPolicy', () => {
      expect(getStateVersionPolicy('unknown_custom_resource')).toBeNull();
    });

    it('assertStateVersionPolicy returns entry or throws StateConcurrencyError', () => {
      const dealPolicy = assertStateVersionPolicy('deal');
      expect(dealPolicy.resourceType).toBe('deal');

      expect(() => assertStateVersionPolicy('non_existent_entity')).toThrow(
        StateConcurrencyError
      );
    });
  });

  describe('getAllStateVersionPolicies', () => {
    it('returns an array of all registered policies', () => {
      const policies = getAllStateVersionPolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThanOrEqual(6);
      expect(policies.some((p) => p.resourceType === 'deal')).toBe(true);
      expect(policies.some((p) => p.resourceType === 'crm_entity')).toBe(true);
    });
  });

  describe('Helper Getters', () => {
    it('getVersionFieldName returns correct field or defaults to version', () => {
      expect(getVersionFieldName('deal')).toBe('stageVersion');
      expect(getVersionFieldName('crm_entity')).toBe('version');
      expect(getVersionFieldName('unregistered_entity')).toBe('version');
    });

    it('getLeaseDurationMs returns duration or defaults to 30,000ms', () => {
      expect(getLeaseDurationMs('deal')).toBe(15000);
      expect(getLeaseDurationMs('invoice')).toBe(60000);
      expect(getLeaseDurationMs('unregistered_entity')).toBe(30000);
    });

    it('isHashValidationRequired returns true for registered and unregistered fallback', () => {
      expect(isHashValidationRequired('crm_entity')).toBe(true);
      expect(isHashValidationRequired('unregistered_entity')).toBe(true);
    });
  });
});
