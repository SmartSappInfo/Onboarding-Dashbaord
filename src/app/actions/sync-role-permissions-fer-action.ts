'use server';

/**
 * @fileoverview FER Action: Sync & Normalize 6-Section Role Permissions
 *
 * Scans all organization and workspace roles in Firestore and executes
 * `normalizePermissionsSchema` to guarantee:
 * 1. 6-section parity (operations, finance, studios, social, workforce, management).
 * 2. Backfill of legacy social media permissions into Social Hub.
 * 3. Backfill of legacy user management permissions into Workforce.
 * 4. Backfill of legacy media permissions into Flipbooks and Thumbnails.
 *
 * Conforms to `.agents/AGENTS.md` and Rule 4 (zero any/any[]).
 */

import { adminDb } from '@/lib/firebase-admin';
import { normalizePermissionsSchema } from '@/lib/permissions-engine';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import { getErrorMessage } from '@/lib/errors/report-error';
import type { PermissionsSchema } from '@/lib/types';

export interface RoleSyncFerDetails {
  rolesScanned: number;
  rolesNeedingSync: number;
  rolesUpdated: number;
  affectedRoleNames: string[];
  errors: string[];
}

export interface RoleSyncFerResult {
  success: boolean;
  message: string;
  dryRun: boolean;
  details: RoleSyncFerDetails;
}

interface FirestoreRoleDoc {
  id?: string;
  name?: string;
  permissionsSchema?: unknown;
  workspaceId?: string;
  organizationId?: string;
  updatedAt?: string;
}

const BATCH_SIZE = 25;

export async function executeSyncRolePermissionsFerAction(
  options: { dryRun: boolean } = { dryRun: true }
): Promise<RoleSyncFerResult> {
  const stats: RoleSyncFerDetails = {
    rolesScanned: 0,
    rolesNeedingSync: 0,
    rolesUpdated: 0,
    affectedRoleNames: [],
    errors: [],
  };

  try {
    // Enforce Backoffice Operator authorization
    await authorizeBackofficeSession('operations', 'execute');
    const rolesSnapshot = await adminDb.collection('roles').get();
    stats.rolesScanned = rolesSnapshot.docs.length;

    const docsToUpdate: { ref: FirebaseFirestore.DocumentReference; name: string; normalized: PermissionsSchema }[] = [];

    for (const doc of rolesSnapshot.docs) {
      const data = doc.data() as FirestoreRoleDoc;
      const roleName = data.name || doc.id;
      const rawSchema = data.permissionsSchema;

      const normalized = normalizePermissionsSchema(rawSchema);

      // Determine if normalization introduced changes or missing sections
      const rawObj = (rawSchema && typeof rawSchema === 'object') ? (rawSchema as Record<string, unknown>) : null;
      const needsSync =
        !rawObj ||
        !rawObj.social ||
        !rawObj.workforce ||
        JSON.stringify(rawObj) !== JSON.stringify(normalized);

      if (needsSync) {
        stats.rolesNeedingSync++;
        stats.affectedRoleNames.push(roleName);
        docsToUpdate.push({
          ref: doc.ref,
          name: roleName,
          normalized,
        });
      }
    }

    if (!options.dryRun && docsToUpdate.length > 0) {
      // Chunked writes to prevent Firestore batch overload
      for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
        const chunk = docsToUpdate.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();

        for (const item of chunk) {
          batch.update(item.ref, {
            permissionsSchema: item.normalized,
            updatedAt: new Date().toISOString(),
          });
        }

        await batch.commit();
        stats.rolesUpdated += chunk.length;
      }
    }

    const message = options.dryRun
      ? `Dry Run Completed: Scanned ${stats.rolesScanned} roles. Found ${stats.rolesNeedingSync} roles needing 6-section synchronization.`
      : `Synchronization Completed: Scanned ${stats.rolesScanned} roles. Successfully normalized and updated ${stats.rolesUpdated} roles.`;

    return {
      success: true,
      message,
      dryRun: options.dryRun,
      details: stats,
    };
  } catch (err: unknown) {
    const errorMsg = getErrorMessage(err);
    stats.errors.push(errorMsg);
    return {
      success: false,
      message: `Role normalization failed: ${errorMsg}`,
      dryRun: options.dryRun,
      details: stats,
    };
  }
}
