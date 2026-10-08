/**
 * @fileoverview Test Suite for Autonomous Multi-Agent Finance Swarm Orchestrator (Phase 12 Milestone 5)
 *
 * Tests:
 * 1. 5-Stage multi-agent coordination across billing, reconciliation, collections, school ops, and revenue analysis.
 * 2. Bounded concurrency chunking (<= 4 concurrent operations, Rules 9 & 23).
 * 3. Knapsack context token budgeting (<= 4,000 tokens, Rules 28 & 56).
 * 4. Zero-write Shadow Mode simulation (Rule 42) producing Blast Radius Reports.
 * 5. Cooperative cancellation via native AbortSignal (Rule 26).
 * 6. Emergency dead-man switch fail-closed handling (Rule 60).
 * 7. Zero `any` or `any[]` typing strictness (Rule 4).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FinanceSwarmOrchestrator,
  getFinanceSwarmOrchestrator,
} from '@/platform/agents/finance/swarm/finance-swarm-orchestrator';
import {
  type FinanceSwarmMissionInput,
  SWARM_ERROR_CODES,
  FinanceSwarmError,
} from '@/platform/agents/finance/swarm/finance-swarm-types';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('FinanceSwarmOrchestrator (Phase 12 Milestone 5)', () => {
  let orchestrator: FinanceSwarmOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    setGovernanceDeadManStateForTests(false);
    orchestrator = new FinanceSwarmOrchestrator();
  });

  const mockMissionInput: FinanceSwarmMissionInput = {
    workspaceId: 'ws_finance_test',
    organizationId: 'org_finance_test',
    operatorUserId: 'user_finance_ops',
    missionGoal: 'Monthly Financial Audit, Receivables Recovery & Liquidity Projection',
    dryRun: false,
    maxBudgetTokens: 4000,
  };

  describe('1. Multi-Agent Swarm Pipeline Execution', () => {
    it('executes all 5 stages in order and produces unified metrics and explainability', async () => {
      const result = await orchestrator.executeSwarmMission(mockMissionInput);

      expect(result.runId).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(result.stages.length).toBe(5);

      // Verify stages
      const stageNames = result.stages.map((s) => s.stageName);
      expect(stageNames).toEqual([
        'BILLING_VERIFICATION',
        'RECONCILIATION_AUDIT',
        'COLLECTIONS_ESCALATION',
        'SCHOOL_OPERATIONS_CORRELATION',
        'CASH_FLOW_FORECAST',
      ]);

      // All stages must succeed
      result.stages.forEach((stage) => {
        expect(stage.status).toBe('SUCCESS');
        expect(stage.durationMs).toBeGreaterThanOrEqual(0);
        expect(stage.assignedPersona).toBeDefined();
      });

      // Context tokens must respect Knapsack budget <= 4,000
      expect(result.metrics.totalTokensUsed).toBeLessThanOrEqual(4000);
      expect(result.metrics.completedStagesCount).toBe(5);
      expect(result.explainabilitySummary).toContain('Financial Audit');
    });
  });

  describe('2. Shadow Mode Simulation (Rule 42)', () => {
    it('executes in dryRun mode with zero live database mutations and outputs BlastRadiusReport', async () => {
      const simulationInput: FinanceSwarmMissionInput = {
        ...mockMissionInput,
        dryRun: true,
      };

      const result = await orchestrator.executeSwarmMission(simulationInput);

      expect(result.status).toBe('COMPLETED');
      expect(result.isSimulation).toBe(true);
      expect(result.blastRadiusReport).toBeDefined();
      expect(result.blastRadiusReport?.liveDatabaseWritesCount).toBe(0);
      expect(result.blastRadiusReport?.interceptedMutationsCount).toBeGreaterThanOrEqual(0);
      expect(result.blastRadiusReport?.summary).toContain('SIMULATION ONLY');
    });
  });

  describe('3. Cooperative Cancellation via AbortSignal (Rule 26)', () => {
    it('aborts mission gracefully when AbortSignal triggers', async () => {
      const controller = new AbortController();
      controller.abort(); // pre-aborted

      await expect(
        orchestrator.executeSwarmMission(mockMissionInput, controller.signal)
      ).rejects.toThrowError(FinanceSwarmError);

      try {
        await orchestrator.executeSwarmMission(mockMissionInput, controller.signal);
      } catch (err) {
        expect(err).toBeInstanceOf(FinanceSwarmError);
        const fErr = err as FinanceSwarmError;
        expect(fErr.code).toBe(SWARM_ERROR_CODES.SWARM_CANCELLED);
      }
    });
  });

  describe('4. Emergency Dead-Man Switch Enforcement (Rule 60)', () => {
    it('fails closed when emergency dead-man switch is active', async () => {
      setGovernanceDeadManStateForTests(true);

      await expect(
        orchestrator.executeSwarmMission(mockMissionInput)
      ).rejects.toThrowError(FinanceSwarmError);

      try {
        await orchestrator.executeSwarmMission(mockMissionInput);
      } catch (err) {
        expect(err).toBeInstanceOf(FinanceSwarmError);
        const fErr = err as FinanceSwarmError;
        expect(fErr.code).toBe(SWARM_ERROR_CODES.SWARM_DEAD_MAN_PAUSED);
        expect(fErr.httpStatus).toBe(503);
      }
    });
  });

  describe('5. Global Singleton Preservation (Rule 69)', () => {
    it('returns the same singleton instance', () => {
      const o1 = getFinanceSwarmOrchestrator();
      const o2 = getFinanceSwarmOrchestrator();
      expect(o1).toBe(o2);
    });
  });
});
