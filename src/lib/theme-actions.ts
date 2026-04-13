'use server';

import { adminDb } from './firebase-admin';
import type { CampaignPageTheme } from './types';

/**
 * Saves or updates a Campaign Page Theme.
 */
export async function saveThemeAction(theme: CampaignPageTheme) {
    try {
        await adminDb.collection('campaign_page_themes').doc(theme.id).set(theme, { merge: true });
        return { success: true };
    } catch (e: any) {
        console.error(">>> [THEME] Save Failed:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Fetches all global or organization-specific themes.
 */
export async function getThemesAction(organizationId: string) {
    try {
        const snap = await adminDb.collection('campaign_page_themes')
            .where('organizationId', 'in', ['system', organizationId])
            .get();
        
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignPageTheme));
    } catch (e) {
        console.error(">>> [THEME] Fetch Failed:", e);
        return [];
    }
}
