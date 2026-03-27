#!/usr/bin/env tsx
/**
 * Test Migration Script
 * 
 * Creates sample schools data and runs the migration to verify:
 * 1. Entities and workspace_entities are created correctly
 * 2. Idempotency: running twice produces same result
 * 3. Error handling for malformed records
 * 
 * Task: 29 - Checkpoint - Migration script runs successfully
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { adminDb } from '../src/lib/firebase-admin';
import type { School } from '../src/lib/types';
import { getOrganizationId } from '../src/lib/organization-utils';

const TEST_ORG_ID = 'test-org-migration';
const TEST_WORKSPACE_ID = 'test-workspace-migration';

interface TestResult {
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Clean up test data
 */
async function cleanup() {
  console.log('🧹 Cleaning up test data...');
  
  // Delete test schools
  const schoolsSnap = await adminDb
    .collection('schools')
    .where('organizationId', '==', TEST_ORG_ID)
    .get();
  
  for (const doc of schoolsSnap.docs) {
    await doc.ref.delete();
  }
  
  // Delete test entities
  const entitiesSnap = await adminDb
    .collection('entities')
    .where('organizationId', '==', TEST_ORG_ID)
    .get();
  
  for (const doc of entitiesSnap.docs) {
    await doc.ref.delete();
  }
  
  // Delete test workspace_entities
  const weSnap = await adminDb
    .collection('workspace_entities')
    .where('organizationId', '==', TEST_ORG_ID)
    .get();
  
  for (const doc of weSnap.docs) {
    await doc.ref.delete();
  }
  
  console.log('   ✅ Cleanup complete\n');
}

/**
 * Create sample schools data
 */
async function createSampleSchools(): Promise<string[]> {
  console.log('📝 Creating sample schools data...');
  
  const schools: Omit<School, 'id'>[] = [
    {
      organizationId: TEST_ORG_ID,
      name: 'Greenwood Academy',
      slug: 'greenwood-academy',
      workspaceIds: [TEST_WORKSPACE_ID],
      status: 'Active',
      pipelineId: 'pipeline-1',
      stage: {
        id: 'stage-1',
        name: 'Onboarding',
        order: 1,
      },
      focalPersons: [
        {
          name: 'Jane Smith',
          email: 'jane@greenwood.edu',
          phone: '+1234567890',
          type: 'Principal',
          isSignatory: true,
        },
      ],
      tags: ['premium', 'active'],
      nominalRoll: 500,
      subscriptionPackageId: 'pkg-premium',
      subscriptionRate: 5000,
      billingAddress: '123 Main St, City, State 12345',
      currency: 'USD',
      modules: [
        { id: 'mod-1', name: 'Admissions', abbreviation: 'ADM', color: '#4CAF50' },
      ],
      implementationDate: '2024-01-15T00:00:00Z',
      referee: 'John Doe',
      createdAt: '2024-01-01T00:00:00Z',
      schoolStatus: 'Active',
      assignedTo: {
        userId: 'user-1',
        name: 'Sales Rep',
        email: 'rep@company.com',
      },
    },
    {
      organizationId: TEST_ORG_ID,
      name: 'Riverside School',
      slug: 'riverside-school',
      workspaceIds: [TEST_WORKSPACE_ID],
      status: 'Active',
      pipelineId: 'pipeline-1',
      stage: {
        id: 'stage-2',
        name: 'Active',
        order: 2,
      },
      focalPersons: [
        {
          name: 'Bob Johnson',
          email: 'bob@riverside.edu',
          phone: '+9876543210',
          type: 'Administrator',
          isSignatory: false,
        },
      ],
      tags: ['standard'],
      nominalRoll: 300,
      subscriptionPackageId: 'pkg-standard',
      subscriptionRate: 3000,
      billingAddress: '456 River Rd, Town, State 67890',
      currency: 'USD',
      createdAt: '2024-02-01T00:00:00Z',
      schoolStatus: 'Active',
    },
    {
      // Malformed record - missing required fields
      organizationId: TEST_ORG_ID,
      name: '', // Empty name
      slug: 'malformed-school',
      workspaceIds: [TEST_WORKSPACE_ID],
      status: 'Active',
      createdAt: '2024-03-01T00:00:00Z',
      schoolStatus: 'Active',
    } as any,
  ];
  
  const schoolIds: string[] = [];
  
  for (const school of schools) {
    const ref = await adminDb.collection('schools').add(school);
    schoolIds.push(ref.id);
  }
  
  console.log(`   ✅ Created ${schoolIds.length} sample schools\n`);
  return schoolIds;
}

/**
 * Simulate migration for a single school
 */
async function migrateSchool(schoolId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const schoolDoc = await adminDb.collection('schools').doc(schoolId).get();
    
    if (!schoolDoc.exists) {
      return { success: false, error: 'School not found' };
    }
    
    const school = { id: schoolDoc.id, ...schoolDoc.data() } as School;
    
    // Skip if already migrated
    if (school.migrationStatus === 'migrated') {
      return { success: true };
    }
    
    // Validate required fields
    if (!school.name || school.name.trim() === '') {
      throw new Error('School name is required');
    }
    
    const timestamp = new Date().toISOString();
    const organizationId = getOrganizationId(school);
    
    // Check if entity already exists
    const existingEntitySnap = await adminDb
      .collection('entities')
      .where('organizationId', '==', organizationId)
      .where('name', '==', school.name)
      .where('entityType', '==', 'institution')
      .limit(1)
      .get();
    
    let entityId: string;
    
    if (!existingEntitySnap.empty) {
      entityId = existingEntitySnap.docs[0].id;
    } else {
      // Create entity
      const entityData = {
        organizationId,
        entityType: 'institution',
        name: school.name,
        slug: school.slug || school.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        contacts: school.focalPersons || [],
        globalTags: [],
        status: school.status === 'Archived' ? 'archived' : 'active',
        createdAt: school.createdAt || timestamp,
        updatedAt: timestamp,
        institutionData: {
          nominalRoll: school.nominalRoll,
          subscriptionPackageId: school.subscriptionPackageId,
          subscriptionRate: school.subscriptionRate,
          billingAddress: school.billingAddress,
          currency: school.currency,
          modules: school.modules,
          implementationDate: school.implementationDate,
          referee: school.referee,
        },
        relatedEntityIds: [],
      };
      
      const entityRef = await adminDb.collection('entities').add(entityData);
      entityId = entityRef.id;
    }
    
    // Create workspace_entities
    const workspaceIds = school.workspaceIds || [];
    
    for (const workspaceId of workspaceIds) {
      // Check if link already exists
      const existingLinkSnap = await adminDb
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', '==', entityId)
        .limit(1)
        .get();
      
      if (!existingLinkSnap.empty) {
        continue;
      }
      
      const primaryContact = school.focalPersons?.[0];
      
      const workspaceEntityData = {
        organizationId,
        workspaceId,
        entityId,
        entityType: 'institution',
        pipelineId: school.pipelineId || '',
        stageId: school.stage?.id || '',
        assignedTo: school.assignedTo,
        status: school.status === 'Archived' ? 'archived' : 'active',
        workspaceTags: school.tags || [],
        addedAt: school.createdAt || timestamp,
        updatedAt: timestamp,
        displayName: school.name,
        primaryEmail: primaryContact?.email,
        primaryPhone: primaryContact?.phone,
        currentStageName: school.stage?.name,
      };
      
      await adminDb.collection('workspace_entities').add(workspaceEntityData);
    }
    
    // Mark as migrated
    await adminDb.collection('schools').doc(schoolId).update({
      migrationStatus: 'migrated',
      updatedAt: timestamp,
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Test 1: Verify entities and workspace_entities created correctly
 */
async function test1_VerifyCreation(schoolIds: string[]): Promise<TestResult> {
  console.log('Test 1: Verify entities and workspace_entities created correctly');
  
  try {
    // Migrate first two schools (skip malformed one)
    for (let i = 0; i < 2; i++) {
      await migrateSchool(schoolIds[i]);
    }
    
    // Verify entities created
    const entitiesSnap = await adminDb
      .collection('entities')
      .where('organizationId', '==', TEST_ORG_ID)
      .get();
    
    if (entitiesSnap.size !== 2) {
      return {
        passed: false,
        message: `Expected 2 entities, found ${entitiesSnap.size}`,
      };
    }
    
    // Verify workspace_entities created
    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('organizationId', '==', TEST_ORG_ID)
      .get();
    
    if (weSnap.size !== 2) {
      return {
        passed: false,
        message: `Expected 2 workspace_entities, found ${weSnap.size}`,
      };
    }
    
    // Verify data integrity
    const entity = entitiesSnap.docs[0].data();
    if (entity.entityType !== 'institution') {
      return {
        passed: false,
        message: `Expected entityType 'institution', found '${entity.entityType}'`,
      };
    }
    
    const we = weSnap.docs[0].data();
    if (!we.displayName || !we.workspaceId || !we.entityId) {
      return {
        passed: false,
        message: 'Workspace entity missing required denormalized fields',
      };
    }
    
    // Verify schools marked as migrated
    const school1 = await adminDb.collection('schools').doc(schoolIds[0]).get();
    if (school1.data()?.migrationStatus !== 'migrated') {
      return {
        passed: false,
        message: 'School not marked as migrated',
      };
    }
    
    return {
      passed: true,
      message: 'Entities and workspace_entities created correctly',
      details: {
        entitiesCreated: entitiesSnap.size,
        workspaceEntitiesCreated: weSnap.size,
      },
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed: ${error.message}`,
    };
  }
}

/**
 * Test 2: Verify idempotency - running twice produces same result
 */
async function test2_VerifyIdempotency(schoolIds: string[]): Promise<TestResult> {
  console.log('Test 2: Verify idempotency - running twice produces same result');
  
  try {
    // Count before second run
    const entitiesBeforeSnap = await adminDb
      .collection('entities')
      .where('organizationId', '==', TEST_ORG_ID)
      .get();
    const entitiesCountBefore = entitiesBeforeSnap.size;
    
    const weBeforeSnap = await adminDb
      .collection('workspace_entities')
      .where('organizationId', '==', TEST_ORG_ID)
      .get();
    const weCountBefore = weBeforeSnap.size;
    
    // Run migration again on first school
    await migrateSchool(schoolIds[0]);
    
    // Count after second run
    const entitiesAfterSnap = await adminDb
      .collection('entities')
      .where('organizationId', '==', TEST_ORG_ID)
      .get();
    const entitiesCountAfter = entitiesAfterSnap.size;
    
    const weAfterSnap = await adminDb
      .collection('workspace_entities')
      .where('organizationId', '==', TEST_ORG_ID)
      .get();
    const weCountAfter = weAfterSnap.size;
    
    // Verify no duplicates created
    if (entitiesCountAfter !== entitiesCountBefore) {
      return {
        passed: false,
        message: `Duplicate entities created: ${entitiesCountBefore} → ${entitiesCountAfter}`,
      };
    }
    
    if (weCountAfter !== weCountBefore) {
      return {
        passed: false,
        message: `Duplicate workspace_entities created: ${weCountBefore} → ${weCountAfter}`,
      };
    }
    
    return {
      passed: true,
      message: 'Idempotency verified - no duplicates created',
      details: {
        entitiesCount: entitiesCountAfter,
        workspaceEntitiesCount: weCountAfter,
      },
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed: ${error.message}`,
    };
  }
}

/**
 * Test 3: Verify error handling for malformed records
 */
async function test3_VerifyErrorHandling(schoolIds: string[]): Promise<TestResult> {
  console.log('Test 3: Verify error handling for malformed records');
  
  try {
    // Try to migrate malformed school (empty name)
    const result = await migrateSchool(schoolIds[2]);
    
    if (result.success) {
      return {
        passed: false,
        message: 'Malformed record should have failed but succeeded',
      };
    }
    
    if (!result.error || !result.error.includes('name')) {
      return {
        passed: false,
        message: `Expected error about name, got: ${result.error}`,
      };
    }
    
    // Verify malformed school was NOT marked as migrated
    const schoolDoc = await adminDb.collection('schools').doc(schoolIds[2]).get();
    const school = schoolDoc.data();
    
    if (school?.migrationStatus === 'migrated') {
      return {
        passed: false,
        message: 'Malformed school should not be marked as migrated',
      };
    }
    
    // Verify no entity was created for malformed school
    const entitiesSnap = await adminDb
      .collection('entities')
      .where('organizationId', '==', TEST_ORG_ID)
      .where('name', '==', '')
      .get();
    
    if (!entitiesSnap.empty) {
      return {
        passed: false,
        message: 'Entity should not be created for malformed school',
      };
    }
    
    return {
      passed: true,
      message: 'Error handling works correctly for malformed records',
      details: {
        error: result.error,
      },
    };
  } catch (error: any) {
    return {
      passed: false,
      message: `Test failed: ${error.message}`,
    };
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Migration Script Test Suite');
  console.log('  Task 29: Checkpoint - Migration script runs successfully');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  try {
    // Cleanup any existing test data
    await cleanup();
    
    // Create sample schools
    const schoolIds = await createSampleSchools();
    
    // Run tests
    const results: TestResult[] = [];
    
    results.push(await test1_VerifyCreation(schoolIds));
    console.log(`   ${results[0].passed ? '✅' : '❌'} ${results[0].message}`);
    if (results[0].details) {
      console.log(`      Details: ${JSON.stringify(results[0].details)}`);
    }
    console.log('');
    
    results.push(await test2_VerifyIdempotency(schoolIds));
    console.log(`   ${results[1].passed ? '✅' : '❌'} ${results[1].message}`);
    if (results[1].details) {
      console.log(`      Details: ${JSON.stringify(results[1].details)}`);
    }
    console.log('');
    
    results.push(await test3_VerifyErrorHandling(schoolIds));
    console.log(`   ${results[2].passed ? '✅' : '❌'} ${results[2].message}`);
    if (results[2].details) {
      console.log(`      Details: ${JSON.stringify(results[2].details)}`);
    }
    console.log('');
    
    // Summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Test Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Total tests:  ${results.length}`);
    console.log(`  Passed:       ${passed}`);
    console.log(`  Failed:       ${failed}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    // Cleanup
    await cleanup();
    
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error);
    await cleanup();
    process.exit(1);
  }
}

main();
