'use server';

import { adminDb } from './firebase-admin';
import { after } from 'next/server';
import { requireWorkspace } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

/**
 * Updates the workspace-specific vocabulary map when a user corrects an AI mapping.
 * Requirement: Unified Learning Loop (ULL) - Entity Mapping Reinforcement
 */
export async function updateWorkspaceVocabularyAction(workspaceId: string, mappings: Record<string, string>, userId?: string) {
    try {

        after(async () => {
            try {
                const vocabRef = adminDb.collection('workspaces').doc(workspaceId).collection('vocabulary_map').doc('current');
                const vocabSnap = await vocabRef.get();
                
                const currentVocab = vocabSnap.exists ? vocabSnap.data()?.mappings || {} : {};
                
                // Merge new mappings into the existing map
                const updatedVocab = {
                    ...currentVocab,
                    ...mappings
                };

                await vocabRef.set({
                    mappings: updatedVocab,
                    updatedAt: new Date().toISOString(),
                    updatedBy: userId || 'system'
                }, { merge: true });
                
            } catch (bgError) {
                console.error('Background Vocabulary Update Failed:', bgError);
            }
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('Update Workspace Vocabulary Error:', error);
        return { success: false, error: getErrorMessage(error) };
    }
}

/**
 * Retrieves the preferred mappings for a workspace.
 * Used during AI generation to provide "context" for entity mapping.
 */
export async function getWorkspaceVocabulary(workspaceId: string): Promise<Record<string, string>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

    try {
        const vocabRef = adminDb.collection('workspaces').doc(workspaceId).collection('vocabulary_map').doc('current');
        const vocabSnap = await vocabRef.get();
        
        if (!vocabSnap.exists) return {};
        return vocabSnap.data()?.mappings || {};
    } catch (error) {
        console.error('Get Workspace Vocabulary Error:', error);
        return {};
    }
}
