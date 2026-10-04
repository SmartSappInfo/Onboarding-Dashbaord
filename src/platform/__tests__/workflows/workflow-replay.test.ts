/**
 * @fileOverview Unit Tests for Deterministic Checkpoint Replay Engine (Phase 7 Milestone 2)
 */

import { describe, it, expect } from 'vitest';
import { createWorkflowReplayEngine } from '@/platform/workflows/execution/workflow-replay-engine';
import { createMemoryWorkflowStore } from '@/platform/workflows/workflow-store';
import { createCheckpointHash } from '@/platform/workflows/workflow-state-machine';
import type { StoredPrincipal } from '@/platform/tasks/agent-step-contract';

describe('Workflow Replay Engine', () => {
  const tenant = {
    organizationId: 'org_rep_1',
    workspaceId: 'ws_rep_1',
  };

  const samplePrincipal: StoredPrincipal = {
    actorType: 'agent',
    userId: 'usr_rep_1',
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    effectiveRole: 'admin',
    grantedScopes: ['rbac:operations.campuses.view'],
  };

  it('verifies a valid linear cryptographic checkpoint chain', async () => {
    const store = createMemoryWorkflowStore();
    const replayEngine = createWorkflowReplayEngine({ store });

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_replay',
      title: 'Replay Test',
      initiator: { actorType: 'user', actorId: 'usr_rep_1' },
      principal: samplePrincipal,
    });

    const initialCheckpoints = await store.listCheckpoints(instance.id, tenant);
    expect(initialCheckpoints).toHaveLength(1);
    const cp0 = initialCheckpoints[0];

    // Checkpoint 1: CREATED -> QUEUED
    const hash1 = createCheckpointHash({
      workflowId: instance.id,
      sequence: 1,
      fromState: 'CREATED',
      toState: 'QUEUED',
      statePayload: { workerId: 'w1' },
      previousHash: cp0.hash,
    });
    await store.recordCheckpoint({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      checkpointSequence: 1,
      fromState: 'CREATED',
      toState: 'QUEUED',
      statePayload: { workerId: 'w1' },
      hash: hash1,
      previousHash: cp0.hash,
    });

    // Checkpoint 2: QUEUED -> RUNNING
    const hash2 = createCheckpointHash({
      workflowId: instance.id,
      sequence: 2,
      fromState: 'QUEUED',
      toState: 'RUNNING',
      stepId: 'step_1',
      statePayload: { output: 'step1_done' },
      previousHash: hash1,
    });
    await store.recordCheckpoint({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      checkpointSequence: 2,
      fromState: 'QUEUED',
      toState: 'RUNNING',
      stepId: 'step_1',
      statePayload: { output: 'step1_done' },
      hash: hash2,
      previousHash: hash1,
    });

    const result = await replayEngine.replayWorkflow(instance.id, tenant);
    expect(result.isValid).toBe(true);
    expect(result.totalCheckpoints).toBe(3);
    expect(result.verifiedCheckpoints).toBe(3);
    expect(result.lastVerifiedSequence).toBe(2);
  });

  it('detects tampering when a checkpoint payload or hash has been altered', async () => {
    const store = createMemoryWorkflowStore();
    const replayEngine = createWorkflowReplayEngine({ store });

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_tamper',
      title: 'Tamper Test',
      initiator: { actorType: 'user', actorId: 'usr_rep_1' },
      principal: samplePrincipal,
    });

    const initialCheckpoints = await store.listCheckpoints(instance.id, tenant);
    const cp0 = initialCheckpoints[0];

    // Record checkpoint 1 with tampered hash (does not match computed hash)
    await store.recordCheckpoint({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      checkpointSequence: 1,
      fromState: 'CREATED',
      toState: 'QUEUED',
      statePayload: { maliciousData: true },
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      previousHash: cp0.hash,
    });

    const result = await replayEngine.replayWorkflow(instance.id, tenant);
    expect(result.isValid).toBe(false);
    expect(result.divergenceIndex).toBe(1);
    expect(result.failureReason).toContain('Hash mismatch');
  });

  it('detects broken previousHash linkage (fork / sequence gap)', async () => {
    const store = createMemoryWorkflowStore();
    const replayEngine = createWorkflowReplayEngine({ store });

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_fork',
      title: 'Fork Test',
      initiator: { actorType: 'user', actorId: 'usr_rep_1' },
      principal: samplePrincipal,
    });

    // Checkpoint 1 carries wrong previousHash
    const invalidPrevHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash1 = createCheckpointHash({
      workflowId: instance.id,
      sequence: 1,
      fromState: 'CREATED',
      toState: 'QUEUED',
      statePayload: {},
      previousHash: invalidPrevHash,
    });
    await store.recordCheckpoint({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      checkpointSequence: 1,
      fromState: 'CREATED',
      toState: 'QUEUED',
      statePayload: {},
      hash: hash1,
      previousHash: invalidPrevHash,
    });

    const result = await replayEngine.replayWorkflow(instance.id, tenant);
    expect(result.isValid).toBe(false);
    expect(result.divergenceIndex).toBe(1);
    expect(result.failureReason).toContain('Broken previousHash chain');
  });

  it('reconstructs point-in-time state at a specified checkpoint', async () => {
    const store = createMemoryWorkflowStore();
    const replayEngine = createWorkflowReplayEngine({ store });

    const instance = await store.createInstance({
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      definitionId: 'wf_point_in_time',
      title: 'PIT Test',
      initiator: { actorType: 'user', actorId: 'usr_rep_1' },
      principal: samplePrincipal,
    });

    const initialCheckpoints = await store.listCheckpoints(instance.id, tenant);
    const cp0 = initialCheckpoints[0];

    const hash1 = createCheckpointHash({
      workflowId: instance.id,
      sequence: 1,
      fromState: 'CREATED',
      toState: 'RUNNING',
      stepId: 'step_1',
      statePayload: { step1Result: 'ok' },
      previousHash: cp0.hash,
    });
    await store.recordCheckpoint({
      workflowId: instance.id,
      organizationId: tenant.organizationId,
      workspaceId: tenant.workspaceId,
      checkpointSequence: 1,
      fromState: 'CREATED',
      toState: 'RUNNING',
      stepId: 'step_1',
      statePayload: { step1Result: 'ok' },
      hash: hash1,
      previousHash: cp0.hash,
    });

    const state = await replayEngine.reconstructStateAtCheckpoint(instance.id, tenant, 1);
    expect(state.status).toBe('RUNNING');
    expect(state.stepOutputs.step_1).toEqual({ step1Result: 'ok' });
    expect(state.lastCheckpoint.checkpointSequence).toBe(1);
  });
});
