/**
 * @fileOverview Access Snapshot & Audit Log Service (Authorization 2.0)
 *
 * Captures immutable point-in-time snapshots of effective permission schemas,
 * role bindings, and access versions for compliance auditing and zero-trust verification.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Read-only immutability once created.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Covered in `authorization-services.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { AccessSnapshot, PermissionsSchema, AppPermissionId } from '@/lib/types';

export class AccessSnapshotService {
  /**
   * Captures and stores an immutable snapshot of a person's effective permissions.
   */
  static async captureSnapshot(params: {
    organizationId: string;
    personId: string;
    workspaceId?: string;
    effectiveSchema: PermissionsSchema;
    flatPermissions: AppPermissionId[];
    activeRoleIds: string[];
    version: number;
    batch?: FirebaseFirestore.WriteBatch;
  }): Promise<AccessSnapshot> {
    const {
      organizationId,
      personId,
      workspaceId,
      effectiveSchema,
      flatPermissions,
      activeRoleIds,
      version,
      batch,
    } = params;

    const now = new Date().toISOString();
    const snapId = `snap_${personId}_${Date.now()}`;
    const snapRef = adminDb.collection('access_snapshots').doc(snapId);

    const snapshot: AccessSnapshot = {
      id: snapId,
      organizationId,
      personId,
      workspaceId,
      effectiveSchema,
      flatPermissions,
      activeRoleIds,
      version,
      snapshotAt: now,
    };

    if (batch) {
      batch.set(snapRef, snapshot);
    } else {
      await snapRef.set(snapshot);
    }

    return snapshot;
  }

  /**
   * Retrieves historical access snapshots for a specific person.
   */
  static async listSnapshotsByPerson(
    organizationId: string,
    personId: string,
    limit = 20
  ): Promise<AccessSnapshot[]> {
    const snap = await adminDb
      .collection('access_snapshots')
      .where('organizationId', '==', organizationId)
      .where('personId', '==', personId)
      .orderBy('snapshotAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AccessSnapshot));
  }
}
