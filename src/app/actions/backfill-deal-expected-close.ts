'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { Deal, Pipeline } from '@/lib/types';
import { calculateExpectedCloseDate } from '../admin/pipeline/utils/deal-expected-close';

export interface BackfillResult {
  success: boolean;
  totalDealsChecked: number;
  totalDealsUpdated: number;
  message: string;
}

export async function backfillDealExpectedCloseDatesAction(): Promise<BackfillResult> {
  try {
    // 1. Fetch all pipelines
    const pipelinesSnap = await adminDb.collection('pipelines').get();
    const pipelineMap = new Map<string, Pipeline>();
    pipelinesSnap.forEach(doc => {
      pipelineMap.set(doc.id, { id: doc.id, ...doc.data() } as Pipeline);
    });

    // 2. Fetch all deals
    const dealsSnap = await adminDb.collection('deals').get();
    let totalDealsChecked = 0;
    let totalDealsUpdated = 0;

    const BATCH_SIZE = 450;
    let batch = adminDb.batch();
    let batchOperationCount = 0;

    for (const dealDoc of dealsSnap.docs) {
      totalDealsChecked++;
      const deal = dealDoc.data() as Deal;

      // Backfill deals where expectedCloseDate is missing, null, or empty string
      if (!deal.expectedCloseDate) {
        const pipeline = pipelineMap.get(deal.pipelineId);
        if (pipeline && pipeline.defaultCloseDateOffsetValue && pipeline.defaultCloseDateOffsetValue > 0) {
          const createdAtDate = deal.createdAt ? new Date(deal.createdAt) : new Date();
          const computedCloseDate = calculateExpectedCloseDate(pipeline, null, createdAtDate);

          if (computedCloseDate) {
            batch.update(dealDoc.ref, {
              expectedCloseDate: computedCloseDate,
              updatedAt: new Date().toISOString(),
            });
            totalDealsUpdated++;
            batchOperationCount++;

            if (batchOperationCount >= BATCH_SIZE) {
              await batch.commit();
              batch = adminDb.batch();
              batchOperationCount = 0;
            }
          }
        }
      }
    }

    if (batchOperationCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      totalDealsChecked,
      totalDealsUpdated,
      message: `Backfill completed successfully. Checked ${totalDealsChecked} deals, updated ${totalDealsUpdated} deals with expected close dates based on pipeline offsets and creation timestamps.`,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Backfill failed';
    console.error('[backfillDealExpectedCloseDatesAction] Error:', error);
    return {
      success: false,
      totalDealsChecked: 0,
      totalDealsUpdated: 0,
      message: err,
    };
  }
}
