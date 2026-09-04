/**
 * @fileOverview Unit & Integration Tests for CompanyBrain Phase 9: Agentic Autonomous Workflows
 *
 * Covers:
 * 1. Linear workflow execution and step telemetry.
 * 2. Decision node conditional branching logic.
 * 3. Human approval gate pausing and durable resumption.
 * 4. Human approval rejection and workflow cancellation.
 * 5. Maximum execution step ceiling (DAG termination guard).
 * 6. Dry-run workflow simulation with mock payloads.
 * 7. Event trigger router filter matching.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../services/workflow-engine';
import { EventTriggerRouter } from '../services/event-trigger-router';
import { DEAL_RESCUE_BLUEPRINT, LEAD_ACTIVATION_BLUEPRINT } from '../blueprints';
import type { WorkflowDefinition } from '../types';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: null,
}));

// Mock McpGateway
vi.mock('@/lib/mcp/gateway', () => ({
  McpGateway: {
    handleRequest: vi.fn(async (rpc) => {
      return {
        jsonrpc: '2.0',
        id: rpc.id,
        result: {
          success: true,
          actionExecuted: true,
          output: `Executed tool ${rpc.params.name}`,
        },
      };
    }),
  },
}));

// Mock McpApprovalEngine
vi.mock('@/lib/mcp/approval-engine', () => ({
  McpApprovalEngine: {
    adjudicate: vi.fn(async () => {
      return {
        success: true,
        adjudicatedAt: new Date().toISOString(),
      };
    }),
    adjudicateApproval: vi.fn(async () => {
      return {
        success: true,
        adjudicatedAt: new Date().toISOString(),
      };
    }),
  },
}));

describe('CompanyBrain Phase 9: WorkflowEngine & EventTriggerRouter', () => {
  const testWorkspaceId = 'ws_workflow_test';
  const testOrgId = 'org_workflow_test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Linear Workflow Execution', () => {
    it('executes a linear workflow to completion', async () => {
      const workflow: WorkflowDefinition = {
        id: 'wf_linear_test',
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        title: 'Linear Test Workflow',
        description: 'Tests sequential trigger to specialist to action',
        status: 'active',
        trigger: {
          type: 'manual',
        },
        nodes: [
          {
            id: 'n_trigger',
            title: 'Manual Trigger',
            nodeType: 'trigger',
            nextNodeIds: ['n_specialist'],
          },
          {
            id: 'n_specialist',
            title: 'Knowledge Audit',
            nodeType: 'specialist',
            specialistId: 'knowledge_specialist',
            nextNodeIds: ['n_action'],
          },
          {
            id: 'n_action',
            title: 'Dispatch Task',
            nodeType: 'action',
            actionConfig: {
              actionType: 'create_task',
              payloadTemplate: {
                title: 'Follow-up Task',
                priority: 'medium',
              },
            },
            nextNodeIds: [],
          },
        ],
        createdBy: 'user_test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await WorkflowEngine.saveWorkflow(workflow);

      const run = await WorkflowEngine.startWorkflow(
        workflow.id,
        { objective: 'Audit Acme Health compliance history' },
        'user_test'
      );

      expect(run.status).toBe('completed');
      expect(run.metrics.totalNodesExecuted).toBe(3);
      expect(run.executedNodeIds).toEqual(['n_trigger', 'n_specialist', 'n_action']);
      expect(run.stepResults['n_specialist'].status).toBe('success');
      expect(run.stepResults['n_action'].status).toBe('success');
    });
  });

  describe('2. Decision Node Branching', () => {
    it('branches to the correct target node based on condition', async () => {
      const workflow: WorkflowDefinition = {
        id: 'wf_decision_test',
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        title: 'Decision Branching Test',
        description: 'Tests conditional routing',
        status: 'active',
        trigger: {
          type: 'event',
          eventType: 'crm.deal.stalled',
        },
        nodes: [
          {
            id: 'n_trig',
            title: 'Trigger',
            nodeType: 'trigger',
            nextNodeIds: ['n_decision'],
          },
          {
            id: 'n_decision',
            title: 'Risk Decision',
            nodeType: 'decision',
            decisionRules: [
              {
                condition: { field: 'dealValue', operator: 'gt', value: 50000 },
                targetNodeId: 'n_high_value_branch',
                label: 'High Value Deal',
              },
            ],
            defaultNextNodeId: 'n_standard_branch',
            nextNodeIds: ['n_high_value_branch', 'n_standard_branch'],
          },
          {
            id: 'n_high_value_branch',
            title: 'High Value Escalation',
            nodeType: 'action',
            actionConfig: {
              actionType: 'create_task',
              payloadTemplate: { title: 'Executive Sponsor Meeting', priority: 'urgent' },
            },
            nextNodeIds: [],
          },
          {
            id: 'n_standard_branch',
            title: 'Standard Follow-up',
            nodeType: 'action',
            actionConfig: {
              actionType: 'create_task',
              payloadTemplate: { title: 'Rep Follow-up Task', priority: 'low' },
            },
            nextNodeIds: [],
          },
        ],
        createdBy: 'user_test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await WorkflowEngine.saveWorkflow(workflow);

      // High value payload ($75,000) -> should branch to n_high_value_branch
      const runHigh = await WorkflowEngine.startWorkflow(
        workflow.id,
        { dealValue: 75000, dealTitle: 'Enterprise Hospital Deal' },
        'user_test'
      );

      expect(runHigh.status).toBe('completed');
      expect(runHigh.executedNodeIds).toContain('n_high_value_branch');
      expect(runHigh.executedNodeIds).not.toContain('n_standard_branch');

      // Low value payload ($20,000) -> should branch to default n_standard_branch
      const runLow = await WorkflowEngine.startWorkflow(
        workflow.id,
        { dealValue: 20000, dealTitle: 'Clinic Subscription' },
        'user_test'
      );

      expect(runLow.status).toBe('completed');
      expect(runLow.executedNodeIds).toContain('n_standard_branch');
      expect(runLow.executedNodeIds).not.toContain('n_high_value_branch');
    });
  });

  describe('3. Approval Gate Pausing & Resumption', () => {
    it('pauses execution at an approval gate and resumes cleanly when approved', async () => {
      const workflow: WorkflowDefinition = {
        id: 'wf_approval_test',
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        title: 'Approval Gate Test',
        description: 'Tests pause and resumption',
        status: 'active',
        trigger: { type: 'manual' },
        nodes: [
          {
            id: 'n1_trigger',
            title: 'Trigger',
            nodeType: 'trigger',
            nextNodeIds: ['n2_gate'],
          },
          {
            id: 'n2_gate',
            title: 'Executive Approval Gate',
            nodeType: 'approval_gate',
            approvalConfig: {
              prompt: 'Authorize deal acceleration package',
              requiredRole: 'manager',
              timeoutHours: 48,
              onTimeout: 'escalate',
            },
            nextNodeIds: ['n3_action'],
          },
          {
            id: 'n3_action',
            title: 'Execute Deal Acceleration',
            nodeType: 'action',
            actionConfig: {
              actionType: 'update_deal',
              payloadTemplate: { stage: 'negotiation' },
            },
            nextNodeIds: [],
          },
        ],
        createdBy: 'user_test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await WorkflowEngine.saveWorkflow(workflow);

      // 1. Initial Start -> Should pause at gate
      const run = await WorkflowEngine.startWorkflow(workflow.id, { dealId: 'deal_123' }, 'user_test');

      expect(run.status).toBe('waiting_approval');
      expect(run.pausedNodeId).toBe('n2_gate');
      expect(run.pendingApprovalId).toBeDefined();
      expect(run.executedNodeIds).toEqual(['n1_trigger', 'n2_gate']);
      expect(run.stepResults['n3_action']).toBeUndefined();

      // 2. Resumption -> Should execute n3_action and complete
      const resumedRun = await WorkflowEngine.resumeWorkflow(
        run.id,
        run.pendingApprovalId!,
        'approved',
        'executive_reviewer'
      );

      expect(resumedRun.status).toBe('completed');
      expect(resumedRun.executedNodeIds).toContain('n3_action');
      expect(resumedRun.stepResults['n3_action'].status).toBe('success');
      expect(resumedRun.resumedBy).toBe('executive_reviewer');
    });

    it('cancels workflow run when approval is rejected', async () => {
      const workflow: WorkflowDefinition = {
        id: 'wf_reject_test',
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        title: 'Approval Reject Test',
        description: 'Tests rejection',
        status: 'active',
        trigger: { type: 'manual' },
        nodes: [
          {
            id: 'n_trig',
            title: 'Trigger',
            nodeType: 'trigger',
            nextNodeIds: ['n_gate'],
          },
          {
            id: 'n_gate',
            title: 'Review Gate',
            nodeType: 'approval_gate',
            approvalConfig: {
              prompt: 'Approve outreach sequence',
              timeoutHours: 24,
              onTimeout: 'auto_cancel',
            },
            nextNodeIds: ['n_outreach'],
          },
          {
            id: 'n_outreach',
            title: 'Send Outreach',
            nodeType: 'action',
            actionConfig: {
              actionType: 'send_notification',
              payloadTemplate: { text: 'Outreach dispatched' },
            },
            nextNodeIds: [],
          },
        ],
        createdBy: 'user_test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await WorkflowEngine.saveWorkflow(workflow);
      const run = await WorkflowEngine.startWorkflow(workflow.id, { leadId: 'lead_999' }, 'user_test');
      expect(run.status).toBe('waiting_approval');

      const cancelledRun = await WorkflowEngine.resumeWorkflow(
        run.id,
        run.pendingApprovalId!,
        'rejected',
        'compliance_officer'
      );

      expect(cancelledRun.status).toBe('cancelled');
      expect(cancelledRun.errorMessage).toContain('cancelled by human reviewer');
      expect(cancelledRun.executedNodeIds).not.toContain('n_outreach');
    });
  });

  describe('4. Execution Ceiling & Safety Guardrails', () => {
    it('halts execution when step count exceeds safety ceiling', async () => {
      // Create a chain of 14 linear nodes exceeding the 12-step ceiling
      const nodes = Array.from({ length: 14 }).map((_, i) => ({
        id: `node_${i}`,
        title: `Step Node ${i}`,
        nodeType: (i === 0 ? 'trigger' : 'action') as any,
        nextNodeIds: i < 13 ? [`node_${i + 1}`] : [],
      }));

      const longWorkflow: WorkflowDefinition = {
        id: 'wf_long_test',
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        title: 'Long Workflow Safety Test',
        description: 'Verifies max 12 steps ceiling',
        status: 'active',
        trigger: { type: 'manual' },
        nodes,
        createdBy: 'user_test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await WorkflowEngine.saveWorkflow(longWorkflow);

      const run = await WorkflowEngine.startWorkflow(longWorkflow.id, {}, 'user_test');

      expect(run.status).toBe('failed');
      expect(run.errorMessage).toContain('maximum safety limit of 12 steps');
    });
  });

  describe('5. Turnkey Blueprint Dry-Run Simulation', () => {
    it('simulates Deal Rescue blueprint with mock payload', async () => {
      const simulationResult = await WorkflowEngine.simulateWorkflow({
        workspaceId: testWorkspaceId,
        organizationId: testOrgId,
        customNodes: DEAL_RESCUE_BLUEPRINT.nodes,
        mockPayload: {
          dealId: 'deal_acme_100k',
          stage: 'proposal',
          daysInStage: 21,
          dealValue: 120000,
        },
      });

      expect(simulationResult.success).toBe(true);
      expect(simulationResult.predictedNodesExecuted).toBe(DEAL_RESCUE_BLUEPRINT.nodes.length);
      expect(simulationResult.predictedApprovalsCount).toBe(1);
      expect(simulationResult.predictedActions.length).toBe(1);
      expect(simulationResult.executionSteps.length).toBe(DEAL_RESCUE_BLUEPRINT.nodes.length);
    });
  });

  describe('6. Event Trigger Router', () => {
    it('dispatches workflows matching event type and filter criteria', async () => {
      const routerWorkspaceId = 'ws_router_isolated_test';

      const activeWorkflow: WorkflowDefinition = {
        id: 'wf_event_routed',
        workspaceId: routerWorkspaceId,
        organizationId: testOrgId,
        title: 'Event Routed Deal Rescue',
        description: 'Triggers on proposal stage deals',
        status: 'active',
        trigger: {
          type: 'event',
          eventType: 'crm.deal.stalled',
          filterCriteria: [{ field: 'stage', operator: 'eq', value: 'proposal' }],
        },
        nodes: [
          {
            id: 'n_ev_trig',
            title: 'Event Trigger',
            nodeType: 'trigger',
            nextNodeIds: [],
          },
        ],
        createdBy: 'user_test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await WorkflowEngine.saveWorkflow(activeWorkflow);

      // Event matching 'proposal' stage
      const matchingRuns = await EventTriggerRouter.dispatchWorkspaceEvent({
        workspaceId: routerWorkspaceId,
        organizationId: testOrgId,
        eventType: 'crm.deal.stalled',
        payload: { dealId: 'deal_match', stage: 'proposal', dealValue: 80000 },
      });

      expect(matchingRuns.length).toBe(1);
      expect(matchingRuns[0].workflowId).toBe('wf_event_routed');

      // Event NOT matching stage ('closed_won') -> should not spawn run
      const nonMatchingRuns = await EventTriggerRouter.dispatchWorkspaceEvent({
        workspaceId: routerWorkspaceId,
        organizationId: testOrgId,
        eventType: 'crm.deal.stalled',
        payload: { dealId: 'deal_nomatch', stage: 'closed_won', dealValue: 80000 },
      });

      expect(nonMatchingRuns.length).toBe(0);
    });
  });
});
