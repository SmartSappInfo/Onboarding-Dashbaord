'use server';

import { adminDb } from './firebase-admin';
import { after } from 'next/server';
import type { LearningSignal } from './types';
import { calculateJsonDiff } from './json-diff';

/**
 * Creates a new learning signal record when AI generates content.
 * Requirement: Unified Learning Loop (ULL) - Phase 1
 */
export async function createLearningSignalAction(data: Omit<LearningSignal, 'id' | 'createdAt' | 'updatedAt' | 'isPublished'>) {
    try {

        const signalRef = adminDb.collection('learning_signals').doc();
        const now = new Date().toISOString();

        const signal: LearningSignal = {
            ...data,
            id: signalRef.id,
            isPublished: false,
            createdAt: now,
            updatedAt: now,
        };

        await signalRef.set(signal);
        return { success: true, id: signalRef.id };
    } catch (error: any) {
        console.error('Create Learning Signal Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Finalizes a learning signal upon first publication.
 * Uses the after() pattern for non-blocking persistence.
 * Requirement: Unified Learning Loop (ULL) - Phase 4
 */
export async function finalizeLearningSignalAction(signalId: string, finalData: any, validationErrors: string[] = []) {
    try {

        // Capture current state immediately to ensure data integrity
        const now = new Date().toISOString();
        const validationSuccess = validationErrors.length === 0;

        // Use after() to handle database writes in the background
        after(async () => {
            try {
                const signalRef = adminDb.collection('learning_signals').doc(signalId);
                const signalSnap = await signalRef.get();

                if (!signalSnap.exists) return;

                const initialData = signalSnap.data()?.initialState;
                
                // Calculate structured JSON diff edit distance
                const diffResult = calculateJsonDiff(initialData, finalData);
                const editDistance = diffResult.editDistance;
                const corrections = diffResult.corrections;

                await signalRef.update({
                    finalState: finalData,
                    validationErrors,
                    validationSuccess,
                    isPublished: true,
                    publishedAt: now,
                    updatedAt: now,
                    editDistance,
                    corrections
                });
            } catch (bgError) {
                console.error('Background Learning Signal Update Failed:', bgError);
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error('Finalize Learning Signal Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates the user rating for an AI generation.
 * Requirement: Unified Learning Loop (ULL) - Phase 2 (Feedback UI)
 */
export async function updateSignalRatingAction(signalId: string, rating: number) {
    try {

        after(async () => {
            try {
                const signalRef = adminDb.collection('learning_signals').doc(signalId);
                await signalRef.update({
                    userRating: rating,
                    updatedAt: new Date().toISOString()
                });
            } catch (bgError) {
                console.error('Background Rating Update Failed:', bgError);
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error('Update Signal Rating Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deletes all learning signals associated with a specific survey.
 * Called when a survey is deleted to maintain data hygiene.
 */
export async function deleteLearningSignalsBySurveyAction(surveyId: string) {
    try {
        const signalsQuery = await adminDb.collection('learning_signals')
            .where('surveyId', '==', surveyId)
            .get();

        if (signalsQuery.empty) return { success: true };

        const batch = adminDb.batch();
        signalsQuery.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        return { success: true };
    } catch (error: any) {
        console.error('Delete Learning Signals Error:', error);
        return { success: false, error: error.message };
    }
}



/**
 * Retrieves past "Gold Standard" examples for a specific organization.
 * Used for Few-Shot Retrieval Augmented Generation (RAG).
 * 
 * @param organizationId - The active organization
 * @param limit - Max number of examples to fetch
 * @returns Array of highly-rated or zero-edit-distance final states
 */
export async function getGoldStandardExamples(organizationId: string, limit: number = 2) {
    if (!organizationId) return [];

    try {
        // Query for successful publications in this org
        const signalsQuery = await adminDb.collection('learning_signals')
            .where('organizationId', '==', organizationId)
            .where('isPublished', '==', true)
            .where('validationSuccess', '==', true)
            // Order by editDistance ascending (0 means perfect generation)
            .orderBy('editDistance', 'asc')
            .limit(limit)
            .get();

        if (signalsQuery.empty) return [];

        return signalsQuery.docs.map(doc => {
            const data = doc.data();
            return {
                prompt: data.prompt,
                finalState: data.finalState,
                editDistance: data.editDistance,
                userRating: data.userRating
            };
        });
    } catch (error) {
        console.error('Fetch Gold Standard Examples Error:', error);
        // Fail gracefully so generation can continue without RAG
        return [];
    }
}
