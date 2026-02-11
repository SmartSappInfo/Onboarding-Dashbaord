'use server';

import { collection, addDoc, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Activity } from '@/lib/types';

type LogActivityProps = {
    firestore: Firestore;
    schoolId: string;
    schoolName: string;
    user: User | null;
    type: Activity['type'];
    description: string;
    details?: Activity['details'];
    timestamp?: string;
}

export async function logActivity({
    firestore,
    schoolId,
    schoolName,
    user,
    type,
    description,
    details,
    timestamp
}: LogActivityProps): Promise<void> {
    try {
        const activityData: Omit<Activity, 'id'> = {
            schoolId,
            schoolName,
            userId: user?.uid || null,
            userName: user?.displayName || 'System',
            userAvatarUrl: user?.photoURL || null,
            type,
            description,
            timestamp: timestamp || new Date().toISOString(),
            details: details || {},
        };

        await addDoc(collection(firestore, 'activities'), activityData);
    } catch (error) {
        console.error("Failed to log activity:", error);
        // Re-throw the error to be caught by the calling function
        throw error;
    }
}
