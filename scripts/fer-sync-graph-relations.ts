#!/usr/bin/env tsx
/**
 * Migration Script: FER Protocol - Synchronize CRM Records & Memories to Graph Mesh
 *
 * Usage:
 *   npx tsx scripts/fer-sync-graph-relations.ts
 *   DRY_RUN=true npx tsx scripts/fer-sync-graph-relations.ts
 *   TARGET_WORKSPACE_ID=ws_123 npx tsx scripts/fer-sync-graph-relations.ts
 *
 * Purpose:
 *   1. Scans CRM Entities, Contacts, Deals, and institutional `MemoryObject` documents.
 *   2. Projects CRM structural nodes (Entity, Contact, Deal) and explicit relationship edges.
 *   3. Projects atomic MemoryObject nodes and typed semantic edges (HAS_PROBLEM, HAS_OPPORTUNITY, HAS_RISK, INTERESTED_IN, DERIVED_FROM).
 *   4. Backfills legacy `knowledge_relations` into the CompanyBrain `graph_edges` collection.
 *   5. Guarantees idempotency and respects Firestore transaction batch size bounds (<= 450 writes).
 *
 * Requirements:
 *   - Strictly typed, zero `any` or `any[]`.
 *   - Detailed telemetry, error reporting, and progress tracking.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

if (process.env.USE_EMULATOR === 'true') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  console.log('🔧 Using Firestore Emulator at localhost:8080');
}

import { adminDb } from '../src/lib/firebase-admin';
import { GraphRepository } from '../src/lib/memory/graph-repository';
import { GraphProjectionService } from '../src/lib/memory/pipeline/graph-projection-service';
import { MEMORY_OBJECTS_COLLECTION } from '../src/lib/memory/memory-repository';
import type { MemoryObject } from '../src/lib/memory/types';
import type {
  CompanyBrainGraphNode,
  CompanyBrainGraphEdge,
  GraphRelationshipType,
} from '../src/lib/memory/graph-types';

const DRY_RUN = process.env.DRY_RUN === 'true';
const TARGET_WORKSPACE_ID = process.env.TARGET_WORKSPACE_ID || '';
const TARGET_ORG_ID = process.env.TARGET_ORG_ID || '';

interface EntityDoc {
  name?: string;
  organizationId?: string;
  workspaceId?: string;
  type?: string;
}

interface ContactDoc {
  name?: string;
  firstName?: string;
  lastName?: string;
  entityId?: string;
  schoolId?: string;
  organizationId?: string;
  workspaceId?: string;
}

interface DealDoc {
  title?: string;
  name?: string;
  entityId?: string;
  schoolId?: string;
  contactId?: string;
  organizationId?: string;
  workspaceId?: string;
}

interface LegacyRelationDoc {
  workspaceId?: string;
  organizationId?: string;
  sourceNoteId?: string;
  targetNoteId?: string;
  targetEntityId?: string;
  relationType?: string;
  confidence?: number;
}

interface GraphSyncStats {
  entitiesEvaluated: number;
  contactsEvaluated: number;
  dealsEvaluated: number;
  memoriesEvaluated: number;
  legacyRelationsEvaluated: number;
  nodesCreated: number;
  edgesCreated: number;
  errors: Array<{ source: string; id: string; error: string }>;
}

async function runGraphSync(): Promise<void> {
  console.log('================================================================');
  console.log('🌐 Starting FER Graph Mesh Sync: CRM & Memory -> Knowledge Graph');
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (Telemetry only)' : '⚡ LIVE RUN (Persisting to graph_nodes & graph_edges)'}`);
  if (TARGET_WORKSPACE_ID) console.log(`🎯 Filtering by Workspace ID: ${TARGET_WORKSPACE_ID}`);
  if (TARGET_ORG_ID) console.log(`🎯 Filtering by Organization ID: ${TARGET_ORG_ID}`);
  console.log('================================================================');

  const stats: GraphSyncStats = {
    entitiesEvaluated: 0,
    contactsEvaluated: 0,
    dealsEvaluated: 0,
    memoriesEvaluated: 0,
    legacyRelationsEvaluated: 0,
    nodesCreated: 0,
    edgesCreated: 0,
    errors: [],
  };

  const now = new Date().toISOString();

  // 1. Process CRM Entities
  try {
    console.log('\n[1/5] 🏢 Scanning CRM Entities...');
    let entityQuery: FirebaseFirestore.Query = adminDb.collection('entities');
    if (TARGET_WORKSPACE_ID) {
      entityQuery = entityQuery.where('workspaceId', '==', TARGET_WORKSPACE_ID);
    }
    const entitySnap = await entityQuery.get();
    stats.entitiesEvaluated = entitySnap.docs.length;
    console.log(`Found ${stats.entitiesEvaluated} entities in scope.`);

    const entityNodes: CompanyBrainGraphNode[] = [];
    for (const doc of entitySnap.docs) {
      const data = doc.data() as EntityDoc;
      const wsId = data.workspaceId || TARGET_WORKSPACE_ID || 'workspace_default';
      const orgId = data.organizationId || TARGET_ORG_ID || wsId;
      const label = data.name || `Entity (${doc.id.slice(0, 8)})`;

      entityNodes.push({
        id: `ent_${doc.id}`,
        organizationId: orgId,
        workspaceId: wsId,
        nodeType: 'entity',
        sourceId: doc.id,
        label,
        originHref: `/admin/entities/${encodeURIComponent(doc.id)}`,
        metadata: { type: data.type || 'account' },
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!DRY_RUN && entityNodes.length > 0) {
      await GraphRepository.batchUpsertNodes(entityNodes);
    }
    stats.nodesCreated += entityNodes.length;
    console.log(`✓ Processed ${entityNodes.length} entity nodes.`);
  } catch (err) {
    console.error('Error processing entities:', err);
    stats.errors.push({ source: 'entities', id: 'all', error: err instanceof Error ? err.message : String(err) });
  }

  // 2. Process Contacts
  try {
    console.log('\n[2/5] 👤 Scanning Contacts & Affiliations...');
    let contactQuery: FirebaseFirestore.Query = adminDb.collection('contacts');
    if (TARGET_WORKSPACE_ID) {
      contactQuery = contactQuery.where('workspaceId', '==', TARGET_WORKSPACE_ID);
    }
    const contactSnap = await contactQuery.get();
    stats.contactsEvaluated = contactSnap.docs.length;
    console.log(`Found ${stats.contactsEvaluated} contacts in scope.`);

    const contactNodes: CompanyBrainGraphNode[] = [];
    const contactEdges: CompanyBrainGraphEdge[] = [];

    for (const doc of contactSnap.docs) {
      const data = doc.data() as ContactDoc;
      const wsId = data.workspaceId || TARGET_WORKSPACE_ID || 'workspace_default';
      const orgId = data.organizationId || TARGET_ORG_ID || wsId;
      const name = data.name || [data.firstName, data.lastName].filter(Boolean).join(' ') || `Contact (${doc.id.slice(0, 8)})`;
      const contactNodeId = `person_${doc.id}`;

      contactNodes.push({
        id: contactNodeId,
        organizationId: orgId,
        workspaceId: wsId,
        nodeType: 'person',
        sourceId: doc.id,
        label: name,
        originHref: `/admin/contacts?id=${encodeURIComponent(doc.id)}`,
        createdAt: now,
        updatedAt: now,
      });

      const parentEntityId = data.entityId || data.schoolId;
      if (parentEntityId) {
        const entityNodeId = `ent_${parentEntityId}`;
        contactEdges.push({
          id: `edge_${entityNodeId}_hascontact_${contactNodeId}`,
          organizationId: orgId,
          workspaceId: wsId,
          sourceNodeId: entityNodeId,
          targetNodeId: contactNodeId,
          relationshipType: 'HAS_CONTACT',
          confidence: 1.0,
          sourceType: 'system',
          sourceId: doc.id,
          createdAt: now,
        });
      }
    }

    if (!DRY_RUN) {
      if (contactNodes.length > 0) await GraphRepository.batchUpsertNodes(contactNodes);
      if (contactEdges.length > 0) await GraphRepository.batchUpsertEdges(contactEdges);
    }
    stats.nodesCreated += contactNodes.length;
    stats.edgesCreated += contactEdges.length;
    console.log(`✓ Processed ${contactNodes.length} contact nodes and ${contactEdges.length} contact affiliation edges.`);
  } catch (err) {
    console.error('Error processing contacts:', err);
    stats.errors.push({ source: 'contacts', id: 'all', error: err instanceof Error ? err.message : String(err) });
  }

  // 3. Process Deals
  try {
    console.log('\n[3/5] 💼 Scanning Deals & Pipeline Links...');
    let dealQuery: FirebaseFirestore.Query = adminDb.collection('deals');
    if (TARGET_WORKSPACE_ID) {
      dealQuery = dealQuery.where('workspaceId', '==', TARGET_WORKSPACE_ID);
    }
    const dealSnap = await dealQuery.get();
    stats.dealsEvaluated = dealSnap.docs.length;
    console.log(`Found ${stats.dealsEvaluated} deals in scope.`);

    const dealNodes: CompanyBrainGraphNode[] = [];
    const dealEdges: CompanyBrainGraphEdge[] = [];

    for (const doc of dealSnap.docs) {
      const data = doc.data() as DealDoc;
      const wsId = data.workspaceId || TARGET_WORKSPACE_ID || 'workspace_default';
      const orgId = data.organizationId || TARGET_ORG_ID || wsId;
      const title = data.title || data.name || `Deal (${doc.id.slice(0, 8)})`;
      const dealNodeId = `deal_${doc.id}`;

      dealNodes.push({
        id: dealNodeId,
        organizationId: orgId,
        workspaceId: wsId,
        nodeType: 'deal',
        sourceId: doc.id,
        label: title,
        originHref: `/admin/deals?id=${encodeURIComponent(doc.id)}`,
        createdAt: now,
        updatedAt: now,
      });

      const parentEntityId = data.entityId || data.schoolId;
      if (parentEntityId) {
        const entityNodeId = `ent_${parentEntityId}`;
        dealEdges.push({
          id: `edge_${entityNodeId}_ownsdeal_${dealNodeId}`,
          organizationId: orgId,
          workspaceId: wsId,
          sourceNodeId: entityNodeId,
          targetNodeId: dealNodeId,
          relationshipType: 'OWNS_DEAL',
          confidence: 1.0,
          sourceType: 'system',
          sourceId: doc.id,
          createdAt: now,
        });
      }

      if (data.contactId) {
        const contactNodeId = `person_${data.contactId}`;
        dealEdges.push({
          id: `edge_${dealNodeId}_involves_${contactNodeId}`,
          organizationId: orgId,
          workspaceId: wsId,
          sourceNodeId: dealNodeId,
          targetNodeId: contactNodeId,
          relationshipType: 'INVOLVES',
          confidence: 1.0,
          sourceType: 'system',
          sourceId: doc.id,
          createdAt: now,
        });
      }
    }

    if (!DRY_RUN) {
      if (dealNodes.length > 0) await GraphRepository.batchUpsertNodes(dealNodes);
      if (dealEdges.length > 0) await GraphRepository.batchUpsertEdges(dealEdges);
    }
    stats.nodesCreated += dealNodes.length;
    stats.edgesCreated += dealEdges.length;
    console.log(`✓ Processed ${dealNodes.length} deal nodes and ${dealEdges.length} deal linkage edges.`);
  } catch (err) {
    console.error('Error processing deals:', err);
    stats.errors.push({ source: 'deals', id: 'all', error: err instanceof Error ? err.message : String(err) });
  }

  // 4. Process Institutional MemoryObjects
  try {
    console.log('\n[4/5] 🧠 Projecting Institutional Memories to Graph Mesh...');
    let memQuery: FirebaseFirestore.Query = adminDb.collection(MEMORY_OBJECTS_COLLECTION);
    if (TARGET_WORKSPACE_ID) {
      memQuery = memQuery.where('workspaceId', '==', TARGET_WORKSPACE_ID);
    }
    if (TARGET_ORG_ID) {
      memQuery = memQuery.where('organizationId', '==', TARGET_ORG_ID);
    }
    const memSnap = await memQuery.get();
    stats.memoriesEvaluated = memSnap.docs.length;
    console.log(`Found ${stats.memoriesEvaluated} memory objects in scope.`);

    for (const doc of memSnap.docs) {
      const memory = { id: doc.id, ...doc.data() } as MemoryObject;
      if (!DRY_RUN) {
        await GraphProjectionService.projectMemory(memory);
      }
      stats.nodesCreated += 1;
      const refCount = (memory.subjectRefs?.entityIds?.length || 0) + (memory.subjectRefs?.dealIds?.length || 0);
      stats.edgesCreated += refCount + (memory.source.type === 'user_note' ? 1 : 0);
    }
    console.log(`✓ Projected ${stats.memoriesEvaluated} memories into the graph.`);
  } catch (err) {
    console.error('Error processing memory objects:', err);
    stats.errors.push({ source: 'memories', id: 'all', error: err instanceof Error ? err.message : String(err) });
  }

  // 5. Backfill Legacy Knowledge Relations (if present)
  try {
    console.log('\n[5/5] 🔄 Evaluating Historical Legacy Knowledge Relations...');
    let legacyQuery: FirebaseFirestore.Query = adminDb.collection('knowledge_relations');
    if (TARGET_WORKSPACE_ID) {
      legacyQuery = legacyQuery.where('workspaceId', '==', TARGET_WORKSPACE_ID);
    }
    const legacySnap = await legacyQuery.get();
    stats.legacyRelationsEvaluated = legacySnap.docs.length;
    console.log(`Found ${stats.legacyRelationsEvaluated} legacy relations in scope.`);

    const legacyEdges: CompanyBrainGraphEdge[] = [];
    for (const doc of legacySnap.docs) {
      const rel = doc.data() as LegacyRelationDoc;
      const wsId = rel.workspaceId || TARGET_WORKSPACE_ID || 'workspace_default';
      const orgId = rel.organizationId || TARGET_ORG_ID || wsId;
      const sourceId = rel.sourceNoteId ? `note_${rel.sourceNoteId}` : null;
      let targetId = rel.targetNoteId ? `note_${rel.targetNoteId}` : null;
      if (!targetId && rel.targetEntityId) {
        targetId = `ent_${rel.targetEntityId}`;
      }

      if (sourceId && targetId) {
        let mappedType: GraphRelationshipType = 'RELATES_TO';
        if (rel.relationType === 'depends_on') mappedType = 'RELATES_TO';
        else if (rel.relationType === 'derived_from') mappedType = 'DERIVED_FROM';
        else if (rel.relationType === 'about_school' || rel.relationType === 'about_contact') mappedType = 'RELATES_TO';
        else if (rel.relationType === 'about_deal') mappedType = 'DISCUSSED';

        legacyEdges.push({
          id: `edge_legacy_${doc.id}`,
          organizationId: orgId,
          workspaceId: wsId,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          relationshipType: mappedType,
          confidence: typeof rel.confidence === 'number' ? rel.confidence : 1.0,
          sourceType: 'user',
          sourceId: doc.id,
          createdAt: now,
        });
      }
    }

    if (!DRY_RUN && legacyEdges.length > 0) {
      await GraphRepository.batchUpsertEdges(legacyEdges);
    }
    stats.edgesCreated += legacyEdges.length;
    console.log(`✓ Backfilled ${legacyEdges.length} legacy relations to explicit graph edges.`);
  } catch (err) {
    console.error('Error processing legacy relations:', err);
    stats.errors.push({ source: 'legacy_relations', id: 'all', error: err instanceof Error ? err.message : String(err) });
  }

  // Summary
  console.log('\n================================================================');
  console.log('🎉 Graph Mesh Sync Complete!');
  console.log(`- Entities evaluated:           ${stats.entitiesEvaluated}`);
  console.log(`- Contacts evaluated:           ${stats.contactsEvaluated}`);
  console.log(`- Deals evaluated:              ${stats.dealsEvaluated}`);
  console.log(`- Memories projected:           ${stats.memoriesEvaluated}`);
  console.log(`- Legacy relations evaluated:   ${stats.legacyRelationsEvaluated}`);
  console.log(`- Total graph nodes upserted:   ${stats.nodesCreated}`);
  console.log(`- Total graph edges upserted:   ${stats.edgesCreated}`);
  console.log(`- Errors encountered:           ${stats.errors.length}`);
  if (stats.errors.length > 0) {
    console.log('\nErrors detail:');
    for (const e of stats.errors) {
      console.log(`  [${e.source}] (${e.id}): ${e.error}`);
    }
  }
  console.log('================================================================');
}

runGraphSync().catch((err) => {
  console.error('Fatal sync failure:', err);
  process.exit(1);
});
