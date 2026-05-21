'use server';

import { adminDb } from '@/lib/firebase-admin';
import { logActivity } from '@/lib/activity-logger';

export async function clearAllImportLogsAction(userId: string): Promise<{
    success: boolean;
    deletedLogsCount: number;
    deletedSubdocsCount: number;
    error?: string;
}> {
    try {
        let deletedLogsCount = 0;
        let deletedSubdocsCount = 0;

        // 1. Get all import logs
        const logsSnap = await adminDb.collection('import_logs').get();

        if (logsSnap.empty) {
            return {
                success: true,
                deletedLogsCount: 0,
                deletedSubdocsCount: 0,
            };
        }

        let batch = adminDb.batch();
        let batchWriteCount = 0;

        for (const doc of logsSnap.docs) {
            const docId = doc.id;
            const docData = doc.data();

            // Define the three subcollections associated with each import log
            const subcollections = ['pending_rows', 'failed_rows', 'duplicate_rows'];

            for (const sub of subcollections) {
                const subSnap = await doc.ref.collection(sub).get();

                for (const subDoc of subSnap.docs) {
                    batch.delete(subDoc.ref);
                    batchWriteCount++;
                    deletedSubdocsCount++;

                    // Commit batch before it exceeds Firestore limits (500 operations max)
                    if (batchWriteCount >= 450) {
                        await batch.commit();
                        batch = adminDb.batch();
                        batchWriteCount = 0;
                    }
                }
            }

            // Delete the parent import log document itself
            batch.delete(doc.ref);
            batchWriteCount++;
            deletedLogsCount++;

            // Commit batch if limit reached
            if (batchWriteCount >= 450) {
                await batch.commit();
                batch = adminDb.batch();
                batchWriteCount = 0;
            }
        }

        // Commit any remaining operations in the last batch
        if (batchWriteCount > 0) {
            await batch.commit();
        }

        // 2. Log this administrative event to the activity logger
        try {
            await logActivity({
                type: 'import_logs_cleared',
                userId: userId,
                description: `Purged all ${deletedLogsCount} bulk import logs and ${deletedSubdocsCount} associated validation/duplicate rows.`,
                workspaceId: 'system',
                organizationId: 'system-governance',
            } as any);
        } catch (activityError) {
            console.error('[clearAllImportLogsAction] Activity logging failed:', activityError);
        }

        return {
            success: true,
            deletedLogsCount,
            deletedSubdocsCount,
        };
    } catch (error: any) {
        console.error('[clearAllImportLogsAction] Error clearing import logs:', error);
        return {
            success: false,
            deletedLogsCount: 0,
            deletedSubdocsCount: 0,
            error: error.message || 'Failed to clear import logs',
        };
    }
}
