'use server';

import { adminDb } from './firebase-admin';
import { after } from 'next/server';

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
    } catch (error: any) {
        console.error('Update Workspace Vocabulary Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Retrieves the preferred mappings for a workspace.
 * Used during AI generation to provide "context" for entity mapping.
 */
export async function getWorkspaceVocabulary(workspaceId: string): Promise<Record<string, string>> {
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
