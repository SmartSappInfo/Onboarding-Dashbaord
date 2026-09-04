/**
 * Seed & Diagnostic CLI Script for Enterprise Offline Sync & Zero-Data-Loss PWA (Company Brain Phase 10).
 *
 * Demonstrates and verifies:
 * 1. Seeding sample knowledge notes for client-side IndexedDB caching.
 * 2. Simulating append-only offline mutation queues (create, update, delete).
 * 3. Simulating concurrent multi-device cloud timestamp drifts & deterministic 3-way conflict detection.
 * 4. Calculating storage quotas and partition estimates.
 *
 * Usage:
 *   npx tsx scripts/seed-offline-sync-demo.ts [workspaceId]
 */

import { adminDb } from '../src/lib/firebase-admin';
import {
  type QuickNote,
  type OfflineMutationJob,
  type NoteDocument,
  QUICK_NOTES_COLLECTION,
} from '../src/lib/quick-notes-types';
import {
  createOfflineMutationJob,
  generateDocumentDiffSummary,
  resolveOfflineConflict,
  computeOfflineBackoffDelay,
  calculateCacheStorageEstimate,
  filterOfflineMutations,
} from '../src/lib/quick-notes-domain';

const DEFAULT_WORKSPACE_ID = 'default';

async function seedOfflineSyncDemo() {
  const workspaceId = process.argv[2] || DEFAULT_WORKSPACE_ID;
  console.log(`\n================================================================`);
  console.log(`🚀 Phase 10: Enterprise Offline Sync & Zero-Data-Loss PWA Demo`);
  console.log(`🏢 Target Workspace: [${workspaceId}]`);
  console.log(`================================================================\n`);

  const now = new Date().toISOString();
  const basePast = new Date(Date.now() - 3600 * 1000).toISOString();

  // 1. Showcase Offline-Ready Notes
  const showcaseNotes: Array<Omit<QuickNote, 'id'>> = [
    {
      workspaceId,
      title: 'Field Visit: Ridge Church School Offline Inspection',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Conducted offline field audit of Ridge Church School IT lab. Bursar requested offline SMS queuing for remote fee updates during internet outages.',
              },
            ],
          },
        ],
      },
      document: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Conducted offline field audit of Ridge Church School IT lab. Bursar requested offline SMS queuing for remote fee updates during internet outages.',
              },
            ],
          },
        ],
      },
      plainText: 'Conducted offline field audit of Ridge Church School IT lab. Bursar requested offline SMS queuing for remote fee updates during internet outages.',
      category: 'school_note',
      knowledgeType: 'meeting_note',
      tags: ['offline', 'field-audit', 'sms-queue', 'ridge-church'],
      color: 'blue',
      pinned: true,
      archived: false,
      authorId: 'user-field-auditor-1',
      authorName: 'Kwame Mensah (Field Agent)',
      authorEmail: 'kwame@smartsapp.com',
      createdAt: basePast,
      updatedAt: basePast,
      lastModified: basePast,
    },
    {
      workspaceId,
      title: 'Regional Hub Connectivity Fallback Protocol',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Standard operating procedure for Ashanti & Northern Region schools when fiber internet drops. Sync engine stores mutations in IndexedDB and drains automatically upon reconnect.',
              },
            ],
          },
        ],
      },
      document: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Standard operating procedure for Ashanti & Northern Region schools when fiber internet drops. Sync engine stores mutations in IndexedDB and drains automatically upon reconnect.',
              },
            ],
          },
        ],
      },
      plainText: 'Standard operating procedure for Ashanti & Northern Region schools when fiber internet drops. Sync engine stores mutations in IndexedDB and drains automatically upon reconnect.',
      category: 'sop',
      knowledgeType: 'sop',
      tags: ['pwa', 'indexeddb', 'connectivity', 'standard-operating-procedure'],
      color: 'emerald',
      pinned: false,
      archived: false,
      authorId: 'user-ops-lead',
      authorName: 'Ama Osei (Ops Lead)',
      authorEmail: 'ama@smartsapp.com',
      createdAt: basePast,
      updatedAt: basePast,
      lastModified: basePast,
    },
  ];

  console.log(`📦 [1/4] Preparing ${showcaseNotes.length} offline-ready notes...`);
  const createdNoteIds: string[] = [];

  try {
    for (const note of showcaseNotes) {
      const docRef = adminDb.collection(QUICK_NOTES_COLLECTION).doc();
      await docRef.set({
        ...note,
        id: docRef.id,
      });
      createdNoteIds.push(docRef.id);
      console.log(`   ✅ Synced Note to Firestore [${docRef.id}]: "${note.title}"`);
    }
  } catch {
    console.log(`   ℹ️ Running in pure local mode (cloud credentials skipped). Using mock entity IDs.`);
    createdNoteIds.push('note-field-audit-01', 'note-sop-02');
  }

  // 2. Simulate Local Append-Only Mutation Queue
  console.log(`\n⚡ [2/4] Simulating Client-Side FIFO Mutation Queue generation...`);
  const sampleNoteId = createdNoteIds[0] || 'note-field-audit-01';

  const mutationCreate = createOfflineMutationJob({
    workspaceId,
    entityId: 'note-local-draft-99',
    type: 'create_note',
    payload: {
      title: 'New Offline Draft Note (Created in Airplane Mode)',
      category: 'general',
      knowledgeType: 'fleeting_note',
      tags: ['offline-first', 'draft'],
    },
    id: 'client-mut-001',
  });

  const localEditedDoc: NoteDocument = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Conducted offline field audit of Ridge Church School IT lab. Bursar requested offline SMS queuing. Local addition: verified generator backup.',
          },
        ],
      },
    ],
  };

  const mutationUpdate = createOfflineMutationJob({
    workspaceId,
    entityId: sampleNoteId,
    type: 'update_note',
    payload: {
      title: 'Field Visit: Ridge Church School Offline Inspection (Local Edits)',
      tags: ['offline', 'field-audit', 'local-changes-applied'],
      document: localEditedDoc,
    },
    baseServerUpdatedAt: basePast,
    id: 'client-mut-002',
  });

  const simulatedQueue: OfflineMutationJob[] = [mutationCreate, mutationUpdate];
  console.log(`   📝 Queued ${simulatedQueue.length} optimistic mutations in client memory.`);
  console.log(`   - Mutation 1: ${mutationCreate.type} [${mutationCreate.id}] -> Status: ${mutationCreate.status}`);
  console.log(`   - Mutation 2: ${mutationUpdate.type} [${mutationUpdate.id}] (Base timestamp: ${mutationUpdate.baseServerUpdatedAt})`);

  // 3. Simulate Server Timestamp Drift & 3-Way Conflict Resolution
  console.log(`\n⚔️ [3/4] Simulating Concurrent Server Drift & 3-Way Conflict Detection...`);
  const serverConflictTimestamp = new Date(Date.now() - 300 * 1000).toISOString();

  const serverEditedDoc: NoteDocument = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Conducted offline field audit of Ridge Church School IT lab. Headmaster notes: Starlink satellite dish installed.',
          },
        ],
      },
    ],
  };

  const serverSnapshot: QuickNote = {
    id: sampleNoteId,
    workspaceId,
    title: 'Field Visit: Ridge Church School Offline Inspection (Headmaster Edited on Web)',
    content: serverEditedDoc,
    document: serverEditedDoc,
    plainText: 'Conducted offline field audit of Ridge Church School IT lab. Headmaster notes: Starlink satellite dish installed.',
    category: 'school_note',
    knowledgeType: 'meeting_note',
    tags: ['offline', 'field-audit', 'cloud-version'],
    authorId: 'user-headmaster',
    authorName: 'Rev. Addo (Headmaster)',
    createdAt: basePast,
    updatedAt: serverConflictTimestamp,
  };

  const resolutionResult = resolveOfflineConflict({
    localJob: mutationUpdate,
    serverSnapshot,
    action: 'smart_merge',
  });

  console.log(`   🔍 Base client timestamp: ${mutationUpdate.baseServerUpdatedAt}`);
  console.log(`   ☁️ Server latest timestamp: ${serverSnapshot.updatedAt}`);
  console.log(`   🚨 Conflict detected: ${resolutionResult.isConflict ? 'YES (Server modified concurrently)' : 'NO'}`);

  if (resolutionResult.isConflict && resolutionResult.conflictDetails) {
    const diff = resolutionResult.conflictDetails.diffSummary;
    console.log(`   📊 Visual Diff Summary:`);
    console.log(`      - Local Changes:  ${diff.localChanges.length} line(s)`);
    console.log(`      - Server Changes: ${diff.serverChanges.length} line(s)`);

    console.log(`   🛡️ Auto-Resolution Path: "smart_merge"`);
    console.log(`      - Merged Tags Count: ${(resolutionResult.resolvedPayload?.tags as string[] | undefined)?.length || 0}`);
  }

  // 4. Storage Quotas & Partition Diagnostics
  console.log(`\n💾 [4/4] Evaluating Browser IndexedDB Storage Quotas & Backoff Logic...`);
  const estimatedBytes = calculateCacheStorageEstimate(showcaseNotes.length, 1, simulatedQueue.length);
  console.log(`   📈 Storage Estimate:`);
  console.log(`      - Estimated Local DB: ~${estimatedBytes} bytes (${(estimatedBytes / 1024).toFixed(2)} KB)`);

  const filteredQueue = filterOfflineMutations(simulatedQueue, { status: 'pending' });
  console.log(`      - Filtered Pending Mutations: ${filteredQueue.length} jobs`);

  const backoffRetry1 = computeOfflineBackoffDelay(1);
  const backoffRetry3 = computeOfflineBackoffDelay(3);
  console.log(`   ⏱️ Exponential Backoff Delays:`);
  console.log(`      - Attempt 1: ${backoffRetry1}ms`);
  console.log(`      - Attempt 3: ${backoffRetry3}ms (with deterministic jitter)`);

  console.log(`\n================================================================`);
  console.log(`🎉 Phase 10 Offline Sync & Zero-Data-Loss PWA Demonstration Complete!`);
  console.log(`================================================================\n`);
}

seedOfflineSyncDemo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error during Phase 10 offline sync demo seeding:', err);
    process.exit(1);
  });
