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
}

export async function logActivity({
    firestore,
    schoolId,
    schoolName,
    user,
    type,
    description,
    details
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
            timestamp: new Date().toISOString(),
            details: details || {},
        };

        // This is a fire-and-forget operation on the server for performance.
        addDoc(collection(firestore, 'activities'), activityData);
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}
