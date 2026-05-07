'use server';

import { adminDb } from '@/lib/firebase-admin';

/**
 * @fileOverview One-time migration script for Phase 1: Template Taxonomy & Dynamic Branding.
 * 
 * This action backfills existing templates with:
 * 1. `target`: 'external_client' (default for all existing templates)
 * 2. `contentMode`: inferred from existing data:
 *    - 'rich_builder' if blocks[] exists and has items
 *    - 'plain_text' for SMS
 *    - 'html_code' for email without blocks
 * 3. `status`: migrated from old lifecycle:
 *    - 'approved' → 'active'
 *    - 'pending_approval' / 'rejected' → 'draft'
 *    - 'archived' → 'archived' (no change)
 *    - 'draft' → 'draft' (no change)
 * 4. Removes deprecated `isActive` by setting it to align with new status
 * 
 * IMPORTANT: Run this ONCE via the backoffice admin panel.
 * Idempotent — safe to re-run (only updates docs missing the new fields).
 */

interface MigrationResult {
  total: number;
  updated: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

export async function migrateTemplatesTaxonomy(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const snapshot = await adminDb.collection('message_templates').get();
  result.total = snapshot.size;

  const batch = adminDb.batch();
  let batchCount = 0;
  const MAX_BATCH = 400; // Firestore limit is 500, leave headroom

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip if already migrated (has target field)
    if (data.target && data.contentMode) {
      result.skipped++;
      continue;
    }

    try {
      const updates: Record<string, any> = {};

      // 1. Backfill target
      if (!data.target) {
        updates.target = 'external_client';
      }

      // 2. Backfill contentMode
      if (!data.contentMode) {
        if (data.channel === 'sms') {
          updates.contentMode = 'plain_text';
        } else if (data.blocks && Array.isArray(data.blocks) && data.blocks.length > 0) {
          updates.contentMode = 'rich_builder';
        } else if (data.channel === 'email') {
          // Check if body contains HTML tags
          const hasHtml = /<[a-z][\s\S]*>/i.test(data.body || '');
          updates.contentMode = hasHtml ? 'html_code' : 'plain_text';
        } else {
          updates.contentMode = 'plain_text';
        }
      }

      // 3. Migrate status
      const oldStatus = data.status;
      if (oldStatus === 'approved') {
        updates.status = 'active';
        updates.isActive = true;
      } else if (oldStatus === 'pending_approval' || oldStatus === 'rejected') {
        updates.status = 'draft';
        updates.isActive = false;
      } else if (oldStatus === 'archived') {
        updates.isActive = false;
      } else if (oldStatus === 'draft') {
        updates.isActive = false;
      }
      // If status is already 'active' or 'draft' or 'archived', no change needed

      // 4. Ensure isActive aligns with status
      if (updates.status === 'active') {
        updates.isActive = true;
      } else if (updates.status === 'draft' || updates.status === 'archived') {
        updates.isActive = false;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString();
        batch.update(doc.ref, updates);
        batchCount++;
        result.updated++;

        // Commit in chunks to stay within Firestore limits
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batchCount = 0;
        }
      } else {
        result.skipped++;
      }
    } catch (e) {
      result.errors.push({
        id: doc.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`>>> [MIGRATION] Template taxonomy migration complete:`, result);
  return result;
}
