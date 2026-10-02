// @vitest-environment node
/**
 * @fileOverview Approval binding tests (round-2 blocker R3)
 *
 * Approvals are no longer self-asserted on the principal. An agent can run an approval-requiring
 * capability only with a server-side `capability_approvals` record that matches the tenant,
 * capability + version, exact payload hash and invocation, and that is bound single-use.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v4';
import type {
  AgentPrincipal,
  CapabilityDefinition,
  CapabilityExecutionResult,
  VerifiedApproval,
} from '../capabilities/contracts/capability-definition';
import {
  CAPABILITY_APPROVALS_COLLECTION,
  computeApprovalPayloadHash,
  createFirestoreApprovalVerifier,
  type ApprovalRequest,
} from '../capabilities/policy/approval-verifier';
import { evaluatePrincipalAuthority } from '../capabilities/policy/principal-evaluator';
import { registerCapability, getCapability, resetCapabilityRegistryForTests } from '../capabilities/registry/capability-registry';
import { processAgentStep } from '../tasks/agent-step-executor';
import { createFirestoreAgentStepStore } from '../tasks/firestore-agent-step-store';
import { FakeFirestore } from './helpers/fake-firestore';

type SendInput = { to: string; body: string };
type SendOutput = { messageId: string };

const tenant = { organizationId: 'org-1', workspaceId: 'ws-1' };
const agent: AgentPrincipal = {
  actorType: 'agent',
  userId: 'user-1',
  ...tenant,
  agentId: 'sdr-agent',
  runId: 'run-9',
  toolInvocationId: 'run-9:0',
  grantedScopes: ['messages.send'],
  effectiveRole: 'agent',
};

const sendMessage: CapabilityDefinition<SendInput, SendOutput> = {
  id: 'messaging.message.send',
  version: '1.0.0',
  name: 'Send message',
  description: 'Sends an external message',
  domain: 'communication_messaging',
  operation: 'execute',
  inputSchema: z.object({ to: z.string().trim(), body: z.string() }),
  outputSchema: z.object({ messageId: z.string() }),
  permissions: ['messages.send'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
    destructive: false,
    idempotent: false,
    openWorld: true,
    requiresHumanApproval: true,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 2_000,
    supportsDryRun: false,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 8_192,
  },
  policies: { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: true },
  handler: async (): Promise<CapabilityExecutionResult<SendOutput>> => ({
    success: true,
    data: { messageId: 'm-1' },
    executionId: 'e',
    emittedEvents: [],
    durationMs: 1,
  }),
};

const input = { to: '+233200000000', body: 'Hello' };
const hash = computeApprovalPayloadHash({ capabilityId: sendMessage.id, capabilityVersion: '1.0.0', ...tenant, input });

function approvalRecord(overrides: Record<string, unknown> = {}) {
  return {
    approvalId: 'appr-1',
    ...tenant,
    capabilityId: sendMessage.id,
    capabilityVersion: '1.0.0',
    payloadHash: hash,
    requestedBy: 'sdr-agent',
    approvedBy: 'manager-7',
    approvedAt: '2026-09-27T09:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    status: 'approved',
    boundToolInvocationId: null,
    boundAt: null,
    ...overrides,
  };
}

const request = (overrides: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  approvalId: 'appr-1',
  capabilityId: sendMessage.id,
  capabilityVersion: '1.0.0',
  ...tenant,
  payloadHash: hash,
  toolInvocationId: 'run-9:0',
  agentId: 'sdr-agent',
  nowMs: Date.parse('2026-09-27T10:00:00.000Z'),
  ...overrides,
});

describe('computeApprovalPayloadHash', () => {
  it('ignores key order but changes with any value', () => {
    const base = { capabilityId: 'c', capabilityVersion: '1', ...tenant };
    expect(computeApprovalPayloadHash({ ...base, input: { a: 1, b: 2 } })).toBe(computeApprovalPayloadHash({ ...base, input: { b: 2, a: 1 } }));
    expect(computeApprovalPayloadHash({ ...base, input: { a: 1, b: 3 } })).not.toBe(computeApprovalPayloadHash({ ...base, input: { a: 1, b: 2 } }));
  });
});

describe('Firestore approval verifier', () => {
  let db: FakeFirestore;
  const path = `${CAPABILITY_APPROVALS_COLLECTION}/appr-1`;
  const verify = (r: ApprovalRequest = request()) => createFirestoreApprovalVerifier(db.asFirestore()).verifyAndBind(r);

  beforeEach(() => {
    db = new FakeFirestore();
  });

  it('verifies a matching approval and binds it single-use', async () => {
    db.write(path, approvalRecord());
    const result = await verify();
    expect(result).toMatchObject({ ok: true, approval: { approvedBy: 'manager-7', toolInvocationId: 'run-9:0' } });
    expect(db.read(path)).toMatchObject({ status: 'bound', boundToolInvocationId: 'run-9:0' });
  });

  it('re-verifies for a retry of the same invocation but refuses replay by another', async () => {
    db.write(path, approvalRecord());
    await verify();
    expect((await verify()).ok).toBe(true);
    expect(await verify(request({ toolInvocationId: 'run-9:1' }))).toMatchObject({ ok: false, code: 'APPROVAL_ALREADY_USED' });
  });

  it('refuses a different payload, tenant, capability version or an expired/pending/self approval', async () => {
    const cases: Array<[Record<string, unknown>, Partial<ApprovalRequest>, string]> = [
      [{}, { payloadHash: 'f'.repeat(64) }, 'APPROVAL_MISMATCH'],
      [{}, { workspaceId: 'ws-2' }, 'APPROVAL_MISMATCH'],
      [{}, { capabilityVersion: '2.0.0' }, 'APPROVAL_MISMATCH'],
      [{ expiresAt: '2026-09-27T09:30:00.000Z' }, {}, 'APPROVAL_EXPIRED'],
      [{ status: 'pending', approvedBy: null, approvedAt: null }, {}, 'APPROVAL_NOT_APPROVED'],
      [{ approvedBy: 'sdr-agent' }, {}, 'APPROVAL_SELF_APPROVED'],
    ];
    for (const [record, req, code] of cases) {
      db.write(path, approvalRecord(record));
      expect(await verify(request(req))).toMatchObject({ ok: false, code });
    }
  });

  it('reports missing and corrupt records without throwing', async () => {
    expect(await verify()).toMatchObject({ ok: false, code: 'APPROVAL_NOT_FOUND' });
    db.write(path, { approvalId: 'appr-1', status: 'approved' });
    expect(await verify()).toMatchObject({ ok: false, code: 'APPROVAL_CORRUPT' });
  });
});

describe('evaluatePrincipalAuthority approval rules', () => {
  const verified: VerifiedApproval = {
    approvalId: 'appr-1',
    approvedBy: 'manager-7',
    ...tenant,
    capabilityId: sendMessage.id,
    capabilityVersion: '1.0.0',
    payloadHash: hash,
    toolInvocationId: 'run-9:0',
    expiresAt: '2099-01-01T00:00:00.000Z',
  };

  it('requires a verified approval for agents and accepts a matching one', () => {
    expect(evaluatePrincipalAuthority(agent, sendMessage, tenant).violationCodes).toContain('APPROVAL_REQUIRED');
    expect(evaluatePrincipalAuthority(agent, sendMessage, tenant, { verifiedApproval: verified, payloadHash: hash }).allowed).toBe(true);
  });

  it('rejects an approval bound to another payload or invocation', () => {
    const otherPayload = evaluatePrincipalAuthority(agent, sendMessage, tenant, { verifiedApproval: verified, payloadHash: 'x' });
    expect(otherPayload.violationCodes).toContain('APPROVAL_INVALID');
    const otherInvocation = evaluatePrincipalAuthority({ ...agent, toolInvocationId: 'run-9:5' }, sendMessage, tenant, {
      verifiedApproval: verified,
      payloadHash: hash,
    });
    expect(otherInvocation.violationCodes).toContain('APPROVAL_INVALID');
  });

  it('refuses when the target organization is missing (no fail-open)', () => {
    const human: AgentPrincipal = { actorType: 'user', userId: 'u', ...tenant, grantedScopes: ['messages.send'], effectiveRole: 'admin' };
    const result = evaluatePrincipalAuthority(human, sendMessage, { organizationId: '', workspaceId: 'ws-1' });
    expect(result.violationCodes).toContain('TENANT_SCOPE_MISSING');
  });
});

describe('agent-step worker with approvals', () => {
  let db: FakeFirestore;

  beforeEach(() => {
    db = new FakeFirestore();
    resetCapabilityRegistryForTests();
    const now = '2026-09-27T10:00:00.000Z';
    db.write('agent_runs/run-9', {
      runId: 'run-9',
      ...tenant,
      principal: { actorType: 'agent', userId: 'user-1', ...tenant, agentId: 'sdr-agent', grantedScopes: ['messages.send'], effectiveRole: 'agent' },
      status: 'running',
      correlationId: 'corr',
      createdAt: now,
      updatedAt: now,
    });
    db.write('agent_runs/run-9/steps/0', {
      runId: 'run-9',
      stepNumber: 0,
      capabilityId: sendMessage.id,
      capabilityVersion: '1.0.0',
      input,
      idempotencyKey: 'idem-key-9000',
      approvalId: 'appr-1',
      status: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  const process = (withVerifier = true) =>
    processAgentStep(
      { runId: 'run-9', stepNumber: 0, idempotencyKey: 'idem-key-9000' },
      {
        store: createFirestoreAgentStepStore(db.asFirestore()),
        resolveCapability: getCapability,
        approvals: withVerifier ? createFirestoreApprovalVerifier(db.asFirestore()) : undefined,
        nowMs: () => Date.parse('2026-09-27T10:00:00.000Z'),
      }
    );

  it('executes only with a matching server-side approval', async () => {
    const handler = vi.fn(sendMessage.handler);
    registerCapability({ ...sendMessage, handler });
    db.write(`${CAPABILITY_APPROVALS_COLLECTION}/appr-1`, approvalRecord());
    const outcome = await process();
    expect(outcome.body.status).toBe('completed');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the approval covers a different message body', async () => {
    const handler = vi.fn(sendMessage.handler);
    registerCapability({ ...sendMessage, handler });
    const otherHash = computeApprovalPayloadHash({ capabilityId: sendMessage.id, capabilityVersion: '1.0.0', ...tenant, input: { ...input, body: 'Pay now' } });
    db.write(`${CAPABILITY_APPROVALS_COLLECTION}/appr-1`, approvalRecord({ payloadHash: otherHash }));
    const outcome = await process();
    expect(outcome.body).toMatchObject({ status: 'failed', code: 'APPROVAL_MISMATCH' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('fails closed when no verifier is configured', async () => {
    registerCapability(sendMessage);
    db.write(`${CAPABILITY_APPROVALS_COLLECTION}/appr-1`, approvalRecord());
    const outcome = await process(false);
    expect(outcome.body).toMatchObject({ status: 'failed', code: 'APPROVAL_VERIFIER_UNAVAILABLE' });
  });

  it('does not burn or bind approval if base authority (e.g. scopes revoked) fails', async () => {
    const handler = vi.fn(sendMessage.handler);
    registerCapability({ ...sendMessage, handler });
    db.write(`${CAPABILITY_APPROVALS_COLLECTION}/appr-1`, approvalRecord());
    db.write('agent_runs/run-9', {
      runId: 'run-9',
      ...tenant,
      principal: { actorType: 'agent', userId: 'user-1', ...tenant, agentId: 'sdr-agent', grantedScopes: [], effectiveRole: 'agent' },
      status: 'running',
      correlationId: 'corr',
      createdAt: '2026-09-27T10:00:00.000Z',
      updatedAt: '2026-09-27T10:00:00.000Z',
    });

    const outcome = await process();
    expect(outcome.body).toMatchObject({ status: 'failed', code: 'AUTHORIZATION_DENIED' });
    expect(handler).not.toHaveBeenCalled();
    // Approval MUST still be 'approved', NOT 'bound' (Rule 21/22 burn prevention)
    expect(db.read(`${CAPABILITY_APPROVALS_COLLECTION}/appr-1`)).toMatchObject({ status: 'approved', boundToolInvocationId: null });
  });
});

describe('dispatcher approval gate', () => {
  it('refuses to enqueue an approval-requiring agent step without an approval id, and records it when given', async () => {
    const { enqueueAsyncCapabilityStep } = await import('../tasks/cloud-tasks-dispatcher');
    const db = new FakeFirestore();
    const schedule = vi.fn(async () => 'task');
    resetCapabilityRegistryForTests();
    registerCapability(sendMessage);
    const principal = { actorType: 'agent' as const, userId: 'user-1', ...tenant, agentId: 'sdr-agent', grantedScopes: ['messages.send'], effectiveRole: 'agent' };
    const base = { runId: 'run-7', stepNumber: 0, capabilityId: sendMessage.id, input, idempotencyKey: 'idem-key-7000', principal };

    await expect(enqueueAsyncCapabilityStep(base, { db: db.asFirestore(), schedule })).rejects.toMatchObject({ code: 'APPROVAL_REQUIRED' });
    expect(schedule).not.toHaveBeenCalled();

    await enqueueAsyncCapabilityStep({ ...base, approvalId: 'appr-1' }, { db: db.asFirestore(), schedule });
    expect(db.read('agent_runs/run-7/steps/0')).toMatchObject({ approvalId: 'appr-1' });
    expect(schedule).toHaveBeenCalledTimes(1);
  });
});

describe('agent identity cannot be dodged (round-3 finding #1)', () => {
  const noAgentId: AgentPrincipal = { actorType: 'agent', userId: 'user-1', ...tenant, grantedScopes: ['*', 'messages.send'], effectiveRole: 'admin' };

  it('applies agent rules to actorType "agent" even without agentId/delegationId', () => {
    const result = evaluatePrincipalAuthority(noAgentId, sendMessage, tenant);
    expect(result.violationCodes).toContain('APPROVAL_REQUIRED');
  });

  it('treats a "user" carrying an agent or delegation id as an agent', () => {
    const disguised: AgentPrincipal = { ...noAgentId, actorType: 'user', delegationId: 'del-1' };
    expect(evaluatePrincipalAuthority(disguised, sendMessage, tenant).violationCodes).toContain('APPROVAL_REQUIRED');
  });

  it('only lets an explicit interactive user use the * wildcard', () => {
    const readCap = { ...sendMessage, permissions: ['contacts.read'], risk: { ...sendMessage.risk, level: 'L0_READ' as const, requiresHumanApproval: false } };
    const human: AgentPrincipal = { actorType: 'user', userId: 'u', ...tenant, grantedScopes: ['*'], effectiveRole: 'admin' };
    expect(evaluatePrincipalAuthority(human, readCap, tenant).allowed).toBe(true);
    expect(evaluatePrincipalAuthority({ ...human, actorType: 'agent' }, readCap, tenant).violationCodes).toContain('INSUFFICIENT_SCOPE');
  });

  it('MCP forces agent rules even when getPrincipal resolves an interactive user', async () => {
    const { createCapabilityToolHandler } = await import('../mcp/create-stateless-handler');
    const handler = vi.fn(sendMessage.handler);
    const human: AgentPrincipal = { actorType: 'user', userId: 'u', ...tenant, grantedScopes: ['messages.send'], effectiveRole: 'admin' };
    const tool = createCapabilityToolHandler({ ...sendMessage, handler }, { getPrincipal: () => human, audit: () => undefined });
    const response = await tool(input);
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Human Approval Required');
    expect(handler).not.toHaveBeenCalled();
  });

  it('dispatcher stores every queued principal as an agent and requires an approval id', async () => {
    const { enqueueAsyncCapabilityStep } = await import('../tasks/cloud-tasks-dispatcher');
    const db = new FakeFirestore();
    resetCapabilityRegistryForTests();
    registerCapability(sendMessage);
    const human: AgentPrincipal = { actorType: 'user', userId: 'u', ...tenant, grantedScopes: ['messages.send'], effectiveRole: 'admin' };
    const base = { runId: 'run-h', stepNumber: 0, capabilityId: sendMessage.id, input, idempotencyKey: 'idem-key-h000', principal: human };
    await expect(enqueueAsyncCapabilityStep(base, { db: db.asFirestore(), schedule: vi.fn(async () => 't') })).rejects.toMatchObject({
      code: 'APPROVAL_REQUIRED',
    });
    await enqueueAsyncCapabilityStep({ ...base, approvalId: 'appr-1' }, { db: db.asFirestore(), schedule: vi.fn(async () => 't') });
    expect(db.read('agent_runs/run-h')).toMatchObject({ principal: { actorType: 'agent' } });
  });
});
