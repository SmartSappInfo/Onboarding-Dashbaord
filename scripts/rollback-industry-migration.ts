/**
 * Industry Migration Rollback Script
 * 
 * This script rolls back industry migration for a specific workspace:
 * - Resets `industryScopeLocked: false` on the workspace
 * - Reverts all `workspace_entities` in that workspace to `migrationStatus: 'legacy'`
 * - Logs `migration_rolled_back` activity for audit trail
 * 
 * Requirements: 12.2, 12.6
 * 
 * IMPORTANT: This script should only be used if migration issues are detected
 * within the 90-day rollback window. The legacy `schools` collection must still
 * be intact for rollback to work properly.
 * 
 * Run with: npx tsx scripts/rollback-industry-migration.ts <workspaceId>
 * Dry run: npx tsx scripts/rollback-industry-migration.ts <workspaceId> --dry-run
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import type { Workspace, WorkspaceEntity } from '../src/lib/types';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf-8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

interface RollbackStats {
  workspace: {
    id: string;
    name: string;
    wasLocked: boolean;
    unlocked: boolean;
  };
  workspaceEntities: {
    total: number;
    alreadyLegacy: number;
    reverted: number;
    errors: number;
  };
  activities: {
    logged: boolean;
    error?: string;
  };
  errors: string[];
}

async function validateWorkspace(workspaceId: string): Promise<Workspace | null> {
  console.log(`\n🔍 Validating workspace: ${workspaceId}`);
  
  const workspaceRef = db.collection('workspaces').doc(workspaceId);
  const workspaceSnap = await workspaceRef.get();
  
  if (!workspaceSnap.exists) {
    console.error(`❌ Workspace not found: ${workspaceId}`);
    return null;
  }
  
  const workspace = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;
  
  console.log(`✅ Workspace found: ${workspace.name}`);
  console.log(`   Industry: ${workspace.industry}`);
  console.log(`   Industry Scope Locked: ${workspace.industryScopeLocked}`);
  
  if (workspace.industryScopeLockedAt) {
    console.log(`   Locked At: ${workspace.industryScopeLockedAt}`);
  }
  
  return workspace;
}

async function analyzeWorkspaceEntities(workspaceId: string): Promise<{
  total: number;
  alreadyLegacy: number;
  needsRevert: WorkspaceEntity[];
}> {
  console.log(`\n📊 Analyzing workspace_entities for workspace: ${workspaceId}`);
  
  const workspaceEntitiesRef = db.collection('workspace_entities');
  const snapshot = await workspaceEntitiesRef
    .where('workspaceId', '==', workspaceId)
    .get();
  
  const needsRevert: WorkspaceEntity[] = [];
  let alreadyLegacy = 0;
  
  snapshot.forEach((doc) => {
    const workspaceEntity = { id: doc.id, ...doc.data() } as WorkspaceEntity;
    
    // Check if entity is already in legacy status
    if ((workspaceEntity as any).migrationStatus === 'legacy') {
      alreadyLegacy++;
    } else {
      needsRevert.push(workspaceEntity);
    }
  });
  
  console.log(`✅ Analysis complete:`);
  console.log(`  Total workspace_entities: ${snapshot.size}`);
  console.log(`  Already legacy: ${alreadyLegacy}`);
  console.log(`  Need revert: ${needsRevert.length}`);
  
  return { total: snapshot.size, alreadyLegacy, needsRevert };
}

async function rollbackWorkspace(
  workspaceId: string,
  userId: string = 'system',
  dryRun: boolean = false
): Promise<RollbackStats> {
  console.log(`\n🚀 Starting Industry Migration Rollback`);
  console.log(`Workspace ID: ${workspaceId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE ROLLBACK'}\n`);
  
  const stats: RollbackStats = {
    workspace: {
      id: workspaceId,
      name: '',
      wasLocked: false,
      unlocked: false
    },
    workspaceEntities: {
      total: 0,
      alreadyLegacy: 0,
      reverted: 0,
      errors: 0
    },
    activities: {
      logged: false
    },
    errors: []
  };
  
  try {
    // Step 1: Validate workspace exists
    const workspace = await validateWorkspace(workspaceId);
    
    if (!workspace) {
      stats.errors.push('Workspace not found');
      return stats;
    }
    
    stats.workspace.name = workspace.name;
    stats.workspace.wasLocked = workspace.industryScopeLocked;
    
    // Step 2: Analyze workspace_entities
    const { total, alreadyLegacy, needsRevert } = await analyzeWorkspaceEntities(workspaceId);
    
    stats.workspaceEntities.total = total;
    stats.workspaceEntities.alreadyLegacy = alreadyLegacy;
    
    if (needsRevert.length === 0 && !workspace.industryScopeLocked) {
      console.log('\n✅ Workspace is already in legacy state - no rollback needed');
      return stats;
    }
    
    // Step 3: Reset industryScopeLocked on workspace
    console.log(`\n🔓 Unlocking workspace industry scope...`);
    
    if (!dryRun) {
      try {
        const workspaceRef = db.collection('workspaces').doc(workspaceId);
        await workspaceRef.update({
          industryScopeLocked: false,
          industryScopeLockedAt: null,
          updatedAt: new Date().toISOString()
        });
        
        stats.workspace.unlocked = true;
        console.log(`✅ Workspace unlocked successfully`);
      } catch (error: any) {
        console.error(`❌ Failed to unlock workspace:`, error.message);
        stats.errors.push(`Workspace unlock failed: ${error.message}`);
      }
    } else {
      console.log(`ℹ️  Would unlock workspace (dry run)`);
    }
    
    // Step 4: Revert workspace_entities to legacy status
    if (needsRevert.length > 0) {
      console.log(`\n🔄 Reverting ${needsRevert.length} workspace_entities to legacy status...`);
      
      // Process in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 500;
      const batches = [];
      
      for (let i = 0; i < needsRevert.length; i += BATCH_SIZE) {
        batches.push(needsRevert.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`\n📦 Processing ${batches.length} batch(es)...`);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = db.batch();
        const currentBatch = batches[batchIndex];
        
        console.log(`\n  Batch ${batchIndex + 1}/${batches.length} (${currentBatch.length} entities)`);
        
        for (const workspaceEntity of currentBatch) {
          const workspaceEntityRef = db.collection('workspace_entities').doc(workspaceEntity.id);
          
          console.log(`    ✓ ${workspaceEntity.displayName} (${workspaceEntity.id})`);
          
          if (!dryRun) {
            batch.update(workspaceEntityRef, {
              migrationStatus: 'legacy',
              updatedAt: new Date().toISOString()
            });
          }
        }
        
        if (!dryRun) {
          try {
            await batch.commit();
            stats.workspaceEntities.reverted += currentBatch.length;
            console.log(`  ✅ Batch ${batchIndex + 1} committed successfully`);
          } catch (error: any) {
            console.error(`  ❌ Batch ${batchIndex + 1} failed:`, error.message);
            stats.workspaceEntities.errors += currentBatch.length;
            stats.errors.push(`Batch ${batchIndex + 1} failed: ${error.message}`);
          }
        } else {
          console.log(`  ℹ️  Batch ${batchIndex + 1} (dry run - no changes made)`);
        }
      }
    }
    
    // Step 5: Log migration_rolled_back activity
    console.log(`\n📝 Logging rollback activity...`);
    
    if (!dryRun) {
      try {
        const activityRef = db.collection('activities');
        await activityRef.add({
          organizationId: workspace.organizationId,
          workspaceId: workspaceId,
          userId: userId,
          type: 'migration_rolled_back',
          source: 'system',
          description: `Industry migration rolled back for workspace "${workspace.name}"`,
          metadata: {
            workspaceId: workspaceId,
            workspaceName: workspace.name,
            industry: workspace.industry,
            wasLocked: stats.workspace.wasLocked,
            entitiesReverted: stats.workspaceEntities.reverted,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });
        
        stats.activities.logged = true;
        console.log(`✅ Activity logged successfully`);
      } catch (error: any) {
        console.error(`❌ Failed to log activity:`, error.message);
        stats.activities.error = error.message;
        stats.errors.push(`Activity logging failed: ${error.message}`);
      }
    } else {
      console.log(`ℹ️  Would log migration_rolled_back activity (dry run)`);
    }
    
    return stats;
  } catch (error: any) {
    console.error('\n❌ Rollback failed:', error);
    stats.errors.push(`Rollback failed: ${error.message}`);
    return stats;
  }
}

function printSummary(stats: RollbackStats, dryRun: boolean) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 INDUSTRY MIGRATION ROLLBACK - SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nMode: ${dryRun ? 'DRY RUN' : 'LIVE ROLLBACK'}\n`);
  
  console.log('📊 WORKSPACE');
  console.log('-'.repeat(80));
  console.log(`ID: ${stats.workspace.id}`);
  console.log(`Name: ${stats.workspace.name}`);
  console.log(`Was Locked: ${stats.workspace.wasLocked}`);
  
  if (!dryRun) {
    console.log(`Unlocked: ${stats.workspace.unlocked ? '✅' : '❌'}`);
  }
  
  console.log('\n📊 WORKSPACE ENTITIES');
  console.log('-'.repeat(80));
  console.log(`Total: ${stats.workspaceEntities.total}`);
  console.log(`Already Legacy: ${stats.workspaceEntities.alreadyLegacy}`);
  
  if (!dryRun) {
    console.log(`Reverted: ${stats.workspaceEntities.reverted}`);
    console.log(`Errors: ${stats.workspaceEntities.errors}`);
  } else {
    console.log(`Would Revert: ${stats.workspaceEntities.total - stats.workspaceEntities.alreadyLegacy}`);
  }
  
  console.log('\n📊 ACTIVITY LOG');
  console.log('-'.repeat(80));
  
  if (!dryRun) {
    console.log(`Logged: ${stats.activities.logged ? '✅' : '❌'}`);
    if (stats.activities.error) {
      console.log(`Error: ${stats.activities.error}`);
    }
  } else {
    console.log(`Would Log: migration_rolled_back activity`);
  }
  
  if (stats.errors.length > 0) {
    console.log('\n⚠️  ERRORS');
    console.log('-'.repeat(80));
    stats.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  console.log('\n\n📊 ROLLBACK STATUS');
  console.log('-'.repeat(80));
  
  if (dryRun) {
    console.log('ℹ️  DRY RUN COMPLETE - No changes were made');
    console.log('\nTo apply this rollback, run:');
    console.log(`  npx tsx scripts/rollback-industry-migration.ts ${stats.workspace.id}`);
  } else if (stats.errors.length > 0) {
    console.log(`⚠️  PARTIAL SUCCESS - Rollback completed with ${stats.errors.length} error(s)`);
    console.log('\nPlease review the errors above and retry if needed.');
  } else {
    console.log(`✅ SUCCESS - Rollback completed successfully`);
    console.log('\nNext steps:');
    console.log('  1. Verify workspace data in Firestore console');
    console.log('  2. Test workspace functionality with legacy data model');
    console.log('  3. Monitor for any issues with the legacy schools collection');
    console.log('\nIMPORTANT: The legacy schools collection must remain intact for');
    console.log('the workspace to function properly after rollback.');
  }
  
  console.log('\n' + '='.repeat(80));
}

async function run() {
  const args = process.argv.slice(2);
  
  // Check for required workspaceId argument
  const workspaceId = args.find(arg => !arg.startsWith('--'));
  
  if (!workspaceId) {
    console.error('❌ Error: workspaceId is required');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/rollback-industry-migration.ts <workspaceId>');
    console.log('  npx tsx scripts/rollback-industry-migration.ts <workspaceId> --dry-run');
    console.log('\nExample:');
    console.log('  npx tsx scripts/rollback-industry-migration.ts workspace_abc123');
    console.log('  npx tsx scripts/rollback-industry-migration.ts workspace_abc123 --dry-run');
    process.exit(1);
  }
  
  const dryRun = args.includes('--dry-run');
  const userId = args.find(arg => arg.startsWith('--user='))?.split('=')[1] || 'system';
  
  if (dryRun) {
    console.log('⚠️  Running in DRY RUN mode - no changes will be made\n');
  } else {
    console.log('⚠️  Running in LIVE mode - changes will be written to Firestore');
    console.log('⚠️  This will roll back industry migration for the specified workspace');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  try {
    const stats = await rollbackWorkspace(workspaceId, userId, dryRun);
    printSummary(stats, dryRun);
    
    // Save detailed report
    const reportPath = `rollback-${workspaceId}-${dryRun ? 'dryrun-' : ''}${Date.now()}.json`;
    writeFileSync(reportPath, JSON.stringify(stats, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    
    process.exit(stats.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Rollback failed:', error);
    process.exit(1);
  }
}

run();
