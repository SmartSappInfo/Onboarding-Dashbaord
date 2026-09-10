'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

/**
 * Analytics Actions for Requirement 15.10: Performance Tracking
 * 
 * Provides server actions for recording page views, unique visits, and block interactions
 * using performant Firestore atomic increments.
 */

/**
 * Records a page view and checks for uniqueness.
 * @param pageId The campaign page ID
 * @param isUnique Whether this is a new visitor session
 */
export async function recordPageViewAction(pageId: string, isUnique: boolean) {
    try {
        const pageRef = adminDb.collection('campaign_pages').doc(pageId);
        
        const updates: any = {
            'stats.views': FieldValue.increment(1),
            updatedAt: new Date().toISOString()
        };

        if (isUnique) {
            updates['stats.uniques'] = FieldValue.increment(1);
        }

        await pageRef.update(updates);
        return { success: true };
    } catch (error: unknown) {
        console.error(">>> [ANALYTICS:VIEW] Failed:", getErrorMessage(error));
        return { success: false, error: getErrorMessage(error) };
    }
}

/**
 * Records a generic interaction on the page (e.g., CTA click).
 * @param pageId The campaign page ID
 * @param blockId (Optional) The specific block ID interacted with
 */
export async function recordInteractionAction(pageId: string, blockId?: string) {
    try {
        const pageRef = adminDb.collection('campaign_pages').doc(pageId);
        
        await pageRef.update({
            'stats.clicks': FieldValue.increment(1),
            updatedAt: new Date().toISOString()
        });

        // If block-specific tracking is needed in the future, 
        // we could log to a subcollection or increment a map here.
        
        return { success: true };
    } catch (error: unknown) {
        console.error(">>> [ANALYTICS:INTERACTION] Failed:", getErrorMessage(error));
        return { success: false, error: getErrorMessage(error) };
    }
}

/**
 * (Internal Helper) Records a conversion when a form or survey is submitted.
 * Typically called from within other server actions.
 */
export async function recordConversion(pageId: string) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    try {
        const pageRef = adminDb.collection('campaign_pages').doc(pageId);
        await pageRef.update({
            'stats.conversions': FieldValue.increment(1),
            updatedAt: new Date().toISOString()
        });
    } catch (error: unknown) {
        console.error(">>> [ANALYTICS:CONVERSION] Failed to record:", getErrorMessage(error));
    }
}
