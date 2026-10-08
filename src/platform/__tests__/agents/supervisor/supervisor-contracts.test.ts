/**
 * @fileOverview Unit Tests for Supervisor Contracts, Schemas & Matrices (Phase 13 Milestone 3)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 10 (Zod v4 schema validation)
 * - Rule 12 (Canonical Risk Taxonomy)
 * - Rule 27 (Reverse-LIFO Rollback Matrix)
 * - Rule 28 & 56 (Knapsack Token Budget Ceilings)
 * - Rule 48 (Structured Error Taxonomy & HTTP Status Mapping)
 * - Rules 1940-1953 (The 7 Mandatory Domain Agent Deliverables Gate)
 */

import { describe, it, expect } from 'vitest';
import {
  SupervisorGoalInputSchema,
  PlanStepSchema,
  ExecutionDagSchema,
  SupervisorSynthesisResultSchema,
  MultiAgentBlastRadiusReportSchema,
  SupervisorError,
  SUPERVISOR_PERMISSION_MATRIX,
  SUPERVISOR_TOOL_MATRIX,
  SUPERVISOR_FAILURE_MATRIX,
  SUPERVISOR_ROLLBACK_MATRIX,
  validateSupervisorStepToolAccess,
  getSupervisorRollbackCapability,
  resolveSupervisorFailureStrategy,
  MAX_DAG_STEPS,
  MAX_STEP_TOKEN_BUDGET,
} from '@/platform/agents/supervisor/supervisor-types';

describe('Supervisor Contracts & Schemas', () => {
  describe('SupervisorGoalInputSchema', () => {
    it('parses valid goal input and applies canonical defaults', () => {
      const raw = {
        goal: 'Recover tuition arrears for Greater Accra campuses',
        organizationId: 'org_test_123',
        workspaceId: 'ws_test_456',
      };

      const parsed = SupervisorGoalInputSchema.parse(raw);
      expect(parsed.goal).toBe(raw.goal);
      expect(parsed.missionType).toBe('CUSTOM');
      expect(parsed.priorityLevel).toBe('MEDIUM');
      expect(parsed.budgetCapTokens).toBe(12000);
      expect(parsed.maxSteps).toBe(MAX_DAG_STEPS);
      expect(parsed.allowedRiskCeiling).toBe('L2_STATE_MUTATION');
      expect(parsed.dryRun).toBe(false);
    });

    it('rejects goal prompts that are too short', () => {
      expect(() =>
        SupervisorGoalInputSchema.parse({
          goal: 'hi',
          organizationId: 'org_test',
          workspaceId: 'ws_test',
        })
      ).toThrow();
    });

    it('rejects missing organizationId or workspaceId (Rules 8 & 47 Anti-IDOR)', () => {
      expect(() =>
        SupervisorGoalInputSchema.parse({
          goal: 'Valid goal prompt',
          organizationId: '',
          workspaceId: 'ws_test',
        })
      ).toThrow();
    });
  });

  describe('PlanStepSchema & ExecutionDagSchema', () => {
    it('validates a complete PlanStep record with defaults', () => {
      const step = PlanStepSchema.parse({
        stepId: 'step_1',
        title: 'Check Attendance Anomalies',
        description: 'Examines class attendance drops across campuses',
        assignedPersona: 'school_ops_agent',
        capabilityId: 'school.attendance.get_anomalies',
        input: { campusId: 'campus_123' },
        riskLevel: 'L0_READ',
        idempotencyKey: 'idem_key_001',
      });

      expect(step.status).toBe('PENDING');
      expect(step.maxTokens).toBe(MAX_STEP_TOKEN_BUDGET);
      expect(step.dependentOnStepIds).toEqual([]);
      expect(step.output).toBeNull();
    });

    it('validates a complete ExecutionDag with wave groups', () => {
      const dag = ExecutionDagSchema.parse({
        nodes: [
          {
            stepId: 'step_1',
            title: 'Attendance Check',
            description: 'Read attendance',
            assignedPersona: 'school_ops_agent',
            capabilityId: 'school.attendance.get_anomalies',
            input: {},
            riskLevel: 'L0_READ',
            idempotencyKey: 'k1',
          },
          {
            stepId: 'step_2',
            title: 'Arrears Lookup',
            description: 'Read invoices',
            assignedPersona: 'collections_agent',
            capabilityId: 'finance.invoice.get_summary',
            input: {},
            dependentOnStepIds: ['step_1'],
            riskLevel: 'L0_READ',
            idempotencyKey: 'k2',
          },
        ],
        edges: [{ from: 'step_1', to: 'step_2' }],
        topologicalOrder: ['step_1', 'step_2'],
        waveGroups: [['step_1'], ['step_2']],
        estimatedDurationMs: 15000,
        totalTokenBudget: 8000,
        hasCycles: false,
      });

      expect(dag.nodes.length).toBe(2);
      expect(dag.waveGroups.length).toBe(2);
      expect(dag.hasCycles).toBe(false);
    });

    it('enforces maximum 10 steps per DAG ceiling (Rule 23)', () => {
      const nodes = Array.from({ length: 11 }, (_, i) => ({
        stepId: `step_${i}`,
        title: `Step ${i}`,
        description: `Desc ${i}`,
        assignedPersona: 'crm_assistant',
        capabilityId: 'crm.entity.get',
        input: {},
        riskLevel: 'L0_READ',
        idempotencyKey: `k_${i}`,
      }));

      expect(() =>
        ExecutionDagSchema.parse({
          nodes,
          edges: [],
          topologicalOrder: [],
          waveGroups: [],
          estimatedDurationMs: 1000,
          totalTokenBudget: 4000,
        })
      ).toThrow();
    });
  });

  describe('SupervisorSynthesisResultSchema & BlastRadiusReport', () => {
    it('validates a structured synthesis result with explainability grid', () => {
      const synthesis = SupervisorSynthesisResultSchema.parse({
        missionId: 'mis_123',
        executiveSummary: 'All Greater Accra tuition recovery actions completed.',
        groundedCitations: [
          {
            stepId: 'step_1',
            agentPersona: 'collections_agent',
            citationText: 'Total arrears: GHS 45,000 across 12 families.',
            containerXml: '<untrusted_reference_data id="c1">arrears</untrusted_reference_data>',
          },
        ],
        consolidatedRisks: [
          {
            domain: 'finance',
            severity: 'HIGH',
            description: 'Aging fee delinquency > 60 days',
          },
        ],
        stepMetrics: [
          {
            stepId: 'step_1',
            persona: 'collections_agent',
            capabilityId: 'finance.invoice.get_summary',
            durationMs: 1200,
            tokensUsed: 850,
            status: 'COMPLETED',
          },
        ],
        totalTokensUsed: 850,
        totalDurationMs: 1200,
        proposalsStaged: [],
        explainabilityGrid: {
          what: 'Dispatched payment reminders',
          why: 'Tuition delinquency exceeded 60-day threshold',
          impact: 'Accelerated fee collection pipeline',
          risk: 'Parent churn if contacted aggressively',
        },
      });

      expect(synthesis.missionId).toBe('mis_123');
      expect(synthesis.groundedCitations.length).toBe(1);
    });

    it('validates Shadow Mode MultiAgentBlastRadiusReport (Rule 42)', () => {
      const report = MultiAgentBlastRadiusReportSchema.parse({
        runId: 'shadow_run_001',
        organizationId: 'org_001',
        workspaceId: 'ws_001',
        dryRun: true,
        totalStepsSimulated: 4,
        affectedEntities: ['ent_1', 'ent_2'],
        affectedWorkspaces: ['ws_001'],
        cumulativeFinancialExposure: 52000,
        proposedInvoiceTotal: 14000,
        stagedProposals: [
          {
            proposalId: 'prop_001',
            capabilityId: 'finance.invoice.create_draft',
            payloadHash: 'abc123hash',
            description: 'Draft invoice for term 1 fees',
          },
        ],
        requiresHumanApproval: true,
        highestSimulatedRisk: 'L2_STATE_MUTATION',
        simulatedAt: new Date().toISOString(),
        explainability: {
          what: 'Simulated tuition invoice drafts',
          why: 'Annual enrollment fee schedule triggered',
          expectedStateChange: 'Staged 1 invoice proposal',
        },
      });

      expect(report.dryRun).toBe(true);
      expect(report.cumulativeFinancialExposure).toBe(52000);
    });
  });

  describe('SupervisorError Taxonomy (Rule 48)', () => {
    it('maps error codes correctly to HTTP status codes', () => {
      expect(new SupervisorError('DAG_CYCLE_DETECTED', 'Cycle').httpStatus).toBe(400);
      expect(new SupervisorError('GOAL_REQUIRED', 'No goal').httpStatus).toBe(400);
      expect(new SupervisorError('TENANT_MISMATCH', 'IDOR probe').httpStatus).toBe(403);
      expect(new SupervisorError('UNAUTHORIZED_CAPABILITY', 'Denied').httpStatus).toBe(403);
      expect(new SupervisorError('MISSION_NOT_FOUND', 'Not found').httpStatus).toBe(404);
      expect(new SupervisorError('SUBAGENT_TIMEOUT', 'Timeout').httpStatus).toBe(408);
      expect(new SupervisorError('PROPOSAL_REQUIRED', 'Needs approval').httpStatus).toBe(409);
      expect(new SupervisorError('RATE_LIMITED', 'Too many requests').httpStatus).toBe(429);
      expect(new SupervisorError('EXECUTION_ABORTED', 'Cancelled').httpStatus).toBe(499);
      expect(new SupervisorError('DEAD_MAN_PAUSED', 'Paused').httpStatus).toBe(503);
      expect(new SupervisorError('INTERNAL_ERROR', 'Crash').httpStatus).toBe(500);
    });
  });

  describe('The 4 Governance Matrices (Rules 1940–1953)', () => {
    it('SUPERVISOR_PERMISSION_MATRIX provides explicit scopes for key personas', () => {
      expect(SUPERVISOR_PERMISSION_MATRIX.supervisor).toContain('ai_governance:*');
      expect(SUPERVISOR_PERMISSION_MATRIX.crm_assistant).toContain('crm:contacts:read');
      expect(SUPERVISOR_PERMISSION_MATRIX.lead_sdr).toContain('sales:leads:write');
      expect(SUPERVISOR_PERMISSION_MATRIX.collections_agent).toContain('finance:invoices:draft');
    });

    it('SUPERVISOR_TOOL_MATRIX contains canonical supervisor capabilities with immutable risk levels', () => {
      expect(SUPERVISOR_TOOL_MATRIX['supervisor.plan.decompose_goal'].riskLevel).toBe(
        'L1_INTERNAL_DRAFT'
      );
      expect(SUPERVISOR_TOOL_MATRIX['supervisor.mission.execute'].riskLevel).toBe(
        'L2_STATE_MUTATION'
      );
      expect(SUPERVISOR_TOOL_MATRIX['supervisor.mission.get_status'].riskLevel).toBe('L0_READ');
      expect(SUPERVISOR_TOOL_MATRIX['supervisor.mission.cancel'].riskLevel).toBe(
        'L2_STATE_MUTATION'
      );
    });

    it('SUPERVISOR_FAILURE_MATRIX defines deterministic strategies', () => {
      expect(SUPERVISOR_FAILURE_MATRIX.DAG_CYCLE_DETECTED).toBeDefined();
      const cycleStrategy = resolveSupervisorFailureStrategy('DAG_CYCLE_DETECTED');
      expect(cycleStrategy.strategy).toBe('FAIL_CLOSED');
      expect(cycleStrategy.shouldRollback).toBe(false);

      const timeoutStrategy = resolveSupervisorFailureStrategy('SUBAGENT_TIMEOUT');
      expect(timeoutStrategy.strategy).toBe('REVERSE_LIFO_ROLLBACK');
      expect(timeoutStrategy.shouldRollback).toBe(true);

      const deadManStrategy = resolveSupervisorFailureStrategy('DEAD_MAN_PAUSED');
      expect(deadManStrategy.strategy).toBe('FAIL_CLOSED');
      expect(deadManStrategy.shouldRollback).toBe(false);
    });

    it('SUPERVISOR_ROLLBACK_MATRIX correctly identifies compensating capabilities (Rule 27)', () => {
      expect(SUPERVISOR_ROLLBACK_MATRIX['task.create']?.compensatingCapabilityId).toBe('task.archive');
      expect(getSupervisorRollbackCapability('task.create')).toBe('task.archive');
      expect(getSupervisorRollbackCapability('crm.entity.tag_add')).toBe('crm.entity.tag_remove');
      expect(getSupervisorRollbackCapability('finance.invoice.create_draft')).toBe(
        'finance.invoice.delete_draft'
      );
      expect(getSupervisorRollbackCapability('sdr.draft_outreach')).toBeNull();
      expect(getSupervisorRollbackCapability('non_existent')).toBeNull();
    });

    it('validateSupervisorStepToolAccess validates permissions and tool existence', () => {
      expect(validateSupervisorStepToolAccess('supervisor', 'crm.entity.get')).toBe(true);
      expect(validateSupervisorStepToolAccess('supervisor', 'unknown.tool.name')).toBe(false);
    });
  });
});
