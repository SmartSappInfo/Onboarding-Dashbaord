/**
 * @fileOverview Unit & Contract Tests for Phase 14 Milestone 4: Health & Discrepancy Contracts
 *
 * Validates Zod v4 schemas, error taxonomy, and typing invariants for:
 * - DiscrepancyVarianceTypeSchema, DiscrepancyReportSchema
 * - CircuitStateSchema, AgentHealthStatusSchema, AgentHealthScorecardSchema
 * - HealthThresholdPolicySchema, RecordExecutionTelemetryInputSchema, ResetCircuitBreakerInputSchema
 * - Error taxonomy: HEALTH_ERROR_CODES & AgentHealthError
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import {
  DiscrepancyVarianceTypeSchema,
  DiscrepancyReportSchema,
  CircuitStateSchema,
  AgentHealthStatusSchema,
  AgentHealthScorecardSchema,
  HealthThresholdPolicySchema,
  RecordExecutionTelemetryInputSchema,
  ResetCircuitBreakerInputSchema,
  HEALTH_ERROR_CODES,
  AgentHealthError,
} from '../../verification/health/health-types';

describe('Phase 14 Milestone 4 - Health & Discrepancy Contracts', () => {
  describe('DiscrepancyVarianceTypeSchema', () => {
    it('validates canonical variance types', () => {
      const validTypes = [
        'NO_VARIANCE',
        'BENIGN_INDEX_DRIFT',
        'BENIGN_TIMELINE_UNLINK',
        'FIELD_VALUE_MISMATCH',
        'MISSING_RECORD',
        'UNEXPECTED_MUTATION',
        'EXTERNAL_EGRESS_FAILED',
      ];

      for (const t of validTypes) {
        expect(DiscrepancyVarianceTypeSchema.safeParse(t).success).toBe(true);
      }

      expect(DiscrepancyVarianceTypeSchema.safeParse('INVALID_TYPE').success).toBe(false);
    });
  });

  describe('DiscrepancyReportSchema', () => {
    it('validates a valid discrepancy report', () => {
      const validReport = {
        reportId: 'disc_rep_123',
        executionId: 'exec_abc',
        capabilityId: 'crm.deal.advance_stage',
        targetResource: 'deal',
        targetId: 'deal_999',
        predictedChange: {
          field: 'stage',
          previousValue: 'QUALIFIED',
          expectedValue: 'PROPOSAL_STAGED',
        },
        actualChange: {
          field: 'stage',
          actualValue: 'PROPOSAL_STAGED',
        },
        varianceType: 'NO_VARIANCE',
        isRemediable: true,
        remediationAction: 'NONE',
        detectedAt: '2026-10-08T18:00:00.000Z',
        remediationAttempts: 0,
      };

      const result = DiscrepancyReportSchema.safeParse(validReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isRemediable).toBe(true);
        expect(result.data.varianceType).toBe('NO_VARIANCE');
      }
    });

    it('validates a benign remediable discrepancy', () => {
      const benignReport = {
        reportId: 'disc_rep_benign',
        executionId: 'exec_xyz',
        capabilityId: 'crm.entity.update',
        targetResource: 'crm_entity',
        targetId: 'entity_123',
        predictedChange: { indexSynced: true },
        actualChange: { indexSynced: false },
        varianceType: 'BENIGN_INDEX_DRIFT',
        isRemediable: true,
        remediationAction: 'AUTO_RETRY_INDEX',
        detectedAt: '2026-10-08T18:00:00.000Z',
        remediationAttempts: 1,
      };

      expect(DiscrepancyReportSchema.safeParse(benignReport).success).toBe(true);
    });

    it('rejects invalid timestamps', () => {
      const invalid = {
        reportId: 'disc_1',
        executionId: 'exec_1',
        capabilityId: 'crm.entity.update',
        targetResource: 'crm_entity',
        targetId: '1',
        predictedChange: {},
        actualChange: {},
        varianceType: 'NO_VARIANCE',
        isRemediable: true,
        remediationAction: 'NONE',
        detectedAt: 'not-a-timestamp',
      };

      expect(DiscrepancyReportSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('CircuitStateSchema and AgentHealthStatusSchema', () => {
    it('validates canonical circuit states', () => {
      const validStates = ['CLOSED', 'DEGRADED', 'OPEN', 'HALF_OPEN'];
      for (const s of validStates) {
        expect(CircuitStateSchema.safeParse(s).success).toBe(true);
      }
      expect(CircuitStateSchema.safeParse('TRIPPED').success).toBe(false);
    });

    it('validates canonical health statuses', () => {
      const validStatuses = ['HEALTHY', 'DEGRADED', 'TRIPPED', 'CRITICAL'];
      for (const s of validStatuses) {
        expect(AgentHealthStatusSchema.safeParse(s).success).toBe(true);
      }
      expect(AgentHealthStatusSchema.safeParse('OFFLINE').success).toBe(false);
    });
  });

  describe('AgentHealthScorecardSchema', () => {
    it('validates a complete agent health scorecard', () => {
      const validScorecard = {
        personaId: 'lead_sdr',
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_sales_hq',
        healthScore: 94,
        status: 'HEALTHY',
        circuitState: 'CLOSED',
        successRate: 98,
        failureRate: 2,
        recoveryRate: 100,
        totalExecutions: 50,
        successfulExecutions: 49,
        failedExecutions: 1,
        consecutiveFailures: 0,
        toolErrorsCount: 1,
        avgDurationMs: 420,
        tokenCostUSD: 0.045,
        updatedAt: '2026-10-08T18:00:00.000Z',
        lastTrippedAt: null,
        trippedReason: null,
        degradationMode: 'SHADOW_MODE',
      };

      const result = AgentHealthScorecardSchema.safeParse(validScorecard);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.healthScore).toBe(94);
        expect(result.data.status).toBe('HEALTHY');
      }
    });

    it('rejects score outside 0-100 range', () => {
      const invalidScore = {
        personaId: 'lead_sdr',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        healthScore: 105,
        status: 'HEALTHY',
        circuitState: 'CLOSED',
        successRate: 100,
        failureRate: 0,
        recoveryRate: 100,
        totalExecutions: 10,
        successfulExecutions: 10,
        failedExecutions: 0,
        consecutiveFailures: 0,
        toolErrorsCount: 0,
        avgDurationMs: 300,
        tokenCostUSD: 0.01,
        updatedAt: '2026-10-08T18:00:00.000Z',
        lastTrippedAt: null,
        trippedReason: null,
        degradationMode: 'SHADOW_MODE',
      };

      expect(AgentHealthScorecardSchema.safeParse(invalidScore).success).toBe(false);
    });
  });

  describe('HealthThresholdPolicySchema', () => {
    it('validates threshold policies', () => {
      const validPolicy = {
        personaId: 'billing_analyst',
        minSuccessRate: 95,
        maxFailureRate: 5,
        maxToolErrorsPerHour: 5,
        maxConsecutiveFailures: 2,
        coolOffPeriodMs: 600000,
        degradationMode: 'SHADOW_MODE',
      };

      expect(HealthThresholdPolicySchema.safeParse(validPolicy).success).toBe(true);
    });
  });

  describe('RecordExecutionTelemetryInputSchema', () => {
    it('validates execution telemetry input payloads', () => {
      const validTelemetry = {
        personaId: 'lead_sdr',
        executionId: 'exec_123',
        capabilityId: 'sdr.draft_outreach',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        success: true,
        durationMs: 1200,
        tokenUsage: 350,
        tokenCostUSD: 0.005,
      };

      expect(RecordExecutionTelemetryInputSchema.safeParse(validTelemetry).success).toBe(true);
    });
  });

  describe('ResetCircuitBreakerInputSchema', () => {
    it('validates reset requests with >= 5 chars justification', () => {
      const validReset = {
        personaId: 'lead_sdr',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        justification: 'Transient network glitch resolved on external provider',
      };

      expect(ResetCircuitBreakerInputSchema.safeParse(validReset).success).toBe(true);
    });

    it('rejects reset requests with < 5 chars justification (Rule 61)', () => {
      const invalidReset = {
        personaId: 'lead_sdr',
        organizationId: 'org_123',
        workspaceId: 'ws_123',
        justification: 'fix',
      };

      expect(ResetCircuitBreakerInputSchema.safeParse(invalidReset).success).toBe(false);
    });
  });

  describe('HEALTH_ERROR_CODES & AgentHealthError', () => {
    it('maps all error codes to appropriate HTTP status codes', () => {
      expect(HEALTH_ERROR_CODES.HEALTH_CIRCUIT_TRIPPED).toBe('HEALTH_CIRCUIT_TRIPPED');
      expect(HEALTH_ERROR_CODES.HEALTH_INVALID_JUSTIFICATION).toBe('HEALTH_INVALID_JUSTIFICATION');
      expect(HEALTH_ERROR_CODES.HEALTH_UNAUTHORIZED_RESET).toBe('HEALTH_UNAUTHORIZED_RESET');
      expect(HEALTH_ERROR_CODES.HEALTH_DEAD_MAN_PAUSED).toBe('HEALTH_DEAD_MAN_PAUSED');
      expect(HEALTH_ERROR_CODES.DISCREPANCY_REMEDIATION_FAILED).toBe('DISCREPANCY_REMEDIATION_FAILED');
      expect(HEALTH_ERROR_CODES.DISCREPANCY_NON_REMEDIABLE).toBe('DISCREPANCY_NON_REMEDIABLE');
      expect(HEALTH_ERROR_CODES.IDOR_VIOLATION).toBe('IDOR_VIOLATION');
      expect(HEALTH_ERROR_CODES.HEALTH_PERSONA_NOT_FOUND).toBe('HEALTH_PERSONA_NOT_FOUND');

      const err = new AgentHealthError('HEALTH_CIRCUIT_TRIPPED', 'Circuit is OPEN for persona');
      expect(err.code).toBe('HEALTH_CIRCUIT_TRIPPED');
      expect(err.statusCode).toBe(503);
      expect(err.name).toBe('AgentHealthError');

      const justErr = new AgentHealthError('HEALTH_INVALID_JUSTIFICATION', 'Justification too short');
      expect(justErr.statusCode).toBe(400);

      const unauthErr = new AgentHealthError('HEALTH_UNAUTHORIZED_RESET', 'Subagent reset forbidden');
      expect(unauthErr.statusCode).toBe(403);
    });
  });
});
