'use server';

import { adminDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activity-logger';
import { normalizeContactScope } from '@/lib/scope-guard';
import type { Workspace, ContactScope } from '@/lib/types';

/**
 * FETCH-ENRICH-RESTORE PROTOCOL: Workspace Scope Deprecation & Migration
 * 
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * 1. FETCH PHASE:
 *    - Queries all workspace documents in the Firestore `workspaces` collection.
 *    - Scans `workspace_entities` to identify active contacts linked to each workspace.
 * 
 * 2. ENRICH PHASE:
 *    - Normalizes `contactScope` from legacy values ('school', 'schools', null, undefined)
 *      to canonical 'institution'.
 *    - Evaluates `scopeLocked` status. If a workspace has active contacts, locks scope automatically.
 * 
 * 3. RESTORE PHASE:
 *    - Performs atomic batch writes (up to 500 docs per batch) back to Firestore.
 *    - Emits audit activity logs and revalidates Next.js settings cache.
 */

export interface ScopeMigrationResult {
  success: boolean;
  totalExamined: number;
  totalUpdated: number;
  updatedWorkspaces: Array<{
    id: string;
    name: string;
    previousScope: string;
    newScope: ContactScope;
    scopeLocked: boolean;
  }>;
  error?: string;
}

/**
 * Executes the Fetch-Enrich-Restore Protocol for workspace contact scopes.
 */
export async function executeWorkspaceScopeFetchEnrichRestoreAction(
  userId: string = 'system_migration'
): Promise<ScopeMigrationResult> {
  try {
    console.log('[FETCH-ENRICH-RESTORE] Starting Workspace Scope Migration Protocol...');

    // ── STEP 1: FETCH PHASE ──
    const workspacesSnapshot = await adminDb.collection('workspaces').get();
    const totalExamined = workspacesSnapshot.size;

    if (totalExamined === 0) {
      return {
        success: true,
        totalExamined: 0,
        totalUpdated: 0,
        updatedWorkspaces: [],
      };
    }

    const updatedWorkspaces: ScopeMigrationResult['updatedWorkspaces'] = [];
    const batch = adminDb.batch();
    let batchCount = 0;
    const now = new Date().toISOString();

    for (const docSnap of workspacesSnapshot.docs) {
      const data = docSnap.data() as Partial<Workspace>;
      const currentScope = data.contactScope;
      const workspaceId = docSnap.id;
      const workspaceName = data.name || workspaceId;

      // Check if workspace has active contacts
      const activeEntitiesSnap = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      const hasActiveContacts = !activeEntitiesSnap.empty;
      const canonicalScope = normalizeContactScope(currentScope);
      const shouldLockScope = data.scopeLocked || hasActiveContacts;

      // Determine if document needs enrichment
      const scopeNeedsUpdate = !currentScope || currentScope !== canonicalScope;
      const lockNeedsUpdate = data.scopeLocked !== shouldLockScope;

      if (scopeNeedsUpdate || lockNeedsUpdate) {
        // ── STEP 2: ENRICH PHASE ──
        const enrichedUpdates: Record<string, unknown> = {
          contactScope: canonicalScope,
          scopeLocked: shouldLockScope,
          updatedAt: now,
        };

        // ── STEP 3: RESTORE PHASE (Queue batch update) ──
        batch.update(docSnap.ref, enrichedUpdates);
        batchCount++;

        updatedWorkspaces.push({
          id: workspaceId,
          name: workspaceName,
          previousScope: currentScope || 'unassigned',
          newScope: canonicalScope,
          scopeLocked: shouldLockScope,
        });
      }
    }

    // Commit batch restore if updates exist
    if (batchCount > 0) {
      await batch.commit();

      await logActivity({
        entityId: '',
        organizationId: 'system',
        userId,
        workspaceId: '',
        type: 'workspace_scope_updated',
        source: 'system',
        description: `Fetch-Enrich-Restore Protocol: Migrated ${batchCount} workspace(s) to canonical 'institution' scope.`,
      });

      try {
        revalidatePath('/admin/settings');
      } catch {
        // Ignored when executed outside Next.js request context
      }
    }

    console.log(`[FETCH-ENRICH-RESTORE] Complete. Examined: ${totalExamined}, Updated: ${batchCount}`);

    return {
      success: true,
      totalExamined,
      totalUpdated: batchCount,
      updatedWorkspaces,
    };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown migration error';
    console.error('[FETCH-ENRICH-RESTORE] Protocol Failed:', errorMessage);
    return {
      success: false,
      totalExamined: 0,
      totalUpdated: 0,
      updatedWorkspaces: [],
      error: errorMessage,
    };
  }
}
