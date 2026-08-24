'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Server-Side Document CTA Migration:
 *    Executes the Fetch-Enrich-Restore backfill protocol via Firebase Admin SDK (`adminDb`).
 * 2. Exact Text Transformations:
 *    - CTA Pretext: "Are you interested in fixing the critical issues identified in your online prsence audit report? Our team is available to assist you to do just that.\n\nClick to Schedule a review meeting with our team"
 *    - CTA Button Text: "Book Meeting Now" (replacing "Make My School Visible").
 * 3. Chunked Batch Write Safety:
 *    Commits updates in strict chunks of 150 operations per writeBatch.
 * 4. Strict Typing: Zero `any`/`any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { 
  NEW_DOCUMENT_CTA_PRETEXT, 
  NEW_DOCUMENT_CTA_TEXT, 
  OLD_DOCUMENT_CTA_TEXT, 
  OLD_DOCUMENT_CTA_PRETEXT_KEYWORD 
} from '@/lib/media/document-cta-backfill-service';

export interface BackfillCtaActionResult {
  success: boolean;
  processed: number;
  updated: number;
  message: string;
}

export async function runDocumentCtaBackfillAction(): Promise<BackfillCtaActionResult> {
  try {
    const sharesRef = adminDb.collection('media_shares');
    const sharesSnap = await sharesRef.get();
    
    let processed = 0;
    let updated = 0;

    const oct18Timestamp = new Date('2025-10-18T00:00:00Z').getTime();
    
    const candidateDocs = sharesSnap.docs.filter((docSnap) => {
      const data = docSnap.data();
      const assetUrl = (data.assetUrl || data.url || '') as string;
      const assetType = (data.assetType || data.type || '') as string;
      const ctaText = (data.ctaText || '') as string;
      const ctaPretext = (data.ctaPretext || '') as string;
      const createdAt = data.createdAt 
        ? new Date(data.createdAt.seconds ? data.createdAt.seconds * 1000 : data.createdAt).getTime() 
        : 0;

      const isDocumentAsset = assetType === 'document' ||
        assetUrl.toLowerCase().includes('.pdf') ||
        assetUrl.toLowerCase().includes('.doc') ||
        assetUrl.toLowerCase().includes('.ppt');

      const matchesOldPretext = ctaPretext.includes(OLD_DOCUMENT_CTA_PRETEXT_KEYWORD) || ctaPretext.includes('SmartSapp Online Visibility Program');
      const matchesOldCtaText = ctaText === OLD_DOCUMENT_CTA_TEXT || ctaText.toLowerCase().includes('make my school visible');
      const uploadedAfterOct18 = createdAt >= oct18Timestamp || createdAt === 0;

      return (isDocumentAsset || matchesOldPretext || matchesOldCtaText) && (uploadedAfterOct18 || matchesOldPretext || matchesOldCtaText);
    });

    interface PendingUpdate {
      ref: FirebaseFirestore.DocumentReference;
      ctaPretext: string;
      ctaText: string;
    }

    const pendingUpdates: PendingUpdate[] = [];

    for (const docSnap of candidateDocs) {
      processed++;
      const data = docSnap.data();
      const currentCtaPretext = (data.ctaPretext || '') as string;
      const currentCtaText = (data.ctaText || '') as string;

      if (currentCtaPretext !== NEW_DOCUMENT_CTA_PRETEXT || currentCtaText !== NEW_DOCUMENT_CTA_TEXT) {
        pendingUpdates.push({
          ref: docSnap.ref,
          ctaPretext: NEW_DOCUMENT_CTA_PRETEXT,
          ctaText: NEW_DOCUMENT_CTA_TEXT,
        });
        updated++;
      }
    }

    const BATCH_SIZE = 150;
    for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
      const chunk = pendingUpdates.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      chunk.forEach((item) => {
        batch.update(item.ref, {
          ctaPretext: item.ctaPretext,
          ctaText: item.ctaText,
          updatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();
    }

    return {
      success: true,
      processed,
      updated,
      message: `Successfully backfilled ${updated} document share pages (Inspected: ${processed}).`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error running backfill action:', errorMsg);
    return {
      success: false,
      processed: 0,
      updated: 0,
      message: `Backfill failed: ${errorMsg}`,
    };
  }
}
