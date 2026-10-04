/**
 * @fileOverview The Critical Distinction Bridge: Agent-to-Workflow Adapter (Phase 7 Milestone 5)
 *
 * Implements the core architectural distinction from Document 10 / Rule 69:
 *   - Autonomous Agents plan goals, interpret ambiguous intent, and select strategies.
 *   - Durable Workflows execute deterministic, repeatable, multi-day, auditable state machine graphs.
 *
 * This bridge registers workflow template instantiation, status inspection, and cancellation
 * as canonical platform capabilities under the 'automation_workflows' domain. Autonomous agents
 * can discover and invoke these capabilities without ever executing the micro-steps directly.
 *
 * ARCHITECTURAL INVARIANTS:
 * - Rule 4: Zero `any` or `any[]` typing policy across all schemas and execution handlers.
 * - Rule 8 & 47: Anti-IDOR perimeter scoping. Validates caller credentials and tenant context.
 * - Rule 16 & 17: Attenuated scopes and appropriate risk levels (L0 to L3).
 * - Rule 60: Emergency Dead-Man Switch evaluation halting execution with DEAD_MAN_PAUSED.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod/v4';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '@/platform/capabilities/contracts/capability-definition';
import { registerCapability } from '@/platform/capabilities/registry/capability-registry';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { getWorkflowStore, type WorkflowStore } from '../workflow-store';
import {
  getWorkflowTemplateRegistry,
  type WorkflowTemplateRegistry,
} from '../templates/workflow-template-registry';

// ── 1. Input / Output Schemas ───────────────────────────────────────────────

export const WorkflowInstantiateTemplateInputSchema = z.object({
  templateId: z.string().trim().min(1, 'templateId is required'),
  inputs: z.record(z.string(), z.unknown()).default({}),
  title: z.string().optional(),
});

export type WorkflowInstantiateTemplateInput = z.infer<
  typeof WorkflowInstantiateTemplateInputSchema
>;

export const WorkflowInstantiateTemplateOutputSchema = z.object({
  workflowId: z.string(),
  definitionId: z.string(),
  status: z.string(),
  stepCount: z.number(),
  createdAt: z.string(),
});

export type WorkflowInstantiateTemplateOutput = z.infer<
  typeof WorkflowInstantiateTemplateOutputSchema
>;

export const WorkflowGetInstanceStatusInputSchema = z.object({
  workflowId: z.string().trim().min(1, 'workflowId is required'),
});

export type WorkflowGetInstanceStatusInput = z.infer<
  typeof WorkflowGetInstanceStatusInputSchema
>;

export const WorkflowGetInstanceStatusOutputSchema = z.object({
  workflowId: z.string(),
  status: z.string(),
  progress: z.number().min(0).max(100),
  currentStepId: z.string().optional(),
  waitCondition: z
    .object({
      type: z.string(),
      expiresAt: z.string().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorkflowGetInstanceStatusOutput = z.infer<
  typeof WorkflowGetInstanceStatusOutputSchema
>;

export const WorkflowCancelInstanceInputSchema = z.object({
  workflowId: z.string().trim().min(1, 'workflowId is required'),
  reason: z.string().optional(),
});

export type WorkflowCancelInstanceInput = z.infer<
  typeof WorkflowCancelInstanceInputSchema
>;

export const WorkflowCancelInstanceOutputSchema = z.object({
  workflowId: z.string(),
  status: z.literal('cancelled'),
  cancelledAt: z.string(),
  reason: z.string().optional(),
});

export type WorkflowCancelInstanceOutput = z.infer<
  typeof WorkflowCancelInstanceOutputSchema
>;

// ── 2. Capability Definitions Factory ───────────────────────────────────────

export interface WorkflowCapabilitiesOptions {
  store?: WorkflowStore;
  templateRegistry?: WorkflowTemplateRegistry;
}

export function createWorkflowCapabilities(
  options: WorkflowCapabilitiesOptions = {}
): [
  CapabilityDefinition<WorkflowInstantiateTemplateInput, WorkflowInstantiateTemplateOutput>,
  CapabilityDefinition<WorkflowGetInstanceStatusInput, WorkflowGetInstanceStatusOutput>,
  CapabilityDefinition<WorkflowCancelInstanceInput, WorkflowCancelInstanceOutput>,
] {
  const store = options.store || getWorkflowStore();
  const templateRegistry =
    options.templateRegistry || getWorkflowTemplateRegistry();

  // 1. workflow.instantiate_template (L2_STATE_MUTATION)
  const instantiateCapability: CapabilityDefinition<
    WorkflowInstantiateTemplateInput,
    WorkflowInstantiateTemplateOutput
  > = {
    id: 'workflow.instantiate_template',
    version: '1.0.0',
    name: 'Instantiate Workflow Template',
    description:
      'Instantiates and launches a deterministic business workflow template without executing steps directly (The Critical Distinction Bridge).',
    domain: 'automation_workflows',
    operation: 'execute',
    inputSchema: WorkflowInstantiateTemplateInputSchema,
    outputSchema: WorkflowInstantiateTemplateOutputSchema,
    permissions: ['app:automations_manage', 'rbac:workflows.run.create'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
      destructive: false,
      idempotent: false,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 30000,
      supportsDryRun: true,
      supportsCancellation: false,
      supportsCompensation: true,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: false,
      auditRequired: true,
      defaultEnabled: true,
    },
    async handler(
        input: WorkflowInstantiateTemplateInput,
        context: CapabilityExecutionContext
      ): Promise<CapabilityExecutionResult<WorkflowInstantiateTemplateOutput>> {
        const startTime = Date.now();

        // Rule 60: Emergency Dead-Man Switch Evaluation
        try {
          await checkGovernanceDeadManSwitch(context.principal.organizationId);
        } catch {
          return {
            success: false,
            error: {
              code: 'DEAD_MAN_PAUSED',
              message:
                'Autonomous and workflow execution is paused under Rule 60 emergency governance.',
              retryable: true,
            },
            executionId: randomUUID(),
          };
        }

        try {
          const tenant = {
            organizationId: context.principal.organizationId,
            workspaceId: context.principal.workspaceId,
          };

          const storedPrincipal = {
            actorType: 'agent' as const,
            userId: context.principal.userId,
            organizationId: context.principal.organizationId,
            workspaceId: context.principal.workspaceId,
            agentId: context.principal.agentId || 'agent:operator',
            agentVersion: context.principal.agentVersion || '1.0.0',
            delegationId: context.principal.delegationId,
            policyVersion: context.principal.policyVersion,
            grantedScopes: context.principal.grantedScopes || [],
            effectiveRole: context.principal.effectiveRole || 'agent:operator',
          };

          const { instance, steps } = await templateRegistry.instantiateTemplate({
            templateId: input.templateId,
            inputs: input.inputs,
            initiator: {
              actorType: 'agent',
              actorId: context.principal.userId,
            },
            principal: storedPrincipal,
            tenant,
            title: input.title,
            correlationId: context.correlationId,
            dryRun: context.dryRun ?? false,
          });

          return {
            success: true,
            data: {
              workflowId: instance.id,
              definitionId: instance.definitionId,
              status: instance.status,
              stepCount: steps.length,
              createdAt: instance.createdAt,
            },
            executionId: randomUUID(),
            emittedEvents: [],
            durationMs: Date.now() - startTime,
          };
        } catch (err) {
          return {
            success: false,
            error: {
              code: 'WORKFLOW_INSTANTIATION_FAILED',
              message:
                err instanceof Error
                  ? err.message
                  : 'Workflow instantiation failed',
              retryable: false,
            },
            executionId: randomUUID(),
          };
        }
      },
    };

  // 2. workflow.get_instance_status (L0_READ)
  const statusCapability: CapabilityDefinition<
    WorkflowGetInstanceStatusInput,
    WorkflowGetInstanceStatusOutput
  > = {
    id: 'workflow.get_instance_status',
    version: '1.0.0',
    name: 'Get Workflow Instance Status',
    description:
      'Inspects the progress, status, and wait conditions of a durable workflow instance.',
    domain: 'automation_workflows',
    operation: 'read',
    inputSchema: WorkflowGetInstanceStatusInputSchema,
    outputSchema: WorkflowGetInstanceStatusOutputSchema,
    permissions: ['app:automations_view', 'rbac:workflows.run.read'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L0_READ',
      destructive: false,
      idempotent: true,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 10000,
      supportsDryRun: true,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: false,
      auditRequired: false,
      defaultEnabled: true,
    },
    async handler(
        input: WorkflowGetInstanceStatusInput,
        context: CapabilityExecutionContext
      ): Promise<CapabilityExecutionResult<WorkflowGetInstanceStatusOutput>> {
        const startTime = Date.now();
        const tenant = {
          organizationId: context.principal.organizationId,
          workspaceId: context.principal.workspaceId,
        };

        const instance = await store.getInstance(input.workflowId, tenant);
        if (!instance) {
          return {
            success: false,
            error: {
              code: 'WORKFLOW_NOT_FOUND',
              message: `Workflow '${input.workflowId}' not found`,
              retryable: false,
            },
            executionId: randomUUID(),
          };
        }

        const steps = await store.listSteps(instance.id, tenant);
        const totalSteps = steps.length;
        const completedSteps = steps.filter((s) => s.status === 'COMPLETED').length;
        const progress =
          totalSteps > 0
            ? Math.round((completedSteps / totalSteps) * 100)
            : instance.status === 'COMPLETED'
              ? 100
              : 0;

        const currentStep = steps.find(
          (s) => s.status === 'WAITING' || s.status === 'RUNNING'
        );
        const waitCondition =
          instance.currentWaitCondition || currentStep?.waitCondition;

        return {
          success: true,
          data: {
            workflowId: instance.id,
            status: instance.status,
            progress,
            currentStepId: instance.currentStepId || currentStep?.id,
            waitCondition: waitCondition
              ? {
                  type: waitCondition.type,
                  expiresAt: waitCondition.expiresAt,
                  details: waitCondition.details,
                }
              : undefined,
            createdAt: instance.createdAt,
            updatedAt: instance.updatedAt,
          },
          executionId: randomUUID(),
          emittedEvents: [],
          durationMs: Date.now() - startTime,
        };
      },
    };

  // 3. workflow.cancel_instance (L3_EXTERNAL_COMMUNICATION_FINANCE)
  const cancelCapability: CapabilityDefinition<
    WorkflowCancelInstanceInput,
    WorkflowCancelInstanceOutput
  > = {
    id: 'workflow.cancel_instance',
    version: '1.0.0',
    name: 'Cancel Workflow Instance',
    description:
      'Requests cooperative cancellation and unwinding of a running or waiting workflow instance.',
    domain: 'automation_workflows',
    operation: 'update',
    inputSchema: WorkflowCancelInstanceInputSchema,
    outputSchema: WorkflowCancelInstanceOutputSchema,
    permissions: ['app:automations_manage', 'rbac:workflows.run.cancel'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      destructive: false,
      idempotent: true,
      openWorld: false,
      requiresHumanApproval: true,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 15000,
      supportsDryRun: false,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: false,
      auditRequired: true,
      defaultEnabled: true,
    },
    async handler(
        input: WorkflowCancelInstanceInput,
        context: CapabilityExecutionContext
      ): Promise<CapabilityExecutionResult<WorkflowCancelInstanceOutput>> {
        const startTime = Date.now();
        const tenant = {
          organizationId: context.principal.organizationId,
          workspaceId: context.principal.workspaceId,
        };

        const instance = await store.getInstance(input.workflowId, tenant);
        if (!instance) {
          return {
            success: false,
            error: {
              code: 'WORKFLOW_NOT_FOUND',
              message: `Workflow '${input.workflowId}' not found`,
              retryable: false,
            },
            executionId: randomUUID(),
          };
        }

        if (instance.status === 'CANCELLED') {
          return {
            success: true,
            data: {
              workflowId: instance.id,
              status: 'cancelled',
              cancelledAt: instance.completedAt || instance.updatedAt,
              reason: input.reason,
            },
            executionId: randomUUID(),
            emittedEvents: [],
            durationMs: Date.now() - startTime,
          };
        }

        const updated = await store.updateInstanceStatus(
          instance.id,
          'CANCELLED',
          tenant
        );

        return {
          success: true,
          data: {
            workflowId: updated.id,
            status: 'cancelled',
            cancelledAt: updated.completedAt || updated.updatedAt,
            reason: input.reason,
          },
          executionId: randomUUID(),
          emittedEvents: [],
          durationMs: Date.now() - startTime,
        };
      },
    };

  return [instantiateCapability, statusCapability, cancelCapability];
}

/**
 * Registers canonical workflow capabilities into the global CapabilityRegistry.
 */
export function registerWorkflowCapabilities(
  options: WorkflowCapabilitiesOptions = {}
): void {
  const capabilities = createWorkflowCapabilities(options);
  for (const cap of capabilities) {
    registerCapability(cap, { allowOverride: true });
  }
}
