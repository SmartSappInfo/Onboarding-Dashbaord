#!/usr/bin/env tsx
/**
 * Migration Script: Migrate tags from schools to entities/workspace_entities
 * 
 * Usage:
 *   npx tsx scripts/migrate-entity-tags.ts
 *   DRY_RUN=true npx tsx scripts/migrate-entity-tags.ts
 * 
 * This script migrates existing tags from the schools collection to the new
 * entity/workspace_entity model, classifying tags as either global or workspace-scoped.
 * 
 * Requirements: 7 (Global vs. Workspace Tag Separation)
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { migrateSchoolTagsAction } from '../src/lib/tag-migration';

const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  console.log('\n🚀 Starting tag migration...\n');
  
  const result = await migrateSchoolTagsAction(DRY_RUN);
  
  if (result.success) {
    console.log('\n✅ Migration completed successfully!\n');
    process.exit(0);
  } else {
    console.error('\n❌ Migration failed!\n');
    console.error('Errors:', result.errors);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
