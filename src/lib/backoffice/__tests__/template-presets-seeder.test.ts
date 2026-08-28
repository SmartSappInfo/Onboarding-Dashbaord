/**
 * @fileoverview Unit Tests for 15-Domain Platform Template Master Preset Seeder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { verifyIdToken, userGet, batchSet, batchCommit, auditAdd } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  userGet: vi.fn(),
  batchSet: vi.fn(),
  batchCommit: vi.fn().mockResolvedValue([]),
  auditAdd: vi.fn().mockResolvedValue({ id: 'audit_123' }),
}));

function makeAdminDbMock() {
  return {
    collection: (name: string) => {
      if (name === 'users') return { doc: () => ({ get: userGet }) };
      if (name === 'platform_audit_logs') return { add: auditAdd };
      return {
        doc: (id: string) => ({ id, path: `${name}/${id}` }),
        orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }),
      };
    },
    batch: () => ({
      set: batchSet,
      commit: batchCommit,
    }),
  };
}

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken },
  adminDb: makeAdminDbMock(),
}));
vi.mock('../../firebase-admin', () => ({
  adminAuth: { verifyIdToken },
  adminDb: makeAdminDbMock(),
}));

import { seedAllPlatformTemplatesAction } from '@/app/actions/seed-platform-presets-action';

function mockUser(profile: Record<string, unknown>): void {
  verifyIdToken.mockResolvedValue({ uid: 'usr_admin', email: 'admin@smartsapp.com' });
  userGet.mockResolvedValue({ exists: true, data: () => profile });
}

describe('15-Domain Platform Template Preset Seeder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forbids callers without templates:create permission', async () => {
    mockUser({ backofficeRoles: ['finance_admin'] }); // finance_admin cannot create templates

    const result = await seedAllPlatformTemplatesAction('mock_token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Forbidden');
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('forbids unauthenticated callers with bad token', async () => {
    verifyIdToken.mockRejectedValue(new Error('Invalid ID token'));

    const result = await seedAllPlatformTemplatesAction('bad_token');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('successfully seeds templates across all 15 operational domains for authorized template_admin', async () => {
    mockUser({ backofficeRoles: ['template_admin'] });

    const result = await seedAllPlatformTemplatesAction('valid_token');
    expect(result.success).toBe(true);
    expect(result.seededCount).toBeDefined();

    if (result.seededCount) {
      expect(result.seededCount.pages).toBeGreaterThan(0);
      expect(result.seededCount.sections).toBeGreaterThan(0);
      expect(result.seededCount.messaging).toBeGreaterThan(0);
      expect(result.seededCount.meetings).toBeGreaterThan(0);
      expect(result.seededCount.surveys).toBeGreaterThan(0);
      expect(result.seededCount.forms).toBeGreaterThan(0);
      expect(result.seededCount.automations).toBeGreaterThan(0);
      expect(result.seededCount.pipelines).toBeGreaterThan(0);
      expect(result.seededCount.portals).toBeGreaterThan(0);
      expect(result.seededCount.pdfs).toBeGreaterThan(0);
      expect(result.seededCount.dunning).toBeGreaterThan(0);
      expect(result.seededCount.credentials).toBeGreaterThan(0);
      expect(result.seededCount.governance).toBeGreaterThan(0);
      expect(result.seededCount.total).toBeGreaterThan(20);
    }

    expect(batchCommit).toHaveBeenCalled();
    expect(auditAdd).toHaveBeenCalled();
  });
});
