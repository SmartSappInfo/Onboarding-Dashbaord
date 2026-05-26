/**
 * Idempotent migration: legacy school automation triggers/actions → entity model.
 *
 * Usage:
 *   npx tsx scripts/migrate-automation-triggers.ts --dry-run   # preview only
 *   npx tsx scripts/migrate-automation-triggers.ts             # apply writes
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Firebase admin env.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const TRIGGER_MAP: Record<string, string> = {
  SCHOOL_CREATED: 'ENTITY_CREATED',
  SCHOOL_STAGE_CHANGED: 'ENTITY_STAGE_CHANGED',
};

const ACTION_MAP: Record<string, string> = {
  UPDATE_SCHOOL: 'UPDATE_ENTITY',
};

const dryRun = process.argv.includes('--dry-run');

function migrateNodeData(data: Record<string, unknown>): boolean {
  let changed = false;
  if (typeof data.trigger === 'string' && TRIGGER_MAP[data.trigger]) {
    data.trigger = TRIGGER_MAP[data.trigger];
    changed = true;
  }
  if (typeof data.actionType === 'string' && ACTION_MAP[data.actionType]) {
    data.actionType = ACTION_MAP[data.actionType];
    changed = true;
  }
  const config = data.config as Record<string, unknown> | undefined;
  if (config?.contactType) {
    if (config.contactType === 'school') config.entityType = 'institution';
    if (config.contactType === 'prospect') config.entityType = 'person';
    delete config.contactType;
    changed = true;
  }
  return changed;
}

async function main() {
  if (dryRun) {
    console.log('DRY RUN — no documents will be modified.\n');
  }

  if (!getApps().length) {
    initializeApp();
  }
  const db = getFirestore();
  const snap = await db.collection('automations').get();
  let wouldUpdate = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    let docChanged = false;
    const updates: Record<string, unknown> = {};

    if (typeof data.trigger === 'string' && TRIGGER_MAP[data.trigger]) {
      updates.trigger = TRIGGER_MAP[data.trigger];
      docChanged = true;
    }

    const nodes = Array.isArray(data.nodes) ? [...data.nodes] : [];
    for (const node of nodes) {
      if (node?.data && migrateNodeData(node.data)) docChanged = true;
    }
    if (nodes.length) updates.nodes = nodes;

    if (docChanged) {
      wouldUpdate++;
      const label = `${doc.id} (${data.name})`;
      if (dryRun) {
        console.log(`Would migrate: ${label}`);
        if (updates.trigger) console.log(`  trigger → ${updates.trigger}`);
      } else {
        updates.schemaVersion = 2;
        updates.updatedAt = new Date().toISOString();
        await doc.ref.update(updates);
        console.log(`Migrated automation: ${label}`);
      }
    }
  }

  console.log(
    `\n${dryRun ? 'Would update' : 'Updated'} ${wouldUpdate} of ${snap.size} automations.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
