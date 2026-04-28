// @ts-nocheck
/**
 * Industry Migration Phase 2: Schema Extension
 * 
 * This script extends the schema for industry support:
 * - Updates all workspaces missing `industry` field to default 'SaaS'
 * - Sets `industryScopeLocked: false` on workspaces that lack the field
 * - Preserves existing data and adds new fields only where missing
 * 
 * Requirements: 21.5–21.8, 11.2
 * 
 * IMPORTANT: Run Phase 1 audit first to identify any data integrity issues
 * 
 * Run with: npx tsx scripts/migrate-industry-phase2.ts
 * Dry run: npx tsx scripts/migrate-industry-phase2.ts --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Workspace, IndustryVertical } from '../src/lib/types';

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Default industry for existing workspaces (Requirement 11.2)
const DEFAULT_INDUSTRY: IndustryVertical = 'SaaS';

interface MigrationStats {
  workspaces: {
    total: number;
    alreadyMigrated: number;
    needsIndustry: number;
    needsIndustryScopeLocked: number;
    needsIndustryScopeLockedAt: number;
    updated: number;
    errors: number;
  };
  changes: Array<{
    workspaceId: string;
    workspaceName: string;
    changes: string[];
  }>;
}

async function analyzeWorkspaces(): Promise<{
  needsUpdate: Array<{ id: string; name: string; updates: any }>;
  alreadyMigrated: number;
}> {
  console.log('\n📊 Analyzing workspaces...');
  
  const workspacesRef = db.collection('workspaces');
  const snapshot = await workspacesRef.get();
  
  const needsUpdate: Array<{ id: string; name: string; updates: any }> = [];
  let alreadyMigrated = 0;
  
  snapshot.forEach((doc) => {
    const workspace = doc.data() as Workspace;
    const updates: any = {};
    
    // Check if industry field is missing
    if (!workspace.industry) {
      updates.industry = DEFAULT_INDUSTRY;
    }
    
    // Check if industryScopeLocked field is missing
    if (workspace.industryScopeLocked === undefined) {
      updates.industryScopeLocked = false;
    }
    
    // Check if industryScopeLockedAt should be removed (if scope is not locked)
    if (workspace.industryScopeLockedAt && !workspace.industryScopeLocked) {
      updates.industryScopeLockedAt = FieldValue.delete();
    }
    
    // Add updatedAt timestamp
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      needsUpdate.push({
        id: doc.id,
        name: workspace.name,
        updates
      });
    } else {
      alreadyMigrated++;
    }
  });
  
  console.log(`✅ Analysis complete:`);
  console.log(`  Total workspaces: ${snapshot.size}`);
  console.log(`  Already migrated: ${alreadyMigrated}`);
  console.log(`  Need updates: ${needsUpdate.length}`);
  
  return { needsUpdate, alreadyMigrated };
}

async function migrateWorkspaces(dryRun: boolean = false): Promise<MigrationStats> {
  console.log(`\n🚀 Starting Industry Migration Phase 2: Schema Extension`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}\n`);
  
  const stats: MigrationStats = {
    workspaces: {
      total: 0,
      alreadyMigrated: 0,
      needsIndustry: 0,
      needsIndustryScopeLocked: 0,
      needsIndustryScopeLockedAt: 0,
      updated: 0,
      errors: 0
    },
    changes: []
  };
  
  try {
    const { needsUpdate, alreadyMigrated } = await analyzeWorkspaces();
    
    stats.workspaces.total = needsUpdate.length + alreadyMigrated;
    stats.workspaces.alreadyMigrated = alreadyMigrated;
    
    if (needsUpdate.length === 0) {
      console.log('\n✅ All workspaces are already up to date!');
      return stats;
    }
    
    console.log(`\n📝 Preparing to update ${needsUpdate.length} workspaces...`);
    
    // Process in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    const batches = [];
    
    for (let i = 0; i < needsUpdate.length; i += BATCH_SIZE) {
      batches.push(needsUpdate.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`\n📦 Processing ${batches.length} batch(es)...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = db.batch();
      const currentBatch = batches[batchIndex];
      
      console.log(`\n  Batch ${batchIndex + 1}/${batches.length} (${currentBatch.length} workspaces)`);
      
      for (const workspace of currentBatch) {
        const workspaceRef = db.collection('workspaces').doc(workspace.id);
        const changes: string[] = [];
        
        // Track what fields are being updated
        if (workspace.updates.industry) {
          stats.workspaces.needsIndustry++;
          changes.push(`industry: ${workspace.updates.industry}`);
        }
        
        if (workspace.updates.industryScopeLocked !== undefined) {
          stats.workspaces.needsIndustryScopeLocked++;
          changes.push(`industryScopeLocked: ${workspace.updates.industryScopeLocked}`);
        }
        
        if (workspace.updates.industryScopeLockedAt) {
          stats.workspaces.needsIndustryScopeLockedAt++;
          changes.push('industryScopeLockedAt: (removed)');
        }
        
        stats.changes.push({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          changes
        });
        
        console.log(`    ✓ ${workspace.name} (${workspace.id})`);
        changes.forEach(change => console.log(`      - ${change}`));
        
        if (!dryRun) {
          batch.update(workspaceRef, workspace.updates);
        }
      }
      
      if (!dryRun) {
        try {
          await batch.commit();
          stats.workspaces.updated += currentBatch.length;
          console.log(`  ✅ Batch ${batchIndex + 1} committed successfully`);
        } catch (error) {
          console.error(`  ❌ Batch ${batchIndex + 1} failed:`, error);
          stats.workspaces.errors += currentBatch.length;
        }
      } else {
        console.log(`  ℹ️  Batch ${batchIndex + 1} (dry run - no changes made)`);
      }
    }
    
    return stats;
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

function printSummary(stats: MigrationStats, dryRun: boolean) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 INDUSTRY MIGRATION PHASE 2 - SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nMode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}\n`);
  
  console.log('📊 WORKSPACE STATISTICS');
  console.log('-'.repeat(80));
  console.log(`Total workspaces: ${stats.workspaces.total}`);
  console.log(`Already migrated: ${stats.workspaces.alreadyMigrated}`);
  console.log(`Needed industry field: ${stats.workspaces.needsIndustry}`);
  console.log(`Needed industryScopeLocked field: ${stats.workspaces.needsIndustryScopeLocked}`);
  console.log(`Needed industryScopeLockedAt cleanup: ${stats.workspaces.needsIndustryScopeLockedAt}`);
  
  if (!dryRun) {
    console.log(`\nUpdated successfully: ${stats.workspaces.updated}`);
    console.log(`Errors: ${stats.workspaces.errors}`);
  }
  
  if (stats.changes.length > 0) {
    console.log('\n\n📝 CHANGES APPLIED');
    console.log('-'.repeat(80));
    
    // Show first 20 changes
    const displayCount = Math.min(20, stats.changes.length);
    stats.changes.slice(0, displayCount).forEach(change => {
      console.log(`\n${change.workspaceName} (${change.workspaceId}):`);
      change.changes.forEach(c => console.log(`  - ${c}`));
    });
    
    if (stats.changes.length > displayCount) {
      console.log(`\n... and ${stats.changes.length - displayCount} more workspaces`);
    }
  }
  
  console.log('\n\n📊 MIGRATION STATUS');
  console.log('-'.repeat(80));
  
  if (dryRun) {
    console.log('ℹ️  DRY RUN COMPLETE - No changes were made');
    console.log('\nTo apply these changes, run:');
    console.log('  npx tsx scripts/migrate-industry-phase2.ts');
  } else if (stats.workspaces.errors > 0) {
    console.log(`⚠️  PARTIAL SUCCESS - ${stats.workspaces.updated} updated, ${stats.workspaces.errors} errors`);
    console.log('\nPlease review the errors above and retry if needed.');
  } else if (stats.workspaces.updated > 0) {
    console.log(`✅ SUCCESS - All ${stats.workspaces.updated} workspaces updated successfully`);
    console.log('\nNext steps:');
    console.log('  1. Verify workspace data in Firestore console');
    console.log('  2. Run Phase 3 migration to transform entity data');
    console.log('  3. Test workspace functionality with new industry fields');
  } else {
    console.log('✅ SUCCESS - All workspaces already up to date');
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
    const stats = await migrateWorkspaces(dryRun);
    printSummary(stats, dryRun);
    
    // Save detailed report
    const fs = require('fs');
    const reportPath = `migration-phase2-${dryRun ? 'dryrun-' : ''}${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    
    process.exit(stats.workspaces.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

run();
