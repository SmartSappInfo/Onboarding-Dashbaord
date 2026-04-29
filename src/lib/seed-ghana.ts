'use server';

/**
 * Seeds the `regions` and `districts` collections for a specific organization
 * using the scraped Ghana regions and districts data.
 */

import { adminDb } from './firebase-admin';
import ghanaData from '@/data/ghana_regions_districts.json';

export async function seedGhanaLocationsAction(organizationId: string) {
  try {
    if (!organizationId) {
      return { success: false, error: 'Organization ID is required to seed locations.' };
    }

    const countryId = 'GH'; // ISO code for Ghana
    let seededRegions = 0;
    let seededDistricts = 0;

    // Check if any regions for Ghana already exist in this organization
    const existingRegionsSnap = await adminDb.collection('regions')
      .where('organizationId', '==', organizationId)
      .where('countryId', '==', countryId)
      .limit(1)
      .get();
      
    if (!existingRegionsSnap.empty) {
      return { 
        success: true, 
        message: 'Ghana regions are already seeded for this organization. Skipping to prevent duplicates.',
        seededRegions: 0,
        seededDistricts: 0
      };
    }

    const batch = adminDb.batch();
    let opsCount = 0;

    for (const regionData of ghanaData) {
      // 1. Create Region
      const regionRef = adminDb.collection('regions').doc();
      batch.set(regionRef, {
        name: regionData.region,
        countryId,
        organizationId,
      });
      seededRegions++;
      opsCount++;

      // 2. Create Districts for this Region
      for (const districtName of regionData.districts) {
        const districtRef = adminDb.collection('districts').doc();
        batch.set(districtRef, {
          name: districtName,
          regionId: regionRef.id,
          organizationId,
        });
        seededDistricts++;
        opsCount++;

        // Commit and reset batch if approaching limit (Firestore batch limit is 500 ops)
        if (opsCount >= 450) {
          await batch.commit();
          opsCount = 0;
        }
      }
    }

    // Commit any remaining operations
    if (opsCount > 0) {
      await batch.commit();
    }

    return { 
      success: true, 
      message: `Successfully seeded ${seededRegions} regions and ${seededDistricts} districts.`,
      seededRegions,
      seededDistricts 
    };
  } catch (error: any) {
    console.error('[SEED:GHANA_LOCATIONS] Failed:', error.message);
    return { success: false, error: error.message };
  }
}
