// @ts-nocheck
/**
 * Backfill Style-specific Logo and Footer settings from Organization Defaults
 *
 * Scans all visual wrapper styles (`message_styles` collection) in Firestore.
 * For each style, fetches its parent organization's default settings and enriches
 * the style wrapper document with the organization's logoUrl, footerHtml, and
 * footerEnabled status if they are not already defined.
 *
 * Usage:
 *   npx tsx scripts/migrate-style-footers.ts            # Dry run (safe, read-only)
 *   npx tsx scripts/migrate-style-footers.ts --apply    # Write changes to database
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load local configuration environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

if (getApps().length === 0) {
  let credentialJson: any;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      credentialJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON, trying fallback file...");
    }
  }

  if (!credentialJson) {
    // Fallback to serviceAccountKey.json file in root
    const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      credentialJson = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    } else {
      throw new Error('No service account key found in env or serviceAccountKey.json');
    }
  }

  initializeApp({
    credential: cert(credentialJson),
  });
}

const db = getFirestore();

async function main() {
  const APPLY = process.argv.includes('--apply');
  console.log('=== Message Style Branding & Footer Enrichment ===');
  console.log(`Mode: ${APPLY ? '🔴 LIVE RUN (APPLYING CHANGES)' : '🟡 DRY RUN (READ ONLY)'}`);
  if (!APPLY) {
    console.log('To write changes to the database, run with: --apply\n');
  }

  try {
    // 1. Fetch all style documents
    console.log('Fetching message styles...');
    const stylesSnap = await db.collection('message_styles').get();
    console.log(`Found ${stylesSnap.size} style wrapper documents.\n`);

    let scannedCount = 0;
    let enrichedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Cache organization data to avoid redundant Firestore reads
    const orgCache = new Map<string, any>();

    for (const styleDoc of stylesSnap.docs) {
      scannedCount++;
      const styleId = styleDoc.id;
      const styleData = styleDoc.data();
      const orgId = styleData.organizationId;
      const styleName = styleData.name || 'Unnamed Style';

      if (!orgId) {
        console.log(`[SKIPPED] "${styleName}" (${styleId}) - No organization ID associated.`);
        skippedCount++;
        continue;
      }

      // Resolve organization details
      let orgData = orgCache.get(orgId);
      if (orgData === undefined) {
        const orgDoc = await db.collection('organizations').doc(orgId).get();
        if (orgDoc.exists) {
          orgData = orgDoc.data();
          orgCache.set(orgId, orgData);
        } else {
          orgData = null;
          orgCache.set(orgId, null);
        }
      }

      if (!orgData) {
        console.log(`[WARNING] "${styleName}" (${styleId}) - Organization document "${orgId}" not found.`);
        failedCount++;
        continue;
      }

      // Check organization branding & footer settings
      const orgLogoUrl = orgData.logoUrl || '';
      const orgFooterHtml = orgData.footerHtml || '';
      const orgFooterEnabled = orgData.footerEnabled !== false; // default true

      // Determine changes
      const updates: Record<string, any> = {};

      if (styleData.logoUrl === undefined) {
        updates.logoUrl = orgLogoUrl;
      }
      if (styleData.footerHtml === undefined) {
        updates.footerHtml = orgFooterHtml;
      }
      if (styleData.footerEnabled === undefined) {
        updates.footerEnabled = orgFooterEnabled;
      }

      const hasChanges = Object.keys(updates).length > 0;

      if (!hasChanges) {
        console.log(`[NO CHANGE] "${styleName}" (${styleId}) - Already contains override fields.`);
        skippedCount++;
        continue;
      }

      console.log(`[ENRICHING] "${styleName}" (${styleId}) for Org "${orgData.name || orgId}":`);
      if (updates.logoUrl !== undefined) {
        console.log(`  + logoUrl: "${updates.logoUrl}"`);
      }
      if (updates.footerHtml !== undefined) {
        const snippet = updates.footerHtml.length > 60 
          ? `${updates.footerHtml.substring(0, 60)}...` 
          : updates.footerHtml;
        console.log(`  + footerHtml: "${snippet}"`);
      }
      if (updates.footerEnabled !== undefined) {
        console.log(`  + footerEnabled: ${updates.footerEnabled}`);
      }

      enrichedCount++;

      if (APPLY) {
        await db.collection('message_styles').doc(styleId).update(updates);
        console.log(`  ✓ Updated in database`);
      }
    }

    console.log('\n=== Enrichment Summary ===');
    console.log(`Total styles scanned: ${scannedCount}`);
    console.log(`Total styles enriched: ${enrichedCount}`);
    console.log(`Total styles skipped/no change: ${skippedCount}`);
    console.log(`Total failed lookups: ${failedCount}`);
    
    if (!APPLY && enrichedCount > 0) {
      console.log('\nDry run completed. Run with "--apply" to commit these changes.');
    } else {
      console.log('\nEnrichment run completed.');
    }
    process.exit(0);
  } catch (error: any) {
    console.error('Migration error:', error.message);
    process.exit(1);
  }
}

main();
