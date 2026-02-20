
'use server';

import { adminDb } from './firebase-admin';
import type { Activity } from './types';

type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

/**
 * Logs an activity using the Firebase Admin SDK for reliability.
 */
export async function logActivity(activityData: LogActivityInput): Promise<void> {
    try {
        await adminDb.collection('activities').add({
            ...activityData,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("ActivityLogger: Failed to log activity.", error);
    }
}
