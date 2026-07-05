import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────
// Four-eyes approval workflow tests:
// enqueue writes pending + audit; requester cannot decide own request;
// approve executes the STORED payload; reject/expired never execute;
// gated actions enqueue instead of mutating.
// ─────────────────────────────────────────────────

const {
  verifyIdToken, userGet, reqSet, reqUpdate, reqGet, auditAdd,
  txGet, txUpdate, orgGet, orgUpdate, executorFn,
} = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  userGet: vi.fn(),
  reqSet: vi.fn(),
  reqUpdate: vi.fn(),
  reqGet: vi.fn(),
  auditAdd: vi.fn(),
  txGet: vi.fn(),
  txUpdate: vi.fn(),
  orgGet: vi.fn(),
  orgUpdate: vi.fn(),
  executorFn: vi.fn(),
}));

function makeAdminDbMock() {
  return {
    collection: (name: string) => {
      if (name === 'users') return { doc: () => ({ get: userGet }) };
      if (name === 'platform_audit_logs') return { add: auditAdd };
      if (name === 'organizations') return { doc: () => ({ get: orgGet, update: orgUpdate }) };
      if (name === 'platform_approval_requests') {
        return {
          doc: () => ({ id: 'req-1', set: reqSet, update: reqUpdate, get: reqGet }),
          orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ docs: [] }) }) }),
          where: () => ({ orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }),
        };
      }
      return { doc: () => ({ get: vi.fn(), set: vi.fn(), update: vi.fn() }) };
    },
    runTransaction: (fn: (tx: { get: typeof txGet; update: typeof txUpdate }) => Promise<unknown>) =>
      fn({ get: txGet, update: txUpdate }),
  };
}

vi.mock('../../firebase-admin', () => ({
  adminAuth: { verifyIdToken },
  adminDb: makeAdminDbMock(),
}));
vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken },
  adminDb: makeAdminDbMock(),
}));

// Keep enqueueApproval real; stub the executors so decide-tests control outcomes.
vi.mock('../approval-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../approval-registry')>();
  const stubbed = Object.fromEntries(
    Object.keys(actual.APPROVAL_EXECUTORS).map((key) => [key, executorFn])
  );
  return { ...actual, APPROVAL_EXECUTORS: stubbed };
});

import { decideApprovalRequest } from '../backoffice-approval-actions';
import { enqueueApproval } from '../approval-registry';
import { suspendOrganization } from '../backoffice-org-actions';
import type { AuditActor } from '../backoffice-types';

const requester: AuditActor = { userId: 'u-req', name: 'Requester', email: 'req@x.com', role: 'super_admin' };

function mockAuthAs(uid: string, profile: Record<string, unknown>): void {
  verifyIdToken.mockResolvedValue({ uid, email: profile.email });
  userGet.mockResolvedValue({ exists: true, data: () => profile });
}

function pendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    id: 'req-1',
    data: () => ({
      actionKey: 'organization.suspend',
      payload: { orgId: 'org-9', reason: 'nonpayment' },
      summary: 'Suspend org-9',
      status: 'pending',
      requestedBy: requester,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ...overrides,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auditAdd.mockResolvedValue(undefined);
  reqSet.mockResolvedValue(undefined);
  reqUpdate.mockResolvedValue(undefined);
  executorFn.mockResolvedValue({ success: true });
});

describe('enqueueApproval', () => {
  it('writes a pending request and audits it', async () => {
    const { requestId } = await enqueueApproval('organization.suspend', { orgId: 'org-9' }, 'Suspend org-9', requester);

    expect(requestId).toBe('req-1');
    expect(reqSet).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      actionKey: 'organization.suspend',
      requestedBy: requester,
    }));
    expect(auditAdd).toHaveBeenCalledWith(expect.objectContaining({ action: 'approval.requested' }));
  });
});

describe('decideApprovalRequest', () => {
  it('rejects a four-eyes violation (requester deciding own request)', async () => {
    mockAuthAs('u-req', { email: 'req@x.com', permissions: ['system_admin'] });
    txGet.mockResolvedValue(pendingRequest());

    const res = await decideApprovalRequest('req-1', 'approved', 'tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/four-eyes/i);
    expect(executorFn).not.toHaveBeenCalled();
  });

  it('executes the STORED payload when a different admin approves', async () => {
    mockAuthAs('u-other', { email: 'other@x.com', permissions: ['system_admin'] });
    txGet.mockResolvedValue(pendingRequest());

    const res = await decideApprovalRequest('req-1', 'approved', 'tok');
    expect(res.success).toBe(true);
    expect(res.status).toBe('executed');
    expect(executorFn).toHaveBeenCalledWith(
      { orgId: 'org-9', reason: 'nonpayment' },
      expect.objectContaining({ userId: 'u-other' })
    );
    expect(reqUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'executed' }));
  });

  it('never executes on rejection', async () => {
    mockAuthAs('u-other', { email: 'other@x.com', permissions: ['system_admin'] });
    txGet.mockResolvedValue(pendingRequest());

    const res = await decideApprovalRequest('req-1', 'rejected', 'tok');
    expect(res.success).toBe(true);
    expect(res.status).toBe('rejected');
    expect(executorFn).not.toHaveBeenCalled();
  });

  it('transitions an expired pending request to expired without executing', async () => {
    mockAuthAs('u-other', { email: 'other@x.com', permissions: ['system_admin'] });
    txGet.mockResolvedValue(pendingRequest({ expiresAt: new Date(Date.now() - 60_000).toISOString() }));

    const res = await decideApprovalRequest('req-1', 'approved', 'tok');
    expect(res.success).toBe(true);
    expect(res.status).toBe('expired');
    expect(executorFn).not.toHaveBeenCalled();
  });

  it('forbids a role without approvals:execute from deciding', async () => {
    mockAuthAs('u-view', { email: 'view@x.com', backofficeRoles: ['readonly_auditor'] });

    const res = await decideApprovalRequest('req-1', 'approved', 'tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/forbidden/i);
  });
});

describe('gated action enqueues instead of mutating', () => {
  it('suspendOrganization returns pendingApproval and does NOT update the org', async () => {
    mockAuthAs('u-req', { email: 'req@x.com', permissions: ['system_admin'] });
    orgGet.mockResolvedValue({ exists: true, data: () => ({ name: 'Acme Corp' }) });

    const res = await suspendOrganization('org-9', 'nonpayment', 'tok');
    expect(res.success).toBe(true);
    expect(res.pendingApproval).toBe(true);
    expect(res.requestId).toBe('req-1');
    expect(orgUpdate).not.toHaveBeenCalled();
    expect(reqSet).toHaveBeenCalledWith(expect.objectContaining({ actionKey: 'organization.suspend' }));
  });
});
