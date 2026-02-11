
'use server';

import { collection, addDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { Activity } from './types';
import { firebaseConfig } from '@/firebase/config';

// This is a server-side only utility.

// Ensure Firebase is initialized on the server
function getDb() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getFirestore(getApp());
}

// Define the input type, omitting fields that will be added by the logger itself.
type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

/**
 * Logs an activity to the Firestore 'activities' collection.
 * This function is the single source of truth for creating activity records.
 * @param activityData The data for the activity to be logged.
 */
export async function logActivity(activityData: LogActivityInput): Promise<void> {
    const db = getDb();
    if (!db) {
        console.error("ActivityLogger: Firestore not available.");
        // In a real-world scenario, you might add this to a retry queue or a dead-letter queue.
        return;
    }

    try {
        const activityCollection = collection(db, 'activities');
        // Add the timestamp just before writing to the database.
        await addDoc(activityCollection, {
            ...activityData,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        // We log the error server-side but don't throw it,
        // as a logging failure shouldn't break the primary user-facing action.
        console.error("ActivityLogger: Failed to log activity.", error);
    }
}
