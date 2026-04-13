'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';

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
    } catch (error: any) {
        console.error(">>> [ANALYTICS:VIEW] Failed:", error.message);
        return { success: false, error: error.message };
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
    } catch (error: any) {
        console.error(">>> [ANALYTICS:INTERACTION] Failed:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * (Internal Helper) Records a conversion when a form or survey is submitted.
 * Typically called from within other server actions.
 */
export async function recordConversion(pageId: string) {
    try {
        const pageRef = adminDb.collection('campaign_pages').doc(pageId);
        await pageRef.update({
            'stats.conversions': FieldValue.increment(1),
            updatedAt: new Date().toISOString()
        });
    } catch (error: any) {
        console.error(">>> [ANALYTICS:CONVERSION] Failed to record:", error.message);
    }
}
