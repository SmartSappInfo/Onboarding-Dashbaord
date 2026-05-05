'use server';

import { logActivity } from './activity-logger';
import { EntityNote } from './types';
import { summarizeEntityNotesFlow } from '@/ai/flows/entity-summarizer';

/**
 * Logs a note creation event to the global Activity Feed.
 * Uses the non-blocking 'after' pattern internally via logActivity.
 */
export async function logNoteActivity(
    note: Omit<EntityNote, 'id'>, 
    organizationId: string
) {
    if (!note.entityId || !note.workspaceId || !organizationId) return;

    await logActivity({
        type: 'note_added',
        description: `${note.noteType || 'general'} note added`,
        source: 'app',
        organizationId,
        workspaceId: note.workspaceId,
        entityId: note.entityId,
        userId: note.createdBy,
        displayName: note.createdByName,
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
 */
export async function getEntityAiSummary(notes: EntityNote[], entityName?: string) {
    try {
        const result = await summarizeEntityNotesFlow({ 
            notes: notes.slice(0, 50), // Limit to recent 50 notes for context window efficiency
            entityName 
        });
        return { success: true, summary: result };
    } catch (error: any) {
        console.error('AI Summary Error:', error);
        return { success: false, error: error.message };
    }
}
