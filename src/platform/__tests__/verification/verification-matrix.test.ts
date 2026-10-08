/**
 * @fileOverview Unit & Integration Tests for Capability Verification Matrix (Phase 14 Milestone 1)
 *
 * Implements Rules 2, 4, 10, 12, 21, 27, 48, 67, and 69.
 * Verifies:
 * - VERIFICATION_POLICY_MATRIX mappings across CRM, Sales, Finance, Knowledge, and Supervisor
 * - Required assertions resolution per capability
 * - Failure strategy resolution (FAIL_AND_COMPENSATE, RECORD_WARNING, ESCALATE_TO_APPROVAL)
 * - Safe fallback for unmapped read-only capabilities
 */

import { describe, it, expect } from 'vitest';
import {
  getVerificationPolicyForCapability,
  getRequiredAssertionsForCapability,
  resolveVerificationFailureStrategy,
  isVerificationRequired,
} from '@/platform/verification/verification-matrix';

describe('Phase 14 Milestone 1 - Capability Verification Matrix', () => {
  describe('VERIFICATION_POLICY_MATRIX Entries', () => {
    it('defines policies for critical mutating CRM capabilities', () => {
      const dealPolicy = getVerificationPolicyForCapability('crm.deal.advance_stage');
      expect(dealPolicy).toBeDefined();
      expect(dealPolicy?.severity).toBe('CRITICAL');
      expect(dealPolicy?.failureStrategy).toBe('FAIL_AND_COMPENSATE');
      expect(dealPolicy?.requiredAssertions).toContain('crm:deal_stage_advanced');

      const entityPolicy = getVerificationPolicyForCapability('crm.entity.update');
      expect(entityPolicy?.severity).toBe('CRITICAL');
      expect(entityPolicy?.requiredAssertions).toContain('crm:entity_updated');

      const notePolicy = getVerificationPolicyForCapability('crm.note.create');
      expect(notePolicy?.severity).toBe('WARNING');
      expect(notePolicy?.failureStrategy).toBe('RECORD_WARNING');
    });

    it('defines policies for critical Sales outreach capabilities', () => {
      const waPolicy = getVerificationPolicyForCapability('sdr.dispatch_whatsapp');
      expect(waPolicy).toBeDefined();
      expect(waPolicy?.severity).toBe('CRITICAL');
      expect(waPolicy?.failureStrategy).toBe('FAIL_AND_COMPENSATE');
      expect(waPolicy?.requiredAssertions).toContain('sales:outreach_sent');

      const emailPolicy = getVerificationPolicyForCapability('sdr.dispatch_email');
      expect(emailPolicy?.requiredAssertions).toContain('sales:outreach_sent');
    });

    it('defines policies for Finance, Knowledge, and Supervisor mesh', () => {
      const finPolicy = getVerificationPolicyForCapability('collections.execute_proposal');
      expect(finPolicy?.requiredAssertions).toContain('finance:remainder_balanced');

      const knowPolicy = getVerificationPolicyForCapability('knowledge.candidate.decide');
      expect(knowPolicy?.requiredAssertions).toContain('knowledge:fact_superseded');

      const meshPolicy = getVerificationPolicyForCapability('supervisor.mesh.route_handoff');
      expect(meshPolicy?.requiredAssertions).toContain('supervisor:delegation_bounded');
    });
  });

  describe('Helper Functions', () => {
    it('resolves required assertions for known capabilities', () => {
      const assertions = getRequiredAssertionsForCapability('crm.deal.advance_stage');
      expect(assertions).toEqual(['crm:deal_stage_advanced']);
    });

    it('returns empty array of assertions for read-only capabilities', () => {
      const assertions = getRequiredAssertionsForCapability('crm.deal.get');
      expect(assertions).toEqual([]);
    });

    it('resolves verification failure strategy', () => {
      expect(resolveVerificationFailureStrategy('crm.deal.advance_stage')).toBe('FAIL_AND_COMPENSATE');
      expect(resolveVerificationFailureStrategy('crm.note.create')).toBe('RECORD_WARNING');
      // Unmapped read-only defaults to RECORD_WARNING
      expect(resolveVerificationFailureStrategy('crm.entity.list')).toBe('RECORD_WARNING');
    });

    it('identifies whether a capability requires postcondition verification', () => {
      expect(isVerificationRequired('crm.deal.advance_stage')).toBe(true);
      expect(isVerificationRequired('sdr.dispatch_whatsapp')).toBe(true);
      expect(isVerificationRequired('crm.deal.get')).toBe(false);
      expect(isVerificationRequired('lead.search')).toBe(false);
    });
  });
});
