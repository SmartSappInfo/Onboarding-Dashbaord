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
            organizationId: school.organizationId || 'default',
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

/**
 * Creates a new school record with proper workspace and pipeline initialization.
 * Uses server-side Firebase Admin SDK to bypass client-side security rules.
 */
export async function createSchoolAction(data: Partial<School>, userId: string) {
  try {
    const timestamp = new Date().toISOString();
    const slug = data.name?.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Resolve initial pipeline and stage
    const primaryWorkspaceId = data.workspaceIds?.includes('onboarding') 
      ? 'onboarding' 
      : data.workspaceIds?.[0] || 'onboarding';

    let initialPipelineId = 'institutional_onboarding';
    let defaultStage = { 
      id: 'stg_institutional_onboarding_0', 
      name: 'Welcome', 
      order: 1, 
      color: '#f72585' 
    };

    // Try to get the actual pipeline for the workspace
    const pipelinesSnap = await adminDb.collection('pipelines')
      .where('workspaceId', '==', primaryWorkspaceId)
      .limit(1)
      .get();

    if (!pipelinesSnap.empty) {
      initialPipelineId = pipelinesSnap.docs[0].id;

      // Get the first stage of this pipeline
      const stagesSnap = await adminDb.collection('onboardingStages')
        .where('pipelineId', '==', initialPipelineId)
        .orderBy('order', 'asc')
        .limit(1)
        .get();

      if (!stagesSnap.empty) {
        const stageData = stagesSnap.docs[0].data();
        defaultStage = {
          id: stagesSnap.docs[0].id,
          name: stageData.name,
          order: stageData.order,
          color: stageData.color
        };
      }
    }

    const schoolData = {
      ...data,
      slug,
      pipelineId: initialPipelineId,
      track: primaryWorkspaceId,
      stage: defaultStage,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await adminDb.collection('schools').add(schoolData);

    // Log activity
    await logActivity({
      schoolId: docRef.id,
      schoolName: data.name || 'Unknown',
      schoolSlug: slug || '',
      organizationId: data.organizationId || 'default',
      userId,
      workspaceId: primaryWorkspaceId,
      type: 'school_created',
      source: 'user_action',
      description: `registered new record: "${data.name}" in ${data.workspaceIds?.length || 0} hubs`,
    });

    revalidatePath('/admin/schools');
    revalidatePath('/admin/pipeline');

    return { success: true, id: docRef.id };
  } catch (e: any) {
    console.error(">>> [SCHOOL:CREATE] Failed:", e.message);
    return { success: false, error: e.message };
  }
}
