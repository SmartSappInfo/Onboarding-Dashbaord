
'use server';

import { adminDb } from './firebase-admin';
import type { Activity, AutomationTrigger } from './types';
import { triggerAutomationProtocols } from './automation-processor';

type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

/**
 * Logs an activity using the Firebase Admin SDK for reliability.
 * Upgraded to serve as the platform's primary Event Bus for the Automation Engine.
 */
export async function logActivity(activityData: LogActivityInput): Promise<void> {
    try {
        let finalData = { ...activityData };
        
        // 1. Ensure Denormalization (Fetch school context if missing)
        if (activityData.schoolId && (!activityData.schoolName || !activityData.schoolSlug)) {
            const schoolSnap = await adminDb.collection('schools').doc(activityData.schoolId).get();
            if (schoolSnap.exists) {
                const schoolData = schoolSnap.data();
                finalData.schoolName = schoolData?.name;
                finalData.schoolSlug = schoolData?.slug;
            }
        }

        // 2. Persist the Audit Log
        const docRef = await adminDb.collection('activities').add({
            ...finalData,
            timestamp: new Date().toISOString(),
        });

        // 3. BROADCAST TO AUTOMATION ENGINE
        // Map Activity types to high-level Automation Triggers
        const triggerMap: Record<string, AutomationTrigger> = {
            'school_created': 'SCHOOL_CREATED',
            'pipeline_stage_changed': 'SCHOOL_STAGE_CHANGED',
            'pdf_form_submitted': 'PDF_SIGNED',
            'form_submission': 'SURVEY_SUBMITTED',
            'task_completed': 'TASK_COMPLETED',
            'meeting_created': 'MEETING_CREATED'
        };

        const triggerType = triggerMap[activityData.type];
        if (triggerType) {
            console.log(`>>> [EVENT:BUS] Signal detected: ${triggerType}. Invoking Logic Processor.`);
            
            // Prepare the payload for the engine
            const payload = {
                ...finalData,
                activityId: docRef.id,
                // Include common resolution keys
                schoolId: activityData.schoolId,
                schoolName: finalData.schoolName,
                schoolSlug: finalData.schoolSlug,
                timestamp: new Date().toISOString()
            };

            // Invoke the processor (Fire and forget, non-blocking for the logger)
            triggerAutomationProtocols(triggerType, payload).catch(err => {
                console.error(`>>> [EVENT:BUS] Protocol trigger failed:`, err.message);
            });
        }

    } catch (error) {
        console.error("ActivityLogger: Failed to log activity.", error);
    }
}
