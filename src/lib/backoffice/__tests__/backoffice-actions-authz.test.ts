import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────
// Authorization tests for backoffice server actions.
// One representative action per file: allowed role passes,
// wrong role → forbidden (and no mutation), bad token → error.
// ─────────────────────────────────────────────────

const { verifyIdToken, userGet, docGet, docUpdate, docSet, auditAdd } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  userGet: vi.fn(),
  docGet: vi.fn(),
  docUpdate: vi.fn(),
  docSet: vi.fn(),
  auditAdd: vi.fn(),
}));

const countChain = {
  count: () => ({ get: () => Promise.resolve({ data: () => ({ count: 0 }) }) }),
};

function makeAdminDbMock() {
  return {
    collection: (name: string) => {
      if (name === 'users') return { doc: () => ({ get: userGet }) };
      if (name === 'platform_audit_logs') return { add: auditAdd, where: () => countChain };
      return {
        doc: () => ({ get: docGet, update: docUpdate, set: docSet }),
        orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }),
        where: () => countChain,
      };
    },
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

// Encryption vault is stubbed so authz tests don't depend on a real key.
vi.mock('../secret-vault', () => ({
  sealSecret: (s: string) => ({ cipher: s, iv: 'i', tag: 't', keyId: 'k' }),
  isEnvelope: () => false,
  isVaultConfigured: () => true,
}));

import { toggleFeatureKillSwitch, listAllFeatures } from '../backoffice-feature-actions';
import { saveGlobalAiKeys } from '../backoffice-ai-actions';
import { getPlatformOpsStats } from '../backoffice-dashboard-actions';

function mockUser(profile: Record<string, unknown>): void {
  verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'u@b.c' });
  userGet.mockResolvedValue({ exists: true, data: () => profile });
}

beforeEach(() => {
  vi.clearAllMocks();
  auditAdd.mockResolvedValue(undefined);
  docUpdate.mockResolvedValue(undefined);
  docSet.mockResolvedValue(undefined);
  docGet.mockResolvedValue({
    exists: true,
    data: () => ({ key: 'page_builder', killSwitch: false }),
  });
});

describe('toggleFeatureKillSwitch (features:execute)', () => {
  it('allows super_admin and performs the update', async () => {
    mockUser({ email: 'u@b.c', name: 'U', permissions: ['system_admin'] });

    const res = await toggleFeatureKillSwitch('f1', true, 'tok');
    expect(res.success).toBe(true);
    expect(docUpdate).toHaveBeenCalled();
  });

  it('forbids readonly_auditor and does NOT mutate', async () => {
    mockUser({ email: 'u@b.c', backofficeRoles: ['readonly_auditor'] });

    const res = await toggleFeatureKillSwitch('f1', true, 'tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/forbidden/i);
    expect(docUpdate).not.toHaveBeenCalled();
  });

  it('fails on an invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    const res = await toggleFeatureKillSwitch('f1', true, 'bad');
    expect(res.success).toBe(false);
    expect(docUpdate).not.toHaveBeenCalled();
  });
});

describe('listAllFeatures (features:view)', () => {
  it('forbids a caller with no backoffice roles', async () => {
    mockUser({ email: 'u@b.c' });

    const res = await listAllFeatures('tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/forbidden|access/i);
  });
});

describe('getPlatformOpsStats (dashboard:view)', () => {
  it('allows any backoffice role and returns aggregate counts', async () => {
    mockUser({ email: 'u@b.c', backofficeRoles: ['readonly_auditor'] });

    const res = await getPlatformOpsStats('tok');
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ failedJobs: 0, pendingJobs: 0, auditActions24h: 0 });
  });

  it('forbids a caller with no backoffice roles', async () => {
    mockUser({ email: 'u@b.c' });

    const res = await getPlatformOpsStats('tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/forbidden|access/i);
  });
});

describe('saveGlobalAiKeys (settings:edit)', () => {
  it('allows super_admin', async () => {
    mockUser({ email: 'u@b.c', permissions: ['system_admin'] });
    docGet.mockResolvedValue({ exists: false, data: () => undefined });

    const res = await saveGlobalAiKeys({ geminiApiKey: 'AIzaSyTest123' }, 'tok');
    expect(res.success).toBe(true);
    expect(docSet).toHaveBeenCalled();
  });

  it('forbids template_admin (settings is view-only for that role)', async () => {
    mockUser({ email: 'u@b.c', backofficeRoles: ['template_admin'] });

    const res = await saveGlobalAiKeys({ geminiApiKey: 'AIzaSyTest123' }, 'tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/forbidden/i);
    expect(docSet).not.toHaveBeenCalled();
  });
});
