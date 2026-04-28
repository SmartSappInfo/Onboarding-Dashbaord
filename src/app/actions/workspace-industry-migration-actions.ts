'use server';

/**
 * Server Actions for Workspace Industry Migration
 * 
 * Provides Fetch, Enrich, and Restore (FER) operations for migrating
 * workspaces to their correct industry vertical.
 * 
 * Workspace Mapping:
 * - "Client Onboarding" → SaaS
 * - "Research Team" → Marketing
 * - "Sales Leads" → SaaS
 * - "Mining Support" → Consultancy
 * - "Business Hub" → Marketing
 * - "Enrollment" → SchoolEnrollment
 */

import { adminDb } from '@/lib/firebase-admin';
import type { IndustryVertical } from '@/lib/types';

export interface WorkspaceMigrationResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
  workspaceDetails?: Array<{
    id: string;
    name: string;
    currentIndustry?: string;
    targetIndustry: string;
    status: 'success' | 'failed' | 'skipped';
  }>;
}

// Workspace name to industry mapping
const WORKSPACE_INDUSTRY_MAP: Record<string, IndustryVertical> = {
  'Client Onboarding': 'SaaS',
  'Research Team': 'Marketing',
  'Sales Leads': 'SaaS',
  'Mining Support': 'Consultancy',
  'Business Hub': 'Marketing',
  'Enrollment': 'SchoolEnrollment',
};

/**
 * FETCH: Fetches all workspaces that need industry migration
 * 
 * Identifies workspaces that:
 * - Match one of the workspace names in the mapping
 * - Don't have the correct industry set
 * - OR don't have industryScopeLocked set
 */
export async function fetchWorkspacesForIndustryMigration(): Promise<WorkspaceMigrationResult> {
  const result: WorkspaceMigrationResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    workspaceDetails: [],
  };

  try {
    console.log('🔍 [FETCH] Scanning workspaces collection for industry migration candidates...');

    // Get ALL workspaces
    const workspacesSnapshot = await adminDb.collection('workspaces').get();
    result.total = workspacesSnapshot.size;

    console.log(`📊 [FETCH] Found ${result.total} total workspaces in collection`);

    if (result.total === 0) {
      console.warn('⚠️ [FETCH] No workspaces found in the database.');
      return result;
    }

    let needsMigration = 0;
    let alreadyMigrated = 0;

    for (const doc of workspacesSnapshot.docs) {
      const workspace = doc.data();
      const workspaceName = workspace.name;
      
      // Check if this workspace is in our migration map
      const targetIndustry = WORKSPACE_INDUSTRY_MAP[workspaceName];
      
      if (!targetIndustry) {
        // Not in our migration list, skip
        continue;
      }

      // Check if workspace needs migration
      const currentIndustry = workspace.industry;
      const isLocked = workspace.industryScopeLocked === true;
      
      const needsMigrationCheck = 
        !currentIndustry || 
        currentIndustry !== targetIndustry ||
        !isLocked;
      
      if (needsMigrationCheck) {
        needsMigration++;
        result.succeeded++;
        result.workspaceDetails?.push({
          id: doc.id,
          name: workspaceName,
          currentIndustry: currentIndustry,
          targetIndustry: targetIndustry,
          status: 'success',
        });
        console.log(`  ✓ Workspace "${workspaceName}" needs migration: ${currentIndustry || 'undefined'} → ${targetIndustry}`);
      } else {
        alreadyMigrated++;
        result.skipped++;
      }
    }

    console.log(`✅ [FETCH] Found ${needsMigration} workspaces needing migration, ${alreadyMigrated} already migrated`);
    
    return result;
  } catch (error: any) {
    console.error('❌ [FETCH] Error:', error);
    result.errors.push(error.message);
    result.failed = result.total;
    return result;
  }
}

/**
 * ENRICH: Updates workspaces with correct industry vertical
 * 
 * For each workspace:
 * 1. Sets industry field to the correct vertical
 * 2. Sets industryScopeLocked to true
 * 3. Sets industryScopeLockedAt timestamp
 */
export async function enrichWorkspacesWithIndustry(): Promise<WorkspaceMigrationResult> {
  const result: WorkspaceMigrationResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    workspaceDetails: [],
  };

  try {
    console.log('🔄 [ENRICH] Starting workspace industry enrichment...');

    // Get ALL workspaces
    const workspacesSnapshot = await adminDb.collection('workspaces').get();
    
    // Filter workspaces that need migration
    const workspacesToMigrate = workspacesSnapshot.docs.filter(doc => {
      const workspace = doc.data();
      const workspaceName = workspace.name;
      const targetIndustry = WORKSPACE_INDUSTRY_MAP[workspaceName];
      
      if (!targetIndustry) return false;
      
      const currentIndustry = workspace.industry;
      const isLocked = workspace.industryScopeLocked === true;
      
      return !currentIndustry || currentIndustry !== targetIndustry || !isLocked;
    });

    result.total = workspacesToMigrate.length;
    console.log(`📊 [ENRICH] Processing ${result.total} workspaces (out of ${workspacesSnapshot.size} total)...`);

    const batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const workspaceDoc of workspacesToMigrate) {
      try {
        const workspace = workspaceDoc.data();
        const workspaceId = workspaceDoc.id;
        const workspaceName = workspace.name;
        const targetIndustry = WORKSPACE_INDUSTRY_MAP[workspaceName];

        if (!targetIndustry) {
          result.skipped++;
          continue;
        }

        // Update workspace with industry and lock
        const workspaceRef = adminDb.collection('workspaces').doc(workspaceId);
        batch.update(workspaceRef, {
          industry: targetIndustry,
          industryScopeLocked: true,
          industryScopeLockedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        result.succeeded++;
        batchCount++;
        result.workspaceDetails?.push({
          id: workspaceId,
          name: workspaceName,
          currentIndustry: workspace.industry,
          targetIndustry: targetIndustry,
          status: 'success',
        });
        console.log(`  ✓ Enriched workspace "${workspaceName}" with industry: ${targetIndustry}`);

        // Commit batch if size limit reached
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ [ENRICH] Committed batch of ${batchCount} workspaces`);
          batchCount = 0;
        }
      } catch (error: any) {
        console.error(`❌ [ENRICH] Error processing workspace ${workspaceDoc.id}:`, error);
        result.failed++;
        result.errors.push(`${workspaceDoc.id}: ${error.message}`);
        result.workspaceDetails?.push({
          id: workspaceDoc.id,
          name: workspaceDoc.data().name,
          currentIndustry: workspaceDoc.data().industry,
          targetIndustry: WORKSPACE_INDUSTRY_MAP[workspaceDoc.data().name] || 'Unknown',
          status: 'failed',
        });
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ [ENRICH] Committed final batch of ${batchCount} workspaces`);
    }

    console.log(`✅ [ENRICH] Completed: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped`);
    
    return result;
  } catch (error: any) {
    console.error('❌ [ENRICH] Error:', error);
    result.errors.push(error.message);
    return result;
  }
}

/**
 * RESTORE: Validates that workspaces have correct industry data
 * 
 * Verifies:
 * - Workspace has correct industry field
 * - Workspace has industryScopeLocked = true
 * - Workspace has industryScopeLockedAt timestamp
 */
export async function restoreWorkspaceIndustryMigration(): Promise<WorkspaceMigrationResult> {
  const result: WorkspaceMigrationResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    workspaceDetails: [],
  };

  try {
    console.log('🔍 [RESTORE] Validating workspace industry data...');

    // Get all workspaces
    const workspacesSnapshot = await adminDb.collection('workspaces').get();
    
    // Filter to workspaces in our migration map
    const workspacesToValidate = workspacesSnapshot.docs.filter(doc => {
      const workspace = doc.data();
      return !!WORKSPACE_INDUSTRY_MAP[workspace.name];
    });

    result.total = workspacesToValidate.length;
    console.log(`📊 [RESTORE] Validating ${result.total} workspaces...`);

    for (const workspaceDoc of workspacesToValidate) {
      try {
        const workspace = workspaceDoc.data();
        const workspaceId = workspaceDoc.id;
        const workspaceName = workspace.name;
        const targetIndustry = WORKSPACE_INDUSTRY_MAP[workspaceName];

        // Validate industry field
        if (workspace.industry !== targetIndustry) {
          result.failed++;
          result.errors.push(`${workspaceName}: Incorrect industry (expected: ${targetIndustry}, found: ${workspace.industry})`);
          result.workspaceDetails?.push({
            id: workspaceId,
            name: workspaceName,
            currentIndustry: workspace.industry,
            targetIndustry: targetIndustry,
            status: 'failed',
          });
          continue;
        }

        // Validate lock fields
        if (!workspace.industryScopeLocked) {
          result.failed++;
          result.errors.push(`${workspaceName}: Missing industryScopeLocked field`);
          result.workspaceDetails?.push({
            id: workspaceId,
            name: workspaceName,
            currentIndustry: workspace.industry,
            targetIndustry: targetIndustry,
            status: 'failed',
          });
          continue;
        }

        if (!workspace.industryScopeLockedAt) {
          result.failed++;
          result.errors.push(`${workspaceName}: Missing industryScopeLockedAt timestamp`);
          result.workspaceDetails?.push({
            id: workspaceId,
            name: workspaceName,
            currentIndustry: workspace.industry,
            targetIndustry: targetIndustry,
            status: 'failed',
          });
          continue;
        }

        // Validation passed
        result.succeeded++;
        result.workspaceDetails?.push({
          id: workspaceId,
          name: workspaceName,
          currentIndustry: workspace.industry,
          targetIndustry: targetIndustry,
          status: 'success',
        });
        console.log(`  ✓ Workspace "${workspaceName}" has valid industry data: ${targetIndustry}`);
      } catch (error: any) {
        console.error(`❌ [RESTORE] Error validating workspace ${workspaceDoc.id}:`, error);
        result.failed++;
        result.errors.push(`${workspaceDoc.id}: ${error.message}`);
      }
    }

    console.log(`✅ [RESTORE] Completed: ${result.succeeded} valid, ${result.failed} invalid`);
    
    return result;
  } catch (error: any) {
    console.error('❌ [RESTORE] Error:', error);
    result.errors.push(error.message);
    return result;
  }
}

/**
 * ROLLBACK: Removes industry data from workspaces
 */
export async function rollbackWorkspaceIndustryMigration(): Promise<WorkspaceMigrationResult> {
  const result: WorkspaceMigrationResult = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    workspaceDetails: [],
  };

  try {
    console.log('🔄 [ROLLBACK] Starting workspace industry rollback...');

    // Get all workspaces in our migration map
    const workspacesSnapshot = await adminDb.collection('workspaces').get();
    
    const workspacesToRollback = workspacesSnapshot.docs.filter(doc => {
      const workspace = doc.data();
      return !!WORKSPACE_INDUSTRY_MAP[workspace.name];
    });

    result.total = workspacesToRollback.length;
    console.log(`📊 [ROLLBACK] Processing ${result.total} workspaces...`);

    const batch = adminDb.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const workspaceDoc of workspacesToRollback) {
      try {
        const workspaceId = workspaceDoc.id;
        const workspace = workspaceDoc.data();
        const workspaceName = workspace.name;

        // Remove industry fields
        const workspaceRef = adminDb.collection('workspaces').doc(workspaceId);
        batch.update(workspaceRef, {
          industry: null,
          industryScopeLocked: false,
          industryScopeLockedAt: null,
          updatedAt: new Date().toISOString(),
        });

        result.succeeded++;
        batchCount++;
        result.workspaceDetails?.push({
          id: workspaceId,
          name: workspaceName,
          currentIndustry: workspace.industry,
          targetIndustry: 'Removed',
          status: 'success',
        });
        console.log(`  ✓ Rolled back workspace "${workspaceName}"`);

        // Commit batch if size limit reached
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ [ROLLBACK] Committed batch of ${batchCount} workspaces`);
          batchCount = 0;
        }
      } catch (error: any) {
        console.error(`❌ [ROLLBACK] Error rolling back workspace ${workspaceDoc.id}:`, error);
        result.failed++;
        result.errors.push(`${workspaceDoc.id}: ${error.message}`);
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ [ROLLBACK] Committed final batch of ${batchCount} workspaces`);
    }

    console.log(`✅ [ROLLBACK] Completed: ${result.succeeded} succeeded, ${result.failed} failed`);
    
    return result;
  } catch (error: any) {
    console.error('❌ [ROLLBACK] Error:', error);
    result.errors.push(error.message);
    return result;
  }
}
