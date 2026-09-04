/**
 * @fileOverview CompanyBrain 2.0: Graph Projection Pipeline Service
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Dual Ingestion Pathways (PRD Section 26 & 27):
 *    - Deterministic Projections: Directly maps CRM Entities, Contacts, Deals, Tasks, and Meetings.
 *    - AI-Inferred Projections: Maps MemoryObject records from Note extraction with semantic types
 *      (HAS_PROBLEM, HAS_OPPORTUNITY, HAS_RISK, INTERESTED_IN).
 * 2. Non-Blocking Execution:
 *    - Ingestion must never block the main thread or human note-taking experience.
 * 3. Safe Batching Protocol (Rule 9):
 *    - All projections batch nodes and edges into <= 450 items per write.
 * 4. Zero-`any` Standard:
 *    - 100% strongly typed with domain models.
 *
 * @testability Covered in `src/lib/memory/__tests__/knowledge-graph-service.test.ts`.
 */

import { GraphRepository } from '../graph-repository';
import type { MemoryObject } from '../types';
import {
  memoryTypeToRelationship,
  type CompanyBrainGraphNode,
  type CompanyBrainGraphEdge,
} from '../graph-types';

export class GraphProjectionService {
  /**
   * Projects a MemoryObject and its entity/note connections into the knowledge graph.
   * Invoked asynchronously when memories are extracted or confirmed.
   */
  public static async projectMemory(memory: MemoryObject): Promise<void> {
    if (!memory || !memory.id || !memory.workspaceId) return;

    const nodesToUpsert: CompanyBrainGraphNode[] = [];
    const edgesToUpsert: CompanyBrainGraphEdge[] = [];
    const now = new Date().toISOString();

    // 1. Create / Upsert Memory Node
    const memoryNodeId = `mem_${memory.id}`;
    nodesToUpsert.push({
      id: memoryNodeId,
      organizationId: memory.organizationId || memory.workspaceId,
      workspaceId: memory.workspaceId,
      nodeType: 'memory',
      sourceId: memory.id,
      label: memory.title || `${memory.type.toUpperCase()}: ${memory.content.slice(0, 40)}...`,
      metadata: {
        memoryType: memory.type,
        importance: memory.importance,
        confidence: memory.confidence,
        verification: memory.verification,
      },
      createdAt: memory.createdAt || now,
      updatedAt: now,
    });

    // 2. Wire Connection to Source Note (if created from a note)
    if (memory.source.type === 'user_note' && memory.source.sourceId) {
      const noteNodeId = `note_${memory.source.sourceId}`;

      // Upsert note node stub
      nodesToUpsert.push({
        id: noteNodeId,
        organizationId: memory.organizationId || memory.workspaceId,
        workspaceId: memory.workspaceId,
        nodeType: 'knowledge',
        sourceId: memory.source.sourceId,
        label: 'Quick Note Source',
        originHref: `/admin/quick-notes?search=${encodeURIComponent(memory.source.sourceId)}`,
        createdAt: memory.createdAt || now,
        updatedAt: now,
      });

      // Memory -> DERIVED_FROM -> Note
      edgesToUpsert.push({
        id: `edge_${memoryNodeId}_derived_${noteNodeId}`,
        organizationId: memory.organizationId || memory.workspaceId,
        workspaceId: memory.workspaceId,
        sourceNodeId: memoryNodeId,
        targetNodeId: noteNodeId,
        relationshipType: 'DERIVED_FROM',
        confidence: 1.0,
        sourceType: 'system',
        sourceId: memory.id,
        createdAt: now,
      });
    }

    // 3. Wire Connections to Referenced Entities
    const entityIds = memory.subjectRefs?.entityIds || [];
    for (const entityId of entityIds) {
      const entityNodeId = `ent_${entityId}`;

      // Ensure entity node exists
      nodesToUpsert.push({
        id: entityNodeId,
        organizationId: memory.organizationId || memory.workspaceId,
        workspaceId: memory.workspaceId,
        nodeType: 'entity',
        sourceId: entityId,
        label: `Account (${entityId.slice(0, 8)})`,
        originHref: `/admin/entities/${encodeURIComponent(entityId)}`,
        createdAt: now,
        updatedAt: now,
      });

      // Entity -> HAS_PROBLEM / HAS_OPPORTUNITY / HAS_RISK / INTERESTED_IN -> Memory
      const relType = memoryTypeToRelationship(memory.type);
      edgesToUpsert.push({
        id: `edge_${entityNodeId}_${relType.toLowerCase()}_${memoryNodeId}`,
        organizationId: memory.organizationId || memory.workspaceId,
        workspaceId: memory.workspaceId,
        sourceNodeId: entityNodeId,
        targetNodeId: memoryNodeId,
        relationshipType: relType,
        confidence: memory.confidence,
        sourceType: 'ai',
        sourceId: memory.id,
        createdAt: now,
      });

      // Memory -> MENTIONS -> Entity
      edgesToUpsert.push({
        id: `edge_${memoryNodeId}_mentions_${entityNodeId}`,
        organizationId: memory.organizationId || memory.workspaceId,
        workspaceId: memory.workspaceId,
        sourceNodeId: memoryNodeId,
        targetNodeId: entityNodeId,
        relationshipType: 'MENTIONS',
        confidence: memory.confidence,
        sourceType: 'ai',
        sourceId: memory.id,
        createdAt: now,
      });
    }

    // 4. Wire Connections to Referenced Deals
    const dealIds = memory.subjectRefs?.dealIds || [];
    for (const dealId of dealIds) {
      const dealNodeId = `deal_${dealId}`;

      nodesToUpsert.push({
        id: dealNodeId,
        organizationId: memory.organizationId || memory.workspaceId,
        workspaceId: memory.workspaceId,
        nodeType: 'deal',
        sourceId: dealId,
        label: `Deal (${dealId.slice(0, 8)})`,
        originHref: `/admin/deals?id=${encodeURIComponent(dealId)}`,
        createdAt: now,
        updatedAt: now,
      });

      // Deal -> DISCUSSED -> Memory
      edgesToUpsert.push({
        id: `edge_${dealNodeId}_discussed_${memoryNodeId}`,
        organizationId: memory.organizationId || memory.workspaceId,
        workspaceId: memory.workspaceId,
        sourceNodeId: dealNodeId,
        targetNodeId: memoryNodeId,
        relationshipType: 'DISCUSSED',
        confidence: memory.confidence,
        sourceType: 'ai',
        sourceId: memory.id,
        createdAt: now,
      });
    }

    // Execute atomic batch persistence
    await Promise.all([
      GraphRepository.batchUpsertNodes(nodesToUpsert),
      GraphRepository.batchUpsertEdges(edgesToUpsert),
    ]);
  }

  /**
   * Projects CRM Entity, Contact, and Deal structural records into graph nodes and edges.
   */
  public static async projectCrmRecord(params: {
    workspaceId: string;
    organizationId: string;
    entityId: string;
    entityName: string;
    contacts?: Array<{ id: string; name: string }>;
    deals?: Array<{ id: string; title: string }>;
  }): Promise<void> {
    const { workspaceId, organizationId, entityId, entityName, contacts = [], deals = [] } = params;
    const now = new Date().toISOString();

    const nodesToUpsert: CompanyBrainGraphNode[] = [];
    const edgesToUpsert: CompanyBrainGraphEdge[] = [];

    const entityNodeId = `ent_${entityId}`;
    nodesToUpsert.push({
      id: entityNodeId,
      organizationId,
      workspaceId,
      nodeType: 'entity',
      sourceId: entityId,
      label: entityName,
      originHref: `/admin/entities/${encodeURIComponent(entityId)}`,
      createdAt: now,
      updatedAt: now,
    });

    // Contacts -> HAS_CONTACT
    for (const contact of contacts) {
      const contactNodeId = `person_${contact.id}`;
      nodesToUpsert.push({
        id: contactNodeId,
        organizationId,
        workspaceId,
        nodeType: 'person',
        sourceId: contact.id,
        label: contact.name,
        originHref: `/admin/contacts?id=${encodeURIComponent(contact.id)}`,
        createdAt: now,
        updatedAt: now,
      });

      edgesToUpsert.push({
        id: `edge_${entityNodeId}_hascontact_${contactNodeId}`,
        organizationId,
        workspaceId,
        sourceNodeId: entityNodeId,
        targetNodeId: contactNodeId,
        relationshipType: 'HAS_CONTACT',
        confidence: 1.0,
        sourceType: 'system',
        sourceId: entityId,
        createdAt: now,
      });
    }

    // Deals -> OWNS_DEAL
    for (const deal of deals) {
      const dealNodeId = `deal_${deal.id}`;
      nodesToUpsert.push({
        id: dealNodeId,
        organizationId,
        workspaceId,
        nodeType: 'deal',
        sourceId: deal.id,
        label: deal.title,
        originHref: `/admin/deals?id=${encodeURIComponent(deal.id)}`,
        createdAt: now,
        updatedAt: now,
      });

      edgesToUpsert.push({
        id: `edge_${entityNodeId}_ownsdeal_${dealNodeId}`,
        organizationId,
        workspaceId,
        sourceNodeId: entityNodeId,
        targetNodeId: dealNodeId,
        relationshipType: 'OWNS_DEAL',
        confidence: 1.0,
        sourceType: 'system',
        sourceId: entityId,
        createdAt: now,
      });
    }

    await Promise.all([
      GraphRepository.batchUpsertNodes(nodesToUpsert),
      GraphRepository.batchUpsertEdges(edgesToUpsert),
    ]);
  }
}
