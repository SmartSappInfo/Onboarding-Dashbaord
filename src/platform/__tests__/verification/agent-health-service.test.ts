/**
 * @fileOverview Unit & Integration Tests for Agent Health Monitoring Core & Dynamic Circuit Breaker
 *
 * Implements Step 6 (Learn: Continuous Health Telemetry & Circuit Breakers)
 * of the 6-Step Responsible Execution Loop.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentHealthService,
  getAgentHealthService,
} from '../../verification/health/agent-health-service';
import { defaultEventBus } from '../../events/event-bus';
import { setGovernanceDeadManStateForTests } from '../../policy/governance-dead-man';
import { AgentHealthError } from '../../verification/health/health-types';

describe('Phase 14 Milestone 4 - Agent Health Monitoring Core & Dynamic Circuit Breakers', () => {
  let service: AgentHealthService;

  beforeEach(() => {
    vi.clearAllMocks();
    setGovernanceDeadManStateForTests(false);
    service = new AgentHealthService();
    service.clearHistoryForTests();
  });

  describe('Execution Telemetry & Health Score Math (Rule 11)', () => {
    it('initializes a default healthy scorecard for an agent persona', async () => {
      const scorecard = await service.getScorecard({
        personaId: 'lead_sdr',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
      });

      expect(scorecard.personaId).toBe('lead_sdr');
      expect(scorecard.healthScore).toBe(100);
      expect(scorecard.status).toBe('HEALTHY');
      expect(scorecard.circuitState).toBe('CLOSED');
      expect(scorecard.totalExecutions).toBe(0);
      expect(scorecard.degradationMode).toBe('NONE');
    });

    it('records execution telemetry and calculates deterministic health score', async () => {
      const scorecard = await service.recordTelemetry({
        personaId: 'lead_sdr',
        executionId: 'exec_1',
        capabilityId: 'sdr.draft_outreach',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        success: true,
        durationMs: 1200,
        tokenUsage: 450,
        tokenCostUSD: 0.005,
      });

      expect(scorecard.totalExecutions).toBe(1);
      expect(scorecard.successfulExecutions).toBe(1);
      expect(scorecard.failedExecutions).toBe(0);
      expect(scorecard.successRate).toBe(100);
      expect(scorecard.healthScore).toBe(100);
      expect(scorecard.status).toBe('HEALTHY');
      expect(scorecard.circuitState).toBe('CLOSED');
    });

    it('clamps telemetry history to maximum 100 entries per persona (Rule 55)', async () => {
      for (let i = 1; i <= 105; i++) {
        await service.recordTelemetry({
          personaId: 'crm_researcher',
          executionId: `exec_burst_${i}`,
          capabilityId: 'crm.account.search',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          success: true,
          durationMs: 800,
        });
      }

      const scorecard = await service.getScorecard({
        personaId: 'crm_researcher',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
      });

      expect(scorecard.totalExecutions).toBe(100);
    });
  });

  describe('Dynamic Circuit Breaker & Auto-Degradation (Rules 24 & 42)', () => {
    it('automatically trips circuit to OPEN and degrades persona to SHADOW_MODE when consecutive failures exceed limit', async () => {
      const eventSpy = vi.spyOn(defaultEventBus, 'publish');

      // 'lead_sdr' maxConsecutiveFailures is 3
      await service.recordTelemetry({
        personaId: 'lead_sdr',
        executionId: 'fail_1',
        capabilityId: 'sdr.draft_outreach',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        success: false,
        durationMs: 2500,
        toolError: true,
      });

      await service.recordTelemetry({
        personaId: 'lead_sdr',
        executionId: 'fail_2',
        capabilityId: 'sdr.draft_outreach',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        success: false,
        durationMs: 2500,
        toolError: true,
      });

      const trippedScorecard = await service.recordTelemetry({
        personaId: 'lead_sdr',
        executionId: 'fail_3',
        capabilityId: 'sdr.draft_outreach',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        success: false,
        durationMs: 2500,
        toolError: true,
      });

      expect(trippedScorecard.circuitState).toBe('OPEN');
      expect(trippedScorecard.status).toBe('TRIPPED');
      expect(trippedScorecard.degradationMode).toBe('SHADOW_MODE');
      expect(trippedScorecard.consecutiveFailures).toBe(3);
      expect(trippedScorecard.lastTrippedAt).not.toBeNull();

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent.health.circuit_tripped',
        })
      );
    });

    it('trips circuit when failure rate breaches persona SLA threshold', async () => {
      // 'billing_analyst' has maxFailureRate 5% and minSuccessRate 95%
      // 1 success + 2 failures = 66% failure rate
      await service.recordTelemetry({
        personaId: 'billing_analyst',
        executionId: 'billing_ok_1',
        capabilityId: 'finance.invoice.verify',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        success: true,
        durationMs: 1500,
      });

      await service.recordTelemetry({
        personaId: 'billing_analyst',
        executionId: 'billing_fail_1',
        capabilityId: 'finance.invoice.verify',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        success: false,
        durationMs: 1500,
      });

      const scorecard = await service.recordTelemetry({
        personaId: 'billing_analyst',
        executionId: 'billing_fail_2',
        capabilityId: 'finance.invoice.verify',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        success: false,
        durationMs: 1500,
      });

      expect(scorecard.circuitState).toBe('OPEN');
      expect(scorecard.status).toBe('TRIPPED');
      expect(scorecard.degradationMode).toBe('SHADOW_MODE');
    });
  });

  describe('Audited Manual Reset & Non-Delegable Controls (Rules 17 & 61)', () => {
    beforeEach(async () => {
      // Trip the supervisor persona
      for (let i = 1; i <= 2; i++) {
        await service.recordTelemetry({
          personaId: 'supervisor',
          executionId: `sup_fail_${i}`,
          capabilityId: 'supervisor.swarm.route',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          success: false,
          durationMs: 1000,
        });
      }
    });

    it('allows human operator to manually reset circuit breaker with valid audit justification', async () => {
      const eventSpy = vi.spyOn(defaultEventBus, 'publish');

      const resetScorecard = await service.resetCircuitBreaker({
        personaId: 'supervisor',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        justification: 'External API downstream outage resolved and verified.',
        actor: { type: 'user', id: 'user_operator_123' },
      });

      expect(resetScorecard.circuitState).toBe('HALF_OPEN');
      expect(resetScorecard.status).toBe('HEALTHY');
      expect(resetScorecard.consecutiveFailures).toBe(0);
      expect(resetScorecard.degradationMode).toBe('NONE');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent.health.circuit_reset',
        })
      );
    });

    it('rejects circuit breaker reset if justification is under 5 characters (Rule 61)', async () => {
      await expect(
        service.resetCircuitBreaker({
          personaId: 'supervisor',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          justification: 'fix',
          actor: { type: 'user', id: 'user_operator_123' },
        })
      ).rejects.toThrow(AgentHealthError);

      try {
        await service.resetCircuitBreaker({
          personaId: 'supervisor',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          justification: 'fix',
          actor: { type: 'user', id: 'user_operator_123' },
        });
      } catch (err) {
        expect((err as AgentHealthError).code).toBe('HEALTH_INVALID_JUSTIFICATION');
        expect((err as AgentHealthError).statusCode).toBe(400);
      }
    });

    it('rejects circuit breaker reset attempted by an AI agent or autonomous subagent (Rule 17 Non-Delegable)', async () => {
      await expect(
        service.resetCircuitBreaker({
          personaId: 'supervisor',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          justification: 'Autonomous agent self-declares system healthy.',
          actor: { type: 'agent', id: 'autonomous_subagent_99' },
        })
      ).rejects.toThrow(AgentHealthError);

      try {
        await service.resetCircuitBreaker({
          personaId: 'supervisor',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
          justification: 'Autonomous agent self-declares system healthy.',
          actor: { type: 'agent', id: 'autonomous_subagent_99' },
        });
      } catch (err) {
        expect((err as AgentHealthError).code).toBe('HEALTH_UNAUTHORIZED_RESET');
        expect((err as AgentHealthError).statusCode).toBe(403);
      }
    });
  });

  describe('Multi-Tenant Anti-IDOR Isolation & Global Singleton (Rules 8 & 69)', () => {
    it('isolates health scorecards strictly by organizationId and workspaceId', async () => {
      await service.recordTelemetry({
        personaId: 'knowledge_agent',
        executionId: 'exec_orgA',
        capabilityId: 'knowledge.search_hybrid',
        organizationId: 'org_alpha',
        workspaceId: 'ws_alpha',
        success: true,
        durationMs: 500,
      });

      const alphaScorecard = await service.getScorecard({
        personaId: 'knowledge_agent',
        organizationId: 'org_alpha',
        workspaceId: 'ws_alpha',
      });

      const betaScorecard = await service.getScorecard({
        personaId: 'knowledge_agent',
        organizationId: 'org_beta',
        workspaceId: 'ws_beta',
      });

      expect(alphaScorecard.totalExecutions).toBe(1);
      expect(betaScorecard.totalExecutions).toBe(0);
    });

    it('lists all scorecards within a specific workspace', async () => {
      await service.recordTelemetry({
        personaId: 'lead_sdr',
        executionId: 'exec_list_1',
        capabilityId: 'sdr.draft_outreach',
        organizationId: 'org_list',
        workspaceId: 'ws_list',
        success: true,
        durationMs: 300,
      });

      await service.recordTelemetry({
        personaId: 'meeting_analyst',
        executionId: 'exec_list_2',
        capabilityId: 'meeting.analyze',
        organizationId: 'org_list',
        workspaceId: 'ws_list',
        success: true,
        durationMs: 800,
      });

      const scorecards = await service.listScorecards({
        organizationId: 'org_list',
        workspaceId: 'ws_list',
      });

      expect(scorecards.length).toBe(2);
      expect(scorecards.map((s) => s.personaId)).toContain('lead_sdr');
      expect(scorecards.map((s) => s.personaId)).toContain('meeting_analyst');
    });

    it('preserves global singleton across invocations (Rule 69)', () => {
      const instance1 = getAgentHealthService();
      const instance2 = getAgentHealthService();
      expect(instance1).toBe(instance2);
    });
  });
});
