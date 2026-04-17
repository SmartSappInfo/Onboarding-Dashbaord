'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { logActivity } from './activity-logger';
import type { Survey, SurveyResultPage } from './types';
import { canUser } from './workspace-permissions';

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
        // 0. Permission Check
        const permission = await canUser(userId, 'studios', 'surveys', 'create', workspaceId);
        if (!permission.granted) {
            return { success: false, error: permission.reason };
        }

        const surveysCollection = adminDb.collection('surveys');
        
        // 1. Generate a clean slug
        const baseSlug = (surveyData.title || 'ai-composed-survey')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 5)}`;

        // 2. Prepare the survey document
        const newSurvey: Omit<Survey, 'id'> = {
            ...surveyData,
            slug,
            status: 'draft',
            internalName: surveyData.title || 'AI Composed Survey',
            workspaceIds: [workspaceId],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Ensure defaults for styling if missing
            backgroundColor: surveyData.backgroundColor || '#F1F5F9',
            backgroundPattern: surveyData.backgroundPattern || 'none',
            patternColor: surveyData.patternColor || '#3B5FFF',
            showCoverPage: surveyData.showCoverPage ?? true,
            showSurveyTitles: surveyData.showSurveyTitles ?? true,
            startButtonText: surveyData.startButtonText || "Let's Start",
            elements: surveyData.elements || [],
            scoringEnabled: surveyData.scoringEnabled || false,
            maxScore: surveyData.maxScore || 0,
            resultRules: surveyData.resultRules || [],
        } as any;

        // 3. Save to Firestore
        const docRef = await surveysCollection.add(newSurvey);

        // 4. Save result pages subcollection if present
        if (resultPages && resultPages.length > 0) {
            const pagesCol = docRef.collection('resultPages');
            const batch = adminDb.batch();
            
            resultPages.forEach(page => {
                const pageRef = pagesCol.doc(page.id || adminDb.collection('_').doc().id);
                batch.set(pageRef, page);
            });
            
            await batch.commit();
        }

        // 5. Log the intelligent creation event
        await logActivity({
            entityId: '',
            organizationId: 'default',
            userId,
            workspaceId,
            type: 'school_updated', // Reusing existing type
            source: 'ai_design_partner',
            description: `AI Partner composed and saved new survey blueprint: "${newSurvey.title}"`,
            metadata: { surveyId: docRef.id, source: 'ai_composer' }
        });

        revalidatePath('/admin/surveys');
        
        return { success: true, id: docRef.id };

    } catch (error: any) {
        console.error(">>> [AI-SAVE] Critical Failure:", error.message);
        return { success: false, error: error.message || "Failed to persist AI blueprint." };
    }
}
