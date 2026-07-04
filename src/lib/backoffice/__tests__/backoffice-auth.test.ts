import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin before importing the module under test.
// vi.hoisted ensures the fns exist when the hoisted mock factories run.
const { verifyIdToken, userGet } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  userGet: vi.fn(),
}));

vi.mock('../../firebase-admin', () => ({
  adminAuth: { verifyIdToken },
  adminDb: {
    collection: () => ({ doc: () => ({ get: userGet }) }),
  },
}));
vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken },
  adminDb: {
    collection: () => ({ doc: () => ({ get: userGet }) }),
  },
}));

import { authorizeBackoffice, resolveBackofficeActor } from '../backoffice-auth';
import { BackofficeAuthError } from '../backoffice-errors';

describe('authorizeBackoffice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grants a system_admin (super_admin) execute on features', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'a@b.c' });
    userGet.mockResolvedValue({
      exists: true,
      data: () => ({ email: 'a@b.c', name: 'Admin A', permissions: ['system_admin'] }),
    });

    const actor = await authorizeBackoffice('tok', 'features', 'execute');
    expect(actor).toMatchObject({ userId: 'u1', name: 'Admin A', email: 'a@b.c', role: 'super_admin' });
  });

  it('grants release_admin execute on features but forbids execute on operations', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u5', email: 'rel@b.c' });
    userGet.mockResolvedValue({
      exists: true,
      data: () => ({ email: 'rel@b.c', backofficeRoles: ['release_admin'] }),
    });

    await expect(authorizeBackoffice('tok', 'features', 'execute')).resolves.toMatchObject({
      role: 'release_admin',
    });
    await expect(authorizeBackoffice('tok', 'operations', 'execute')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('honors multiple roles (OR logic), not just the first', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u6', email: 'multi@b.c' });
    userGet.mockResolvedValue({
      exists: true,
      data: () => ({ email: 'multi@b.c', backofficeRoles: ['readonly_auditor', 'migration_admin'] }),
    });

    // readonly_auditor alone cannot execute operations; migration_admin can.
    const actor = await authorizeBackoffice('tok', 'operations', 'execute');
    expect(actor.userId).toBe('u6');
  });

  it('forbids readonly_auditor from executing operations', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u2', email: 'r@b.c' });
    userGet.mockResolvedValue({
      exists: true,
      data: () => ({ email: 'r@b.c', backofficeRoles: ['readonly_auditor'] }),
    });

    await expect(authorizeBackoffice('tok', 'operations', 'execute')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('rejects an invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad token'));
    await expect(authorizeBackoffice('bad', 'features', 'view')).rejects.toBeInstanceOf(Error);
  });

  it('rejects a user with no backoffice roles', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u3', email: 'n@b.c' });
    userGet.mockResolvedValue({
      exists: true,
      data: () => ({ email: 'n@b.c' }),
    });

    await expect(authorizeBackoffice('tok', 'dashboard', 'view')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('rejects a token whose user profile does not exist', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'ghost', email: 'g@b.c' });
    userGet.mockResolvedValue({ exists: false, data: () => undefined });

    await expect(authorizeBackoffice('tok', 'dashboard', 'view')).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });
});

describe('resolveBackofficeActor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns actor and full role list without enforcing RBAC', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u4', email: 'ops@b.c' });
    userGet.mockResolvedValue({
      exists: true,
      data: () => ({ email: 'ops@b.c', name: 'Ops', backofficeRoles: ['support_admin', 'migration_admin'] }),
    });

    const { actor, roles } = await resolveBackofficeActor('tok');
    expect(actor).toMatchObject({ userId: 'u4', role: 'support_admin' });
    expect(roles).toEqual(['support_admin', 'migration_admin']);
  });

  it('throws BackofficeAuthError for a missing profile', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'nobody', email: 'x@b.c' });
    userGet.mockResolvedValue({ exists: false, data: () => undefined });

    await expect(resolveBackofficeActor('tok')).rejects.toBeInstanceOf(BackofficeAuthError);
  });
});
