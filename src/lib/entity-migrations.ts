/**
 * Entity Schema Migration Functions
 * 
 * Implements Fetch → Enrich → Restore protocol for migrating to entity architecture.
 * Each function includes full rollback capability via backup collections.
 * 
 * Requirements: 19 (Migration), 18 (Backward Compatibility)
 */

'use client';

import { 
    collection, 
    writeBatch, 
    getDocs, 
    doc, 
    type Firestore 
} from 'firebase/firestore';
import type { School } from '@/lib/types';

const DEFAULT_ORG_ID = 'smartsapp-hq';
const BATCH_SIZE = 450; // Leave room for safety

interface MigrationResult {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    errors: Array<{ id: string; error: string }>;
}

/**
 * PHASE 1: Schools → Entities + Workspace_Entities
 * Core migration that creates the entity architecture
 */
export async function migrateSchoolsToEntities(firestore: Firestore): Promise<MigrationResult> {
    console.log('🚀 Starting schools → entities migration...');
    const timestamp = new Date().toISOString();
    const result: MigrationResult = { total: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
    
    try {
        // FETCH: Get all schools
        const schoolsSnap = await getDocs(collection(firestore, 'schools'));
        result.total = schoolsSnap.size;
        console.log(`📊 Found ${result.total} schools to process`);

        let batch = writeBatch(firestore);
        let operationCount = 0;
        
        for (const schoolDoc of schoolsSnap.docs) {
            try {
                const school = schoolDoc.data() as School;
                
                // Skip if already migrated
                if (school.migrationStatus === 'migrated') {
                    console.log(`⏭️  Skipping ${schoolDoc.id} - already migrated`);
                    result.skipped++;
                    continue;
                }
                
                // ENRICH: Create backup
                const backupRef = doc(firestore, 'backup_entities_migration', schoolDoc.id);
                batch.set(backupRef, { ...school, backedUpAt: timestamp });
                operationCount++;
                
                // ENRICH: Create entity
                const entityId = `entity_${schoolDoc.id}`;
                const entityRef = doc(firestore, 'entities', entityId);
                const slug = school.slug || school.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                batch.set(entityRef, {
                    id: entityId,
                    entityType: 'institution',
                    organizationId: DEFAULT_ORG_ID,
                    name: school.name,
                    slug: slug,
                    globalTags: school.tags || [],
                    institutionData: {
                        nominalRoll: school.nominalRoll || 0,
                        billingAddress: school.billingAddress || '',
                        currency: school.currency || 'GHS',
                        subscriptionPackageId: school.subscriptionPackageId || '',
                        subscriptionRate: school.subscriptionRate || 0,
                        focalPersons: school.focalPersons || []
                    },
                    createdAt: school.createdAt || timestamp,
                    updatedAt: timestamp
                });
                operationCount++;
                
                // ENRICH: Create workspace_entities for each workspace
                const workspaceIds = school.workspaceIds || ['onboarding'];
                for (const workspaceId of workspaceIds) {
                    const workspaceEntityId = `${workspaceId}_${entityId}`;
                    const workspaceEntityRef = doc(firestore, 'workspace_entities', workspaceEntityId);
                    batch.set(workspaceEntityRef, {
                        id: workspaceEntityId,
                        workspaceId: workspaceId,
                        entityId: entityId,
                        organizationId: DEFAULT_ORG_ID,
                        displayName: school.name,
                        primaryEmail: '',
                        primaryPhone: '',
                        pipelineId: school.pipelineId || '',
                        stageId: school.stage?.id || '',
                        currentStageName: school.stage?.name || '',
                        status: school.status || 'Onboarding',
                        assignedTo: school.assignedTo || '',
                        workspaceTags: [],
                        createdAt: school.createdAt || timestamp,
                        updatedAt: timestamp
                    });
                    operationCount++;
                }
                
                // ENRICH: Update school with migration status
                batch.update(schoolDoc.ref, {
                    migrationStatus: 'migrated',
                    entityId: entityId,
                    migratedAt: timestamp
                });
                operationCount++;
                
                // RESTORE: Commit batch if approaching limit
                if (operationCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`✅ Committed batch (${result.succeeded + 1} schools processed)`);
                    batch = writeBatch(firestore);
                    operationCount = 0;
                }
                
                result.succeeded++;
                
            } catch (error: any) {
                console.error(`❌ Error migrating school ${schoolDoc.id}:`, error);
                result.failed++;
                result.errors.push({ id: schoolDoc.id, error: error.message });
            }
        }
        
        // RESTORE: Commit remaining operations
        if (operationCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch`);
        }
        
        console.log(`\n📈 Migration Summary:`);
        console.log(`   Total: ${result.total}`);
        console.log(`   ✅ Succeeded: ${result.succeeded}`);
        console.log(`   ⏭️  Skipped: ${result.skipped}`);
        console.log(`   ❌ Failed: ${result.failed}`);
        
        return result;
        
    } catch (error: any) {
        console.error('💥 Fatal error during migration:', error);
        throw error;
    }
}

/**
 * ROLLBACK: Entities Migration
 * Restores schools from backup and deletes entities/workspace_entities
 */
export async function rollbackEntitiesMigration(firestore: Firestore): Promise<MigrationResult> {
    console.log('🔄 Starting entities migration rollback...');
    const result: MigrationResult = { total: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
    
    try {
        // FETCH: Get all backups
        const backupSnap = await getDocs(collection(firestore, 'backup_entities_migration'));
        result.total = backupSnap.size;
        console.log(`📊 Found ${result.total} backups to restore`);
        
        let batch = writeBatch(firestore);
        let operationCount = 0;
        
        for (const backupDoc of backupSnap.docs) {
            try {
                const { backedUpAt, ...originalSchool } = backupDoc.data();
                
                // RESTORE: Original school
                batch.set(doc(firestore, 'schools', backupDoc.id), originalSchool);
                operationCount++;
                
                // DELETE: Entity
                const entityId = `entity_${backupDoc.id}`;
                batch.delete(doc(firestore, 'entities', entityId));
                operationCount++;
                
                // DELETE: Workspace_entities
                const workspaceIds = originalSchool.workspaceIds || ['onboarding'];
                for (const workspaceId of workspaceIds) {
                    const workspaceEntityId = `${workspaceId}_${entityId}`;
                    batch.delete(doc(firestore, 'workspace_entities', workspaceEntityId));
                    operationCount++;
                }
                
                // DELETE: Backup
                batch.delete(backupDoc.ref);
                operationCount++;
                
                // Commit batch if approaching limit
                if (operationCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`✅ Committed rollback batch (${result.succeeded + 1} schools restored)`);
                    batch = writeBatch(firestore);
                    operationCount = 0;
                }
                
                result.succeeded++;
                
            } catch (error: any) {
                console.error(`❌ Error rolling back school ${backupDoc.id}:`, error);
                result.failed++;
                result.errors.push({ id: backupDoc.id, error: error.message });
            }
        }
        
        // Commit remaining operations
        if (operationCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final rollback batch`);
        }
        
        console.log(`\n📈 Rollback Summary:`);
        console.log(`   Total: ${result.total}`);
        console.log(`   ✅ Restored: ${result.succeeded}`);
        console.log(`   ❌ Failed: ${result.failed}`);
        
        return result;
        
    } catch (error: any) {
        console.error('💥 Fatal error during rollback:', error);
        throw error;
    }
}

/**
 * VERIFICATION: Check migration status
 */
export async function verifyEntitiesMigration(firestore: Firestore): Promise<{
    schools: { total: number; migrated: number; legacy: number };
    entities: { total: number };
    workspaceEntities: { total: number };
}> {
    console.log('🔍 Verifying migration status...');
    
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    const entitiesSnap = await getDocs(collection(firestore, 'entities'));
    const workspaceEntitiesSnap = await getDocs(collection(firestore, 'workspace_entities'));
    
    let migratedCount = 0;
    let legacyCount = 0;
    
    schoolsSnap.forEach(doc => {
        const school = doc.data() as School;
        if (school.migrationStatus === 'migrated') {
            migratedCount++;
        } else {
            legacyCount++;
        }
    });
    
    const stats = {
        schools: {
            total: schoolsSnap.size,
            migrated: migratedCount,
            legacy: legacyCount
        },
        entities: {
            total: entitiesSnap.size
        },
        workspaceEntities: {
            total: workspaceEntitiesSnap.size
        }
    };
    
    console.log('\n📊 Migration Status:');
    console.log(`   Schools: ${stats.schools.total} total (${stats.schools.migrated} migrated, ${stats.schools.legacy} legacy)`);
    console.log(`   Entities: ${stats.entities.total}`);
    console.log(`   Workspace Entities: ${stats.workspaceEntities.total}`);
    
    return stats;
}
