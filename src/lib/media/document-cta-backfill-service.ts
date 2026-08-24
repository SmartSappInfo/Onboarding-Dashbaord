/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document CTA Text Migration:
 *    Idempotent Fetch-Enrich-Restore backfill protocol to update CTA Pretext and Button Text
 *    across all document share pages (`media_shares`) uploaded from 18th October to date.
 * 2. Exact Text Transformations:
 *    - CTA Pretext: "Are you interested in fixing the critical issues identified in your online prsence audit report? Our team is available to assist you to do just that.\n\nClick to Schedule a review meeting with our team"
 *    - CTA Button Text: "Book Meeting Now" (replacing "Make My School Visible").
 * 3. Chunked Batch Write Safety:
 *    Commits updates in strict chunks of 150 operations per writeBatch to prevent Firestore
 *    batch processing overload or memory exhaustion.
 * 4. Touch Target & Strict Typing:
 *    All interfaces and Firestore queries are strictly typed with zero `any`/`any[]`.
 */

import { collection, getDocs, writeBatch, doc as docRef, type Firestore } from 'firebase/firestore';

export const NEW_DOCUMENT_CTA_PRETEXT = `Are you interested in fixing the critical issues identified in your online prsence audit report? Our team is available to assist you to do just that.

Click to Schedule a review meeting with our team`;

export const NEW_DOCUMENT_CTA_TEXT = 'Book Meeting Now';

export const OLD_DOCUMENT_CTA_TEXT = 'Make My School Visible';

export const OLD_DOCUMENT_CTA_PRETEXT_KEYWORD = 'Discover the opportunities your school may be missing online';

export interface DocumentCtaBackfillProgressReport {
  processed: number;
  updated: number;
  errors: number;
  message: string;
}

export interface DocumentCtaBackfillResult {
  processed: number;
  updated: number;
  errors: number;
}

/**
 * Runs the Fetch-Enrich-Restore protocol for document CTA pretext and button text updates.
 */
export async function backfillDocumentCtaTexts(
  firestore: Firestore,
  workspaceId?: string,
  onProgress?: (report: DocumentCtaBackfillProgressReport) => void
): Promise<DocumentCtaBackfillResult> {
  if (!firestore) {
    return { processed: 0, updated: 0, errors: 0 };
  }

  let processed = 0;
  let updated = 0;
  let errors = 0;

  onProgress?.({
    processed: 0,
    updated: 0,
    errors: 0,
    message: 'Scanning media_shares collection for document share pages...',
  });

  try {
    const sharesRef = collection(firestore, 'media_shares');
    const sharesSnap = await getDocs(sharesRef);
    const allShares = sharesSnap.docs;

    // Filter candidate document shares (created on/after Oct 18, 2025 or matching old CTA strings/documents)
    const oct18Timestamp = new Date('2025-10-18T00:00:00Z').getTime();

    const candidateDocs = allShares.filter((docSnap) => {
      const data = docSnap.data();
      const assetUrl = (data.assetUrl || data.url || '') as string;
      const assetType = (data.assetType || data.type || '') as string;
      const ctaText = (data.ctaText || '') as string;
      const ctaPretext = (data.ctaPretext || '') as string;
      const createdAt = data.createdAt ? new Date(data.createdAt.seconds ? data.createdAt.seconds * 1000 : data.createdAt).getTime() : 0;

      const isDocumentAsset = assetType === 'document' ||
        assetUrl.toLowerCase().includes('.pdf') ||
        assetUrl.toLowerCase().includes('.doc') ||
        assetUrl.toLowerCase().includes('.ppt');

      const matchesOldPretext = ctaPretext.includes(OLD_DOCUMENT_CTA_PRETEXT_KEYWORD) || ctaPretext.includes('SmartSapp Online Visibility Program');
      const matchesOldCtaText = ctaText === OLD_DOCUMENT_CTA_TEXT || ctaText.toLowerCase().includes('make my school visible');
      const uploadedAfterOct18 = createdAt >= oct18Timestamp || createdAt === 0;

      // Update if it's a document and either uploaded after Oct 18 or matching old pretext/button text
      return (isDocumentAsset || matchesOldPretext || matchesOldCtaText) && (uploadedAfterOct18 || matchesOldPretext || matchesOldCtaText);
    });

    if (candidateDocs.length === 0) {
      onProgress?.({
        processed: allShares.length,
        updated: 0,
        errors: 0,
        message: 'No document share records requiring CTA text updates were found.',
      });
      return { processed: allShares.length, updated: 0, errors: 0 };
    }

    interface PendingShareUpdate {
      shareId: string;
      ctaPretext: string;
      ctaText: string;
    }

    const pendingUpdates: PendingShareUpdate[] = [];

    for (const docSnap of candidateDocs) {
      processed++;
      const data = docSnap.data();
      const currentCtaPretext = (data.ctaPretext || '') as string;
      const currentCtaText = (data.ctaText || '') as string;

      const needsPretextUpdate = currentCtaPretext !== NEW_DOCUMENT_CTA_PRETEXT;
      const needsCtaTextUpdate = currentCtaText !== NEW_DOCUMENT_CTA_TEXT;

      if (needsPretextUpdate || needsCtaTextUpdate) {
        pendingUpdates.push({
          shareId: docSnap.id,
          ctaPretext: NEW_DOCUMENT_CTA_PRETEXT,
          ctaText: NEW_DOCUMENT_CTA_TEXT,
        });
        updated++;
      }

      onProgress?.({
        processed,
        updated,
        errors,
        message: `Inspected ${processed}/${candidateDocs.length} document share pages...`,
      });
    }

    // Restore: Commit updates in strict chunks of 150 operations per batch
    const BATCH_SIZE = 150;
    for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
      const chunk = pendingUpdates.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(firestore);

      chunk.forEach((item) => {
        const shareRef = docRef(firestore, 'media_shares', item.shareId);
        batch.update(shareRef, {
          ctaPretext: item.ctaPretext,
          ctaText: item.ctaText,
          updatedAt: new Date().toISOString(),
        });
      });

      await batch.commit();
    }

    onProgress?.({
      processed,
      updated,
      errors: 0,
      message: `Fetch-Enrich-Restore complete! Successfully updated CTA text on ${updated} document records.`,
    });

    return { processed, updated, errors };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error executing Document CTA Backfill:', errorMsg);
    onProgress?.({
      processed,
      updated,
      errors: errors + 1,
      message: `Backfill encountered error: ${errorMsg}`,
    });
    return { processed, updated, errors: errors + 1 };
  }
}
