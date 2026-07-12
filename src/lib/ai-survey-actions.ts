'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { Survey, SurveyResultPage } from './types';
import { canUser } from './workspace-permissions';
import { prepareSurveyForFirestore, applySurveyDefaults } from './firestore-utils';

interface CreateSurveyFromAiInput {
    surveyData: Partial<Survey>;
    resultPages?: SurveyResultPage[];
    workspaceId: string;
    userId: string;
}

/**
 * Persists an AI-generated survey blueprint to Firestore.
 * This is triggered automatically when the AI Partner composes a NEW survey.
 */
export async function createSurveyFromAiAction({ surveyData, resultPages, workspaceId, userId }: CreateSurveyFromAiInput) {
    console.log(`>>> [AI-SAVE] Persisting AI-generated blueprint for workspace: ${workspaceId}`);
    try {
        // 0. Workspace & Permission Check
        if (!workspaceId || workspaceId === 'onboarding' || workspaceId === 'generic') {
            return { success: false, error: 'A survey must be associated with a valid workspace.' };
        }
        const permission = await canUser(userId, 'studios', 'surveys', 'create', workspaceId);
        if (!permission.granted) {
            return { success: false, error: `Permission denied: ${permission.reason}` };
        }

        const surveysCollection = adminDb.collection('surveys');
        
        // 1. Validate required fields
        if (!surveyData.title || surveyData.title.trim().length < 2) {
            return { success: false, error: 'Survey title is required and must be at least 2 characters long.' };
        }
        
        if (!surveyData.description || surveyData.description.trim().length < 10) {
            return { success: false, error: 'Survey description is required and must be at least 10 characters long.' };
        }
        
        if (!surveyData.elements || surveyData.elements.length === 0) {
            return { success: false, error: 'Survey must have at least one element (question or section).' };
        }
        
        // 2. Generate a clean slug and check for duplicates
        const baseSlug = surveyData.title
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        
        let slug = `${baseSlug}-${Math.random().toString(36).substring(2, 5)}`;
        
        // Check if slug already exists
        const existingSlugQuery = await surveysCollection.where('slug', '==', slug).limit(1).get();
        if (!existingSlugQuery.empty) {
            slug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).substring(2, 3)}`;
        }

        // 3. Prepare the survey document with defaults and clean for Firestore
        const surveyDocument = {
            ...surveyData,
            slug,
            status: 'draft',
            internalName: surveyData.title || 'AI Composed Survey',
            workspaceIds: [workspaceId]
        };

        const dataWithDefaults = applySurveyDefaults(surveyDocument);
        const newSurvey = prepareSurveyForFirestore(dataWithDefaults, false);

        // 4. Save to Firestore
        const docRef = await surveysCollection.add(newSurvey);

        // 5. Save result pages subcollection if present
        if (resultPages && resultPages.length > 0) {
            const pagesCol = docRef.collection('resultPages');
            const batch = adminDb.batch();
            
            resultPages.forEach(page => {
                const pageRef = pagesCol.doc(page.id || adminDb.collection('_').doc().id);
                const cleanedPage = prepareSurveyForFirestore(page, false);
                batch.set(pageRef, cleanedPage);
            });
            
            await batch.commit();
        }

        // 6. Log the intelligent creation event
        await logActivity({
            entityId: '',
            organizationId: 'default',
            userId,
            workspaceId,
            type: 'entity_updated',
            source: 'ai_design_partner',
            description: `AI Partner composed and saved new survey blueprint: "${newSurvey.title}"`,
            metadata: { surveyId: docRef.id, source: 'ai_composer' }
        });

        revalidatePath('/admin/surveys');
        
        return { success: true, id: docRef.id };

    } catch (error: any) {
        console.error(">>> [AI-SAVE] Critical Failure:", error);
        
        // Provide specific error messages based on error type
        let errorMessage = "Failed to persist AI blueprint.";
        
        if (error.code) {
            switch (error.code) {
                case 'permission-denied':
                    errorMessage = 'Permission denied. You don\'t have access to create surveys in this workspace.';
                    break;
                case 'invalid-argument':
                    errorMessage = 'Invalid survey data. Please check that all required fields are properly filled.';
                    break;
                case 'failed-precondition':
                    errorMessage = 'Survey creation failed due to a system constraint. This might be due to a duplicate slug.';
                    break;
                case 'resource-exhausted':
                    errorMessage = 'System is currently overloaded. Please try again in a few moments.';
                    break;
                case 'unauthenticated':
                    errorMessage = 'Authentication required. Please log in again.';
                    break;
                case 'unavailable':
                    errorMessage = 'Database is temporarily unavailable. Please try again.';
                    break;
                default:
                    errorMessage = `System error (${error.code}): ${error.message || 'Unknown error occurred'}`;
            }
        } else if (error.message) {
            if (error.message.includes('slug')) {
                errorMessage = 'Survey URL slug conflict. Please modify the survey title.';
            } else if (error.message.includes('workspace')) {
                errorMessage = 'Workspace access error. Please ensure you have proper permissions.';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network connection error. Please check your internet connection.';
            } else {
                errorMessage = `Creation failed: ${error.message}`;
            }
        }
        
        return { success: false, error: errorMessage };
    }
}
