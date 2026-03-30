/**
 * Firestore Index Verification Script
 * 
 * This script verifies that all required entityId indexes are created
 * and measures query performance to ensure it meets requirements.
 * 
 * Requirements: 22.3, 28.1
 * 
 * Usage:
 *   npx tsx scripts/verify-firestore-indexes.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

interface IndexTest {
  collection: string;
  description: string;
  query: (workspaceId: string, entityId: string) => Promise<number>;
}

const INDEX_TESTS: IndexTest[] = [
  {
    collection: 'tasks',
    description: 'Tasks by workspaceId + entityId + dueDate',
    query: async (workspaceId, entityId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('tasks')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', '==', entityId)
        .orderBy('dueDate', 'asc')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'activities',
    description: 'Activities by workspaceId + entityId + timestamp',
    query: async (workspaceId, entityId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('activities')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', '==', entityId)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'workspace_entities',
    description: 'Workspace entities by workspaceId + entityType + status',
    query: async (workspaceId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('entityType', '==', 'institution')
        .where('status', '==', 'active')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'workspace_entities',
    description: 'Workspace entities by workspaceId + pipelineId + stageId',
    query: async (workspaceId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('workspace_entities')
        .where('workspaceId', '==', workspaceId)
        .where('pipelineId', '==', 'test-pipeline')
        .where('stageId', '==', 'test-stage')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'message_logs',
    description: 'Message logs by workspaceId + entityId + sentAt',
    query: async (workspaceId, entityId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('message_logs')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', '==', entityId)
        .orderBy('sentAt', 'desc')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'forms',
    description: 'Forms by workspaceId + entityId + status',
    query: async (workspaceId, entityId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('forms')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', '==', entityId)
        .where('status', '==', 'published')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'invoices',
    description: 'Invoices by organizationId + entityId + status',
    query: async (workspaceId, entityId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('invoices')
        .where('organizationId', '==', workspaceId) // Using workspaceId as organizationId for test
        .where('entityId', '==', entityId)
        .where('status', '==', 'sent')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'meetings',
    description: 'Meetings by workspaceId + entityId + startTime',
    query: async (workspaceId, entityId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('meetings')
        .where('workspaceIds', 'array-contains', workspaceId)
        .where('entityId', '==', entityId)
        .orderBy('meetingTime', 'asc')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'surveys',
    description: 'Surveys by workspaceId + entityId + status',
    query: async (workspaceId, entityId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('surveys')
        .where('workspaceIds', 'array-contains', workspaceId)
        .where('entityId', '==', entityId)
        .where('status', '==', 'active')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'pdfs',
    description: 'PDFs by workspaceId + entityId + createdAt',
    query: async (workspaceId, entityId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('pdfs')
        .where('workspaceIds', 'array-contains', workspaceId)
        .where('entityId', '==', entityId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
  {
    collection: 'automation_logs',
    description: 'Automation logs by workspaceId + entityId + executedAt',
    query: async (workspaceId, entityId) => {
      const start = Date.now();
      const snapshot = await db
        .collection('automation_logs')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', '==', entityId)
        .orderBy('executedAt', 'desc')
        .limit(10)
        .get();
      const duration = Date.now() - start;
      console.log(`  ✓ Query returned ${snapshot.size} documents in ${duration}ms`);
      return duration;
    },
  },
];

async function verifyIndexes() {
  console.log('🔍 Verifying Firestore Indexes for EntityId Migration\n');
  console.log('Requirements: Queries should complete in < 1000ms (Requirement 28.1)\n');

  // Get a sample workspaceId and entityId from the database
  const workspaceSnapshot = await db.collection('workspaces').limit(1).get();
  if (workspaceSnapshot.empty) {
    console.error('❌ No workspaces found. Please ensure the database has test data.');
    process.exit(1);
  }
  const workspaceId = workspaceSnapshot.docs[0].id;

  const entitySnapshot = await db.collection('entities').limit(1).get();
  if (entitySnapshot.empty) {
    console.error('❌ No entities found. Please ensure the database has test data.');
    process.exit(1);
  }
  const entityId = entitySnapshot.docs[0].id;

  console.log(`Using test data:`);
  console.log(`  Workspace ID: ${workspaceId}`);
  console.log(`  Entity ID: ${entityId}\n`);

  const results: { collection: string; duration: number; passed: boolean }[] = [];

  for (const test of INDEX_TESTS) {
    console.log(`Testing: ${test.description}`);
    try {
      const duration = await test.query(workspaceId, entityId);
      const passed = duration < 1000;
      results.push({ collection: test.collection, duration, passed });
      
      if (!passed) {
        console.log(`  ⚠️  WARNING: Query exceeded 1000ms threshold`);
      }
    } catch (error) {
      console.error(`  ❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      results.push({ collection: test.collection, duration: -1, passed: false });
    }
    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Summary\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const avgDuration = results
    .filter((r) => r.duration > 0)
    .reduce((sum, r) => sum + r.duration, 0) / results.filter((r) => r.duration > 0).length;

  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ${failed > 0 ? '✗' : ''}`);
  console.log(`Average query time: ${avgDuration.toFixed(2)}ms\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.collection}: ${r.duration > 0 ? `${r.duration}ms` : 'Error'}`);
      });
    console.log('');
  }

  if (passed === results.length) {
    console.log('✅ All indexes verified successfully!');
    console.log('All queries completed within the 1000ms threshold.');
  } else {
    console.log('⚠️  Some indexes may need optimization or are not yet deployed.');
    console.log('Please check the Firestore console to ensure all indexes are created.');
    console.log('Run: firebase deploy --only firestore:indexes');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run verification
verifyIndexes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
