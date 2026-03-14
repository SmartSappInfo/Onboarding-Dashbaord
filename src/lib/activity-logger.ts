
'use server';

import { adminDb } from './firebase-admin';
import type { Activity } from './types';

type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

/**
 * Logs an activity using the Firebase Admin SDK for reliability.
 * Upgraded to emit events to the Automation Engine.
 */
export async function logActivity(activityData: LogActivityInput): Promise<void> {
    try {
        let finalData = { ...activityData };
        
        if (activityData.schoolId && (!activityData.schoolName || !activityData.schoolSlug)) {
            const schoolSnap = await adminDb.collection('schools').doc(activityData.schoolId).get();
            if (schoolSnap.exists) {
                const schoolData = schoolSnap.data();
                finalData.schoolName = schoolData?.name;
                finalData.schoolSlug = schoolData?.slug;
            }
        }

        const docRef = await adminDb.collection('activities').add({
            ...finalData,
            timestamp: new Date().toISOString(),
        });

        // EMIT TO AUTOMATION ENGINE
        const triggerMap: Record<string, string> = {
            'school_created': 'SCHOOL_CREATED',
            'pipeline_stage_changed': 'SCHOOL_STAGE_CHANGED',
            'pdf_form_submitted': 'PDF_SIGNED',
            'form_submission': 'SURVEY_SUBMITTED'
        };

        const triggerType = triggerMap[activityData.type];
        if (triggerType) {
            console.log(`>>> [EVENT:BUS] Emitting ${triggerType} for automated processing.`);
            // In a production environment, this would push to a Task Queue (automation_events)
            // For now, we log the intent.
        }

    } catch (error) {
        console.error("ActivityLogger: Failed to log activity.", error);
    }
}
