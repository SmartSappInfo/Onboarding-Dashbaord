/**
 * @fileOverview Legacy Automations Strangler Fig Bridge (Phase 7 Milestone 5)
 *
 * Implements Rule 69 (Strangler Fig Pattern SSOT):
 * Seamlessly adapts preexisting automation triggers and actions into durable workflow executions
 * with automatic fallback to the legacy execution engine if disabled by feature flag.
 *
 * ARCHITECTURAL INVARIANTS:
 * - Rule 4: Zero `any` or `any[]` typing policy.
 * - Rule 8 & 47: Anti-IDOR perimeter scoping.
 * - Rule 60: Emergency Dead-Man Switch evaluation halting durable execution.
 * - Rule 69: Zero regression to legacy automations and call centre triggers.
 */

import { randomUUID } from 'node:crypto';
import type { WorkflowStore } from '../workflow-store';
import type { WorkflowTemplateRegistry } from '../templates/workflow-template-registry';
import type { TenantBoundary } from '../workflow-types';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import type {
  WorkflowStepTemplate,
} from '../templates/workflow-template-types';

export interface LegacyActionConfig {
  id: string;
  type: string;
  config?: Record<string, unknown>;
}

export interface LegacyAutomationRecord {
  id: string;
  name: string;
  trigger: string;
  status: 'active' | 'draft' | 'paused';
  actions: LegacyActionConfig[];
}

export interface LegacyExecutionOptions {
  automation: LegacyAutomationRecord;
  payload: Record<string, unknown>;
  tenant: TenantBoundary;
  actorId: string;
  correlationId?: string;
}

export interface LegacyBridgeExecutionResult {
  mode: 'durable_workflow' | 'legacy_engine';
  workflowId?: string;
  status: 'QUEUED' | 'COMPLETED' | 'FAILED';
  stepCount?: number;
  error?: string;
}

export interface LegacyWorkflowBridgeOptions {
  store: WorkflowStore;
  templateRegistry: WorkflowTemplateRegistry;
  enableDurableWorkflows?: boolean;
  legacyRunner?: (
    automationId: string,
    payload: Record<string, unknown>,
    context?: unknown
  ) => Promise<unknown>;
}

export class LegacyWorkflowBridge {
  private readonly store: WorkflowStore;
  private readonly templateRegistry: WorkflowTemplateRegistry;
  private readonly enableDurableWorkflows: boolean;
  private readonly legacyRunner?: (
    automationId: string,
    payload: Record<string, unknown>,
    context?: unknown
  ) => Promise<unknown>;

  constructor(options: LegacyWorkflowBridgeOptions) {
    this.store = options.store;
    this.templateRegistry = options.templateRegistry;
    this.enableDurableWorkflows = options.enableDurableWorkflows ?? true;
    this.legacyRunner = options.legacyRunner;
  }

  /**
   * Executes a legacy automation either through the modern durable workflow engine
   * or via the legacy execution engine based on feature flag.
   */
  async executeLegacyAutomation(
    options: LegacyExecutionOptions
  ): Promise<LegacyBridgeExecutionResult> {
    // 1. Fallback to legacy engine when durable workflows are disabled
    if (!this.enableDurableWorkflows) {
      if (this.legacyRunner) {
        await this.legacyRunner(options.automation.id, options.payload, {
          tenant: options.tenant,
          actorId: options.actorId,
        });
      }
      return {
        mode: 'legacy_engine',
        status: 'COMPLETED',
      };
    }

    // 2. Rule 60: Emergency Dead-Man Switch Evaluation
    try {
      await checkGovernanceDeadManSwitch(options.tenant.organizationId);
    } catch {
      throw new Error(
        '[DEAD_MAN_PAUSED] Autonomous and workflow execution is paused under Rule 60 emergency governance.'
      );
    }

    // 3. Convert legacy actions into workflow step templates
    const steps: WorkflowStepTemplate[] = options.automation.actions.map(
      (act, index) => ({
        id: act.id,
        name: `${act.type}_step_${index}`,
        capabilityId: `legacy.${act.type}`,
        dependsOn: index > 0 ? [options.automation.actions[index - 1].id] : [],
        isMutating: true,
        timeoutSeconds: 120,
        maxAttempts: 3,
        inputMapping: act.config || {},
      })
    );

    const templateId = `legacy_${options.automation.id}`;
    let template = this.templateRegistry.getTemplate(templateId);

    if (!template) {
      template = {
        id: templateId,
        version: '1.0.0',
        name: options.automation.name,
        description: `Durable bridge wrapper for legacy automation ${options.automation.id}`,
        category: 'operations',
        parameters: [],
        steps,
      };
      this.templateRegistry.registerTemplate(template);
    }

    // 4. Instantiate workflow template
    const correlationId = options.correlationId || randomUUID();
    const { instance, steps: createdSteps } =
      await this.templateRegistry.instantiateTemplate({
        templateId,
        inputs: options.payload,
        initiator: {
          actorType: 'system',
          actorId: options.actorId,
        },
        principal: {
          actorType: 'agent',
          userId: options.actorId,
          organizationId: options.tenant.organizationId,
          workspaceId: options.tenant.workspaceId,
          agentId: `legacy_bridge:${options.automation.id}`,
          grantedScopes: ['app:automations_manage'],
          effectiveRole: 'system',
        },
        tenant: options.tenant,
        dryRun: false,
        title: options.automation.name,
        correlationId,
      });

    return {
      mode: 'durable_workflow',
      workflowId: instance.id,
      status: instance.status as 'QUEUED' | 'COMPLETED' | 'FAILED',
      stepCount: createdSteps.length,
    };
  }
}
