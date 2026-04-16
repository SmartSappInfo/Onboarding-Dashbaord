#!/usr/bin/env tsx
/**
 * Migration Script: Migrate schools to entities + workspace_entities
 * 
 * Usage:
 *   npx tsx scripts/migrate-schools-to-entities.ts
 *   DRY_RUN=true npx tsx scripts/migrate-schools-to-entities.ts
 * 
 * This script migrates existing schools from the schools collection to the new
 * entities + workspace_entities model.
 * 
 * Requirements: 19 (Migration Script)
 * 
 * What it does:
 * 1. Reads all schools documents from the schools collection
 * 2. For each school, creates an entity document with entityType: institution
 * 3. For each (school, workspaceId) pair, creates a workspace_entities document
 * 4. Copies school data to institutionData sub-document
 * 5. Generates slug for public URLs
 * 6. Copies pipelineId and stage to workspace_entities
 * 7. Copies tags to workspaceTags on workspace_entities
 * 8. Sets migrationStatus: "migrated" on schools documents
 * 
 * Idempotent: Safe to run multiple times - checks if entity/workspace_entities already exist
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { adminDb } from '../src/lib/firebase-admin';
import type { Entity, WorkspaceEntity, School, InstitutionData } from '../src/lib/types';

const DRY_RUN = process.env.DRY_RUN === 'true';
const USE_EMULATOR = process.env.USE_EMULATOR === 'true';
const BATCH_SIZE = 50; // Process in smaller batches for safety
const MIGRATION_ACTOR = 'migration-script';

// Configure emulator if requested
if (USE_EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

interface MigrationStats {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ schoolId: string; schoolName: string; error: string }>;
}

/**
 * Generates a URL-safe slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Checks if an entity already exists for a school
 */
async function entityExists(
  organizationId: string,
  schoolName: string
): Promise<string | null> {
  const entitySnap = await adminDb
    .collection('entities')
    .where('organizationId', '==', organizationId)
    .where('name', '==', schoolName)
    .where('entityType', '==', 'institution')
    .limit(1)
    .get();

  return entitySnap.empty ? null : entitySnap.docs[0].id;
}

/**
 * Checks if a workspace_entities link already exists
 */
async function workspaceEntityExists(
  workspaceId: string,
  entityId: string
): Promise<boolean> {
  const linkSnap = await adminDb
    .collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .where('entityId', '==', entityId)
    .limit(1)
    .get();

  return !linkSnap.empty;
}

/**
 * Migrates a single school document to entities + workspace_entities
 */
async function migrateSchool(
  school: School,
  stats: MigrationStats
): Promise<void> {
  const timestamp = new Date().toISOString();

  try {
    // Skip if already migrated
    if (school.migrationStatus === 'migrated') {
      console.log(`   ⏭  Skipped: "${school.name}" (already migrated)`);
      stats.skipped++;
      return;
    }

    // Determine organization ID (use first workspaceId as fallback)
    const organizationId = school.workspaceIds?.[0] || 'unknown';

    // Check if entity already exists (idempotency)
    let entityId = await entityExists(organizationId, school.name);

    if (!entityId) {
      // Create entity document
      const slug = generateSlug(school.name);

      // Build institution data from school fields
      const institutionData: InstitutionData = {
        nominalRoll: school.nominalRoll,
        subscriptionPackageId: school.subscriptionPackageId,
        subscriptionRate: school.subscriptionRate,
        billingAddress: school.billingAddress,
        currency: school.currency,
        modules: school.modules,
        implementationDate: school.implementationDate,
        referee: school.referee,
      };

      const entityData: Omit<Entity, 'id'> = {
        organizationId,
        entityType: 'institution',
        name: school.name,
        slug,
        entityContacts: [], // FER-01: Contacts migrated separately via normalization pipeline
        globalTags: [], // Global tags will be empty initially
        status: school.status === 'Archived' ? 'archived' : 'active',
        createdAt: school.createdAt || timestamp,
        updatedAt: timestamp,
        institutionData,
        relatedEntityIds: [],
      };

      if (!DRY_RUN) {
        const entityRef = await adminDb.collection('entities').add(entityData);
        entityId = entityRef.id;
      } else {
        entityId = 'dry-run-entity-id';
      }

      console.log(`   ✅ Created entity: "${school.name}" → ${entityId}`);
    } else {
      console.log(`   ⏭  Entity exists: "${school.name}" → ${entityId}`);
    }

    // Create workspace_entities for each workspace
    const workspaceIds = school.workspaceIds || [];
    let workspaceLinksCreated = 0;
    let workspaceLinksSkipped = 0;

    for (const workspaceId of workspaceIds) {
      // Check if link already exists (idempotency)
      const linkExists = await workspaceEntityExists(workspaceId, entityId);

      if (linkExists) {
        workspaceLinksSkipped++;
        continue;
      }

      // FER-01: Primary contact is resolved from entityContacts after normalization
      const primaryContact = (school as any).focalPersons?.[0];

      const workspaceEntityData: Omit<WorkspaceEntity, 'id'> = {
        organizationId,
        workspaceId,
        entityId,
        entityType: 'institution',
        pipelineId: school.pipelineId || '',
        stageId: school.stage?.id || '',
        assignedTo: school.assignedTo,
        status: school.status === 'Archived' ? 'archived' : 'active',
        workspaceTags: school.tags || [],
        lastContactedAt: undefined,
        addedAt: school.createdAt || timestamp,
        updatedAt: timestamp,
        displayName: school.name,
        primaryEmail: primaryContact?.email,
        primaryPhone: primaryContact?.phone,
        currentStageName: school.stage?.name,
        entityContacts: [], // FER-01: Populated by normalization pipeline
      };

      if (!DRY_RUN) {
        await adminDb.collection('workspace_entities').add(workspaceEntityData);
      }

      workspaceLinksCreated++;
    }

    console.log(
      `   🔗 Workspace links: ${workspaceLinksCreated} created, ${workspaceLinksSkipped} skipped`
    );

    // Mark school as migrated
    if (!DRY_RUN) {
      await adminDb.collection('schools').doc(school.id).update({
        migrationStatus: 'migrated',
        updatedAt: timestamp,
      });
    }

    stats.succeeded++;
  } catch (error: any) {
    console.error(`   ❌ Failed: "${school.name}" - ${error.message}`);
    stats.failed++;
    stats.errors.push({
      schoolId: school.id,
      schoolName: school.name,
      error: error.message,
    });
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SmartSapp — Schools to Entities Migration Script');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '✍️  LIVE'}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const stats: MigrationStats = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Fetch all schools
  console.log('📥 Fetching all school documents…');
  const schoolsSnap = await adminDb.collection('schools').get();
  stats.total = schoolsSnap.size;
  console.log(`   Found ${stats.total} school(s).`);

  if (stats.total === 0) {
    console.log('\n⚠️  No schools found. Nothing to migrate.');
    return;
  }

  // Process schools in batches
  console.log('\n🔄 Processing schools…\n');

  const schoolDocs = schoolsSnap.docs;
  for (let i = 0; i < schoolDocs.length; i += BATCH_SIZE) {
    const chunk = schoolDocs.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      const school = { id: doc.id, ...doc.data() } as School;
      await migrateSchool(school, stats);
    }

    const processed = Math.min(i + BATCH_SIZE, schoolDocs.length);
    console.log(`\n   Progress: ${processed}/${stats.total} schools processed\n`);
  }

  // Print summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Migration Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total schools:        ${stats.total}`);
  console.log(`  Succeeded:            ${stats.succeeded}`);
  console.log(`  Failed:               ${stats.failed}`);
  console.log(`  Skipped (migrated):   ${stats.skipped}`);

  if (stats.errors.length > 0) {
    console.log('\n  Errors:');
    for (const err of stats.errors) {
      console.log(`    - ${err.schoolName} (${err.schoolId}): ${err.error}`);
    }
  }

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
