'use server';

/**
 * Seeds the global `countries` collection from the bundled countries.json.
 * Uses the ISO code as document ID for idempotency.
 */

import { adminDb } from './firebase-admin';
import countriesData from '@/data/countries.json';

export async function seedCountriesAction() {
  try {
    // Check if already seeded
    const existingSnap = await adminDb.collection('countries').limit(1).get();
    if (!existingSnap.empty) {
      const countSnap = await adminDb.collection('countries').count().get();
      const existingCount = countSnap.data().count;
      return { success: true, seeded: 0, total: existingCount, message: `Already seeded (${existingCount} countries)` };
    }

    // Batch write in chunks of 500 (Firestore limit)
    const BATCH_SIZE = 500;
    let seeded = 0;

    for (let i = 0; i < countriesData.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const chunk = countriesData.slice(i, i + BATCH_SIZE);

      for (const country of chunk) {
        const ref = adminDb.collection('countries').doc(country.code);
        batch.set(ref, {
          name: country.name,
          code: country.code,
          flag: country.flag,
          dialCode: country.dialCode || null,
        });
        seeded++;
      }

      await batch.commit();
    }

    return { success: true, seeded, total: seeded, message: `Seeded ${seeded} countries` };
  } catch (e: any) {
    console.error('[SEED:COUNTRIES] Failed:', e.message);
    return { success: false, seeded: 0, total: 0, error: e.message };
  }
}
