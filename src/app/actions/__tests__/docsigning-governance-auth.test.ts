// @vitest-environment node
/**
 * @fileOverview DocSigning governance + branding action auth (PR-0 review, 2026-09-29).
 *
 * These 11 server actions were public and unauthenticated. Every one must now refuse an anonymous
 * caller or a member without the Agreements / Doc Signing permission BEFORE touching data, and the
 * legal-hold actor must be the verified session user (never a caller-supplied id).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ signedIn: true, granted: true, uid: 'staff-1' }));

vi.mock('@/lib/auth/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-auth')>();
  return {
    ...actual,
    requireWorkspace: vi.fn(async () => {
      if (!h.signedIn) throw new actual.UnauthorizedError('Not signed in.');
      return { uid: h.uid };
    }),
  };
});
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async () => (h.granted ? { granted: true } : { granted: false, reason: 'Access denied for finance/agreements:edit' })),
}));
vi.mock('@/lib/errors/report-error', () => ({ toClientErrorMessage: (_s: string, _e: unknown, _x: unknown, f: string) => f }));

const svc = vi.hoisted(() => ({
  getWorkspaceAssuranceProfiles: vi.fn(async () => [{ id: 'p1' }]),
  createWorkspaceAssuranceProfile: vi.fn(async () => ({ id: 'p2' })),
  getWorkspaceWebhookSubscriptions: vi.fn(async () => []),
  getWorkspaceWebhookDeliveryLogs: vi.fn(async () => []),
  replayDeadLetterWebhook: vi.fn(async () => ({ id: 'dl1' })),
  createWebhookSubscription: vi.fn(async () => ({ id: 'wh1' })),
  applyLegalHoldToContract: vi.fn(async (_ws: string, _c: string, input: Record<string, unknown>) => ({ isUnderLegalHold: true, ...input })),
  releaseLegalHoldFromContract: vi.fn(async (_ws: string, _c: string, input: Record<string, unknown>) => ({ isUnderLegalHold: false, ...input })),
  getWorkspaceRetentionPolicies: vi.fn(async () => []),
  setWorkspaceRetentionPolicy: vi.fn(async () => ({ category: 'msa' })),
  generateEvidencePackageManifest: vi.fn(() => ({ contractId: 'c1' })),
  brandingSet: vi.fn(async () => undefined),
}));
vi.mock('@/lib/documents/assurance-profile-service', () => ({
  getWorkspaceAssuranceProfiles: svc.getWorkspaceAssuranceProfiles,
  createWorkspaceAssuranceProfile: svc.createWorkspaceAssuranceProfile,
}));
vi.mock('@/lib/documents/document-webhook-service', () => ({
  getWorkspaceWebhookSubscriptions: svc.getWorkspaceWebhookSubscriptions,
  getWorkspaceWebhookDeliveryLogs: svc.getWorkspaceWebhookDeliveryLogs,
  replayDeadLetterWebhook: svc.replayDeadLetterWebhook,
  createWebhookSubscription: svc.createWebhookSubscription,
}));
vi.mock('@/lib/documents/document-governance-service', () => ({
  applyLegalHoldToContract: svc.applyLegalHoldToContract,
  releaseLegalHoldFromContract: svc.releaseLegalHoldFromContract,
  getWorkspaceRetentionPolicies: svc.getWorkspaceRetentionPolicies,
  setWorkspaceRetentionPolicy: svc.setWorkspaceRetentionPolicy,
  generateEvidencePackageManifest: svc.generateEvidencePackageManifest,
}));
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: false, data: () => undefined }), set: svc.brandingSet }),
    }),
  },
}));

import * as governance from '../enterprise-governance-actions';
import { getWorkspaceBrandingAction, updateWorkspaceBrandingAction } from '../workspace-branding-actions';

type Call = () => Promise<unknown>;

const ws = 'ws-a';
const governanceCalls: Record<string, Call> = {
  getAssuranceProfilesAction: () => governance.getAssuranceProfilesAction(ws),
  createAssuranceProfileAction: () =>
    governance.createAssuranceProfileAction(ws, {} as Parameters<typeof governance.createAssuranceProfileAction>[1]),
  getWebhookHealthAction: () => governance.getWebhookHealthAction(ws),
  createWebhookSubscriptionAction: () =>
    governance.createWebhookSubscriptionAction(ws, {} as Parameters<typeof governance.createWebhookSubscriptionAction>[1]),
  replayWebhookDeliveryAction: () => governance.replayWebhookDeliveryAction(ws, 'dl1'),
  getLegalHoldAndRetentionAction: () => governance.getLegalHoldAndRetentionAction(ws),
  toggleContractLegalHoldAction: () => governance.toggleContractLegalHoldAction(ws, 'c1', true, 'Litigation'),
  setRetentionPolicyAction: () =>
    governance.setRetentionPolicyAction(ws, 'msa' as Parameters<typeof governance.setRetentionPolicyAction>[1], 7, true),
  generateEvidencePackageAction: () => governance.generateEvidencePackageAction(ws, 'c1'),
  getWorkspaceBrandingAction: () => getWorkspaceBrandingAction(ws),
  updateWorkspaceBrandingAction: () =>
    updateWorkspaceBrandingAction(ws, { primaryColor: '#112233', companyDisplayName: 'Acme', emailSenderName: 'Acme Ops' }),
};

function serviceCallCount(): number {
  return Object.values(svc).reduce((n, fn) => n + fn.mock.calls.length, 0);
}

beforeEach(() => {
  h.signedIn = true;
  h.granted = true;
  Object.values(svc).forEach((fn) => fn.mockClear());
});

describe('every DocSigning governance/branding action refuses before touching data', () => {
  it('covers all 11 exports', () => {
    expect(Object.keys(governanceCalls)).toHaveLength(11);
  });

  it.each(Object.keys(governanceCalls))('%s: anonymous caller → no service call', async (name) => {
    h.signedIn = false;
    await governanceCalls[name]();
    expect(serviceCallCount()).toBe(0);
  });

  it.each(Object.keys(governanceCalls))('%s: member without the permission → no service call', async (name) => {
    h.granted = false;
    await governanceCalls[name]();
    expect(serviceCallCount()).toBe(0);
  });
});

describe('actor attribution and results', () => {
  it('records the verified session user as the legal-hold actor', async () => {
    await expect(governance.toggleContractLegalHoldAction(ws, 'c1', true, 'Litigation')).resolves.toMatchObject({ success: true });
    expect(svc.applyLegalHoldToContract).toHaveBeenCalledWith(ws, 'c1', expect.objectContaining({ placedByUserId: 'staff-1' }));
    await governance.toggleContractLegalHoldAction(ws, 'c1', false);
    expect(svc.releaseLegalHoldFromContract).toHaveBeenCalledWith(ws, 'c1', expect.objectContaining({ releasedByUserId: 'staff-1' }));
  });

  it('explains a refusal in plain words instead of failing silently on writes', async () => {
    h.granted = false;
    await expect(governance.setRetentionPolicyAction(ws, 'msa' as Parameters<typeof governance.setRetentionPolicyAction>[1], 7, true)).resolves.toEqual({
      success: false,
      error: 'Access denied for finance/agreements:edit',
    });
  });

  it('still works for permitted staff (reads and writes)', async () => {
    await expect(governance.getAssuranceProfilesAction(ws)).resolves.toEqual([{ id: 'p1' }]);
    await expect(updateWorkspaceBrandingAction(ws, { primaryColor: '#112233', companyDisplayName: 'Acme', emailSenderName: 'Acme Ops' })).resolves.toMatchObject({ success: true });
    expect(svc.brandingSet).toHaveBeenCalled();
  });
});
