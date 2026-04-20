'use server';

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { mergePermissionsSchemas, getBlankPermissions } from '../permissions-engine';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import type { AuditActor, PlatformJob } from './backoffice-types';
import type { UserProfile, Role, PermissionsSchema } from '../types';

/**
 * Migration Job: Hydrates user records with their merged hierarchical permissions.
 * 
 * Logic:
 * 1. Queries users based on job scope (Organization vs Platform).
 * 2. Fetches all Role documents for each user.
 * 3. Merges their schemas using the permission engine.
 * 4. Updates the user record with the result.
 */
export async function processRbacMigration(
  jobId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  const jobRef = adminDb.collection('platform_jobs').doc(jobId);

  try {
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) throw new Error('Job document missing.');
    
    const jobData = jobSnap.data() as PlatformJob;
    const isDryRun = jobData.isDryRun;

    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Migration started. Dry Run: ${isDryRun}`
      })
    });

    // 1. Determine User Scope
    let usersQuery: FirebaseFirestore.Query = adminDb.collection('users');
    if (jobData.scope.type === 'organization') {
      usersQuery = usersQuery.where('organizationId', '==', jobData.scope.id);
    }
    
    const usersSnap = await usersQuery.get();
    const totalUsers = usersSnap.size;

    await jobRef.update({ 'progress.total': totalUsers });

    let processed = 0;
    let errors = 0;

    // Cache roles to avoid redundant DB reads
    const roleCache: Record<string, PermissionsSchema> = {};

    for (const userDoc of usersSnap.docs) {
      try {
        const userData = userDoc.data() as UserProfile;
        const userRoles = userData.roles || [];

        if (userRoles.length === 0) {
          await jobRef.update({
            'progress.processed': ++processed,
            'logs': FieldValue.arrayUnion({
              timestamp: new Date().toISOString(),
              level: 'warn',
              message: `Skipping user ${userData.email} (${userDoc.id}): No roles assigned.`
            })
          });
          continue;
        }

        const schemasToMerge: PermissionsSchema[] = [];

        for (const roleId of userRoles) {
          if (roleCache[roleId]) {
            schemasToMerge.push(roleCache[roleId]);
          } else {
            const roleSnap = await adminDb.collection('roles').doc(roleId).get();
            if (roleSnap.exists) {
              const roleData = roleSnap.data() as Role;
              const schema = roleData.permissionsSchema || getBlankPermissions();
              roleCache[roleId] = schema;
              schemasToMerge.push(schema);
            }
          }
        }

        const mergedSchema = mergePermissionsSchemas(schemasToMerge);

        if (!isDryRun) {
          await userDoc.ref.update({
            permissionsSchema: mergedSchema,
            updatedAt: new Date().toISOString()
          });
        }

        await jobRef.update({
           'progress.processed': ++processed,
           'logs': FieldValue.arrayUnion({
             timestamp: new Date().toISOString(),
             level: 'info',
             message: `${isDryRun ? '[DRY RUN] Would hydrate' : 'Hydrated'} permissions for ${userData.email}`
           })
        });

      } catch (userErr: any) {
        errors++;
        await jobRef.update({
          'progress.errors': errors,
          'logs': FieldValue.arrayUnion({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `Failed to process user ${userDoc.id}: ${userErr.message}`
          })
        });
      }
    }

    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Migration finished. Processed: ${processed}, Errors: ${errors}`
      })
    });

    return { success: true };
  } catch (error: any) {
    console.error('[RBAC_MIGRATION_JOB] Critical Failure:', error);
    await jobRef.update({
      status: 'failed',
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Critical Failure: ${error.message}`
      })
    });
    return { success: false, error: error.message };
  }
}
