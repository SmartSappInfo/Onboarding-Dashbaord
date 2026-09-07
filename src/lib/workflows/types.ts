/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Agentic Autonomous Workflows & Background Triggers
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. 7-Node Graph Hierarchy:
 *    - Trigger -> Specialist -> Context -> Decision -> Tool -> Approval Gate -> Action.
 * 2. Strict Zero-`any` & Zero-`unknown` Invariant:
 *    - All payload dictionaries, node parameters, and step outputs must be typed via `McpPayloadValue`
 *      or concrete Zod schemas.
 * 3. Execution Bounds & Resource Protection:
 *    - Max 12 steps per execution run (guarantees DAG termination and prevents infinite loops).
 *    - Hard timeout ceiling of 90,000ms.
 *    - Max 5 concurrent active workflow runs per workspace.
 * 4. Human-in-the-Loop Governance:
 *    - Approval Gate nodes pause execution and generate an MCP approval record with `-32003` error code.
 *    - Resumption continues strictly from `pausedNodeId` child nodes without duplicate execution.
 *
 * @testability Covered in `src/lib/workflows/__tests__/workflow-engine.test.ts`.
 */

import type { McpPayloadValue } from '@/lib/mcp/types';
import type { DomainSpecialistId } from '@/lib/agents/domain-types';

export type { DomainSpecialistId };

/**
 * Supported node types in the agentic workflow pipeline.
 */
export type WorkflowNodeType =
  | 'trigger'
  | 'specialist'
  | 'context'
  | 'decision'
  | 'tool'
  | 'approval_gate'
  | 'action';

/**
 * Trigger archetypes initiating workflow runs.
 */
export type WorkflowTriggerType = 'event' | 'schedule' | 'manual' | 'webhook';

/**
 * Lifecycle status of an individual workflow execution run.
 */
export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Filter criteria for incoming events to match a workflow trigger.
 */
export interface WorkflowEventFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value: McpPayloadValue;
}

/**
 * Configuration for workflow triggers.
 */
export interface WorkflowTriggerConfig {
  type: WorkflowTriggerType;
  eventType?: string; // e.g. 'crm.deal.stalled' | 'crm.lead.created' | 'meeting.completed'
  filterCriteria?: WorkflowEventFilter[];
  scheduleCron?: string; // e.g. '0 9 * * 1-5'
  webhookSecretId?: string;
}

/**
 * Decision branching rule condition.
 */
export interface WorkflowDecisionRule {
  id?: string;
  condition: {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
    value: McpPayloadValue;
  };
  targetNodeId: string;
  label: string;
}

/**
 * Approval gate configuration for human-in-the-loop checkpoints.
 */
export interface WorkflowApprovalConfig {
  prompt: string;
  requiredRole?: 'admin' | 'manager' | 'operator' | 'any';
  timeoutHours: number; // e.g. 24, 48, 72
  onTimeout: 'auto_cancel' | 'escalate' | 'continue_fallback';
  fallbackNodeId?: string;
}

/**
 * Action node configuration for automated follow-ups.
 */
export interface WorkflowActionConfig {
  actionType: 'create_task' | 'update_deal' | 'send_notification';
  payloadTemplate: Record<string, McpPayloadValue>;
}

/**
 * Context node configuration for assembling subject dossiers.
 */
export interface WorkflowContextConfig {
  targetSubjectType: 'deal' | 'lead' | 'contact' | 'meeting';
  subjectIdBindingField: string; // e.g. 'dealId' from trigger payload
  maxTokens: number;
  tiers: number[];
  includeGraph: boolean;
}

/**
 * Configuration for an individual node within a workflow graph.
 */
export interface WorkflowNodeConfig {
  id: string;
  title: string;
  description?: string;
  nodeType: WorkflowNodeType;
  specialistId?: DomainSpecialistId;
  toolName?: string;
  toolArguments?: Record<string, McpPayloadValue>;
  contextConfig?: WorkflowContextConfig;
  decisionRules?: WorkflowDecisionRule[];
  defaultNextNodeId?: string;
  approvalConfig?: WorkflowApprovalConfig;
  actionConfig?: WorkflowActionConfig;
  nextNodeIds: string[];
  position?: { x: number; y: number };
}

/**
 * Authoritative workflow definition stored in Firestore `/brain_workflows/{workflowId}`.
 */
export interface WorkflowDefinition {
  id: string;
  workspaceId: string;
  organizationId: string;
  title: string;
  description: string;
  blueprintId?: string;
  status: 'active' | 'paused' | 'draft';
  trigger: WorkflowTriggerConfig;
  nodes: WorkflowNodeConfig[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version?: number;
}

/**
 * Telemetry record of a single node's execution within a workflow run.
 */
export interface WorkflowStepResult {
  nodeId: string;
  nodeType: WorkflowNodeType;
  status: 'success' | 'failed' | 'skipped' | 'waiting_approval';
  inputPayload: Record<string, McpPayloadValue>;
  outputPayload: Record<string, McpPayloadValue>;
  error?: string;
  approvalId?: string;
  durationMs: number;
  timestamp: string;
}

/**
 * Durable execution record stored in Firestore `/workflow_runs/{runId}`.
 */
export interface WorkflowRun {
  id: string;
  workflowId: string;
  workspaceId: string;
  organizationId: string;
  status: WorkflowRunStatus;
  triggerPayload: Record<string, McpPayloadValue>;
  currentStepIndex: number;
  executedNodeIds: string[];
  stepResults: Record<string, WorkflowStepResult>;
  pendingApprovalId?: string;
  pausedNodeId?: string;
  metrics: {
    durationMs: number;
    totalDurationMs?: number;
    totalNodesExecuted: number;
    toolCallsCount: number;
    approvalWaitCount?: number;
  };
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  error?: string;
  resumedAt?: string;
  resumedBy?: string;
}

/**
 * Pre-packaged turnkey blueprint definition for 1-click workspace installation.
 */
export interface WorkflowBlueprint {
  id: string;
  title: string;
  category: 'revenue' | 'prospecting' | 'meetings' | 'operations';
  description: string;
  iconName: 'ShieldAlert' | 'UserCheck' | 'CalendarCheck' | 'Cpu';
  triggerDescription: string;
  trigger: WorkflowTriggerConfig;
  nodes: WorkflowNodeConfig[];
  benefits: string[];
}

/**
 * Simulation request for testing a workflow dry-run with synthetic payloads.
 */
export interface WorkflowSimulationRequest {
  workspaceId: string;
  organizationId: string;
  workflowId?: string;
  blueprintId?: string;
  customNodes?: WorkflowNodeConfig[];
  mockPayload: Record<string, McpPayloadValue>;
}

/**
 * Simulation result predicting actions, approvals, and potential conflicts.
 */
export interface WorkflowSimulationResult {
  success: boolean;
  predictedNodesExecuted: number;
  predictedActions: Array<{
    nodeId: string;
    actionType: string;
    title: string;
    riskLevel: 'read_only' | 'low_risk' | 'high_risk';
  }>;
  predictedApprovalsCount: number;
  potentialConflictsCount: number;
  estimatedDurationMs: number;
  simulatedPath?: Array<{ nodeId: string; title: string }>;
  executionSteps: Array<{
    nodeId: string;
    nodeType: WorkflowNodeType;
    title: string;
    status: 'simulated_success' | 'simulated_approval_gate' | 'simulated_branch';
    details: string;
  }>;
  warnings: string[];
}
