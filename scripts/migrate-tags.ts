/**
 * Migration Script: Create tags from existing School categorization fields
 *
 * Usage:
 *   npx tsx scripts/migrate-tags.ts
 *   DRY_RUN=true npx tsx scripts/migrate-tags.ts
 *
 * What it does:
 *   1. Scans all school documents across all workspaces
 *   2. Creates tag documents for each unique value found in categorization fields
 *   3. Applies the corresponding tag IDs back to each school document
 *   4. Runs a verification pass and logs a summary
 *
 * Idempotent: safe to run multiple times — skips already-migrated data.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { adminDb } from '../src/lib/firebase-admin';
import { getOrganizationId } from '../src/lib/organization-utils';
import type { School } from '../src/lib/types';
import type { TagCategory } from '../src/lib/types';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 500;
const MIGRATION_ACTOR = 'migration-script';
const NOW = new Date().toISOString();

// ─── Color palette ────────────────────────────────────────────────────────────

const COLOR_PALETTE = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280', // gray
  '#0EA5E9', // sky
  '#A855F7', // purple
  '#10B981', // emerald
];

let colorIndex = 0;
function nextColor(): string {
  return COLOR_PALETTE[colorIndex++ % COLOR_PALETTE.length];
}

// ─── Slug helper ──────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── Tag seed definitions ─────────────────────────────────────────────────────

interface TagSeed {
  name: string;
  category: TagCategory;
}

/**
 * Derive tag seeds from a school document.
 * Returns an array of { name, category } objects — one per categorization value.
 */
function extractTagSeeds(school: Record<string, any>): TagSeed[] {
  const seeds: TagSeed[] = [];

  // status: 'Active' | 'Inactive' | 'Archived'
  if (school.status && typeof school.status === 'string') {
    seeds.push({ name: school.status, category: 'status' });
  }

  // schoolStatus: custom status string
  if (
    school.schoolStatus &&
    typeof school.schoolStatus === 'string' &&
    school.schoolStatus.trim() !== '' &&
    school.schoolStatus !== school.status
  ) {
    seeds.push({ name: school.schoolStatus.trim(), category: 'status' });
  }

  // lifecycleStatus: 'Onboarding' | 'Active' | 'Churned' | 'Lead' | 'Lost'
  if (school.lifecycleStatus && typeof school.lifecycleStatus === 'string') {
    seeds.push({ name: school.lifecycleStatus, category: 'lifecycle' });
  }

  // stage: { id, name, order, color? }
  if (school.stage?.name && typeof school.stage.name === 'string') {
    seeds.push({ name: school.stage.name, category: 'lifecycle' });
  }

  // modules: [{ id, name, abbreviation, color }]
  if (Array.isArray(school.modules)) {
    for (const mod of school.modules) {
      if (mod?.name && typeof mod.name === 'string') {
        seeds.push({ name: mod.name, category: 'interest' });
      }
    }
  }

  // zone: { id, name }
  if (school.zone?.name && typeof school.zone.name === 'string') {
    seeds.push({ name: school.zone.name, category: 'demographic' });
  }

  return seeds;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TagRecord {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  slug: string;
  category: TagCategory;
  color: string;
  isSystem: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SmartSapp — Contact Tagging Migration Script');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '✍️  LIVE'}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── Step 1: Fetch all schools ──────────────────────────────────────────────
  console.log('📥 Fetching all school documents…');
  const schoolsSnap = await adminDb.collection('schools').get();
  const totalSchools = schoolsSnap.size;
  console.log(`   Found ${totalSchools} school(s).`);

  if (totalSchools === 0) {
    console.log('\n⚠️  No schools found. Nothing to migrate.');
    return;
  }

  // Count schools that already have tags (before migration)
  let schoolsWithTagsBefore = 0;
  for (const doc of schoolsSnap.docs) {
    const tags = doc.data().tags;
    if (Array.isArray(tags) && tags.length > 0) schoolsWithTagsBefore++;
  }
  console.log(`   Schools already tagged: ${schoolsWithTagsBefore}`);

  // ── Step 2: Collect all unique tag seeds per workspace ────────────────────
  console.log('\n🔍 Analysing categorization fields…');

  // Map: "workspaceId|slug" → TagSeed (deduped per workspace)
  const seedMap = new Map<string, TagSeed & { workspaceId: string; organizationId: string }>();

  for (const doc of schoolsSnap.docs) {
    const school = doc.data() as School;
    const workspaceIds: string[] = school.workspaceIds || [];
    const organizationId: string = getOrganizationId(school);

    const seeds = extractTagSeeds(school);

    for (const seed of seeds) {
      const slug = toSlug(seed.name);
      for (const wsId of workspaceIds) {
        const key = `${wsId}|${slug}`;
        if (!seedMap.has(key)) {
          seedMap.set(key, { ...seed, workspaceId: wsId, organizationId });
        }
      }
    }
  }

  console.log(`   Unique tag seeds found: ${seedMap.size}`);

  // ── Step 3: Resolve or create tag documents ───────────────────────────────
  console.log('\n🏷️  Resolving tags in Firestore…');

  // Map: "workspaceId|slug" → tag ID
  const tagIdMap = new Map<string, string>();

  let tagsCreated = 0;
  let tagsSkipped = 0;

  for (const [key, seed] of seedMap.entries()) {
    const slug = toSlug(seed.name);

    // Check if tag already exists
    const existing = await adminDb
      .collection('tags')
      .where('workspaceId', '==', seed.workspaceId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!existing.empty) {
      tagIdMap.set(key, existing.docs[0].id);
      tagsSkipped++;
      console.log(`   ⏭  Exists: [${seed.category}] "${seed.name}" (ws: ${seed.workspaceId})`);
      continue;
    }

    // Create new tag
    const tagRef = adminDb.collection('tags').doc();
    const tag: TagRecord = {
      id: tagRef.id,
      workspaceId: seed.workspaceId,
      organizationId: seed.organizationId,
      name: seed.name,
      slug,
      category: seed.category,
      color: nextColor(),
      isSystem: false,
      usageCount: 0,
      createdBy: MIGRATION_ACTOR,
      createdAt: NOW,
      updatedAt: NOW,
    };

    if (!DRY_RUN) {
      await tagRef.set(tag);
    }

    tagIdMap.set(key, tag.id);
    tagsCreated++;
    console.log(`   ✅ Created: [${seed.category}] "${seed.name}" → ${tag.id} (ws: ${seed.workspaceId})`);
  }

  console.log(`\n   Tags created: ${tagsCreated}, already existed: ${tagsSkipped}`);

  // ── Step 4: Apply tags to school documents ────────────────────────────────
  console.log('\n🔗 Applying tags to school documents…');

  let schoolsUpdated = 0;
  let schoolsAlreadyDone = 0;
  let schoolsSkippedNoTags = 0;

  // Process in batches of BATCH_SIZE
  const schoolDocs = schoolsSnap.docs;

  for (let i = 0; i < schoolDocs.length; i += BATCH_SIZE) {
    const chunk = schoolDocs.slice(i, i + BATCH_SIZE);
    const writeBatch = adminDb.batch();
    let batchHasWrites = false;

    for (const doc of chunk) {
      const school = doc.data() as Record<string, any>;
      const workspaceIds: string[] = school.workspaceIds || [];
      const seeds = extractTagSeeds(school);

      if (seeds.length === 0) {
        schoolsSkippedNoTags++;
        continue;
      }

      // Collect tag IDs for this school
      const newTagIds = new Set<string>(school.tags || []);
      const taggedAt: Record<string, string> = { ...(school.taggedAt || {}) };
      const taggedBy: Record<string, string> = { ...(school.taggedBy || {}) };

      let addedAny = false;

      for (const seed of seeds) {
        const slug = toSlug(seed.name);
        for (const wsId of workspaceIds) {
          const key = `${wsId}|${slug}`;
          const tagId = tagIdMap.get(key);
          if (!tagId) continue;

          if (!newTagIds.has(tagId)) {
            newTagIds.add(tagId);
            taggedAt[tagId] = NOW;
            taggedBy[tagId] = MIGRATION_ACTOR;
            addedAny = true;
          }
        }
      }

      if (!addedAny) {
        schoolsAlreadyDone++;
        continue;
      }

      writeBatch.update(doc.ref, {
        tags: Array.from(newTagIds),
        taggedAt,
        taggedBy,
      });

      batchHasWrites = true;
      schoolsUpdated++;
    }

    if (batchHasWrites && !DRY_RUN) {
      await writeBatch.commit();
    }

    const processed = Math.min(i + BATCH_SIZE, schoolDocs.length);
    console.log(`   Processed ${processed}/${schoolDocs.length} schools…`);
  }

  // ── Step 5: Update usageCount on created tags ─────────────────────────────
  if (!DRY_RUN && tagsCreated > 0) {
    console.log('\n📊 Updating tag usage counts…');

    // Count how many schools reference each tag
    const usageCounts = new Map<string, number>();

    const updatedSchoolsSnap = await adminDb.collection('schools').get();
    for (const doc of updatedSchoolsSnap.docs) {
      const tags: string[] = doc.data().tags || [];
      for (const tagId of tags) {
        usageCounts.set(tagId, (usageCounts.get(tagId) || 0) + 1);
      }
    }

    // Write counts in batches
    const tagEntries = Array.from(usageCounts.entries());
    for (let i = 0; i < tagEntries.length; i += BATCH_SIZE) {
      const chunk = tagEntries.slice(i, i + BATCH_SIZE);
      const countBatch = adminDb.batch();
      for (const [tagId, count] of chunk) {
        countBatch.update(adminDb.collection('tags').doc(tagId), {
          usageCount: count,
          updatedAt: NOW,
        });
      }
      await countBatch.commit();
    }

    console.log(`   Updated usage counts for ${usageCounts.size} tag(s).`);
  }

  // ── Step 6: Verification pass ─────────────────────────────────────────────
  console.log('\n🔎 Running verification pass…');

  let schoolsWithTagsAfter = 0;

  if (!DRY_RUN) {
    const verifySnap = await adminDb.collection('schools').get();
    for (const doc of verifySnap.docs) {
      const tags = doc.data().tags;
      if (Array.isArray(tags) && tags.length > 0) schoolsWithTagsAfter++;
    }
  } else {
    // In dry-run, estimate based on what we would have written
    schoolsWithTagsAfter = schoolsWithTagsBefore + schoolsUpdated;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Migration Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total schools scanned:       ${totalSchools}`);
  console.log(`  Schools with tags (before):  ${schoolsWithTagsBefore}`);
  console.log(`  Schools updated:             ${schoolsUpdated}`);
  console.log(`  Schools already migrated:    ${schoolsAlreadyDone}`);
  console.log(`  Schools with no tag fields:  ${schoolsSkippedNoTags}`);
  console.log(`  Schools with tags (after):   ${schoolsWithTagsAfter}`);
  console.log(`  Tags created:                ${tagsCreated}`);
  console.log(`  Tags already existed:        ${tagsSkipped}`);
  if (DRY_RUN) {
    console.log('');
    console.log('  ⚠️  DRY RUN — no data was written to Firestore.');
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
