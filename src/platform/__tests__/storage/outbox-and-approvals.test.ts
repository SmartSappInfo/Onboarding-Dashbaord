// @vitest-environment node
/**
 * @fileOverview Outbox & Approval Storage Tests (PR-7 / Workstream 1.4)
 *
 * Implements Rule 21, Rule 22, Rule 32, and Rule 34.
 * Verifies transactional outbox event queuing, schema enforcement, and approval lifecycle with single-use binding.
 */

import { describe, it, expect } from 'vitest';
import { createDomainEvent } from '../../capabilities/events/domain-event';
import { createInMemoryOutboxStore } from '../../capabilities/storage/outbox-store';
import { createInMemoryApprovalStore } from '../../capabilities/storage/approval-store';
import { computeApprovalPayloadHash } from '../../capabilities/policy/approval-verifier';

describe('Transactional Outbox Store (Rule 32)', () => {
  it('enqueues domain events with status pending and attempts 0', async () => {
    const store = createInMemoryOutboxStore();
    const event = createDomainEvent({
      type: 'crm.contact.created',
      source: 'crm',
      correlationId: 'corr-100',
      actor: { type: 'user', id: 'user-1' },
      entity: { type: 'contact', id: 'c-100' },
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      payload: { name: 'Acme Corp' },
    });

    await store.enqueue([event]);

    const pending = await store.listPending(10);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(event.id);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].attempts).toBe(0);
    expect(pending[0].event.payload).toEqual({ name: 'Acme Corp' });
  });

  it('marks events as published with timestamp', async () => {
    const store = createInMemoryOutboxStore();
    const event = createDomainEvent({
      type: 'crm.deal.won',
      source: 'crm',
      correlationId: 'corr-101',
      actor: { type: 'agent', id: 'agent-1' },
      entity: { type: 'deal', id: 'deal-101' },
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      payload: { amount: 50000 },
    });

    await store.enqueue([event]);
    await store.markPublished(event.id);

    const rec = await store.get(event.id);
    expect(rec?.status).toBe('published');
    expect(rec?.publishedAt).toBeDefined();

    const pending = await store.listPending(10);
    expect(pending).toHaveLength(0);
  });

  it('marks events as failed, increments attempts, and records error', async () => {
    const store = createInMemoryOutboxStore();
    const event = createDomainEvent({
      type: 'portal.course.published',
      source: 'portal',
      correlationId: 'corr-102',
      actor: { type: 'user', id: 'user-2' },
      entity: { type: 'course', id: 'crs-1' },
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      payload: { title: 'AI Basics' },
    });

    await store.enqueue([event]);
    await store.markFailed(event.id, 'Webhook network timeout');

    const rec = await store.get(event.id);
    expect(rec?.status).toBe('failed');
    expect(rec?.attempts).toBe(1);
    expect(rec?.error).toBe('Webhook network timeout');
  });

  it('rejects malformed domain events on enqueue (Rule 32 strict validation)', async () => {
    const store = createInMemoryOutboxStore();
    const malformed = {
      id: 'not-a-uuid',
      type: '',
      // missing actor, entity, etc.
    };

    await expect(store.enqueue([malformed as unknown as ReturnType<typeof createDomainEvent>])).rejects.toThrow();
  });
});

describe('Approval Store & Single-Use Binding (Rules 21, 22, 34)', () => {
  const orgId = 'org-1';
  const wsId = 'ws-1';
  const capId = 'crm.contact.bulk_delete';
  const capVer = '1.0.0';
  const input = { contactIds: ['c-1', 'c-2', 'c-3'] };

  const payloadHash = computeApprovalPayloadHash({
    capabilityId: capId,
    capabilityVersion: capVer,
    organizationId: orgId,
    workspaceId: wsId,
    input,
  });

  it('creates an approval request in pending state', async () => {
    const store = createInMemoryApprovalStore();
    const record = await store.createRequest({
      organizationId: orgId,
      workspaceId: wsId,
      capabilityId: capId,
      capabilityVersion: capVer,
      payloadHash,
      requestedBy: 'agent-sales-1',
    });

    expect(record.status).toBe('pending');
    expect(record.payloadHash).toBe(payloadHash);
    expect(record.requestedBy).toBe('agent-sales-1');
    expect(record.approvedBy).toBeNull();
  });

  it('forbids self-approval (Rule 34 Dual-Custody)', async () => {
    const store = createInMemoryApprovalStore();
    const record = await store.createRequest({
      organizationId: orgId,
      workspaceId: wsId,
      capabilityId: capId,
      capabilityVersion: capVer,
      payloadHash,
      requestedBy: 'agent-1',
    });

    await expect(store.approve(record.approvalId, 'agent-1')).rejects.toThrow(
      'Self-approval is forbidden'
    );
  });

  it('binds single-use approval to invocation; allows exact retry, refuses different invocation (Rule 22)', async () => {
    const store = createInMemoryApprovalStore();
    const record = await store.createRequest({
      organizationId: orgId,
      workspaceId: wsId,
      capabilityId: capId,
      capabilityVersion: capVer,
      payloadHash,
      requestedBy: 'agent-1',
    });

    // Human approves the request
    await store.approve(record.approvalId, 'human-admin-1');

    // First invocation binds
    const verify1 = await store.verifyAndBind({
      approvalId: record.approvalId,
      capabilityId: capId,
      capabilityVersion: capVer,
      organizationId: orgId,
      workspaceId: wsId,
      payloadHash,
      toolInvocationId: 'tool-call-101',
      nowMs: Date.now(),
    });

    expect(verify1.ok).toBe(true);
    if (verify1.ok) {
      expect(verify1.approval.approvedBy).toBe('human-admin-1');
      expect(verify1.approval.toolInvocationId).toBe('tool-call-101');
    }

    // Identical retry of tool-call-101 re-verifies successfully
    const verifyRetry = await store.verifyAndBind({
      approvalId: record.approvalId,
      capabilityId: capId,
      capabilityVersion: capVer,
      organizationId: orgId,
      workspaceId: wsId,
      payloadHash,
      toolInvocationId: 'tool-call-101',
      nowMs: Date.now(),
    });
    expect(verifyRetry.ok).toBe(true);

    // Different invocation (e.g. tool-call-102) fails with APPROVAL_ALREADY_USED
    const verifyTamperedInvocation = await store.verifyAndBind({
      approvalId: record.approvalId,
      capabilityId: capId,
      capabilityVersion: capVer,
      organizationId: orgId,
      workspaceId: wsId,
      payloadHash,
      toolInvocationId: 'tool-call-102',
      nowMs: Date.now(),
    });

    expect(verifyTamperedInvocation.ok).toBe(false);
    if (!verifyTamperedInvocation.ok) {
      expect(verifyTamperedInvocation.code).toBe('APPROVAL_ALREADY_USED');
    }
  });

  it('refuses expired approvals', async () => {
    const store = createInMemoryApprovalStore();
    const record = await store.createRequest({
      organizationId: orgId,
      workspaceId: wsId,
      capabilityId: capId,
      capabilityVersion: capVer,
      payloadHash,
      requestedBy: 'agent-1',
      expiresInMs: 1000, // 1 second
    });

    await store.approve(record.approvalId, 'human-admin-1');

    const verifyExpired = await store.verifyAndBind({
      approvalId: record.approvalId,
      capabilityId: capId,
      capabilityVersion: capVer,
      organizationId: orgId,
      workspaceId: wsId,
      payloadHash,
      toolInvocationId: 'tool-call-200',
      nowMs: Date.now() + 5000, // 5 seconds later
    });

    expect(verifyExpired.ok).toBe(false);
    if (!verifyExpired.ok) {
      expect(verifyExpired.code).toBe('APPROVAL_EXPIRED');
    }
  });

  it('refuses mismatched payload hash (Rule 22 Parameter Tamper Prevention)', async () => {
    const store = createInMemoryApprovalStore();
    const record = await store.createRequest({
      organizationId: orgId,
      workspaceId: wsId,
      capabilityId: capId,
      capabilityVersion: capVer,
      payloadHash,
      requestedBy: 'agent-1',
    });

    await store.approve(record.approvalId, 'human-admin-1');

    const tamperedHash = 'f'.repeat(64);
    const verifyMismatch = await store.verifyAndBind({
      approvalId: record.approvalId,
      capabilityId: capId,
      capabilityVersion: capVer,
      organizationId: orgId,
      workspaceId: wsId,
      payloadHash: tamperedHash,
      toolInvocationId: 'tool-call-300',
      nowMs: Date.now(),
    });

    expect(verifyMismatch.ok).toBe(false);
    if (!verifyMismatch.ok) {
      expect(verifyMismatch.code).toBe('APPROVAL_MISMATCH');
    }
  });
});
