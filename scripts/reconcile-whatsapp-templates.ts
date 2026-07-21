/**
 * Reconcile WhatsApp sendable templates.
 *
 * Earlier builds enabled an approved template by DELETING the document the user
 * authored and minting a replacement with a deterministic `wa_<id>` id. The
 * replacement carried no `workspaceIds`, and workspace-scoped queries filter on
 * `workspaceIds array-contains`, so those templates went live and simultaneously
 * disappeared from the workspace that created them. Duplicates could also
 * accumulate when both the manual and automatic paths ran.
 *
 * This script repairs that history. It is idempotent and DRY-RUN BY DEFAULT.
 *
 *   Fetch    every message_templates document with channel == 'whatsapp',
 *            grouped by organizationId + whatsappTemplateName
 *   Enrich   backfill appCategory / templateType / whatsappParamMap from the
 *            whatsapp_templates mirror where the document is missing them
 *   Restore  re-attach workspaceIds to unscoped documents, taken from a sibling
 *            in the same group (the authored document usually still has them)
 *   Dedupe   keep one canonical document per group and ARCHIVE the rest
 *            (status: 'archived' + reconciledAt) — nothing is ever hard-deleted
 *
 * Usage:
 *   pnpm reconcile:whatsapp-templates            # dry run, prints a report
 *   pnpm reconcile:whatsapp-templates --apply    # writes changes
 *   pnpm reconcile:whatsapp-templates --apply --org=<organizationId>
 */
import * as dotenv from 'dotenv';
// Type-only imports are erased at runtime, so they cannot trigger module
// initialisation before the environment is loaded.
import type { MessageTemplate } from '../src/lib/types';
import type { WhatsAppTemplate } from '../src/lib/whatsapp/whatsapp-types';

// Next loads .env.local automatically; a plain tsx script does not, and the Admin
// SDK reads FIREBASE_SERVICE_ACCOUNT_PATH at import time. ES module imports are
// hoisted above statements, so firebase-admin is imported dynamically *after*
// this runs — importing it statically would initialise it with an empty env.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

type AdminDb = typeof import('../src/lib/firebase-admin')['adminDb'];

/** Firestore allows 500 operations per batch; stay comfortably under it. */
const MAX_BATCH_OPS = 400;

interface Candidate {
  id: string;
  data: Partial<MessageTemplate>;
}

interface PlannedWrite {
  id: string;
  patch: Record<string, unknown>;
  reason: string;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const orgArg = argv.find((a) => a.startsWith('--org='));
  return {
    apply: argv.includes('--apply'),
    org: orgArg ? orgArg.slice('--org='.length) : undefined,
  };
}

/**
 * Choose the document to keep: prefer one that still has workspace scoping, then
 * the one that is not a machine-minted `wa_` replacement, then the oldest.
 */
function pickCanonical(group: Candidate[]): Candidate {
  const score = (c: Candidate): number => {
    let s = 0;
    if ((c.data.workspaceIds?.length ?? 0) > 0) s += 4;
    if (!c.id.startsWith('wa_')) s += 2;
    return s;
  };
  return [...group].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return String(a.data.createdAt ?? '').localeCompare(String(b.data.createdAt ?? ''));
  })[0];
}

async function main() {
  const { apply, org } = parseArgs();
  console.log(`\nReconcile WhatsApp templates — ${apply ? 'APPLY' : 'DRY RUN'}${org ? ` (org: ${org})` : ''}\n`);

  const { adminDb }: { adminDb: AdminDb } = await import('../src/lib/firebase-admin');

  let query = adminDb.collection('message_templates').where('channel', '==', 'whatsapp');
  if (org) query = query.where('organizationId', '==', org);
  const snap = await query.get();

  if (snap.empty) {
    console.log('No WhatsApp templates found. Nothing to do.');
    return;
  }

  // Mirror lookup for backfilling classification / parameter maps.
  const mirrorSnap = org
    ? await adminDb.collection('whatsapp_templates').where('organizationId', '==', org).get()
    : await adminDb.collection('whatsapp_templates').get();
  const mirrorByKey = new Map<string, WhatsAppTemplate>();
  for (const d of mirrorSnap.docs) {
    const m = d.data() as WhatsAppTemplate;
    mirrorByKey.set(`${m.organizationId}::${m.name}`, m);
  }

  // Group by tenant + Meta template name. Names are unique per WABA, never global.
  const groups = new Map<string, Candidate[]>();
  const unbound: Candidate[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Partial<MessageTemplate>;
    const name = data.whatsappTemplateName;
    if (!name) {
      unbound.push({ id: d.id, data }); // still a skeleton — nothing to reconcile
      continue;
    }
    const key = `${data.organizationId ?? ''}::${name}`;
    const list = groups.get(key) ?? [];
    list.push({ id: d.id, data });
    groups.set(key, list);
  }

  const writes: PlannedWrite[] = [];
  let duplicateGroups = 0;
  let restoredScope = 0;
  let backfilled = 0;

  for (const [key, group] of groups) {
    const canonical = pickCanonical(group);
    const mirror = mirrorByKey.get(key);
    const patch: Record<string, unknown> = {};
    const reasons: string[] = [];

    // Restore workspace scoping from a sibling that still has it.
    if ((canonical.data.workspaceIds?.length ?? 0) === 0) {
      const donor = group.find((c) => (c.data.workspaceIds?.length ?? 0) > 0);
      if (donor?.data.workspaceIds?.length) {
        patch.workspaceIds = donor.data.workspaceIds;
        reasons.push(`restored workspaceIds from ${donor.id}`);
        restoredScope++;
      }
    }

    // Backfill classification / parameter map from the Meta mirror.
    if (mirror) {
      if (!canonical.data.category && mirror.appCategory) {
        patch.category = mirror.appCategory;
        reasons.push('backfilled category');
      }
      if (!canonical.data.templateType && mirror.templateType) {
        patch.templateType = mirror.templateType;
        reasons.push('backfilled templateType');
      }
      if ((canonical.data.whatsappParamMap?.length ?? 0) === 0 && mirror.paramMap?.length) {
        patch.whatsappParamMap = mirror.paramMap;
        patch.declaredVariables = mirror.paramMap;
        reasons.push('backfilled param map');
      }
      if (reasons.some((r) => r.startsWith('backfilled'))) backfilled++;
    }

    if (Object.keys(patch).length > 0) {
      patch.reconciledAt = new Date().toISOString();
      writes.push({ id: canonical.id, patch, reason: reasons.join(', ') });
    }

    // Archive the redundant copies — never hard-delete user content.
    const redundant = group.filter((c) => c.id !== canonical.id);
    if (redundant.length > 0) {
      duplicateGroups++;
      for (const dup of redundant) {
        writes.push({
          id: dup.id,
          patch: {
            status: 'archived',
            isActive: false,
            reconciledAt: new Date().toISOString(),
            reconciledInFavourOf: canonical.id,
          },
          reason: `duplicate of ${canonical.id}`,
        });
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`WhatsApp templates scanned : ${snap.size}`);
  console.log(`Unbound skeletons (skipped): ${unbound.length}`);
  console.log(`Distinct Meta templates    : ${groups.size}`);
  console.log(`Groups with duplicates     : ${duplicateGroups}`);
  console.log(`Workspace scope restored   : ${restoredScope}`);
  console.log(`Classification backfilled  : ${backfilled}`);
  console.log(`Planned writes             : ${writes.length}\n`);

  for (const w of writes.slice(0, 40)) {
    console.log(`  ${w.id}\n    ${w.reason}\n    ${JSON.stringify(w.patch)}`);
  }
  if (writes.length > 40) console.log(`  …and ${writes.length - 40} more.`);

  if (!apply) {
    console.log('\nDry run — nothing was written. Re-run with --apply to commit.\n');
    return;
  }

  // ── Apply, chunked ────────────────────────────────────────────────────────
  const col = adminDb.collection('message_templates');
  for (let i = 0; i < writes.length; i += MAX_BATCH_OPS) {
    const batch = adminDb.batch();
    for (const w of writes.slice(i, i + MAX_BATCH_OPS)) {
      batch.set(col.doc(w.id), w.patch, { merge: true });
    }
    await batch.commit();
    console.log(`Committed ${Math.min(i + MAX_BATCH_OPS, writes.length)}/${writes.length}`);
  }
  console.log('\nReconciliation complete.\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[reconcile-whatsapp-templates] failed:', e);
    process.exit(1);
  });
