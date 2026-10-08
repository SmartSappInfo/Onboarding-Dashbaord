/**
 * @fileOverview Unit Tests for Universal Saga Rollback Matrix (Phase 14 Milestone 3)
 *
 * Implements Rules 2, 4, 10, 12, 14, 16, 27, 48, 67, 69, 1961.
 * Verifies:
 * - UNIVERSAL_SAGA_ROLLBACK_MATRIX entries across CRM, Sales, Finance, Knowledge, and Supervisor domains
 * - Lookup helper `getUniversalRollbackEntry`
 * - Reversibility resolution helper `isCapabilityReversible`
 * - Compensating capability resolution helper `getCompensatingCapabilityId`
 * - Safe fallback for unmapped read-only capabilities ('noop')
 */

import { describe, it, expect } from 'vitest';
import {
  UNIVERSAL_SAGA_ROLLBACK_MATRIX,
  getUniversalRollbackEntry,
  isCapabilityReversible,
  getCompensatingCapabilityId,
  getAllUniversalRollbackEntries,
} from '@/platform/verification/saga/universal-saga-rollback-matrix';

describe('Phase 14 Milestone 3 - Universal Saga Rollback Matrix', () => {
  describe('UNIVERSAL_SAGA_ROLLBACK_MATRIX Entries', () => {
    it('defines compensating capabilities for core CRM mutating operations', () => {
      const dealAdvance = getUniversalRollbackEntry('crm.deal.advance_stage');
      expect(dealAdvance).toBeDefined();
      expect(dealAdvance?.compensatingCapabilityId).toBe('crm.deal.revert_stage');
      expect(dealAdvance?.reversibility).toBe('REVERSIBLE');
      expect(dealAdvance?.domain).toBe('crm');

      const entityUpdate = getUniversalRollbackEntry('crm.entity.update');
      expect(entityUpdate).toBeDefined();
      expect(entityUpdate?.compensatingCapabilityId).toBe('crm.entity.update');
      expect(entityUpdate?.reversibility).toBe('REVERSIBLE');

      const taskCreate = getUniversalRollbackEntry('crm.task.create');
      expect(taskCreate).toBeDefined();
      expect(taskCreate?.compensatingCapabilityId).toBe('crm.task.delete');
    });

    it('defines compensating capabilities for Sales & SDR operations', () => {
      const draftOutreach = getUniversalRollbackEntry('sdr.draft_outreach');
      expect(draftOutreach).toBeDefined();
      expect(draftOutreach?.compensatingCapabilityId).toBe('noop');
      expect(draftOutreach?.reversibility).toBe('REVERSIBLE');

      const dispatchEmail = getUniversalRollbackEntry('sdr.dispatch_email');
      expect(dispatchEmail).toBeDefined();
      expect(dispatchEmail?.compensatingCapabilityId).toBe('sdr.log_outreach_revoked');
      expect(dispatchEmail?.reversibility).toBe('PARTIALLY_REVERSIBLE');
      expect(dispatchEmail?.requiresManualReview).toBe(true);

      const dispatchWhatsApp = getUniversalRollbackEntry('sdr.dispatch_whatsapp');
      expect(dispatchWhatsApp).toBeDefined();
      expect(dispatchWhatsApp?.compensatingCapabilityId).toBe('sdr.log_outreach_revoked');
      expect(dispatchWhatsApp?.reversibility).toBe('PARTIALLY_REVERSIBLE');
    });

    it('defines compensating capabilities for Finance operations', () => {
      const reconcile = getUniversalRollbackEntry('reconciliation.resolve_exception');
      expect(reconcile).toBeDefined();
      expect(reconcile?.compensatingCapabilityId).toBe('reconciliation.unresolve_exception');
      expect(reconcile?.reversibility).toBe('REVERSIBLE');

      const collectionsProposal = getUniversalRollbackEntry('collections.execute_proposal');
      expect(collectionsProposal).toBeDefined();
      expect(collectionsProposal?.compensatingCapabilityId).toBe('collections.rollback_proposal');
      expect(collectionsProposal?.reversibility).toBe('REVERSIBLE');
    });

    it('defines compensating capabilities for Knowledge & Memory operations', () => {
      const candidateDecide = getUniversalRollbackEntry('knowledge.candidate.decide');
      expect(candidateDecide).toBeDefined();
      expect(candidateDecide?.compensatingCapabilityId).toBe('knowledge.candidate.reopen');
      expect(candidateDecide?.reversibility).toBe('REVERSIBLE');
    });

    it('defines compensating capabilities for Supervisor operations', () => {
      const handoff = getUniversalRollbackEntry('supervisor.mesh.route_handoff');
      expect(handoff).toBeDefined();
      expect(handoff?.compensatingCapabilityId).toBe('supervisor.mesh.revert_handoff');
      expect(handoff?.reversibility).toBe('REVERSIBLE');
    });
  });

  describe('Lookup & Helper Utilities', () => {
    it('isCapabilityReversible returns true for reversible capabilities and false for unmapped or irreversible', () => {
      expect(isCapabilityReversible('crm.deal.advance_stage')).toBe(true);
      expect(isCapabilityReversible('sdr.dispatch_email')).toBe(false); // PARTIALLY_REVERSIBLE is not fully reversible
      expect(isCapabilityReversible('some.unknown.mutation')).toBe(false);
    });

    it('getCompensatingCapabilityId returns designated capability or noop for unmapped read tools', () => {
      expect(getCompensatingCapabilityId('crm.deal.advance_stage')).toBe('crm.deal.revert_stage');
      expect(getCompensatingCapabilityId('crm.deal.get')).toBe('noop');
    });

    it('getAllUniversalRollbackEntries returns full list of registered entries', () => {
      const allEntries = getAllUniversalRollbackEntries();
      expect(allEntries.length).toBeGreaterThanOrEqual(12);
      expect(allEntries.length).toBe(Object.keys(UNIVERSAL_SAGA_ROLLBACK_MATRIX).length);
    });
  });
});
