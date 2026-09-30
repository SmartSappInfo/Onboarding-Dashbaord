/**
 * @fileoverview Unit and Integration Tests for syncRolePermissionsFerAction
 *
 * Verifies:
 * 1. Dry run scan detects legacy 4-section schemas.
 * 2. Apply execution normalizes all roles to 6 sections and commits chunked batches.
 * 3. Backward compatibility backfilling for social, workforce, and studios subtools.
 * 4. Zero `any` or `any[]` typing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PermissionsSchema } from '@/lib/types';
import { getBlankPermissions, normalizePermissionsSchema } from '@/lib/permissions-engine';

const {
  batchUpdate,
  batchCommit,
  collectionGet,
  authorizeBackofficeSessionMock,
} = vi.hoisted(() => ({
  batchUpdate: vi.fn(),
  batchCommit: vi.fn().mockResolvedValue(undefined),
  collectionGet: vi.fn(),
  authorizeBackofficeSessionMock: vi.fn().mockResolvedValue({ userId: 'admin_123', email: 'admin@test.com' }),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      get: collectionGet,
    })),
    batch: vi.fn(() => ({
      update: batchUpdate,
      commit: batchCommit,
    })),
  },
}));

vi.mock('@/lib/backoffice/backoffice-auth', () => ({
  authorizeBackofficeSession: authorizeBackofficeSessionMock,
}));

import { executeSyncRolePermissionsFerAction } from '@/app/actions/sync-role-permissions-fer-action';

describe('syncRolePermissionsFerAction Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly scans and flags legacy 4-section roles during dryRun without executing writes', async () => {
    const legacyRoleDoc = {
      id: 'role_admissions',
      ref: { id: 'role_admissions' },
      data: () => ({
        name: 'Admissions Officer',
        permissionsSchema: {
          operations: { enabled: true, features: { campuses: { view: true, create: true } } },
          finance: { enabled: false, features: {} },
          studios: { enabled: true, features: { socialIntelligence: { view: true, create: true } } },
          management: { enabled: true, features: { users: { view: true, create: true } } },
        },
      }),
    };

    const modernRoleDoc = {
      id: 'role_full_admin',
      ref: { id: 'role_full_admin' },
      data: () => {
        const full = getBlankPermissions();
        full.operations.enabled = true;
        full.finance.enabled = true;
        full.studios.enabled = true;
        full.social.enabled = true;
        full.workforce.enabled = true;
        full.management.enabled = true;
        return {
          name: 'Super Admin Role',
          permissionsSchema: normalizePermissionsSchema(full),
        };
      },
    };

    collectionGet.mockResolvedValueOnce({
      docs: [legacyRoleDoc, modernRoleDoc],
    });

    const result = await executeSyncRolePermissionsFerAction({ dryRun: true });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.details.rolesScanned).toBe(2);
    expect(result.details.rolesNeedingSync).toBe(1);
    expect(result.details.rolesUpdated).toBe(0);
    expect(result.details.affectedRoleNames).toContain('Admissions Officer');
    expect(batchCommit).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  it('applies batch writes and normalizes schemas when dryRun is false', async () => {
    const legacyRoleDoc = {
      id: 'role_admissions',
      ref: { id: 'role_admissions' },
      data: () => ({
        name: 'Admissions Officer',
        permissionsSchema: {
          operations: { enabled: true, features: { campuses: { view: true, create: true } } },
          studios: { enabled: true, features: { socialIntelligence: { view: true, create: true } } },
          management: { enabled: true, features: { users: { view: true, create: true } } },
        },
      }),
    };

    collectionGet.mockResolvedValueOnce({
      docs: [legacyRoleDoc],
    });

    const result = await executeSyncRolePermissionsFerAction({ dryRun: false });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(result.details.rolesScanned).toBe(1);
    expect(result.details.rolesNeedingSync).toBe(1);
    expect(result.details.rolesUpdated).toBe(1);

    expect(batchUpdate).toHaveBeenCalledTimes(1);
    const updateCall = batchUpdate.mock.calls[0];
    expect(updateCall[0]).toEqual(legacyRoleDoc.ref);

    const updatePayload = updateCall[1] as { permissionsSchema: PermissionsSchema; updatedAt: string };
    expect(updatePayload.permissionsSchema.social.enabled).toBe(true);
    expect(updatePayload.permissionsSchema.social.features.composer?.create).toBe(true);
    expect(updatePayload.permissionsSchema.workforce.enabled).toBe(true);
    expect(updatePayload.permissionsSchema.workforce.features.users?.create).toBe(true);
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('handles authorization failure and returns structured error result', async () => {
    authorizeBackofficeSessionMock.mockRejectedValueOnce(new Error('Unauthorized backoffice session'));

    const result = await executeSyncRolePermissionsFerAction({ dryRun: true });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unauthorized backoffice session');
    expect(result.details.errors).toContain('Unauthorized backoffice session');
  });
});
