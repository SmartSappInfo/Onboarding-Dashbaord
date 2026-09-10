'use server';

import { adminDb } from '@/lib/firebase-admin';
import { SystemMigrationLog, Workspace } from '@/lib/types';
import { seedNativeFieldsAction } from '@/lib/fields-actions';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

const BATCH_SIZE = 400;

export async function executePurgeLegacyFieldsFerAction(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints. This one performs an
  // irreversible, cross-tenant field deletion, and previously accepted the executing
  // user's id as an argument — so any caller could run it and attribute it to anyone.
  // Identity and permission are now both resolved server-side from the session.
  const actor = await authorizeBackofficeSession('operations', 'execute');

  const migrationId = 'fer_purge_legacy_fields';
  const now = new Date().toISOString();

  // 1. Mark as In Progress
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: now,
    executedBy: actor.userId,
    summary: 'Execution started...',
  } as SystemMigrationLog, { merge: true });

  const stats = {
    totalFieldsScanned: 0,
    totalGroupsScanned: 0,
    fieldsDeleted: 0,
    groupsDeleted: 0,
    workspacesReseeded: 0,
    customFieldsReparented: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // ----------------------------------------------------------------------
    // STEP 1: Fetch and delete legacy fields & groups
    // ----------------------------------------------------------------------
    
    // We will collect references to delete
    const toDelete: FirebaseFirestore.DocumentReference[] = [];
    
    // Scan app_fields
    const fieldsSnapshot = await adminDb.collection('app_fields').get();
    const survivingCustomFields: any[] = [];
    
    for (const doc of fieldsSnapshot.docs) {
      stats.totalFieldsScanned++;
      const data = doc.data();
      // If it was marked as native or system, it's a legacy seeded field.
      if (data.isNative === true || data.isSystem === true) {
        toDelete.push(doc.ref);
        stats.fieldsDeleted++;
      } else {
        // Keep track of surviving custom fields so we can re-parent them if their group gets deleted
        survivingCustomFields.push({ ref: doc.ref, data });
      }
    }

    // Scan field_groups
    const groupsSnapshot = await adminDb.collection('field_groups').get();
    for (const doc of groupsSnapshot.docs) {
      stats.totalGroupsScanned++;
      const data = doc.data();
      // If it was marked as system, it was a legacy seeded group.
      if (data.isSystem === true || data.isNative === true) {
        toDelete.push(doc.ref);
        stats.groupsDeleted++;
      }
    }

    // Execute deletions in batches
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = toDelete.slice(i, i + BATCH_SIZE);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    // ----------------------------------------------------------------------
    // STEP 2: Re-seed Workspaces
    // ----------------------------------------------------------------------
    // We need to re-seed the new fields for every workspace
    const workspacesSnap = await adminDb.collection('workspaces').get();
    const affectedWorkspaceIds = workspacesSnap.docs.map(doc => doc.id);

    // Create a fallback "Custom Details" group for each workspace just in case
    const fallbackGroupIds: Record<string, string> = {};

    for (const doc of workspacesSnap.docs) {
      const ws = doc.data() as Workspace;
      const workspaceId = ws.id!;
      const organizationId = ws.organizationId;
      const industry = 'education'; // Defaulting to education or we can try to infer

      // Call the seeder
      try {
        await seedNativeFieldsAction(workspaceId, organizationId, 'system_admin');
        stats.workspacesReseeded++;
      } catch (err: unknown) {
        console.error(`Failed to reseed workspace ${workspaceId}:`, err);
        stats.errors.push(`Workspace ${workspaceId} reseed failed: ${getErrorMessage(err)}`);
      }

      // Create a fallback group immediately so we can re-parent orphaned fields
      const fallbackGroupRef = adminDb.collection('field_groups').doc();
      await fallbackGroupRef.set({
        id: fallbackGroupRef.id,
        workspaceId,
        organizationId,
        name: 'Custom Details',
        slug: 'custom_details_fallback',
        description: 'Auto-generated group for orphaned custom fields.',
        icon: 'Layout',
        color: '#64748b',
        entityTypes: ['institution', 'person', 'family'],
        industry: 'custom',
        isSystem: false,
        order: 999,
        createdAt: now,
        updatedAt: now,
      });
      fallbackGroupIds[workspaceId] = fallbackGroupRef.id;
    }

    // ----------------------------------------------------------------------
    // STEP 3: Re-parent orphaned custom fields
    // ----------------------------------------------------------------------
    // Now that new groups are seeded, any custom fields that point to a DELETED group 
    // need to be re-parented to the fallback group.
    
    // First, get ALL valid group IDs that exist NOW (after seeding)
    const newGroupsSnap = await adminDb.collection('field_groups').get();
    const validGroupIds = new Set(newGroupsSnap.docs.map(d => d.id));

    const reparentBatch = adminDb.batch();
    let reparentOps = 0;

    for (const field of survivingCustomFields) {
      if (!validGroupIds.has(field.data.groupId)) {
        // Orphaned! Re-parent to the fallback group for this workspace
        const fallbackId = fallbackGroupIds[field.data.workspaceId];
        if (fallbackId) {
          reparentBatch.update(field.ref, { groupId: fallbackId, updatedAt: now });
          reparentOps++;
          stats.customFieldsReparented++;
        }
      }
    }

    if (reparentOps > 0) {
      await reparentBatch.commit();
    }

    // 2. Mark as Completed
    const summaryMsg = `Purged ${stats.fieldsDeleted} fields & ${stats.groupsDeleted} groups. Reseeded ${stats.workspacesReseeded} workspaces. Reparented ${stats.customFieldsReparented} orphaned fields.`;
    
    await migrationRef.set({
      status: 'completed',
      lastRunAt: now,
      summary: summaryMsg,
      details: stats,
    } as Partial<SystemMigrationLog>, { merge: true });

    return {
      success: true,
      message: summaryMsg,
      details: stats,
    };

  } catch (error: unknown) {
    console.error(`[FER Purge Legacy Fields] Fatal error:`, error);
    stats.failed++;
    stats.errors.push(getErrorMessage(error));

    // 3. Mark as Failed
    await migrationRef.set({
      status: 'failed',
      lastRunAt: now,
      summary: `Failed: ${getErrorMessage(error)}`,
      details: stats,
    } as Partial<SystemMigrationLog>, { merge: true });

    return {
      success: false,
      message: getErrorMessage(error) || 'Fatal error during migration',
      details: stats,
    };
  }
}
