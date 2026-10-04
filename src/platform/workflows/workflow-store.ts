/**
 * @fileOverview Multi-Tenant Workflow Store Interface & Implementations (Phase 7 Milestone 1)
 *
 * ARCHITECTURAL SPECIFICATIONS & INVARIANTS:
 * 1. ZERO ANY POLICY (Rule 4): All schemas strictly typed via Zod v4.
 * 2. ANTI-IDOR & MULTI-TENANCY (Rule 8 & 47): Every store operation asserts matching organizationId and workspaceId.
 *    Any tenant mismatch throws WorkflowError('TENANT_SCOPE_VIOLATION').
 * 3. 1MB DOCUMENT PROTECTION VIA SUBCOLLECTIONS (Rule 9): Steps and Checkpoints are partitioned into
 *    subcollections (/organizations/{orgId}/workflows/{workflowId}/steps and /checkpoints).
 * 4. ATOMIC TRANSACTIONS (Rule 18 & 19): Status transitions and step mutations run inside atomic transactions.
 * 5. HMR PRESERVATION (Rule 69): Global singleton preserved on globalThis.__smartsappWorkflowStore.
 */

import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  type WorkflowInstance,
  type WorkflowStep,
  type WorkflowCheckpoint,
  type WorkflowState,
  type WaitCondition,
  type WaitConditionInput,
  type TenantBoundary,
  type CreateWorkflowInstanceInput,
  type CreateWorkflowStepInput,
  type UpdateWorkflowStepInput,
  type CreateWorkflowCheckpointInput,
  type ListWorkflowInstancesOptions,
  WorkflowInstanceSchema,
  WorkflowStepSchema,
  WorkflowCheckpointSchema,
  WorkflowBudgetsSchema,
  WaitConditionSchema,
  WorkflowError,
} from './workflow-types';
import {
  assertValidWorkflowTransition,
  createCheckpointHash,
  isTerminalWorkflowState,
} from './workflow-state-machine';

export interface WorkflowStore {
  createInstance(input: CreateWorkflowInstanceInput): Promise<WorkflowInstance>;
  getInstance(id: string, tenant: TenantBoundary): Promise<WorkflowInstance | null>;
  updateInstanceStatus(
    id: string,
    targetState: WorkflowState,
    tenant: TenantBoundary,
    options?: {
      currentStepId?: string;
      waitCondition?: WaitConditionInput;
      error?: {
        code: string;
        message: string;
        details?: unknown;
      };
      outputs?: Record<string, unknown>;
      allowOperatorRecovery?: boolean;
    }
  ): Promise<WorkflowInstance>;
  listInstances(
    options: ListWorkflowInstancesOptions
  ): Promise<{ items: WorkflowInstance[]; total: number }>;

  createStep(input: CreateWorkflowStepInput): Promise<WorkflowStep>;
  getStep(workflowId: string, stepId: string, tenant: TenantBoundary): Promise<WorkflowStep | null>;
  updateStep(
    workflowId: string,
    stepId: string,
    update: UpdateWorkflowStepInput,
    tenant: TenantBoundary
  ): Promise<WorkflowStep>;
  listSteps(workflowId: string, tenant: TenantBoundary): Promise<WorkflowStep[]>;

  recordCheckpoint(input: CreateWorkflowCheckpointInput): Promise<WorkflowCheckpoint>;
  listCheckpoints(workflowId: string, tenant: TenantBoundary): Promise<WorkflowCheckpoint[]>;
  getLatestCheckpoint(workflowId: string, tenant: TenantBoundary): Promise<WorkflowCheckpoint | null>;
}

// ── In-Memory Implementation for Hermetic Testing ───────────────────────────
export function createMemoryWorkflowStore(): WorkflowStore {
  const instances = new Map<string, WorkflowInstance>();
  const steps = new Map<string, WorkflowStep>();
  const checkpoints = new Map<string, WorkflowCheckpoint[]>();
  const idempotencyKeys = new Set<string>();

  const buildStepKey = (workflowId: string, stepId: string) => `${workflowId}:${stepId}`;
  const buildIdemKey = (tenant: TenantBoundary, key: string) =>
    `${tenant.organizationId}:${tenant.workspaceId}:${key}`;

  const assertTenantMatch = (recordTenant: TenantBoundary, requestedTenant: TenantBoundary) => {
    if (
      recordTenant.organizationId !== requestedTenant.organizationId ||
      recordTenant.workspaceId !== requestedTenant.workspaceId
    ) {
      throw new WorkflowError(
        'TENANT_SCOPE_VIOLATION',
        `Access denied: organization or workspace mismatch`
      );
    }
  };

  return {
    async createInstance(input: CreateWorkflowInstanceInput): Promise<WorkflowInstance> {
      const tenant: TenantBoundary = {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
      };

      const idempotencyKey = input.idempotencyKey || `idem_${randomUUID()}`;
      const idemKey = buildIdemKey(tenant, idempotencyKey);
      if (idempotencyKeys.has(idemKey)) {
        throw new WorkflowError(
          'IDEMPOTENCY_CONFLICT',
          `Workflow with idempotencyKey '${idempotencyKey}' already exists for this tenant`
        );
      }
      idempotencyKeys.add(idemKey);

      const id = input.id || `wf_${randomUUID()}`;
      const now = new Date().toISOString();

      const defaultBudgets = WorkflowBudgetsSchema.parse({});
      const mergedBudgets = WorkflowBudgetsSchema.parse({
        ...defaultBudgets,
        ...(input.budgets || {}),
      });

      const instance: WorkflowInstance = WorkflowInstanceSchema.parse({
        id,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        definitionId: input.definitionId,
        definitionVersion: input.definitionVersion || '1.0.0',
        title: input.title,
        status: 'CREATED',
        initiator: input.initiator,
        principal: input.principal,
        correlationId: input.correlationId || `corr_${randomUUID()}`,
        idempotencyKey,
        inputs: input.inputs || {},
        budgets: mergedBudgets,
        stepCounts: { total: 0, completed: 0, failed: 0, skipped: 0 },
        dryRun: input.dryRun || false,
        createdAt: now,
        updatedAt: now,
      });

      instances.set(id, instance);
      checkpoints.set(id, []);

      // Record initial CREATED checkpoint
      const hash = createCheckpointHash({
        workflowId: id,
        sequence: 0,
        fromState: 'CREATED',
        toState: 'CREATED',
        statePayload: { event: 'workflow_created' },
      });

      const initialCheckpoint: WorkflowCheckpoint = WorkflowCheckpointSchema.parse({
        id: `chk_${randomUUID()}`,
        workflowId: id,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        checkpointSequence: 0,
        fromState: 'CREATED',
        toState: 'CREATED',
        statePayload: { event: 'workflow_created' },
        hash,
        timestamp: now,
      });

      checkpoints.get(id)!.push(initialCheckpoint);

      return instance;
    },

    async getInstance(id: string, tenant: TenantBoundary): Promise<WorkflowInstance | null> {
      const instance = instances.get(id);
      if (!instance) {
        return null;
      }
      assertTenantMatch(instance, tenant);
      return instance;
    },

    async updateInstanceStatus(
      id: string,
      targetState: WorkflowState,
      tenant: TenantBoundary,
      options?: {
        currentStepId?: string;
        waitCondition?: WaitCondition;
        error?: {
          code: string;
          message: string;
          details?: unknown;
        };
        outputs?: Record<string, unknown>;
        allowOperatorRecovery?: boolean;
      }
    ): Promise<WorkflowInstance> {
      const instance = instances.get(id);
      if (!instance) {
        throw new WorkflowError('WORKFLOW_NOT_FOUND', `Workflow '${id}' does not exist`);
      }
      assertTenantMatch(instance, tenant);

      assertValidWorkflowTransition(instance.status, targetState, {
        allowOperatorRecovery: options?.allowOperatorRecovery,
      });

      const now = new Date().toISOString();
      const fromState = instance.status;

      const updatedInstance: WorkflowInstance = {
        ...instance,
        status: targetState,
        currentStepId: options?.currentStepId ?? instance.currentStepId,
        currentWaitCondition: options?.waitCondition
          ? WaitConditionSchema.parse(options.waitCondition)
          : instance.currentWaitCondition,
        error: options?.error ?? instance.error,
        outputs: options?.outputs ? { ...(instance.outputs || {}), ...options.outputs } : instance.outputs,
        updatedAt: now,
        completedAt: isTerminalWorkflowState(targetState) ? now : instance.completedAt,
      };

      instances.set(id, updatedInstance);

      // Record state transition checkpoint
      const workflowCheckpoints = checkpoints.get(id) || [];
      const sequence = workflowCheckpoints.length;
      const previousHash = sequence > 0 ? workflowCheckpoints[sequence - 1].hash : undefined;

      const hash = createCheckpointHash({
        workflowId: id,
        sequence,
        fromState,
        toState: targetState,
        stepId: options?.currentStepId,
        statePayload: {
          error: options?.error,
          waitCondition: options?.waitCondition,
          outputs: options?.outputs,
        },
        previousHash,
      });

      const checkpoint: WorkflowCheckpoint = WorkflowCheckpointSchema.parse({
        id: `chk_${randomUUID()}`,
        workflowId: id,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        checkpointSequence: sequence,
        fromState,
        toState: targetState,
        stepId: options?.currentStepId,
        statePayload: {
          error: options?.error,
          waitCondition: options?.waitCondition,
          outputs: options?.outputs,
        },
        hash,
        previousHash,
        timestamp: now,
      });

      workflowCheckpoints.push(checkpoint);
      checkpoints.set(id, workflowCheckpoints);

      return updatedInstance;
    },

    async listInstances(
      options: ListWorkflowInstancesOptions
    ): Promise<{ items: WorkflowInstance[]; total: number }> {
      const all = Array.from(instances.values()).filter(
        (inst) =>
          inst.organizationId === options.organizationId &&
          inst.workspaceId === options.workspaceId &&
          (!options.status || inst.status === options.status) &&
          (!options.definitionId || inst.definitionId === options.definitionId)
      );

      const total = all.length;
      const offset = options.offset || 0;
      const limit = options.limit || 50;
      const items = all.slice(offset, offset + limit);

      return { items, total };
    },

    async createStep(input: CreateWorkflowStepInput): Promise<WorkflowStep> {
      const instance = instances.get(input.workflowId);
      if (!instance) {
        throw new WorkflowError(
          'WORKFLOW_NOT_FOUND',
          `Cannot create step: workflow '${input.workflowId}' does not exist`
        );
      }
      assertTenantMatch(instance, input);

      const stepId = input.id || `step_${randomUUID()}`;
      const stepKey = buildStepKey(input.workflowId, stepId);

      const step: WorkflowStep = WorkflowStepSchema.parse({
        id: stepId,
        workflowId: input.workflowId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        stepIndex: input.stepIndex,
        capabilityId: input.capabilityId,
        capabilityVersion: input.capabilityVersion,
        name: input.name,
        status: input.status || 'PENDING',
        dependsOn: input.dependsOn || [],
        waitCondition: input.waitCondition,
        input: input.input || {},
        idempotencyKey: input.idempotencyKey || `idem_${input.workflowId}_step_${input.stepIndex}`,
        isMutating: input.isMutating || false,
        compensatingCapabilityId: input.compensatingCapabilityId,
        compensationStatus: 'none',
        riskLevel: input.riskLevel,
        isNonDelegable: input.isNonDelegable || false,
        maxAttempts: input.maxAttempts || 3,
        attempt: 0,
      });

      steps.set(stepKey, step);

      // Increment step counts on instance
      instance.stepCounts.total += 1;
      if (input.status === 'COMPLETED') {
        instance.stepCounts.completed += 1;
      }
      instance.updatedAt = new Date().toISOString();
      instances.set(instance.id, instance);

      return step;
    },

    async getStep(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary
    ): Promise<WorkflowStep | null> {
      const stepKey = buildStepKey(workflowId, stepId);
      const step = steps.get(stepKey);
      if (!step) {
        return null;
      }
      assertTenantMatch(step, tenant);
      return step;
    },

    async updateStep(
      workflowId: string,
      stepId: string,
      update: UpdateWorkflowStepInput,
      tenant: TenantBoundary
    ): Promise<WorkflowStep> {
      const stepKey = buildStepKey(workflowId, stepId);
      const step = steps.get(stepKey);
      if (!step) {
        throw new WorkflowError('STEP_NOT_FOUND', `Step '${stepId}' not found`);
      }
      assertTenantMatch(step, tenant);

      const updatedStep: WorkflowStep = {
        ...step,
        status: update.status ?? step.status,
        input: update.input ?? step.input,
        waitCondition: update.waitCondition !== undefined
          ? (update.waitCondition ? WaitConditionSchema.parse(update.waitCondition) : undefined)
          : step.waitCondition,
        output: update.output ?? step.output,
        error: update.error ?? step.error,
        attempt: update.attempt ?? step.attempt,
        compensationStatus: update.compensationStatus ?? step.compensationStatus,
        compensatingCapabilityId: update.compensatingCapabilityId ?? step.compensatingCapabilityId,
        outputValidated: update.outputValidated ?? step.outputValidated,
        outputValidationErrors: update.outputValidationErrors ?? step.outputValidationErrors,
        startedAt: update.startedAt ?? step.startedAt,
        completedAt: update.completedAt ?? step.completedAt,
        durationMs: update.durationMs ?? step.durationMs,
      };

      steps.set(stepKey, updatedStep);

      // Update instance step counts if status completed/failed
      const instance = instances.get(workflowId);
      if (instance) {
        if (update.status === 'COMPLETED' && step.status !== 'COMPLETED') {
          instance.stepCounts.completed += 1;
        } else if (update.status === 'FAILED' && step.status !== 'FAILED') {
          instance.stepCounts.failed += 1;
        } else if (update.status === 'SKIPPED' && step.status !== 'SKIPPED') {
          instance.stepCounts.skipped += 1;
        }
        instance.updatedAt = new Date().toISOString();
        instances.set(instance.id, instance);
      }

      return updatedStep;
    },

    async listSteps(workflowId: string, tenant: TenantBoundary): Promise<WorkflowStep[]> {
      const instance = instances.get(workflowId);
      if (!instance) {
        throw new WorkflowError('WORKFLOW_NOT_FOUND', `Workflow '${workflowId}' not found`);
      }
      assertTenantMatch(instance, tenant);

      const result: WorkflowStep[] = [];
      for (const [key, step] of steps.entries()) {
        if (key.startsWith(`${workflowId}:`)) {
          result.push(step);
        }
      }
      return result.sort((a, b) => a.stepIndex - b.stepIndex);
    },

    async recordCheckpoint(input: CreateWorkflowCheckpointInput): Promise<WorkflowCheckpoint> {
      const instance = instances.get(input.workflowId);
      if (!instance) {
        throw new WorkflowError('WORKFLOW_NOT_FOUND', `Workflow '${input.workflowId}' not found`);
      }
      assertTenantMatch(instance, input);

      const workflowCheckpoints = checkpoints.get(input.workflowId) || [];
      const sequence = input.checkpointSequence;
      const previousHash =
        input.previousHash ||
        (workflowCheckpoints.length > 0
          ? workflowCheckpoints[workflowCheckpoints.length - 1].hash
          : undefined);

      const hash =
        input.hash ||
        createCheckpointHash({
          workflowId: input.workflowId,
          sequence,
          fromState: input.fromState,
          toState: input.toState,
          stepId: input.stepId,
          statePayload: input.statePayload || {},
          previousHash,
        });

      const checkpoint: WorkflowCheckpoint = WorkflowCheckpointSchema.parse({
        id: input.id || `chk_${randomUUID()}`,
        workflowId: input.workflowId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        checkpointSequence: sequence,
        fromState: input.fromState,
        toState: input.toState,
        stepId: input.stepId,
        statePayload: input.statePayload || {},
        hash,
        previousHash,
        timestamp: new Date().toISOString(),
      });

      workflowCheckpoints.push(checkpoint);
      checkpoints.set(input.workflowId, workflowCheckpoints);

      return checkpoint;
    },

    async listCheckpoints(workflowId: string, tenant: TenantBoundary): Promise<WorkflowCheckpoint[]> {
      const instance = instances.get(workflowId);
      if (!instance) {
        throw new WorkflowError('WORKFLOW_NOT_FOUND', `Workflow '${workflowId}' not found`);
      }
      assertTenantMatch(instance, tenant);

      const result = checkpoints.get(workflowId) || [];
      return [...result].sort((a, b) => a.checkpointSequence - b.checkpointSequence);
    },

    async getLatestCheckpoint(
      workflowId: string,
      tenant: TenantBoundary
    ): Promise<WorkflowCheckpoint | null> {
      const list = await this.listCheckpoints(workflowId, tenant);
      return list.length > 0 ? list[list.length - 1] : null;
    },
  };
}

// ── Firestore Implementation for Production ────────────────────────────────
export function createFirestoreWorkflowStore(customDb?: Firestore): WorkflowStore {
  const getDb = (): Firestore => customDb || adminDb;

  const getWorkflowDocRef = (orgId: string, workflowId: string) =>
    getDb().collection('organizations').doc(orgId).collection('workflows').doc(workflowId);

  const getStepDocRef = (orgId: string, workflowId: string, stepId: string) =>
    getWorkflowDocRef(orgId, workflowId).collection('steps').doc(stepId);

  const getCheckpointDocRef = (orgId: string, workflowId: string, checkpointId: string) =>
    getWorkflowDocRef(orgId, workflowId).collection('checkpoints').doc(checkpointId);

  const assertTenantMatch = (recordTenant: TenantBoundary, requestedTenant: TenantBoundary) => {
    if (
      recordTenant.organizationId !== requestedTenant.organizationId ||
      recordTenant.workspaceId !== requestedTenant.workspaceId
    ) {
      throw new WorkflowError(
        'TENANT_SCOPE_VIOLATION',
        `Access denied: organization or workspace mismatch`
      );
    }
  };

  return {
    async createInstance(input: CreateWorkflowInstanceInput): Promise<WorkflowInstance> {
      const db = getDb();
      const workflowId = input.id || `wf_${randomUUID()}`;
      const docRef = getWorkflowDocRef(input.organizationId, workflowId);
      const idempotencyKey = input.idempotencyKey || `idem_${randomUUID()}`;
      const now = new Date().toISOString();

      const defaultBudgets = WorkflowBudgetsSchema.parse({});
      const mergedBudgets = WorkflowBudgetsSchema.parse({
        ...defaultBudgets,
        ...(input.budgets || {}),
      });

      const instance: WorkflowInstance = WorkflowInstanceSchema.parse({
        id: workflowId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        definitionId: input.definitionId,
        definitionVersion: input.definitionVersion || '1.0.0',
        title: input.title,
        status: 'CREATED',
        initiator: input.initiator,
        principal: input.principal,
        correlationId: input.correlationId || `corr_${randomUUID()}`,
        idempotencyKey,
        inputs: input.inputs || {},
        budgets: mergedBudgets,
        stepCounts: { total: 0, completed: 0, failed: 0, skipped: 0 },
        dryRun: input.dryRun || false,
        createdAt: now,
        updatedAt: now,
      });

      await db.runTransaction(async (transaction: Transaction) => {
        // Idempotency check
        const existingIdemQuery = await transaction.get(
          getDb()
            .collection('organizations')
            .doc(input.organizationId)
            .collection('workflows')
            .where('workspaceId', '==', input.workspaceId)
            .where('idempotencyKey', '==', idempotencyKey)
            .limit(1)
        );

        if (!existingIdemQuery.empty) {
          throw new WorkflowError(
            'IDEMPOTENCY_CONFLICT',
            `Workflow with idempotencyKey '${idempotencyKey}' already exists for this tenant`
          );
        }

        transaction.set(docRef, instance);

        // Record initial checkpoint
        const hash = createCheckpointHash({
          workflowId,
          sequence: 0,
          fromState: 'CREATED',
          toState: 'CREATED',
          statePayload: { event: 'workflow_created' },
        });

        const initialCheckpointRef = getCheckpointDocRef(
          input.organizationId,
          workflowId,
          `chk_${randomUUID()}`
        );

        transaction.set(initialCheckpointRef, {
          id: initialCheckpointRef.id,
          workflowId,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          checkpointSequence: 0,
          fromState: 'CREATED',
          toState: 'CREATED',
          statePayload: { event: 'workflow_created' },
          hash,
          timestamp: now,
        });
      });

      return instance;
    },

    async getInstance(id: string, tenant: TenantBoundary): Promise<WorkflowInstance | null> {
      const docRef = getWorkflowDocRef(tenant.organizationId, id);
      const snapshot = await docRef.get();
      if (!snapshot.exists) {
        return null;
      }
      const data = snapshot.data();
      const instance = WorkflowInstanceSchema.parse(data);
      assertTenantMatch(instance, tenant);
      return instance;
    },

    async updateInstanceStatus(
      id: string,
      targetState: WorkflowState,
      tenant: TenantBoundary,
      options?: {
        currentStepId?: string;
        waitCondition?: WaitCondition;
        error?: {
          code: string;
          message: string;
          details?: unknown;
        };
        outputs?: Record<string, unknown>;
        allowOperatorRecovery?: boolean;
      }
    ): Promise<WorkflowInstance> {
      const db = getDb();
      const docRef = getWorkflowDocRef(tenant.organizationId, id);
      let updatedInstance: WorkflowInstance | null = null;

      await db.runTransaction(async (transaction: Transaction) => {
        const snapshot = await transaction.get(docRef);
        if (!snapshot.exists) {
          throw new WorkflowError('WORKFLOW_NOT_FOUND', `Workflow '${id}' does not exist`);
        }

        const instance = WorkflowInstanceSchema.parse(snapshot.data());
        assertTenantMatch(instance, tenant);
        assertValidWorkflowTransition(instance.status, targetState, {
          allowOperatorRecovery: options?.allowOperatorRecovery,
        });

        const now = new Date().toISOString();
        const fromState = instance.status;

        // Get latest checkpoint for previousHash
        const checkpointsSnapshot = await transaction.get(
          docRef.collection('checkpoints').orderBy('checkpointSequence', 'desc').limit(1)
        );
        const latestCheckpoint = checkpointsSnapshot.empty
          ? null
          : WorkflowCheckpointSchema.parse(checkpointsSnapshot.docs[0].data());

        const sequence = latestCheckpoint ? latestCheckpoint.checkpointSequence + 1 : 1;
        const previousHash = latestCheckpoint?.hash;

        const hash = createCheckpointHash({
          workflowId: id,
          sequence,
          fromState,
          toState: targetState,
          stepId: options?.currentStepId,
          statePayload: {
            error: options?.error,
            waitCondition: options?.waitCondition,
            outputs: options?.outputs,
          },
          previousHash,
        });

        updatedInstance = {
          ...instance,
          status: targetState,
          currentStepId: options?.currentStepId ?? instance.currentStepId,
          currentWaitCondition: options?.waitCondition
            ? WaitConditionSchema.parse(options.waitCondition)
            : instance.currentWaitCondition,
          error: options?.error ?? instance.error,
          outputs: options?.outputs ? { ...(instance.outputs || {}), ...options.outputs } : instance.outputs,
          updatedAt: now,
          completedAt: isTerminalWorkflowState(targetState) ? now : instance.completedAt,
        };

        transaction.set(docRef, updatedInstance);

        const checkpointRef = getCheckpointDocRef(
          tenant.organizationId,
          id,
          `chk_${randomUUID()}`
        );
        transaction.set(checkpointRef, {
          id: checkpointRef.id,
          workflowId: id,
          organizationId: tenant.organizationId,
          workspaceId: tenant.workspaceId,
          checkpointSequence: sequence,
          fromState,
          toState: targetState,
          stepId: options?.currentStepId,
          statePayload: {
            error: options?.error,
            waitCondition: options?.waitCondition,
            outputs: options?.outputs,
          },
          hash,
          previousHash,
          timestamp: now,
        });
      });

      if (!updatedInstance) {
        throw new WorkflowError('WORKFLOW_NOT_FOUND', `Failed to update workflow '${id}'`);
      }
      return updatedInstance;
    },

    async listInstances(
      options: ListWorkflowInstancesOptions
    ): Promise<{ items: WorkflowInstance[]; total: number }> {
      const db = getDb();
      let query: FirebaseFirestore.Query = db
        .collection('organizations')
        .doc(options.organizationId)
        .collection('workflows')
        .where('workspaceId', '==', options.workspaceId);

      if (options.status) {
        query = query.where('status', '==', options.status);
      }
      if (options.definitionId) {
        query = query.where('definitionId', '==', options.definitionId);
      }

      query = query.orderBy('createdAt', 'desc');

      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      if (options.offset) {
        query = query.offset(options.offset);
      }
      const limit = options.limit || 50;
      query = query.limit(limit);

      const snapshot = await query.get();
      const items = snapshot.docs.map((doc) => WorkflowInstanceSchema.parse(doc.data()));

      return { items, total };
    },

    async createStep(input: CreateWorkflowStepInput): Promise<WorkflowStep> {
      const db = getDb();
      const workflowDocRef = getWorkflowDocRef(input.organizationId, input.workflowId);
      const stepId = input.id || `step_${randomUUID()}`;
      const stepDocRef = getStepDocRef(input.organizationId, input.workflowId, stepId);

      let createdStep: WorkflowStep | null = null;

      await db.runTransaction(async (transaction: Transaction) => {
        const wfSnapshot = await transaction.get(workflowDocRef);
        if (!wfSnapshot.exists) {
          throw new WorkflowError(
            'WORKFLOW_NOT_FOUND',
            `Workflow '${input.workflowId}' does not exist`
          );
        }

        const instance = WorkflowInstanceSchema.parse(wfSnapshot.data());
        assertTenantMatch(instance, input);

        createdStep = WorkflowStepSchema.parse({
          id: stepId,
          workflowId: input.workflowId,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          stepIndex: input.stepIndex,
          capabilityId: input.capabilityId,
          capabilityVersion: input.capabilityVersion,
          name: input.name,
          status: input.status || 'PENDING',
          dependsOn: input.dependsOn || [],
          waitCondition: input.waitCondition,
          input: input.input || {},
          idempotencyKey: input.idempotencyKey || `idem_${input.workflowId}_step_${input.stepIndex}`,
          isMutating: input.isMutating || false,
          compensatingCapabilityId: input.compensatingCapabilityId,
          compensationStatus: 'none',
          riskLevel: input.riskLevel,
          isNonDelegable: input.isNonDelegable || false,
          maxAttempts: input.maxAttempts || 3,
          attempt: 0,
        });

        transaction.set(stepDocRef, createdStep);

        const wfUpdates: Record<string, unknown> = {
          'stepCounts.total': instance.stepCounts.total + 1,
          updatedAt: new Date().toISOString(),
        };
        if (input.status === 'COMPLETED') {
          wfUpdates['stepCounts.completed'] = instance.stepCounts.completed + 1;
        }

        transaction.update(workflowDocRef, wfUpdates);
      });

      if (!createdStep) {
        throw new WorkflowError('STEP_NOT_FOUND', `Failed to create step '${stepId}'`);
      }
      return createdStep;
    },

    async getStep(
      workflowId: string,
      stepId: string,
      tenant: TenantBoundary
    ): Promise<WorkflowStep | null> {
      const stepDocRef = getStepDocRef(tenant.organizationId, workflowId, stepId);
      const snapshot = await stepDocRef.get();
      if (!snapshot.exists) {
        return null;
      }
      const step = WorkflowStepSchema.parse(snapshot.data());
      assertTenantMatch(step, tenant);
      return step;
    },

    async updateStep(
      workflowId: string,
      stepId: string,
      update: UpdateWorkflowStepInput,
      tenant: TenantBoundary
    ): Promise<WorkflowStep> {
      const db = getDb();
      const workflowDocRef = getWorkflowDocRef(tenant.organizationId, workflowId);
      const stepDocRef = getStepDocRef(tenant.organizationId, workflowId, stepId);
      let updatedStep: WorkflowStep | null = null;

      await db.runTransaction(async (transaction: Transaction) => {
        const stepSnapshot = await transaction.get(stepDocRef);
        if (!stepSnapshot.exists) {
          throw new WorkflowError('STEP_NOT_FOUND', `Step '${stepId}' not found`);
        }

        const step = WorkflowStepSchema.parse(stepSnapshot.data());
        assertTenantMatch(step, tenant);

        updatedStep = {
          ...step,
          status: update.status ?? step.status,
          input: update.input ?? step.input,
          waitCondition: update.waitCondition !== undefined
            ? (update.waitCondition ? WaitConditionSchema.parse(update.waitCondition) : undefined)
            : step.waitCondition,
          output: update.output ?? step.output,
          error: update.error ?? step.error,
          attempt: update.attempt ?? step.attempt,
          compensationStatus: update.compensationStatus ?? step.compensationStatus,
          compensatingCapabilityId: update.compensatingCapabilityId ?? step.compensatingCapabilityId,
          outputValidated: update.outputValidated ?? step.outputValidated,
          outputValidationErrors: update.outputValidationErrors ?? step.outputValidationErrors,
          startedAt: update.startedAt ?? step.startedAt,
          completedAt: update.completedAt ?? step.completedAt,
          durationMs: update.durationMs ?? step.durationMs,
        };

        transaction.set(stepDocRef, updatedStep);

        if (update.status && update.status !== step.status) {
          const wfSnapshot = await transaction.get(workflowDocRef);
          if (wfSnapshot.exists) {
            const instance = WorkflowInstanceSchema.parse(wfSnapshot.data());
            const countUpdates: Record<string, number> = {};

            if (update.status === 'COMPLETED' && step.status !== 'COMPLETED') {
              countUpdates['stepCounts.completed'] = instance.stepCounts.completed + 1;
            } else if (update.status === 'FAILED' && step.status !== 'FAILED') {
              countUpdates['stepCounts.failed'] = instance.stepCounts.failed + 1;
            } else if (update.status === 'SKIPPED' && step.status !== 'SKIPPED') {
              countUpdates['stepCounts.skipped'] = instance.stepCounts.skipped + 1;
            }

            if (Object.keys(countUpdates).length > 0) {
              transaction.update(workflowDocRef, {
                ...countUpdates,
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      });

      if (!updatedStep) {
        throw new WorkflowError('STEP_NOT_FOUND', `Failed to update step '${stepId}'`);
      }
      return updatedStep;
    },

    async listSteps(workflowId: string, tenant: TenantBoundary): Promise<WorkflowStep[]> {
      const docRef = getWorkflowDocRef(tenant.organizationId, workflowId);
      const wfSnapshot = await docRef.get();
      if (!wfSnapshot.exists) {
        throw new WorkflowError('WORKFLOW_NOT_FOUND', `Workflow '${workflowId}' not found`);
      }
      assertTenantMatch(WorkflowInstanceSchema.parse(wfSnapshot.data()), tenant);

      const snapshot = await docRef.collection('steps').orderBy('stepIndex', 'asc').get();
      return snapshot.docs.map((d: QueryDocumentSnapshot) => WorkflowStepSchema.parse(d.data()));
    },

    async recordCheckpoint(input: CreateWorkflowCheckpointInput): Promise<WorkflowCheckpoint> {
      const db = getDb();
      const workflowDocRef = getWorkflowDocRef(input.organizationId, input.workflowId);
      const checkpointId = input.id || `chk_${randomUUID()}`;
      const checkpointDocRef = getCheckpointDocRef(
        input.organizationId,
        input.workflowId,
        checkpointId
      );

      let createdCheckpoint: WorkflowCheckpoint | null = null;

      await db.runTransaction(async (transaction: Transaction) => {
        const wfSnapshot = await transaction.get(workflowDocRef);
        if (!wfSnapshot.exists) {
          throw new WorkflowError(
            'WORKFLOW_NOT_FOUND',
            `Workflow '${input.workflowId}' not found`
          );
        }
        assertTenantMatch(WorkflowInstanceSchema.parse(wfSnapshot.data()), input);

        const latestSnap = await transaction.get(
          workflowDocRef.collection('checkpoints').orderBy('checkpointSequence', 'desc').limit(1)
        );
        const latest = latestSnap.empty ? null : WorkflowCheckpointSchema.parse(latestSnap.docs[0].data());

        const sequence = input.checkpointSequence;
        const previousHash = input.previousHash || latest?.hash;

        const hash =
          input.hash ||
          createCheckpointHash({
            workflowId: input.workflowId,
            sequence,
            fromState: input.fromState,
            toState: input.toState,
            stepId: input.stepId,
            statePayload: input.statePayload || {},
            previousHash,
          });

        createdCheckpoint = WorkflowCheckpointSchema.parse({
          id: checkpointId,
          workflowId: input.workflowId,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          checkpointSequence: sequence,
          fromState: input.fromState,
          toState: input.toState,
          stepId: input.stepId,
          statePayload: input.statePayload || {},
          hash,
          previousHash,
          timestamp: new Date().toISOString(),
        });

        transaction.set(checkpointDocRef, createdCheckpoint);
      });

      if (!createdCheckpoint) {
        throw new WorkflowError('WORKFLOW_NOT_FOUND', `Failed to record checkpoint`);
      }
      return createdCheckpoint;
    },

    async listCheckpoints(workflowId: string, tenant: TenantBoundary): Promise<WorkflowCheckpoint[]> {
      const docRef = getWorkflowDocRef(tenant.organizationId, workflowId);
      const wfSnapshot = await docRef.get();
      if (!wfSnapshot.exists) {
        throw new WorkflowError('WORKFLOW_NOT_FOUND', `Workflow '${workflowId}' not found`);
      }
      assertTenantMatch(WorkflowInstanceSchema.parse(wfSnapshot.data()), tenant);

      const snapshot = await docRef
        .collection('checkpoints')
        .orderBy('checkpointSequence', 'asc')
        .get();

      return snapshot.docs.map((d: QueryDocumentSnapshot) => WorkflowCheckpointSchema.parse(d.data()));
    },

    async getLatestCheckpoint(
      workflowId: string,
      tenant: TenantBoundary
    ): Promise<WorkflowCheckpoint | null> {
      const docRef = getWorkflowDocRef(tenant.organizationId, workflowId);
      const wfSnapshot = await docRef.get();
      if (!wfSnapshot.exists) {
        throw new WorkflowError('WORKFLOW_NOT_FOUND', `Workflow '${workflowId}' not found`);
      }
      assertTenantMatch(WorkflowInstanceSchema.parse(wfSnapshot.data()), tenant);

      const snapshot = await docRef
        .collection('checkpoints')
        .orderBy('checkpointSequence', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }
      return WorkflowCheckpointSchema.parse(snapshot.docs[0].data());
    },
  };
}

// ── Global Singleton Preservation (HMR Safe) ───────────────────────────────
declare global {
  var __smartsappWorkflowStore: WorkflowStore | undefined;
}

export function getWorkflowStore(): WorkflowStore {
  if (process.env.NODE_ENV === 'test') {
    if (!globalThis.__smartsappWorkflowStore) {
      globalThis.__smartsappWorkflowStore = createMemoryWorkflowStore();
    }
    return globalThis.__smartsappWorkflowStore;
  }

  if (!globalThis.__smartsappWorkflowStore) {
    globalThis.__smartsappWorkflowStore = createFirestoreWorkflowStore();
  }
  return globalThis.__smartsappWorkflowStore;
}

export function setWorkflowStoreForTests(store: WorkflowStore): void {
  globalThis.__smartsappWorkflowStore = store;
}
