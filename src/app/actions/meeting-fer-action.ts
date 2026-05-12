'use server';

import { adminDb } from '@/lib/firebase-admin';

interface MeetingFerResult {
  success: boolean;
  totalMeetings: number;
  enriched: number;
  skipped: number;
  error?: string;
}

/**
 * FER Protocol: Meeting Infrastructure Modernization
 * 
 * Fetches all meetings, enriches them with:
 * - personalizedJoinPath (the /join route for the waiting room)
 * - registrationEnabled defaults
 * - meetingSlug normalization
 * 
 * Then restores the enriched data via batch writes.
 */
export async function executeMeetingFerAction(): Promise<MeetingFerResult> {
  try {
    // ── FETCH ──
    const meetingsSnap = await adminDb.collection('meetings').get();
    
    if (meetingsSnap.empty) {
      return { success: true, totalMeetings: 0, enriched: 0, skipped: 0 };
    }

    const batch = adminDb.batch();
    let enriched = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const doc of meetingsSnap.docs) {
      const data = doc.data();
      const updates: Record<string, any> = {};
      let needsUpdate = false;

      // ── ENRICH ──

      // 1. Ensure meetingSlug exists
      if (!data.meetingSlug && data.entitySlug) {
        updates.meetingSlug = data.entitySlug.toLowerCase();
        needsUpdate = true;
      }

      // 2. Ensure registrationEnabled is explicitly set
      if (data.registrationEnabled === undefined) {
        updates.registrationEnabled = false;
        needsUpdate = true;
      }

      // 3. Ensure heroLayout default
      if (!data.heroLayout) {
        updates.heroLayout = data.registrationEnabled ? 'form' : 'image';
        needsUpdate = true;
      }

      // 4. Ensure bannerType default
      if (!data.bannerType) {
        updates.bannerType = 'none';
        needsUpdate = true;
      }

      // 5. Ensure brandingEnabled default
      if (data.brandingEnabled === undefined) {
        updates.brandingEnabled = true;
        needsUpdate = true;
      }

      // 6. Enrich existing registrants with joinPageUrl if missing
      // (This is done separately below for subcollections)

      if (needsUpdate) {
        updates.ferEnrichedAt = now;
        updates.ferVersion = 'v3-join-page';
        batch.update(doc.ref, updates);
        enriched++;
      } else {
        skipped++;
      }
    }

    // ── RESTORE ──
    if (enriched > 0) {
      await batch.commit();
    }

    // ── ENRICH REGISTRANTS (subcollection pass) ──
    // Update registrant personalizedMeetingUrl to use the /join route
    let registrantsUpdated = 0;
    const registrantBatch = adminDb.batch();
    let batchCount = 0;

    for (const meetingDoc of meetingsSnap.docs) {
      const meetingData = meetingDoc.data();
      const typeSlug = meetingData.type?.slug || 'parent-engagement';
      const slug = meetingData.meetingSlug || meetingData.entitySlug || '';
      
      if (!slug) continue;

      const registrantsSnap = await adminDb
        .collection('meetings')
        .doc(meetingDoc.id)
        .collection('registrants')
        .get();

      for (const regDoc of registrantsSnap.docs) {
        const regData = regDoc.data();
        const token = regData.token;
        
        if (!token) continue;

        // Check if URL already points to /join
        const currentUrl = regData.personalizedMeetingUrl || '';
        if (currentUrl.includes('/join?token=')) continue;

        // Build the new join URL (relative — will be resolved by the client)
        const newUrl = `/meetings/${typeSlug}/${slug}/join?token=${token}`;
        
        registrantBatch.update(regDoc.ref, {
          personalizedMeetingUrl: newUrl,
          ferEnrichedAt: now,
        });
        registrantsUpdated++;
        batchCount++;

        // Firestore batch limit is 500
        if (batchCount >= 450) {
          await registrantBatch.commit();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await registrantBatch.commit();
    }

    console.log(`✅ Meeting FER: ${enriched} enriched, ${skipped} skipped, ${registrantsUpdated} registrants updated.`);

    return {
      success: true,
      totalMeetings: meetingsSnap.size,
      enriched,
      skipped,
    };
  } catch (error: any) {
    console.error('❌ Meeting FER failed:', error.message);
    return {
      success: false,
      totalMeetings: 0,
      enriched: 0,
      skipped: 0,
      error: error.message,
    };
  }
}
