'use server';

/**
 * @fileOverview CompanyBrain 2.0: Knowledge Graph Server Actions
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tenant Authorization Gate (Rule 8):
 *    - All graph actions verify user membership via `checkWorkspaceAccess` before querying or mutating data.
 * 2. Actionable Error Navigation (Rule 1):
 *    - Errors return relative `actionConfig` paths (e.g. `/admin/quick-notes` or `/login`).
 * 3. Strict Zero-`any` standard:
 *    - 100% typed request params and `ActionResult<T>` return models.
 * 4. Grounded AI Reasoning:
 *    - Explanations route through `explainGraphConnectionFlow` passing verified multi-hop paths.
 *
 * @testability Covered in `src/lib/memory/__tests__/knowledge-graph-service.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { checkWorkspaceAccess } from '@/lib/workspace-permissions';
import { GraphRepository } from '../graph-repository';
import { KnowledgeGraphService } from '../services/knowledge-graph-service';
import { GraphProjectionService } from '../pipeline/graph-projection-service';
import { MEMORY_OBJECTS_COLLECTION } from '../memory-repository';
import type { MemoryObject } from '../types';
import { requireWorkspace, requireAuth } from '@/lib/auth/require-auth';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  explainGraphConnectionFlow,
  type ExplainGraphConnectionOutput,
} from '@/ai/flows/explain-graph-connection-flow';
import type {
  CompanyBrainGraphNode,
  CompanyBrainGraphEdge,
  GraphQueryFilter,
  GraphPath,
  GraphTopologyMetrics,
  GraphRelationshipType,
  GraphSourceType,
} from '../graph-types';

export type ActionResult<T> =
  | { success: true; data: T; error?: never; code?: never; actionConfig?: never }
  | {
      success: false;
      data?: never;
      error: string;
      code?: 'unauthenticated' | 'unauthorized' | 'validation_error' | 'not_found';
      actionConfig?: { path: string; label: string };
    };

// ============================================================================
// RETRIEVAL & TRAVERSAL ACTIONS
// ============================================================================

/**
 * Retrieves the workspace knowledge graph with optional node and edge filters.
 */
export async function getWorkspaceGraphAction(params: {
  workspaceId: string;
  userId: string;
  filters?: GraphQueryFilter;
}): Promise<ActionResult<{ nodes: CompanyBrainGraphNode[]; edges: CompanyBrainGraphEdge[] }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, filters = {} } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }
  if (!workspaceId) {
    return {
      success: false,
      error: 'Workspace identifier is required.',
      code: 'validation_error',
      actionConfig: { path: '/admin/quick-notes', label: 'Return to Notes' },
    };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return {
      success: false,
      error: access.reason || 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Return to Notes' },
    };
  }

  try {
    const result = await GraphRepository.queryWorkspaceGraph(workspaceId, filters);
    return { success: true, data: result };
  } catch (err) {
    console.error('[getWorkspaceGraphAction] Error:', err);
    return {
      success: false,
      error: toClientErrorMessage('memory.actions.graph-actions', err, undefined, 'Failed to query workspace graph.'),
      actionConfig: { path: '/admin/quick-notes/graph', label: 'Refresh Graph' },
    };
  }
}

/**
 * Retrieves a contextual sub-graph centered on a specific Entity (for the Entity Profile tab).
 */
export async function getEntitySubGraphAction(params: {
  workspaceId: string;
  userId: string;
  entityId: string;
  depth?: number;
}): Promise<ActionResult<{ nodes: CompanyBrainGraphNode[]; edges: CompanyBrainGraphEdge[] }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, entityId, depth = 2 } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }
  if (!workspaceId || !entityId) {
    return {
      success: false,
      error: 'Missing required parameters.',
      code: 'validation_error',
    };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return {
      success: false,
      error: access.reason || 'Unauthorized workspace access.',
      code: 'unauthorized',
    };
  }

  try {
    const entityNodeId = `ent_${entityId}`;
    const result = await KnowledgeGraphService.getSubGraph([entityNodeId], depth);
    return { success: true, data: result };
  } catch (err) {
    console.error('[getEntitySubGraphAction] Error:', err);
    return {
      success: false,
      error: toClientErrorMessage('memory.actions.graph-actions', err, undefined, 'Failed to retrieve entity sub-graph.'),
    };
  }
}

/**
 * Finds the shortest connecting path between two nodes in the graph.
 */
export async function findGraphPathAction(params: {
  workspaceId: string;
  userId: string;
  startNodeId: string;
  targetNodeId: string;
  maxHops?: number;
}): Promise<ActionResult<GraphPath | null>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, startNodeId, targetNodeId, maxHops = 4 } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
    };
  }
  if (!workspaceId || !startNodeId || !targetNodeId) {
    return {
      success: false,
      error: 'Missing required parameters for pathfinding.',
      code: 'validation_error',
    };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return {
      success: false,
      error: access.reason || 'Unauthorized workspace access.',
      code: 'unauthorized',
    };
  }

  try {
    const path = await KnowledgeGraphService.findPath(startNodeId, targetNodeId, maxHops);
    return { success: true, data: path };
  } catch (err) {
    console.error('[findGraphPathAction] Error:', err);
    return {
      success: false,
      error: toClientErrorMessage('memory.actions.graph-actions', err, undefined, 'Failed to calculate graph path.'),
    };
  }
}

/**
 * Synthesizes a natural language explanation for why two nodes are connected.
 */
export async function explainGraphConnectionAction(params: {
  workspaceId: string;
  userId: string;
  startNodeId: string;
  targetNodeId: string;
}): Promise<ActionResult<ExplainGraphConnectionOutput>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, startNodeId, targetNodeId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
    };
  }
  if (!workspaceId || !startNodeId || !targetNodeId) {
    return {
      success: false,
      error: 'Missing required parameters for connection explanation.',
      code: 'validation_error',
    };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return {
      success: false,
      error: access.reason || 'Unauthorized workspace access.',
      code: 'unauthorized',
    };
  }

  try {
    const [startNode, targetNode, path] = await Promise.all([
      KnowledgeGraphService.getNode(startNodeId),
      KnowledgeGraphService.getNode(targetNodeId),
      KnowledgeGraphService.findPath(startNodeId, targetNodeId, 4),
    ]);

    if (!startNode || !targetNode) {
      return {
        success: false,
        error: 'One or both nodes could not be found.',
        code: 'not_found',
      };
    }

    if (!path || path.nodes.length <= 1) {
      return {
        success: true,
        data: {
          narrative: `No direct or multi-hop path currently connects "${startNode.label}" and "${targetNode.label}" in the knowledge graph.`,
          summary: 'No path discovered between entities.',
          confidence: 0.0,
          eventsCited: [],
        },
      };
    }

    // Build sequential path steps
    const pathSteps: Array<{
      sourceLabel: string;
      sourceType: string;
      relationshipType: string;
      targetLabel: string;
      targetType: string;
      eventContext?: string;
    }> = [];

    for (let i = 0; i < path.edges.length; i++) {
      const edge = path.edges[i];
      const source = path.nodes[i];
      const target = path.nodes[i + 1];

      if (source && target) {
        pathSteps.push({
          sourceLabel: source.label,
          sourceType: source.nodeType,
          relationshipType: edge.relationshipType,
          targetLabel: target.label,
          targetType: target.nodeType,
          eventContext: edge.sourceId ? `Source ID: ${edge.sourceId}` : undefined,
        });
      }
    }

    const explanation = await explainGraphConnectionFlow({
      startNodeId,
      startNodeLabel: startNode.label,
      targetNodeId,
      targetNodeLabel: targetNode.label,
      pathSteps,
      workspaceId,
    });

    return { success: true, data: explanation };
  } catch (err) {
    console.error('[explainGraphConnectionAction] Error:', err);
    return {
      success: false,
      error: toClientErrorMessage('memory.actions.graph-actions', err, undefined, 'Failed to explain connection.'),
    };
  }
}

// ============================================================================
// MUTATION ACTIONS
// ============================================================================

/**
 * Creates or updates an explicit user-defined relationship edge.
 */
export async function createGraphEdgeAction(params: {
  workspaceId: string;
  organizationId: string;
  userId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: GraphRelationshipType;
  confidence?: number;
  sourceType?: GraphSourceType;
  metadata?: Record<string, string | number | boolean>;
}): Promise<ActionResult<CompanyBrainGraphEdge>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const {
    workspaceId,
    organizationId,
    userId,
    sourceNodeId,
    targetNodeId,
    relationshipType,
    confidence = 1.0,
    sourceType = 'user',
    metadata,
  } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
    };
  }
  if (!workspaceId || !sourceNodeId || !targetNodeId || !relationshipType) {
    return {
      success: false,
      error: 'Missing required parameters to create relationship edge.',
      code: 'validation_error',
    };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return {
      success: false,
      error: access.reason || 'Unauthorized workspace access.',
      code: 'unauthorized',
    };
  }

  try {
    const edgeId = `edge_${sourceNodeId}_${relationshipType.toLowerCase()}_${targetNodeId}`;
    const edge: CompanyBrainGraphEdge = {
      id: edgeId,
      organizationId: organizationId || workspaceId,
      workspaceId,
      sourceNodeId,
      targetNodeId,
      relationshipType,
      confidence,
      sourceType,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await KnowledgeGraphService.createEdge(edge);
    return { success: true, data: edge };
  } catch (err) {
    console.error('[createGraphEdgeAction] Error:', err);
    return {
      success: false,
      error: toClientErrorMessage('memory.actions.graph-actions', err, undefined, 'Failed to create graph edge.'),
    };
  }
}

/**
 * Deletes a relationship edge with workspace tenant validation.
 */
export async function deleteGraphEdgeAction(params: {
  workspaceId: string;
  userId: string;
  edgeId: string;
}): Promise<ActionResult<{ deleted: boolean }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId, edgeId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
    };
  }
  if (!workspaceId || !edgeId) {
    return {
      success: false,
      error: 'Missing required edge identifier.',
      code: 'validation_error',
    };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return {
      success: false,
      error: access.reason || 'Unauthorized workspace access.',
      code: 'unauthorized',
    };
  }

  try {
    await KnowledgeGraphService.deleteEdge(edgeId, workspaceId);
    return { success: true, data: { deleted: true } };
  } catch (err) {
    console.error('[deleteGraphEdgeAction] Error:', err);
    return {
      success: false,
      error: toClientErrorMessage('memory.actions.graph-actions', err, undefined, 'Failed to delete graph edge.'),
    };
  }
}

/**
 * Retrieves graph topology health metrics for the Backoffice console.
 */
export async function getGraphTopologyMetricsAction(params: {
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<GraphTopologyMetrics>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
    };
  }
  if (!workspaceId) {
    return {
      success: false,
      error: 'Workspace ID is required.',
      code: 'validation_error',
    };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return {
      success: false,
      error: access.reason || 'Unauthorized workspace access.',
      code: 'unauthorized',
    };
  }

  try {
    const metrics = await GraphRepository.getTopologyMetrics(workspaceId);
    return { success: true, data: metrics };
  } catch (err) {
    console.error('[getGraphTopologyMetricsAction] Error:', err);
    return {
      success: false,
      error: toClientErrorMessage('memory.actions.graph-actions', err, undefined, 'Failed to calculate topology metrics.'),
    };
  }
}

/**
 * Triggers a live FER sync of CRM entities, contacts, deals, and memory objects into the graph mesh for a workspace.
 */
export async function syncWorkspaceGraphMeshAction(params: {
  workspaceId: string;
  userId: string;
}): Promise<ActionResult<{ nodesUpserted: number; edgesUpserted: number }>> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { workspaceId, userId } = params;

  if (!userId) {
    return {
      success: false,
      error: 'Authentication required.',
      code: 'unauthenticated',
      actionConfig: { path: '/login', label: 'Sign In' },
    };
  }
  if (!workspaceId) {
    return {
      success: false,
      error: 'Workspace ID is required.',
      code: 'validation_error',
    };
  }

  const access = await checkWorkspaceAccess(userId, workspaceId);
  if (!access.granted) {
    return {
      success: false,
      error: access.reason || 'Unauthorized workspace access.',
      code: 'unauthorized',
      actionConfig: { path: '/admin/quick-notes', label: 'Go to Quick Notes' },
    };
  }

  try {
    let nodesUpserted = 0;
    let edgesUpserted = 0;
    const now = new Date().toISOString();

    // 1. Entities
    const entitySnap = await adminDb
      .collection('entities')
      .where('workspaceId', '==', workspaceId)
      .get();

    const entityNodes: CompanyBrainGraphNode[] = [];
    for (const doc of entitySnap.docs) {
      const data = doc.data() as { name?: string; organizationId?: string; type?: string };
      entityNodes.push({
        id: `ent_${doc.id}`,
        organizationId: data.organizationId || workspaceId,
        workspaceId,
        nodeType: 'entity',
        sourceId: doc.id,
        label: data.name || `Entity (${doc.id.slice(0, 8)})`,
        originHref: `/admin/entities/${encodeURIComponent(doc.id)}`,
        metadata: { type: data.type || 'account' },
        createdAt: now,
        updatedAt: now,
      });
    }
    if (entityNodes.length > 0) {
      await GraphRepository.batchUpsertNodes(entityNodes);
      nodesUpserted += entityNodes.length;
    }

    // 2. Contacts
    const contactSnap = await adminDb
      .collection('contacts')
      .where('workspaceId', '==', workspaceId)
      .get();

    const contactNodes: CompanyBrainGraphNode[] = [];
    const contactEdges: CompanyBrainGraphEdge[] = [];
    for (const doc of contactSnap.docs) {
      const data = doc.data() as {
        name?: string;
        firstName?: string;
        lastName?: string;
        entityId?: string;
        schoolId?: string;
        organizationId?: string;
      };
      const contactNodeId = `person_${doc.id}`;
      contactNodes.push({
        id: contactNodeId,
        organizationId: data.organizationId || workspaceId,
        workspaceId,
        nodeType: 'person',
        sourceId: doc.id,
        label: data.name || [data.firstName, data.lastName].filter(Boolean).join(' ') || `Contact (${doc.id.slice(0, 8)})`,
        originHref: `/admin/contacts?id=${encodeURIComponent(doc.id)}`,
        createdAt: now,
        updatedAt: now,
      });

      const parentEntityId = data.entityId || data.schoolId;
      if (parentEntityId) {
        contactEdges.push({
          id: `edge_ent_${parentEntityId}_hascontact_${contactNodeId}`,
          organizationId: data.organizationId || workspaceId,
          workspaceId,
          sourceNodeId: `ent_${parentEntityId}`,
          targetNodeId: contactNodeId,
          relationshipType: 'HAS_CONTACT',
          confidence: 1.0,
          sourceType: 'system',
          sourceId: doc.id,
          createdAt: now,
        });
      }
    }
    if (contactNodes.length > 0) {
      await GraphRepository.batchUpsertNodes(contactNodes);
      nodesUpserted += contactNodes.length;
    }
    if (contactEdges.length > 0) {
      await GraphRepository.batchUpsertEdges(contactEdges);
      edgesUpserted += contactEdges.length;
    }

    // 3. Deals
    const dealSnap = await adminDb
      .collection('deals')
      .where('workspaceId', '==', workspaceId)
      .get();

    const dealNodes: CompanyBrainGraphNode[] = [];
    const dealEdges: CompanyBrainGraphEdge[] = [];
    for (const doc of dealSnap.docs) {
      const data = doc.data() as {
        title?: string;
        name?: string;
        entityId?: string;
        schoolId?: string;
        contactId?: string;
        organizationId?: string;
      };
      const dealNodeId = `deal_${doc.id}`;
      dealNodes.push({
        id: dealNodeId,
        organizationId: data.organizationId || workspaceId,
        workspaceId,
        nodeType: 'deal',
        sourceId: doc.id,
        label: data.title || data.name || `Deal (${doc.id.slice(0, 8)})`,
        originHref: `/admin/deals?id=${encodeURIComponent(doc.id)}`,
        createdAt: now,
        updatedAt: now,
      });

      const parentEntityId = data.entityId || data.schoolId;
      if (parentEntityId) {
        dealEdges.push({
          id: `edge_ent_${parentEntityId}_ownsdeal_${dealNodeId}`,
          organizationId: data.organizationId || workspaceId,
          workspaceId,
          sourceNodeId: `ent_${parentEntityId}`,
          targetNodeId: dealNodeId,
          relationshipType: 'OWNS_DEAL',
          confidence: 1.0,
          sourceType: 'system',
          sourceId: doc.id,
          createdAt: now,
        });
      }
      if (data.contactId) {
        dealEdges.push({
          id: `edge_${dealNodeId}_involves_person_${data.contactId}`,
          organizationId: data.organizationId || workspaceId,
          workspaceId,
          sourceNodeId: dealNodeId,
          targetNodeId: `person_${data.contactId}`,
          relationshipType: 'INVOLVES',
          confidence: 1.0,
          sourceType: 'system',
          sourceId: doc.id,
          createdAt: now,
        });
      }
    }
    if (dealNodes.length > 0) {
      await GraphRepository.batchUpsertNodes(dealNodes);
      nodesUpserted += dealNodes.length;
    }
    if (dealEdges.length > 0) {
      await GraphRepository.batchUpsertEdges(dealEdges);
      edgesUpserted += dealEdges.length;
    }

    // 4. Memory Objects
    const memSnap = await adminDb
      .collection(MEMORY_OBJECTS_COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .get();

    for (const doc of memSnap.docs) {
      const memory = { id: doc.id, ...doc.data() } as MemoryObject;
      await GraphProjectionService.projectMemory(memory);
      nodesUpserted += 1;
      const refCount = (memory.subjectRefs?.entityIds?.length || 0) + (memory.subjectRefs?.dealIds?.length || 0);
      edgesUpserted += refCount + (memory.source.type === 'user_note' ? 1 : 0);
    }

    return {
      success: true,
      data: { nodesUpserted, edgesUpserted },
    };
  } catch (err) {
    console.error('[syncWorkspaceGraphMeshAction] Error:', err);
    return {
      success: false,
      error: toClientErrorMessage('memory.actions.graph-actions', err, undefined, 'Failed to synchronize workspace graph mesh.'),
    };
  }
}
