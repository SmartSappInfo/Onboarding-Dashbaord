'use server';

import { logActivity } from './activity-logger';
import { EntityNote } from './types';
import { summarizeEntityNotesFlow } from '@/ai/flows/entity-summarizer';
import { requireWorkspace } from '@/lib/auth/require-auth';
import { canUser } from './workspace-permissions';
import { workspaceOrganizationId } from './crm/deal-core';
import { isEntityInWorkspace } from './crm/entity-core';

/*
 * SECURITY (agents_mcp PR-1 / N1): both actions used to be unguarded. The author, organization and
 * workspace now come from the session and the workspace document, never from the caller.
 */

/** The signed-in user, if allowed to view contacts in `workspaceId`. */
async function viewerOf(workspaceId: string): Promise<{ uid: string; name: string } | null> {
  const { uid, profile } = await requireWorkspace(workspaceId);
  const permission = await canUser(uid, 'operations', 'campuses', 'view', workspaceId);
  return permission.granted ? { uid, name: profile.name || '' } : null;
}

/**
 * Logs a note creation event to the global Activity Feed.
 * Uses the non-blocking 'after' pattern internally via logActivity.
 */
export async function logNoteActivity(note: Omit<EntityNote, 'id'>) {
    if (!note.entityId || !note.workspaceId) return;
    const viewer = await viewerOf(note.workspaceId);
    if (!viewer) return;
    if (!(await isEntityInWorkspace(note.entityId, note.workspaceId))) return;
    const organizationId = await workspaceOrganizationId(note.workspaceId);
    if (!organizationId) return;

    await logActivity({
        type: 'note_added',
        description: `${note.noteType || 'general'} note added`,
        source: 'app',
        organizationId,
        workspaceId: note.workspaceId,
        entityId: note.entityId,
        userId: viewer.uid,
        displayName: viewer.name || note.createdByName,
        metadata: {
            noteType: note.noteType || 'general',
            contentPreview: note.content.length > 120 
                ? note.content.slice(0, 117) + '…' 
                : note.content
        }
    });
}

/**
 * Generates an AI summary for an entity based on its notes history.
 * Session-only and permission-checked (operations/campuses:view): it is a metered AI call.
 */
export async function getEntityAiSummary(
    notes: EntityNote[], 
    entityName: string | undefined,
    workspaceId: string
) {
    try {
        if (!workspaceId) return { success: false, error: 'Workspace is required.' };
        const viewer = await viewerOf(workspaceId);
        if (!viewer) return { success: false, error: 'Permission denied' };
        const organizationId = (await workspaceOrganizationId(workspaceId)) || undefined;

        const result = await summarizeEntityNotesFlow({ 
            notes: notes.slice(0, 50), // Limit to recent 50 notes for context window efficiency
            entityName,
            workspaceId,
            organizationId
        });
        return { success: true, summary: result };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('AI Summary Error:', msg);
        return { success: false, error: msg };
    }
}
