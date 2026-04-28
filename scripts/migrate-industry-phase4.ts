// @ts-nocheck
/**
 * Industry Migration Phase 4: Validation and Cutover
 * 
 * This script validates the migration and switches entities to "migrated" status:
 * - Validates all relationships post-migration
 * - Checks data integrity across entities, workspace_entities, and industry collections
 * - Switches migrationStatus from 'dual-write' to 'migrated' after validation passes
 * - Writes migration audit log to migrationAuditLogs collection
 * 
 * Requirements: 21.16–21.19
 * 
 * IMPORTANT: Run Phase 3 data transformation first
 * 
 * Run with: npx tsx scripts/migrate-industry-phase4.ts
 * Dry run: npx tsx scripts/migrate-industry-phase4.ts --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Entity, WorkspaceEntity, Workspace } from '../src/lib/types';

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const BATCH_SIZE = 500;

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface MigrationStats {
  validation: {
    entitiesChecked: number;
    workspaceEntitiesChecked: number;
    workspacesChecked: number;
    validationErrors: number;
    validationWarnings: number;
  };
  cutover: {
    entitiesUpdated: number;
    errors: number;
  };
  validationResults: Array<{
    entityId: string;
    entityName: string;
    result: ValidationResult;
  }>;
  errors: Array<{
    entityId: string;
    entityName: string;
    error: string;
  }>;
}

interface MigrationAuditLog {
  id?: string;
  phase: 'phase4_validation';
  timestamp: string;
  stats: MigrationStats;
  status: 'success' | 'partial' | 'failed';
  executedBy: string;
  dryRun: boolean;
}

/**
 * Validates an entity's data integrity
 * Requirements: 21.16, 21.19
 */
async function validateEntity(entity: Entity): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required fields
  if (!entity.organizationId) {
    errors.push('Missing organizationId');
  }
  
  if (!entity.name || entity.name.trim() === '') {
    errors.push('Missing or empty name');
  }
  
  // Check industry data consistency (Requirement 3.9)
  if (entity.industry && !entity.industryData) {
    errors.push('Has industry field but missing industryData');
  }
  
  if (!entity.industry && entity.industryData) {
    errors.push('Has industryData but missing industry field');
  }
  
  if (entity.industry && entity.industryData) {
    if (entity.industryData.industry !== entity.industry) {
      errors.push(`Industry mismatch: entity.industry=${entity.industry}, industryData.industry=${entity.industryData.industry}`);
    }
    
    if (entity.entityType !== entity.industryData.entityType) {
      errors.push(`EntityType mismatch: entity.entityType=${entity.entityType}, industryData.entityType=${entity.industryData.entityType}`);
    }
  }
  
  // Check migration status
  if (entity.migrationStatus === 'dual-write') {
    // This is expected for Phase 4 - we'll update these
  } else if (entity.migrationStatus === 'migrated') {
    warnings.push('Already migrated');
  } else if (!entity.migrationStatus) {
    warnings.push('Missing migrationStatus field');
  }
  
  // Validate workspace_entities relationships
  try {
    const workspaceEntitiesSnapshot = await db.collection('workspace_entities')
      .where('entityId', '==', entity.id)
      .get();
    
    if (workspaceEntitiesSnapshot.empty) {
      warnings.push('No workspace_entities found for this entity');
    }
    
    // Check each workspace_entity
    for (const doc of workspaceEntitiesSnapshot.docs) {
      const we = doc.data() as WorkspaceEntity;
      
      // Verify workspace exists
      const workspaceDoc = await db.collection('workspaces').doc(we.workspaceId).get();
      if (!workspaceDoc.exists) {
        errors.push(`Referenced workspace ${we.workspaceId} does not exist`);
      } else {
        const workspace = workspaceDoc.data() as Workspace;
        
        // Verify workspace has industry field (Requirement 2)
        if (!workspace.industry) {
          errors.push(`Workspace ${we.workspaceId} missing industry field`);
        }
        
        // Verify entity industry matches workspace industry (if entity has industry)
        if (entity.industry && workspace.industry && entity.industry !== workspace.industry) {
          errors.push(`Entity industry (${entity.industry}) does not match workspace industry (${workspace.industry})`);
        }
      }
    }
  } catch (error) {
    errors.push(`Failed to validate workspace_entities: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates all entities in dual-write status
 * Requirements: 21.16, 21.19
 */
async function validateAllEntities(): Promise<{
  entities: Array<{ id: string; name: string; data: Entity }>;
  validationResults: Array<{ entityId: string; entityName: string; result: ValidationResult }>;
  stats: {
    entitiesChecked: number;
    workspaceEntitiesChecked: number;
    workspacesChecked: number;
    validationErrors: number;
    validationWarnings: number;
  };
}> {
  console.log('\n📊 Validating entities...');
  
  const entitiesRef = db.collection('entities');
  const snapshot = await entitiesRef
    .where('migrationStatus', '==', 'dual-write')
    .get();
  
  console.log(`Found ${snapshot.size} entities in dual-write status`);
  
  const entities: Array<{ id: string; name: string; data: Entity }> = [];
  const validationResults: Array<{ entityId: string; entityName: string; result: ValidationResult }> = [];
  
  let totalErrors = 0;
  let totalWarnings = 0;
  let workspaceEntitiesChecked = 0;
  const workspacesChecked = new Set<string>();
  
  for (const doc of snapshot.docs) {
    const entity = doc.data() as Entity;
    
    console.log(`  Validating ${entity.name} (${doc.id})...`);
    const result = await validateEntity(entity);
    
    validationResults.push({
      entityId: doc.id,
      entityName: entity.name,
      result
    });
    
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
    
    if (result.valid) {
      entities.push({ id: doc.id, name: entity.name, data: entity });
      console.log(`    ✅ Valid`);
    } else {
      console.log(`    ❌ Invalid (${result.errors.length} errors, ${result.warnings.length} warnings)`);
      result.errors.forEach(error => console.log(`      - ${error}`));
    }
    
    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => console.log(`      ⚠️  ${warning}`));
    }
    
    // Count workspace_entities
    const weSnapshot = await db.collection('workspace_entities')
      .where('entityId', '==', doc.id)
      .get();
    workspaceEntitiesChecked += weSnapshot.size;
    weSnapshot.docs.forEach(weDoc => {
      const we = weDoc.data() as WorkspaceEntity;
      workspacesChecked.add(we.workspaceId);
    });
  }
  
  console.log(`\n✅ Validation complete:`);
  console.log(`  Entities checked: ${snapshot.size}`);
  console.log(`  Valid entities: ${entities.length}`);
  console.log(`  Invalid entities: ${snapshot.size - entities.length}`);
  console.log(`  Total errors: ${totalErrors}`);
  console.log(`  Total warnings: ${totalWarnings}`);
  console.log(`  Workspace entities checked: ${workspaceEntitiesChecked}`);
  console.log(`  Workspaces checked: ${workspacesChecked.size}`);
  
  return {
    entities,
    validationResults,
    stats: {
      entitiesChecked: snapshot.size,
      workspaceEntitiesChecked,
      workspacesChecked: workspacesChecked.size,
      validationErrors: totalErrors,
      validationWarnings: totalWarnings
    }
  };
}

/**
 * Switches entities from dual-write to migrated status
 * Requirements: 21.16
 */
async function cutoverEntities(
  entities: Array<{ id: string; name: string; data: Entity }>,
  dryRun: boolean
): Promise<{ updated: number; errors: number; errorDetails: Array<{ entityId: string; entityName: string; error: string }> }> {
  console.log(`\n🔄 Switching ${entities.length} entities to "migrated" status...`);
  
  let updated = 0;
  let errors = 0;
  const errorDetails: Array<{ entityId: string; entityName: string; error: string }> = [];
  
  // Process in batches
  const batches = [];
  for (let i = 0; i < entities.length; i += BATCH_SIZE) {
    batches.push(entities.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`\n📦 Processing ${batches.length} batch(es)...`);
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = db.batch();
    const currentBatch = batches[batchIndex];
    
    console.log(`\n  Batch ${batchIndex + 1}/${batches.length} (${currentBatch.length} entities)`);
    
    for (const entity of currentBatch) {
      try {
        const entityRef = db.collection('entities').doc(entity.id);
        
        console.log(`    ✓ ${entity.name} (${entity.id})`);
        
        if (!dryRun) {
          batch.update(entityRef, {
            migrationStatus: 'migrated',
            updatedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`    ❌ Failed to update ${entity.name}:`, error);
        errorDetails.push({
          entityId: entity.id,
          entityName: entity.name,
          error: error instanceof Error ? error.message : String(error)
        });
        errors++;
      }
    }
    
    if (!dryRun) {
      try {
        await batch.commit();
        updated += currentBatch.length - errorDetails.filter(
          e => currentBatch.some(entity => entity.id === e.entityId)
        ).length;
        console.log(`  ✅ Batch ${batchIndex + 1} committed successfully`);
      } catch (error) {
        console.error(`  ❌ Batch ${batchIndex + 1} failed:`, error);
        errors += currentBatch.length;
      }
    } else {
      console.log(`  ℹ️  Batch ${batchIndex + 1} (dry run - no changes made)`);
    }
    
    // Progress indicator
    const progress = ((batchIndex + 1) / batches.length * 100).toFixed(1);
    console.log(`  Progress: ${progress}%`);
  }
  
  return { updated, errors, errorDetails };
}

/**
 * Writes migration audit log to Firestore
 * Requirements: 21.16
 */
async function writeMigrationAuditLog(
  stats: MigrationStats,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    console.log('\n📝 Skipping audit log write (dry run mode)');
    return;
  }
  
  console.log('\n📝 Writing migration audit log...');
  
  const auditLog: MigrationAuditLog = {
    phase: 'phase4_validation',
    timestamp: new Date().toISOString(),
    stats,
    status: stats.cutover.errors > 0 ? 'partial' : 
            stats.validation.validationErrors > 0 ? 'failed' : 'success',
    executedBy: 'migration-script',
    dryRun
  };
  
  try {
    const docRef = await db.collection('migrationAuditLogs').add(auditLog);
    console.log(`✅ Audit log written: ${docRef.id}`);
  } catch (error) {
    console.error('❌ Failed to write audit log:', error);
  }
}

async function runMigration(dryRun: boolean = false): Promise<MigrationStats> {
  console.log(`\n🚀 Starting Industry Migration Phase 4: Validation and Cutover`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}\n`);
  
  const stats: MigrationStats = {
    validation: {
      entitiesChecked: 0,
      workspaceEntitiesChecked: 0,
      workspacesChecked: 0,
      validationErrors: 0,
      validationWarnings: 0
    },
    cutover: {
      entitiesUpdated: 0,
      errors: 0
    },
    validationResults: [],
    errors: []
  };
  
  try {
    // Step 1: Validate all entities
    const { entities, validationResults, stats: validationStats } = await validateAllEntities();
    
    stats.validation = validationStats;
    stats.validationResults = validationResults;
    
    if (validationStats.validationErrors > 0) {
      console.log('\n❌ Validation failed - cannot proceed with cutover');
      console.log('Please fix the validation errors and run Phase 4 again');
      return stats;
    }
    
    if (entities.length === 0) {
      console.log('\n✅ No entities to migrate (all already migrated or none in dual-write status)');
      return stats;
    }
    
    // Step 2: Cutover entities to "migrated" status
    const { updated, errors, errorDetails } = await cutoverEntities(entities, dryRun);
    
    stats.cutover.entitiesUpdated = updated;
    stats.cutover.errors = errors;
    stats.errors = errorDetails;
    
    // Step 3: Write audit log
    await writeMigrationAuditLog(stats, dryRun);
    
    return stats;
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

function printSummary(stats: MigrationStats, dryRun: boolean) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 INDUSTRY MIGRATION PHASE 4 - SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nMode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}\n`);
  
  console.log('📊 VALIDATION STATISTICS');
  console.log('-'.repeat(80));
  console.log(`Entities checked: ${stats.validation.entitiesChecked}`);
  console.log(`Workspace entities checked: ${stats.validation.workspaceEntitiesChecked}`);
  console.log(`Workspaces checked: ${stats.validation.workspacesChecked}`);
  console.log(`Validation errors: ${stats.validation.validationErrors}`);
  console.log(`Validation warnings: ${stats.validation.validationWarnings}`);
  
  if (stats.validationResults.length > 0) {
    console.log('\n\n📝 VALIDATION RESULTS');
    console.log('-'.repeat(80));
    
    const invalidEntities = stats.validationResults.filter(r => !r.result.valid);
    if (invalidEntities.length > 0) {
      console.log(`\n❌ Invalid Entities (${invalidEntities.length}):`);
      invalidEntities.forEach(result => {
        console.log(`\n${result.entityName} (${result.entityId}):`);
        result.result.errors.forEach(error => console.log(`  - ${error}`));
      });
    }
    
    const entitiesWithWarnings = stats.validationResults.filter(r => r.result.warnings.length > 0);
    if (entitiesWithWarnings.length > 0) {
      console.log(`\n⚠️  Entities with Warnings (${entitiesWithWarnings.length}):`);
      entitiesWithWarnings.slice(0, 10).forEach(result => {
        console.log(`\n${result.entityName} (${result.entityId}):`);
        result.result.warnings.forEach(warning => console.log(`  - ${warning}`));
      });
      
      if (entitiesWithWarnings.length > 10) {
        console.log(`\n... and ${entitiesWithWarnings.length - 10} more`);
      }
    }
  }
  
  console.log('\n\n📊 CUTOVER STATISTICS');
  console.log('-'.repeat(80));
  
  if (!dryRun) {
    console.log(`Entities updated: ${stats.cutover.entitiesUpdated}`);
    console.log(`Errors: ${stats.cutover.errors}`);
  } else {
    console.log('(Dry run - no cutover performed)');
  }
  
  if (stats.errors.length > 0) {
    console.log('\n\n❌ CUTOVER ERRORS');
    console.log('-'.repeat(80));
    stats.errors.forEach(error => {
      console.log(`\n${error.entityName} (${error.entityId}):`);
      console.log(`  Error: ${error.error}`);
    });
  }
  
  console.log('\n\n📊 MIGRATION STATUS');
  console.log('-'.repeat(80));
  
  if (dryRun) {
    console.log('ℹ️  DRY RUN COMPLETE - No changes were made');
    console.log('\nTo apply these changes, run:');
    console.log('  npx tsx scripts/migrate-industry-phase4.ts');
  } else if (stats.validation.validationErrors > 0) {
    console.log('❌ VALIDATION FAILED - Migration cannot proceed');
    console.log('\nPlease fix the validation errors and run Phase 4 again.');
  } else if (stats.cutover.errors > 0) {
    console.log(`⚠️  PARTIAL SUCCESS - ${stats.cutover.entitiesUpdated} updated, ${stats.cutover.errors} errors`);
    console.log('\nPlease review the errors above and retry if needed.');
  } else if (stats.cutover.entitiesUpdated > 0) {
    console.log(`✅ SUCCESS - All ${stats.cutover.entitiesUpdated} entities migrated successfully`);
    console.log('\nMigration complete! Next steps:');
    console.log('  1. Verify entity data in Firestore console');
    console.log('  2. Test entity functionality with new industry fields');
    console.log('  3. Monitor application for any issues');
    console.log('  4. Keep schools collection intact for 90-day rollback window');
  } else {
    console.log('✅ SUCCESS - All entities already migrated');
  }
  
  console.log('\n' + '='.repeat(80));
}

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  if (dryRun) {
    console.log('⚠️  Running in DRY RUN mode - no changes will be made\n');
  } else {
    console.log('⚠️  Running in LIVE mode - changes will be written to Firestore');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  try {
    const stats = await runMigration(dryRun);
    printSummary(stats, dryRun);
    
    // Save detailed report
    const fs = require('fs');
    const reportPath = `migration-phase4-${dryRun ? 'dryrun-' : ''}${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    
    const exitCode = stats.validation.validationErrors > 0 || stats.cutover.errors > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

run();
