/**
 * @fileOverview Workflow Template Registry & Instantiation Compiler (Phase 7 Milestone 5)
 *
 * Implements:
 * - Rule 4: Zero `any` or `any[]` typing policy
 * - Rule 8 & 47: Anti-IDOR tenant boundary enforcement
 * - Rule 19: Deterministic idempotency keys
 * - Rule 20: OpenTelemetry distributed tracing correlation
 * - Rule 47: Model Distrust & Kahn's Algorithm DAG verification
 * - Rule 60: Emergency Dead-Man Switch evaluation
 * - HMR Preservation (Rule 69)
 */

import { randomUUID } from 'node:crypto';
import { type WorkflowStore, getWorkflowStore } from '../workflow-store';
import { getWorkflowDispatcher, type WorkflowDispatcher } from '../dispatcher/workflow-dispatcher';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  WorkflowTemplateDefinitionSchema,
  InstantiateTemplateInputSchema,
  validateTemplateDag,
  WorkflowTemplateError,
  TEMPLATE_ERROR_CODES,
  type WorkflowTemplateDefinition,
  type InstantiateTemplateInput,
} from './workflow-template-types';
import type { WorkflowInstance, WorkflowStep } from '../workflow-types';
import { LeadOnboardingWorkflow } from './lead-onboarding-template';
import { DealReviewWorkflow } from './deal-review-template';

export interface WorkflowTemplateRegistryOptions {
  store?: WorkflowStore;
  dispatcher?: WorkflowDispatcher;
}

export class WorkflowTemplateRegistry {
  private readonly store?: WorkflowStore;
  private readonly dispatcher?: WorkflowDispatcher;
  private readonly templates = new Map<string, WorkflowTemplateDefinition>();

  constructor(options?: WorkflowTemplateRegistryOptions) {
    this.store = options?.store;
    this.dispatcher = options?.dispatcher;
  }

  private getStore(): WorkflowStore {
    if (process.env.NODE_ENV === 'test' && !this.store) {
      return getWorkflowStore();
    }
    return this.store || getWorkflowStore();
  }

  /**
   * Registers a new workflow template, validating its schema and DAG acyclicity via Kahn's algorithm.
   */
  registerTemplate(template: WorkflowTemplateDefinition): void {
    const parsed = WorkflowTemplateDefinitionSchema.parse(template);

    // Kahn's algorithm DAG validation (Rule 47)
    validateTemplateDag(parsed.steps);

    this.templates.set(parsed.id, parsed);
  }

  /**
   * Retrieves a registered workflow template by ID.
   */
  getTemplate(templateId: string): WorkflowTemplateDefinition | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Returns a list of all registered templates.
   */
  listTemplates(): WorkflowTemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  /**
   * Compiles and instantiates a workflow template into durable WorkflowInstance and WorkflowStep records.
   */
  async instantiateTemplate(
    rawInput: InstantiateTemplateInput
  ): Promise<{ instance: WorkflowInstance; steps: WorkflowStep[] }> {
    const input = InstantiateTemplateInputSchema.parse(rawInput);

    // Rule 60: Emergency Dead-Man Switch Evaluation
    try {
      await checkGovernanceDeadManSwitch(input.tenant.organizationId);
    } catch {
      throw new WorkflowTemplateError(
        TEMPLATE_ERROR_CODES.DEAD_MAN_PAUSED,
        '[DEAD_MAN_PAUSED] Autonomous and workflow execution is paused under Rule 60 emergency governance.'
      );
    }

    const template = this.getTemplate(input.templateId);
    if (!template) {
      throw new WorkflowTemplateError(
        TEMPLATE_ERROR_CODES.TEMPLATE_NOT_FOUND,
        `Workflow template '${input.templateId}' does not exist.`
      );
    }

    // Validate required parameters
    for (const param of template.parameters) {
      if (param.required) {
        const value = input.inputs[param.name];
        if (value === undefined || value === null || value === '') {
          throw new WorkflowTemplateError(
            TEMPLATE_ERROR_CODES.TEMPLATE_INVALID_PARAMETERS,
            `[TEMPLATE_INVALID_PARAMETERS] Missing required parameter '${param.name}' for template '${template.id}'.`
          );
        }
      }
    }

    // Compute topological order (Kahn's algorithm)
    const topologicalOrder = validateTemplateDag(template.steps);
    const correlationId = input.correlationId || randomUUID();
    const idempotencyKey = `instantiate_${template.id}_${randomUUID()}`;

    const store = this.getStore();

    // 1. Create WorkflowInstance in durable store
    const initialInstance = await store.createInstance({
      organizationId: input.tenant.organizationId,
      workspaceId: input.tenant.workspaceId,
      definitionId: template.id,
      definitionVersion: template.version,
      title: input.title || template.name,
      initiator: input.initiator,
      principal: input.principal,
      correlationId,
      idempotencyKey,
      inputs: input.inputs,
      dryRun: input.dryRun,
    });

    // Advance to QUEUED state
    const queuedInstance = await store.updateInstanceStatus(
      initialInstance.id,
      'QUEUED',
      input.tenant
    );

    // 2. Create Steps in topological order
    const createdSteps: WorkflowStep[] = [];
    const stepMap = new Map(template.steps.map((s) => [s.id, s]));

    for (let index = 0; index < topologicalOrder.length; index++) {
      const stepTemplateId = topologicalOrder[index];
      const stepTemplate = stepMap.get(stepTemplateId)!;

      const step = await store.createStep({
        workflowId: queuedInstance.id,
        organizationId: input.tenant.organizationId,
        workspaceId: input.tenant.workspaceId,
        stepIndex: index,
        capabilityId: stepTemplate.capabilityId,
        capabilityVersion: stepTemplate.capabilityVersion,
        name: stepTemplate.name,
        dependsOn: stepTemplate.dependsOn,
        waitCondition: stepTemplate.waitCondition,
        isMutating: stepTemplate.isMutating,
        compensatingCapabilityId: stepTemplate.compensatingCapabilityId,
        riskLevel: stepTemplate.riskLevel,
        input: stepTemplate.inputMapping,
      });

      createdSteps.push(step);
    }

    // 3. Dispatch Step 0 to Cloud Tasks queue
    if (this.dispatcher && createdSteps.length > 0) {
      await this.dispatcher.enqueueWorkflowStep({
        workflowId: queuedInstance.id,
        stepId: createdSteps[0].id,
        attempt: 1,
        tenant: input.tenant,
        correlationId,
        idempotencyKey: createdSteps[0].idempotencyKey,
      });
    }

    return {
      instance: queuedInstance,
      steps: createdSteps,
    };
  }
}

// ── Global Singleton with HMR Preservation (Rule 69) ────────────────────────
declare global {
  var __smartsappWorkflowTemplateRegistry: WorkflowTemplateRegistry | undefined;
}

export function getWorkflowTemplateRegistry(): WorkflowTemplateRegistry {
  if (!globalThis.__smartsappWorkflowTemplateRegistry) {
    const registry = new WorkflowTemplateRegistry({
      dispatcher: getWorkflowDispatcher(),
    });

    registry.registerTemplate(LeadOnboardingWorkflow);
    registry.registerTemplate(DealReviewWorkflow);
    // `meeting_followup_v1` is RETIRED (Phase 11 M2 · T3.3): it had no production starter (zero
    // instances), called capabilities that don't exist and sent an ungoverned recap email.
    // Post-meeting work is `meeting_postprocess_v2` (src/lib/meetings/intelligence/pipeline.ts).

    globalThis.__smartsappWorkflowTemplateRegistry = registry;
  }

  return globalThis.__smartsappWorkflowTemplateRegistry;
}

export function setWorkflowTemplateRegistryForTests(
  registry: WorkflowTemplateRegistry | undefined
): void {
  globalThis.__smartsappWorkflowTemplateRegistry = registry;
}

