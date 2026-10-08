/**
 * @fileOverview Unit & Contract Tests for Postcondition Verification Contracts & Error Taxonomy (Phase 14 Milestone 1)
 *
 * Implements Rules 2, 4, 8, 10, 12, 48, 67, and 68.
 * Verifies:
 * - Postcondition Severity, Status, and Overall Status schemas
 * - Postcondition Assertion & Context Schemas
 * - Verification Result Schema
 * - Error Taxonomy & AgentVerificationError HTTP status mapping
 * - Barrel exports from @/platform/verification
 */

import { describe, it, expect } from 'vitest';
import {
  PostconditionSeveritySchema,
  PostconditionStatusSchema,
  OverallVerificationStatusSchema,
  PostconditionAssertionSchema,
  PostconditionContextSchema,
  VerificationResultSchema,
  VerificationStrategySchema,
  VERIFICATION_ERROR_CODES,
  AgentVerificationError,
} from '@/platform/verification';

describe('Phase 14 Milestone 1 - Canonical Verification Contracts', () => {
  describe('Enumeration & Status Schemas', () => {
    it('validates PostconditionSeverity values correctly', () => {
      expect(PostconditionSeveritySchema.parse('CRITICAL')).toBe('CRITICAL');
      expect(PostconditionSeveritySchema.parse('WARNING')).toBe('WARNING');
      expect(() => PostconditionSeveritySchema.parse('INFO')).toThrow();
    });

    it('validates PostconditionStatus values correctly', () => {
      expect(PostconditionStatusSchema.parse('VERIFIED')).toBe('VERIFIED');
      expect(PostconditionStatusSchema.parse('FAILED')).toBe('FAILED');
      expect(PostconditionStatusSchema.parse('SKIPPED')).toBe('SKIPPED');
      expect(() => PostconditionStatusSchema.parse('UNKNOWN')).toThrow();
    });

    it('validates OverallVerificationStatus values correctly', () => {
      expect(OverallVerificationStatusSchema.parse('PASS')).toBe('PASS');
      expect(OverallVerificationStatusSchema.parse('FAIL')).toBe('FAIL');
      expect(OverallVerificationStatusSchema.parse('DEGRADED')).toBe('DEGRADED');
      expect(() => OverallVerificationStatusSchema.parse('ERROR')).toThrow();
    });

    it('validates VerificationStrategy values correctly', () => {
      expect(VerificationStrategySchema.parse('FAIL_AND_COMPENSATE')).toBe('FAIL_AND_COMPENSATE');
      expect(VerificationStrategySchema.parse('ESCALATE_TO_APPROVAL')).toBe('ESCALATE_TO_APPROVAL');
      expect(VerificationStrategySchema.parse('RECORD_WARNING')).toBe('RECORD_WARNING');
      expect(() => VerificationStrategySchema.parse('IGNORE')).toThrow();
    });
  });

  describe('PostconditionAssertionSchema', () => {
    it('parses a valid postcondition assertion with evidence', () => {
      const assertionData = {
        assertionId: 'asrt_123',
        ruleName: 'crm:deal_stage_advanced',
        targetResource: 'deals',
        targetId: 'deal_456',
        severity: 'CRITICAL',
        status: 'VERIFIED',
        evidence: {
          previousStage: 'QUALIFICATION',
          currentStage: 'PROPOSAL_SUBMITTED',
        },
        evaluatedAt: new Date().toISOString(),
      };

      const parsed = PostconditionAssertionSchema.parse(assertionData);
      expect(parsed.assertionId).toBe('asrt_123');
      expect(parsed.severity).toBe('CRITICAL');
      expect(parsed.status).toBe('VERIFIED');
      expect(parsed.evidence?.currentStage).toBe('PROPOSAL_SUBMITTED');
    });

    it('rejects an assertion missing required fields', () => {
      const invalidData = {
        assertionId: 'asrt_123',
        // missing ruleName, targetResource, targetId
        severity: 'CRITICAL',
        status: 'VERIFIED',
        evaluatedAt: new Date().toISOString(),
      };

      expect(() => PostconditionAssertionSchema.parse(invalidData)).toThrow();
    });
  });

  describe('PostconditionContextSchema', () => {
    it('parses a valid postcondition context with pre/post state snapshots', () => {
      const contextData = {
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_sales_hq',
        actorId: 'usr_senior_rep',
        preStateSnapshot: { stage: 'QUALIFICATION', version: 1 },
        postStateSnapshot: { stage: 'PROPOSAL_SUBMITTED', version: 2 },
        mutationPayload: { stage: 'PROPOSAL_SUBMITTED' },
      };

      const parsed = PostconditionContextSchema.parse(contextData);
      expect(parsed.organizationId).toBe('org_enterprise_1');
      expect(parsed.postStateSnapshot).not.toBeNull();
      expect(parsed.mutationPayload.stage).toBe('PROPOSAL_SUBMITTED');
    });

    it('allows nullable postStateSnapshot for deletion/unverified checks', () => {
      const contextData = {
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_sales_hq',
        actorId: 'usr_senior_rep',
        preStateSnapshot: { id: 'item_1' },
        postStateSnapshot: null,
        mutationPayload: { action: 'delete' },
      };

      const parsed = PostconditionContextSchema.parse(contextData);
      expect(parsed.postStateSnapshot).toBeNull();
    });

    it('rejects context with empty organizationId or actorId', () => {
      const invalidData = {
        organizationId: '',
        workspaceId: 'ws_sales_hq',
        actorId: '',
        preStateSnapshot: {},
        postStateSnapshot: {},
        mutationPayload: {},
      };

      expect(() => PostconditionContextSchema.parse(invalidData)).toThrow();
    });
  });

  describe('VerificationResultSchema', () => {
    it('validates a complete verification result payload', () => {
      const resultData = {
        executionId: 'exec_789',
        capabilityId: 'crm.deal.advance_stage',
        overallStatus: 'PASS',
        assertionsCount: 2,
        passedCount: 2,
        failedCount: 0,
        assertions: [
          {
            assertionId: 'asrt_1',
            ruleName: 'crm:deal_stage_advanced',
            targetResource: 'deals',
            targetId: 'deal_456',
            severity: 'CRITICAL',
            status: 'VERIFIED',
            evaluatedAt: new Date().toISOString(),
          },
          {
            assertionId: 'asrt_2',
            ruleName: 'crm:activity_recorded',
            targetResource: 'activities',
            targetId: 'act_101',
            severity: 'WARNING',
            status: 'VERIFIED',
            evaluatedAt: new Date().toISOString(),
          },
        ],
        durationMs: 42,
        timestamp: new Date().toISOString(),
      };

      const parsed = VerificationResultSchema.parse(resultData);
      expect(parsed.overallStatus).toBe('PASS');
      expect(parsed.assertionsCount).toBe(2);
      expect(parsed.passedCount).toBe(2);
      expect(parsed.failedCount).toBe(0);
      expect(parsed.assertions).toHaveLength(2);
    });
  });

  describe('VERIFICATION_ERROR_CODES & AgentVerificationError', () => {
    it('defines all required error taxonomy codes', () => {
      expect(VERIFICATION_ERROR_CODES.POSTCONDITION_ASSERTION_FAILED).toBe('POSTCONDITION_ASSERTION_FAILED');
      expect(VERIFICATION_ERROR_CODES.VERIFICATION_TIMEOUT).toBe('VERIFICATION_TIMEOUT');
      expect(VERIFICATION_ERROR_CODES.INVALID_POSTCONDITION_CONTEXT).toBe('INVALID_POSTCONDITION_CONTEXT');
      expect(VERIFICATION_ERROR_CODES.UNVERIFIED_MUTATION_REJECTED).toBe('UNVERIFIED_MUTATION_REJECTED');
      expect(VERIFICATION_ERROR_CODES.VERIFICATION_DEAD_MAN_PAUSED).toBe('VERIFICATION_DEAD_MAN_PAUSED');
      expect(VERIFICATION_ERROR_CODES.IDOR_VIOLATION).toBe('IDOR_VIOLATION');
    });

    it('correctly maps error codes to HTTP status codes', () => {
      const errContext = new AgentVerificationError(
        'INVALID_POSTCONDITION_CONTEXT',
        'Invalid context provided',
      );
      expect(errContext.statusCode).toBe(400);

      const errIdor = new AgentVerificationError('IDOR_VIOLATION', 'Cross-tenant access forbidden');
      expect(errIdor.statusCode).toBe(403);

      const errFailed = new AgentVerificationError(
        'POSTCONDITION_ASSERTION_FAILED',
        'Assertion deal_stage_advanced failed',
      );
      expect(errFailed.statusCode).toBe(422);

      const errUnverified = new AgentVerificationError(
        'UNVERIFIED_MUTATION_REJECTED',
        'Mutation rejected due to failed critical postconditions',
      );
      expect(errUnverified.statusCode).toBe(409);

      const errDeadMan = new AgentVerificationError(
        'VERIFICATION_DEAD_MAN_PAUSED',
        'Verification paused by emergency dead-man switch',
      );
      expect(errDeadMan.statusCode).toBe(503);

      const errTimeout = new AgentVerificationError('VERIFICATION_TIMEOUT', 'Assertion timeout');
      expect(errTimeout.statusCode).toBe(504);
    });

    it('supports custom override statusCode if provided', () => {
      const customErr = new AgentVerificationError('IDOR_VIOLATION', 'Custom forbidden', 403);
      expect(customErr.statusCode).toBe(403);
      expect(customErr.name).toBe('AgentVerificationError');
      expect(customErr.message).toBe('Custom forbidden');
    });
  });
});
