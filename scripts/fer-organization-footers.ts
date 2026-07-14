#!/usr/bin/env tsx
// @ts-nocheck
/**
 * Migration Script: FER Protocol - Organization Footers Unsubscribe Link Integration
 *
 * Usage:
 *   npx tsx scripts/fer-organization-footers.ts
 *   DRY_RUN=true npx tsx scripts/fer-organization-footers.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 400;
const NOW = new Date().toISOString();
const BACKUP_DIR = '/Users/josephaidoo/.gemini/antigravity/brain/d0f55683-6b15-4422-8e95-a4720e271a50/scratch';

interface MigrationStats {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; name: string; error: string }>;
}

const DEFAULT_FOOTER = `<div style="font-family: 'Figtree', sans-serif; font-size: 12px; line-height: 1.5; color: #64748b; text-align: center; max-width: 600px; margin: 0 auto; padding: 20px 0;">
  <p>© ${new Date().getFullYear()} {{org_name}}. All rights reserved.</p>
  <p>You received this email because you are registered with our services.</p>
  <p style="margin-top: 10px;">If you wish to stop receiving these emails, you can <a href="{{unsubscribe_link}}" style="color: #3B5FFF; text-decoration: underline; font-weight: 600;">unsubscribe here</a>.</p>
</div>`;

const UNSUBSCRIBE_SUFFIX = `<div style="margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; text-align: center; color: #94a3b8;">No longer want to receive these emails? <a href="{{unsubscribe_link}}" style="color: #3B5FFF; text-decoration: underline; font-weight: 600;">Unsubscribe here</a></div>`;

async function run() {
  console.log(`🚀 Starting Organization & Style Footers Enrichment (FER Protocol)${DRY_RUN ? ' [DRY RUN]' : ''}...`);

  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    // ── Part A: Enrich Organizations ──
    const orgsSnapshot = await adminDb.collection('organizations').get();
    stats.total += orgsSnapshot.size;

    const backupOrgs: Record<string, any> = {};
    const orgUpdates: Array<{ id: string; footerHtml: string }> = [];

    for (const doc of orgsSnapshot.docs) {
      const data = doc.data();
      backupOrgs[doc.id] = data;

      const currentFooter = data.footerHtml || '';
      if (!currentFooter.trim()) {
        orgUpdates.push({
          id: doc.id,
          footerHtml: DEFAULT_FOOTER
        });
      } else if (!currentFooter.includes('{{unsubscribe_link}}')) {
        orgUpdates.push({
          id: doc.id,
          footerHtml: `${currentFooter}\n${UNSUBSCRIBE_SUFFIX}`
        });
      } else {
        stats.skipped++;
      }
    }

    // ── Part B: Enrich Style Overrides ──
    const stylesSnapshot = await adminDb.collection('message_styles').get();
    stats.total += stylesSnapshot.size;

    const backupStyles: Record<string, any> = {};
    const styleUpdates: Array<{ id: string; footerHtml: string }> = [];

    for (const doc of stylesSnapshot.docs) {
      const data = doc.data();
      backupStyles[doc.id] = data;

      const currentFooter = data.footerHtml || '';
      if (currentFooter.trim() && !currentFooter.includes('{{unsubscribe_link}}')) {
        styleUpdates.push({
          id: doc.id,
          footerHtml: `${currentFooter}\n${UNSUBSCRIBE_SUFFIX}`
        });
      } else {
        stats.skipped++;
      }
    }

    // Write Backups
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = Date.now();
    fs.writeFileSync(path.join(BACKUP_DIR, `organizations_backup_${timestamp}.json`), JSON.stringify(backupOrgs, null, 2), 'utf-8');
    fs.writeFileSync(path.join(BACKUP_DIR, `styles_backup_${timestamp}.json`), JSON.stringify(backupStyles, null, 2), 'utf-8');
    console.log(`✅ Backups successfully saved to: ${BACKUP_DIR}`);

    const totalUpdates = orgUpdates.length + styleUpdates.length;
    if (totalUpdates === 0) {
      console.log('✨ All organization and style footers are already enriched. No updates needed.');
      printSummary(stats);
      return;
    }

    console.log(`📦 Preparing to enrich ${orgUpdates.length} organizations and ${styleUpdates.length} style footers...`);

    // 3. Restore
    if (DRY_RUN) {
      console.log('⚠️ [DRY RUN] Skipping actual write operations.');
      stats.updated = totalUpdates;
    } else {
      let batch = adminDb.batch();
      let opCount = 0;

      // Update Orgs
      for (const update of orgUpdates) {
        const docRef = adminDb.collection('organizations').doc(update.id);
        batch.update(docRef, {
          footerHtml: update.footerHtml,
          updatedAt: NOW
        });

        opCount++;
        if (opCount === BATCH_SIZE) {
          await batch.commit();
          stats.updated += opCount;
          batch = adminDb.batch();
          opCount = 0;
        }
      }

      // Update Styles
      for (const update of styleUpdates) {
        const docRef = adminDb.collection('message_styles').doc(update.id);
        batch.update(docRef, {
          footerHtml: update.footerHtml,
          updatedAt: NOW
        });

        opCount++;
        if (opCount === BATCH_SIZE) {
          await batch.commit();
          stats.updated += opCount;
          batch = adminDb.batch();
          opCount = 0;
        }
      }

      if (opCount > 0) {
        await batch.commit();
        stats.updated += opCount;
      }
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    stats.failed = stats.total - stats.updated - stats.skipped;
  }

  printSummary(stats);
}

function printSummary(stats: MigrationStats) {
  console.log('\n📊 --- Migration Summary ---');
  console.log(`  Total Organizations: ${stats.total}`);
  console.log(`  Updated/Enriched   : ${stats.updated}`);
  console.log(`  Skipped (Existing) : ${stats.skipped}`);
  console.log(`  Failed             : ${stats.failed}`);
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(err => {
      console.log(`  - Org ID ${err.id} (${err.name}): ${err.error}`);
    });
  }
  console.log('----------------------------\n');
}

run().catch(console.error);
