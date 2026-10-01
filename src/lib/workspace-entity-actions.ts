'use server';

/**
 * @fileOverview Server actions for workspace-entity relationship management.
 *
 * SECURITY (agents_mcp PR-1 / N1): the logic lives in `src/lib/crm/workspace-entity-core.ts`.
 * These exports are public endpoints, so identity (and the audit name/email) comes from the
 * session; the core authorizes against each record's stored workspace.
 */

import { adminDb } from './firebase-admin';
import { filterAndSortEntities, type FilterStateInput } from './utils/entity-filter-util';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import type { CrmActor } from './crm/deal-core';
import {
  type ArchiveEntityInput,
  type BulkArchiveEntitiesInput,
  type BulkDeleteEntitiesInput,
  type DeleteEntityPermanentlyInput,
  type LinkEntityToWorkspaceInput,
  type UnlinkEntityFromWorkspaceInput,
  type UpdateWorkspaceEntityInput,
  archiveEntityCore,
  bulkArchiveEntitiesCore,
  bulkDeleteEntitiesCore,
  deleteEntityPermanentlyCore,
  linkEntityToWorkspaceCore,
  unlinkEntityFromWorkspaceCore,
  updateWorkspaceEntityCore,
} from './crm/workspace-entity-core';

type SessionIdentity = 'userId' | 'userName' | 'userEmail';

/** The session user as an actor, plus the name/email written to audit logs. */
async function sessionCaller(workspaceId?: string): Promise<{ actor: CrmActor; userName: string; userEmail: string }> {
  const { uid, profile } = workspaceId ? await requireWorkspace(workspaceId) : await requireAuth();
  return { actor: { kind: 'user', uid }, userName: profile.name || 'Unknown User', userEmail: profile.email || '' };
}

export async function linkEntityToWorkspaceAction(input: Omit<LinkEntityToWorkspaceInput, SessionIdentity>) {
  const { actor, userName, userEmail } = await sessionCaller(input.workspaceId);
  return linkEntityToWorkspaceCore(actor, { ...input, userId: '', userName, userEmail });
}

export async function unlinkEntityFromWorkspaceAction(input: Omit<UnlinkEntityFromWorkspaceInput, SessionIdentity>) {
  const { actor, userName, userEmail } = await sessionCaller();
  return unlinkEntityFromWorkspaceCore(actor, { ...input, userId: '', userName, userEmail });
}

export async function updateWorkspaceEntityAction(input: Omit<UpdateWorkspaceEntityInput, SessionIdentity>) {
  const { actor, userName, userEmail } = await sessionCaller();
  return updateWorkspaceEntityCore(actor, { ...input, userId: '', userName, userEmail });
}

export async function archiveEntityAction(input: Omit<ArchiveEntityInput, SessionIdentity>) {
  const { actor, userName, userEmail } = await sessionCaller();
  return archiveEntityCore(actor, { ...input, userId: '', userName, userEmail });
}

export async function deleteEntityPermanentlyAction(input: Omit<DeleteEntityPermanentlyInput, SessionIdentity>) {
  const { actor, userName, userEmail } = await sessionCaller();
  return deleteEntityPermanentlyCore(actor, { ...input, userId: '', userName, userEmail });
}

export async function bulkArchiveEntitiesAction(input: Omit<BulkArchiveEntitiesInput, SessionIdentity>) {
  const { actor, userName, userEmail } = await sessionCaller(input.workspaceId);
  return bulkArchiveEntitiesCore(actor, { ...input, userId: '', userName, userEmail });
}

export async function bulkDeleteEntitiesAction(input: Omit<BulkDeleteEntitiesInput, SessionIdentity>) {
  const { actor, userName, userEmail } = await sessionCaller(input.workspaceId);
  return bulkDeleteEntitiesCore(actor, { ...input, userId: '', userName, userEmail });
}

/**
 * Server-side helper to filter and sort all workspace entities and return matching document IDs.
 */
export async function getFilteredEntityIdsAction(
  workspaceId: string,
  filterState: FilterStateInput,
  assignedUserId: string | null | undefined,
  tagFilteredIdsArray: string[] | null | undefined,
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null
): Promise<{ success: boolean; data?: string[]; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    let q = adminDb.collection('workspace_entities')
      .where('workspaceId', '==', workspaceId);

    // Apply basic status filter in query to reduce Firestore document reads
    if (filterState.status && filterState.status !== 'all') {
      q = q.where('status', '==', filterState.status);
    }
    
    // Apply basic assignee filter in query if set and is not "unassigned"
    if (assignedUserId && assignedUserId !== 'unassigned') {
      q = q.where('assignedTo.userId', '==', assignedUserId);
    }

    // Select only fields needed for matching, filtering, and sorting to optimize bandwidth
    const snap = await q.select(
      'entityId',
      'displayName',
      'primaryContactName',
      'primaryEmail',
      'primaryPhone',
      'status',
      'locationCountryId',
      'locationRegionId',
      'locationDistrictId',
      'workspaceTags',
      'addedAt',
      'interests',
      'assignedTo',
      'entityContacts'
    ).get();

    const entities = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const tagFilteredIds = tagFilteredIdsArray ? new Set(tagFilteredIdsArray) : null;

    // Perform full-text search, multi-tag matching, cascading locations, and other complex logic in-memory
    const filtered = filterAndSortEntities(
      entities,
      filterState,
      assignedUserId,
      tagFilteredIds,
      undefined, // Cache matches are checked via emailVerificationCache
      null, // Saved audience matched IDs are evaluated client-side
      sortConfig
    );

    return {
      success: true,
      data: filtered.map(e => e.id)
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get filtered entity IDs';
    console.error('>>> [WORKSPACE_ENTITY:GET_FILTERED_IDS] Failed:', msg);
    return { success: false, error: msg };
  }
}
