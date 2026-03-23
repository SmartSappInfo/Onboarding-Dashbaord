'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import { revalidatePath } from 'next/cache';
import type { School, OnboardingStage } from './types';

/**
 * @fileOverview Server actions for institutional lifecycle management.
 * Handles track transitions and conversion protocols.
 */

/**
 * Atomically converts a Prospect into an Onboarding school.
 * Moves the record to the specified onboarding pipeline and resets the stage.
 */
export async function convertToOnboardingAction(
    schoolId: string, 
    targetPipelineId: string, 
    userId: string
) {
    try {
        const timestamp = new Date().toISOString();
        const schoolRef = adminDb.collection('schools').doc(schoolId);
        const schoolSnap = await schoolRef.get();

        if (!schoolSnap.exists) throw new Error("School record not found.");
        const school = schoolSnap.data() as School;

        // 1. Resolve target pipeline's initial stage
        const stagesSnap = await adminDb.collection('onboardingStages')
            .where('pipelineId', '==', targetPipelineId)
            .orderBy('order', 'asc')
            .limit(1)
            .get();

        if (stagesSnap.empty) throw new Error("Target pipeline has no defined stages.");
        const firstStage = { id: stagesSnap.docs[0].id, ...stagesSnap.docs[0].data() } as OnboardingStage;

        // 2. Execute Track Transition
        await schoolRef.update({
            track: 'onboarding',
            pipelineId: targetPipelineId,
            stage: {
                id: firstStage.id,
                name: firstStage.name,
                order: firstStage.order,
                color: firstStage.color
            },
            updatedAt: timestamp
        });

        // 3. Log Conversion Success
        await logActivity({
            schoolId,
            schoolName: school.name,
            schoolSlug: school.slug,
            userId,
            workspaceId: school.workspaceIds[0],
            type: 'pipeline_stage_changed',
            source: 'user_action',
            description: `successfully converted "${school.name}" from Prospect to Onboarding.`,
            metadata: { 
                conversionDate: timestamp, 
                targetPipeline: targetPipelineId,
                previousTrack: 'prospect'
            }
        });

        revalidatePath('/admin/schools');
        revalidatePath('/admin/pipeline');
        revalidatePath(`/admin/schools/${schoolId}`);

        return { success: true };
    } catch (e: any) {
        console.error(">>> [SCHOOL:CONVERT] Failed:", e.message);
        return { success: false, error: e.message };
    }
}
