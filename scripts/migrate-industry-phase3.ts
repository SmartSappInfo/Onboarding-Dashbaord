// @ts-nocheck
/**
 * Industry Migration Phase 3: Data Transformation
 * 
 * This script transforms existing entity data to include industry-specific fields:
 * - For each entity with entityType: 'institution' and no industryData, writes SaaSInstitutionData
 * - Maps legacy fields: nominalRoll → companySize, subscriptionPackage → planType, modules → features, implementationDate → signupDate
 * - Sets migrationStatus: 'dual-write' on transformed entities
 * - Processes in batches of 500 with progress logging
 * 
 * Requirements: 21.9–21.15
 * 
 * IMPORTANT: Run Phase 1 audit and Phase 2 schema extension first
 * 
 * Run with: npx tsx scripts/migrate-industry-phase3.ts
 * Dry run: npx tsx scripts/migrate-industry-phase3.ts --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Entity, InstitutionData, SaaSInstitutionData } from '../src/lib/types';

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const BATCH_SIZE = 500;

interface MigrationStats {
  entities: {
    total: number;
    alreadyMigrated: number;
    needsTransformation: number;
    transformed: number;
    errors: number;
  };
  transformations: Array<{
    entityId: string;
    entityName: string;
    changes: string[];
    warnings: string[];
  }>;
  errors: Array<{
    entityId: string;
    entityName: string;
    error: string;
  }>;
}

/**
 * Maps legacy InstitutionData to SaaSInstitutionData structure
 * Requirements: 21.10–21.12
 */
function mapInstitutionDataToSaaS(
  entity: Entity,
  institutionData: InstitutionData
): { data: SaaSInstitutionData; warnings: string[] } {
  const warnings: string[] = [];
  
  // Map nominalRoll → companySize (Requirement 21.11)
  const companySize = institutionData.nominalRoll ?? 0;
  if (companySize === 0) {
    warnings.push('companySize defaulted to 0 (nominalRoll was missing or 0)');
  }
  
  // Map subscriptionPackageId → planType (Requirement 21.11)
  const planType = institutionData.subscriptionPackageId || 'unknown';
  if (planType === 'unknown') {
    warnings.push('planType defaulted to "unknown" (subscriptionPackageId was missing)');
  }
  
  // Map modules → features (Requirement 21.11)
  const features = institutionData.modules?.map(m => m.name || m.abbreviation) ?? [];
  
  // Map implementationDate → signupDate (Requirement 21.11)
  const signupDate = institutionData.implementationDate || new Date().toISOString();
  if (!institutionData.implementationDate) {
    warnings.push('signupDate defaulted to current date (implementationDate was missing)');
  }
  
  // Preserve existing billing fields (Requirement 21.12)
  const billingAddress = institutionData.billingAddress;
  const currency = institutionData.currency;
  const subscriptionRate = institutionData.subscriptionRate;
  
  // Set default accountStatus for existing accounts (Requirement 21.13)
  const accountStatus: 'lead' | 'trial' | 'active' | 'suspended' | 'churned' = 'active';
  
  const saasData: SaaSInstitutionData = {
    industry: 'SaaS',
    
    companySize,
    planType,
    features,
    signupDate,
    accountStatus,
    // Optional fields
    ...(billingAddress && { billingAddress }),
    ...(currency && { currency }),
    ...(subscriptionRate && { subscriptionRate }),
  };
  
  return { data: saasData, warnings };
}

async function analyzeEntities(): Promise<{
  needsTransformation: Array<{ id: string; name: string; data: Entity }>;
  alreadyMigrated: number;
}> {
  console.log('\n📊 Analyzing entities...');
  
  const entitiesRef = db.collection('entities');
  const snapshot = await entitiesRef
    .where('entityType', '==', 'institution')
    .get();
  
  const needsTransformation: Array<{ id: string; name: string; data: Entity }> = [];
  let alreadyMigrated = 0;
  
  snapshot.forEach((doc) => {
    const entity = doc.data() as Entity;
    
    // Check if entity already has industryData
    if (entity.industryData) {
      alreadyMigrated++;
      return;
    }
    
    // Check if entity has institutionData to transform
    if (!entity.institutionData) {
      // Skip entities without institution data (might be new entities)
      return;
    }
    
    needsTransformation.push({
      id: doc.id,
      name: entity.name,
      data: entity
    });
  });
  
  console.log(`✅ Analysis complete:`);
  console.log(`  Total institution entities: ${snapshot.size}`);
  console.log(`  Already migrated: ${alreadyMigrated}`);
  console.log(`  Need transformation: ${needsTransformation.length}`);
  
  return { needsTransformation, alreadyMigrated };
}

async function transformEntities(dryRun: boolean = false): Promise<MigrationStats> {
  console.log(`\n🚀 Starting Industry Migration Phase 3: Data Transformation`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}\n`);
  
  const stats: MigrationStats = {
    entities: {
      total: 0,
      alreadyMigrated: 0,
      needsTransformation: 0,
      transformed: 0,
      errors: 0
    },
    transformations: [],
    errors: []
  };
  
  try {
    const { needsTransformation, alreadyMigrated } = await analyzeEntities();
    
    stats.entities.total = needsTransformation.length + alreadyMigrated;
    stats.entities.alreadyMigrated = alreadyMigrated;
    stats.entities.needsTransformation = needsTransformation.length;
    
    if (needsTransformation.length === 0) {
      console.log('\n✅ All entities are already transformed!');
      return stats;
    }
    
    console.log(`\n📝 Preparing to transform ${needsTransformation.length} entities...`);
    
    // Process in batches of 500 (Firestore batch limit)
    const batches = [];
    for (let i = 0; i < needsTransformation.length; i += BATCH_SIZE) {
      batches.push(needsTransformation.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`\n📦 Processing ${batches.length} batch(es)...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = db.batch();
      const currentBatch = batches[batchIndex];
      
      console.log(`\n  Batch ${batchIndex + 1}/${batches.length} (${currentBatch.length} entities)`);
      
      for (const entity of currentBatch) {
        try {
          const entityRef = db.collection('entities').doc(entity.id);
          const changes: string[] = [];
          
          // Transform institutionData to SaaSInstitutionData
          const { data: saasData, warnings } = mapInstitutionDataToSaaS(
            entity.data,
            entity.data.institutionData!
          );
          
          changes.push(`industry: SaaS`);
          changes.push(`industryData: SaaSInstitutionData`);
          changes.push(`  capacity: ${saasData.companySize}`);
          changes.push(`  // planType: ${saasData.planType}`);
          changes.push(`  // features: [${saasData.features.join(', ')}]`);
          changes.push(`  accountStatus: ${saasData.accountStatus}`);
          changes.push(`migrationStatus: dual-write`);
          
          stats.transformations.push({
            entityId: entity.id,
            entityName: entity.name,
            changes,
            warnings
          });
          
          console.log(`    ✓ ${entity.name} (${entity.id})`);
          changes.forEach(change => console.log(`      - ${change}`));
          if (warnings.length > 0) {
            warnings.forEach(warning => console.log(`      ⚠️  ${warning}`));
          }
          
          if (!dryRun) {
            batch.update(entityRef, {
              industry: 'SaaS',
              industryData: saasData,
              migrationStatus: 'dual-write',
              updatedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`    ❌ Failed to transform ${entity.name}:`, error);
          stats.errors.push({
            entityId: entity.id,
            entityName: entity.name,
            error: error instanceof Error ? error.message : String(error)
          });
          stats.entities.errors++;
        }
      }
      
      if (!dryRun) {
        try {
          await batch.commit();
          stats.entities.transformed += currentBatch.length - stats.errors.filter(
            e => currentBatch.some(entity => entity.id === e.entityId)
          ).length;
          console.log(`  ✅ Batch ${batchIndex + 1} committed successfully`);
        } catch (error) {
          console.error(`  ❌ Batch ${batchIndex + 1} failed:`, error);
          stats.entities.errors += currentBatch.length;
        }
      } else {
        console.log(`  ℹ️  Batch ${batchIndex + 1} (dry run - no changes made)`);
      }
      
      // Progress indicator
      const progress = ((batchIndex + 1) / batches.length * 100).toFixed(1);
      console.log(`  Progress: ${progress}%`);
    }
    
    return stats;
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

function printSummary(stats: MigrationStats, dryRun: boolean) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 INDUSTRY MIGRATION PHASE 3 - SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nMode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}\n`);
  
  console.log('📊 ENTITY STATISTICS');
  console.log('-'.repeat(80));
  console.log(`Total institution entities: ${stats.entities.total}`);
  console.log(`Already migrated: ${stats.entities.alreadyMigrated}`);
  console.log(`Needed transformation: ${stats.entities.needsTransformation}`);
  
  if (!dryRun) {
    console.log(`\nTransformed successfully: ${stats.entities.transformed}`);
    console.log(`Errors: ${stats.entities.errors}`);
  }
  
  if (stats.transformations.length > 0) {
    console.log('\n\n📝 TRANSFORMATIONS APPLIED');
    console.log('-'.repeat(80));
    
    // Show first 20 transformations
    const displayCount = Math.min(20, stats.transformations.length);
    stats.transformations.slice(0, displayCount).forEach(transformation => {
      console.log(`\n${transformation.entityName} (${transformation.entityId}):`);
      transformation.changes.forEach(c => console.log(`  - ${c}`));
      if (transformation.warnings.length > 0) {
        console.log('  Warnings:');
        transformation.warnings.forEach(w => console.log(`    ⚠️  ${w}`));
      }
    });
    
    if (stats.transformations.length > displayCount) {
      console.log(`\n... and ${stats.transformations.length - displayCount} more entities`);
    }
  }
  
  if (stats.errors.length > 0) {
    console.log('\n\n❌ ERRORS');
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
    console.log('  npx tsx scripts/migrate-industry-phase3.ts');
  } else if (stats.entities.errors > 0) {
    console.log(`⚠️  PARTIAL SUCCESS - ${stats.entities.transformed} transformed, ${stats.entities.errors} errors`);
    console.log('\nPlease review the errors above and retry if needed.');
  } else if (stats.entities.transformed > 0) {
    console.log(`✅ SUCCESS - All ${stats.entities.transformed} entities transformed successfully`);
    console.log('\nNext steps:');
    console.log('  1. Verify entity data in Firestore console');
    console.log('  2. Run Phase 4 migration to validate relationships and switch to "migrated" status');
    console.log('  3. Test entity functionality with new industry fields');
  } else {
    console.log('✅ SUCCESS - All entities already transformed');
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
    const stats = await transformEntities(dryRun);
    printSummary(stats, dryRun);
    
    // Save detailed report
    const fs = require('fs');
    const reportPath = `migration-phase3-${dryRun ? 'dryrun-' : ''}${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    
    process.exit(stats.entities.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

run();
