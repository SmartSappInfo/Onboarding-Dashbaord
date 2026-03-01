'use server';

import { adminDb } from './firebase-admin';
import type { Activity } from './types';

type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

/**
 * Logs an activity using the Firebase Admin SDK for reliability.
 */
export async function logActivity(activityData: LogActivityInput): Promise<void> {
    try {
        // If name/slug aren't provided, attempt to look them up if a schoolId exists
        // This is a safety measure, though usually provided by the caller
        let finalData = { ...activityData };
        
        if (activityData.schoolId && (!activityData.schoolName || !activityData.schoolSlug)) {
            const schoolSnap = await adminDb.collection('schools').doc(activityData.schoolId).get();
            if (schoolSnap.exists) {
                const schoolData = schoolSnap.data();
                finalData.schoolName = schoolData?.name;
                finalData.schoolSlug = schoolData?.slug;
            }
        }

        await adminDb.collection('activities').add({
            ...finalData,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("ActivityLogger: Failed to log activity.", error);
    }
}
