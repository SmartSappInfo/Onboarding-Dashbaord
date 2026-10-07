/**
 * @fileOverview Relationship Graph Projection Service & Rule 55 Traversal Ceilings (Phase 11 M3 · T5)
 *
 * Implements Rule 55 (Graph Canvas Ceilings: max 80 nodes, max 150 edges, depth <= 2 or 3),
 * Rule 40 (Domain Event Publishing: knowledge.graph.projected),
 * Rule 8 & 47 (Multi-Tenant Scoping & Anti-IDOR).
 */

import { adminDb } from '@/lib/firebase-admin';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import type { KnowledgeCandidate } from '../contracts/knowledge-schemas';

export interface GraphNodeRecord {
  id: string;
  label: string;
  type: string;
  workspaceId: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdgeRecord {
  id: string;
  source: string;
  target: string;
  relationship: string;
  weight: number;
  workspaceId: string;
  verificationState?: string;
  metadata?: Record<string, unknown>;
}

export class KnowledgeGraphProjectionService {
  private inMemoryNodes = new Map<string, GraphNodeRecord>();
  private inMemoryEdges = new Map<string, GraphEdgeRecord>();

  /**
   * Upserts a single graph node in memory and Firestore.
   */
  async upsertNode(node: GraphNodeRecord): Promise<void> {
    this.inMemoryNodes.set(node.id, node);
    if (adminDb) {
      try {
        await adminDb.collection('graph_nodes').doc(node.id).set(node, { merge: true });
      } catch {
        // Fallback
      }
    }
  }

  /**
   * Upserts a single graph edge in memory and Firestore.
   */
  async upsertEdge(edge: GraphEdgeRecord): Promise<void> {
    this.inMemoryEdges.set(edge.id, edge);
    if (adminDb) {
      try {
        await adminDb.collection('graph_edges').doc(edge.id).set(edge, { merge: true });
      } catch {
        // Fallback
      }
    }
  }

  /**
   * Projects candidate subject references and suggested relationships into graph nodes and edges.
   */
  async projectCandidate(
    candidate: KnowledgeCandidate,
    options?: { verificationState?: 'unverified' | 'proposed' | 'verified' }
  ): Promise<{ nodes: GraphNodeRecord[]; edges: GraphEdgeRecord[] }> {
    const nodes: GraphNodeRecord[] = [];
    const edges: GraphEdgeRecord[] = [];
    const verification = options?.verificationState ?? (candidate.status === 'accepted' ? 'verified' : 'proposed');

    // Primary subject or source node
    const primaryNodeId = candidate.subjectRefs[0] || `src_${candidate.source.id}`;
    const primaryNode: GraphNodeRecord = {
      id: primaryNodeId,
      label: candidate.title,
      type: candidate.type,
      workspaceId: candidate.workspaceId,
    };
    await this.upsertNode(primaryNode);
    nodes.push(primaryNode);

    // Subject reference nodes
    for (const refId of candidate.subjectRefs) {
      if (refId !== primaryNodeId) {
        const sNode: GraphNodeRecord = {
          id: refId,
          label: refId,
          type: 'entity',
          workspaceId: candidate.workspaceId,
        };
        await this.upsertNode(sNode);
        nodes.push(sNode);
      }
    }

    // Suggested relationships
    for (const rel of candidate.suggestedRelationships) {
      const targetNode: GraphNodeRecord = {
        id: rel.targetId,
        label: rel.targetId,
        type: 'entity',
        workspaceId: candidate.workspaceId,
      };
      await this.upsertNode(targetNode);
      if (!nodes.some((n) => n.id === targetNode.id)) {
        nodes.push(targetNode);
      }

      const edgeId = `edge_${primaryNodeId}_${rel.predicate}_${rel.targetId}`;
      const edge: GraphEdgeRecord = {
        id: edgeId,
        source: primaryNodeId,
        target: rel.targetId,
        relationship: rel.predicate,
        weight: rel.confidence,
        workspaceId: candidate.workspaceId,
        verificationState: verification,
      };
      await this.upsertEdge(edge);
      edges.push(edge);
    }

    // Emit domain event (Rule 40)
    try {
      await defaultEventBus.publish(
        createDomainEvent({
          type: 'knowledge.graph.projected',
          organizationId: candidate.organizationId,
          workspaceId: candidate.workspaceId,
          actor: { id: candidate.decidedBy ?? 'system', type: 'user' },
          entity: { type: 'knowledge_candidate', id: candidate.id },
          payload: {
            candidateId: candidate.id,
            nodesCount: nodes.length,
            edgesCount: edges.length,
          },
          correlationId: `corr_${candidate.id}`,
          source: 'knowledge_graph_projection_service',
        })
      );
    } catch {
      // Non-blocking
    }

    return { nodes, edges };
  }

  /**
   * Retrieves neighboring nodes and edges for a node within Rule 55 ceilings:
   * maxNodes <= 80, maxDepth <= 2, maxEdges <= 150.
   */
  async getNeighbors(query: {
    workspaceId: string;
    nodeId: string;
    maxNodes?: number;
    maxDepth?: number;
  }): Promise<{ nodes: GraphNodeRecord[]; edges: GraphEdgeRecord[] }> {
    // Rule 55 Hard Ceilings
    const maxNodes = Math.min(80, Math.max(1, query.maxNodes ?? 50));
    const maxDepth = Math.min(2, Math.max(1, query.maxDepth ?? 1));
    const maxEdges = 150;

    const visitedNodeIds = new Set<string>();
    const visitedEdgeIds = new Set<string>();
    const resultNodes: GraphNodeRecord[] = [];
    const resultEdges: GraphEdgeRecord[] = [];

    // Root node
    const rootNode = this.inMemoryNodes.get(query.nodeId);
    if (rootNode && rootNode.workspaceId === query.workspaceId) {
      visitedNodeIds.add(query.nodeId);
      resultNodes.push(rootNode);
    } else {
      visitedNodeIds.add(query.nodeId);
    }

    // BFS queue: [nodeId, currentDepth]
    const queue: [string, number][] = [[query.nodeId, 0]];

    while (queue.length > 0 && resultNodes.length < maxNodes) {
      const [currentId, depth] = queue.shift()!;

      if (depth >= maxDepth) continue;

      // Find incident edges in memory
      for (const edge of this.inMemoryEdges.values()) {
        if (edge.workspaceId !== query.workspaceId) continue;
        if (visitedEdgeIds.has(edge.id)) continue;

        if (edge.source === currentId || edge.target === currentId) {
          const neighborId = edge.source === currentId ? edge.target : edge.source;

          if (resultEdges.length < maxEdges) {
            visitedEdgeIds.add(edge.id);
            resultEdges.push(edge);
          }

          if (!visitedNodeIds.has(neighborId)) {
            visitedNodeIds.add(neighborId);
            const neighborNode = this.inMemoryNodes.get(neighborId);
            if (neighborNode && resultNodes.length < maxNodes) {
              resultNodes.push(neighborNode);
            }
            queue.push([neighborId, depth + 1]);
          }
        }
      }
    }

    return { nodes: resultNodes, edges: resultEdges };
  }

  /**
   * Finds shortest path between source and target nodes with Rule 55 ceilings:
   * maxDepth <= 3, maxNodes <= 80.
   */
  async findPath(query: {
    workspaceId: string;
    sourceNodeId: string;
    targetNodeId: string;
    maxDepth?: number;
    maxNodes?: number;
  }): Promise<{
    pathFound: boolean;
    nodes: GraphNodeRecord[];
    edges: GraphEdgeRecord[];
  }> {
    const maxDepth = Math.min(3, Math.max(1, query.maxDepth ?? 2));
    const maxNodes = Math.min(80, Math.max(1, query.maxNodes ?? 80));

    if (query.sourceNodeId === query.targetNodeId) {
      const node = this.inMemoryNodes.get(query.sourceNodeId);
      return {
        pathFound: true,
        nodes: node ? [node] : [],
        edges: [],
      };
    }

    // BFS Queue: [currentId, pathNodeIds, pathEdgeIds]
    const queue: [string, string[], GraphEdgeRecord[]][] = [
      [query.sourceNodeId, [query.sourceNodeId], []],
    ];
    const visited = new Set<string>([query.sourceNodeId]);

    while (queue.length > 0) {
      const [currentId, pathNodes, pathEdges] = queue.shift()!;

      if (pathNodes.length - 1 >= maxDepth) continue;

      for (const edge of this.inMemoryEdges.values()) {
        if (edge.workspaceId !== query.workspaceId) continue;

        if (edge.source === currentId || edge.target === currentId) {
          const nextId = edge.source === currentId ? edge.target : edge.source;

          if (nextId === query.targetNodeId) {
            const finalNodes = [...pathNodes, nextId].slice(0, maxNodes);
            const finalEdges = [...pathEdges, edge];
            const nodeRecords = finalNodes
              .map((id) => this.inMemoryNodes.get(id))
              .filter((n): n is GraphNodeRecord => Boolean(n));

            return {
              pathFound: true,
              nodes: nodeRecords,
              edges: finalEdges,
            };
          }

          if (!visited.has(nextId)) {
            visited.add(nextId);
            queue.push([nextId, [...pathNodes, nextId], [...pathEdges, edge]]);
          }
        }
      }
    }

    return { pathFound: false, nodes: [], edges: [] };
  }
}

// Global HMR singleton preservation
const GLOBAL_KNOWLEDGE_GRAPH_SERVICE_KEY = Symbol.for('smartsapp.knowledge_graph_service');
type GlobalWithGraphService = typeof globalThis & {
  [GLOBAL_KNOWLEDGE_GRAPH_SERVICE_KEY]?: KnowledgeGraphProjectionService;
};

export function getKnowledgeGraphProjectionService(): KnowledgeGraphProjectionService {
  const g = globalThis as GlobalWithGraphService;
  if (!g[GLOBAL_KNOWLEDGE_GRAPH_SERVICE_KEY]) {
    g[GLOBAL_KNOWLEDGE_GRAPH_SERVICE_KEY] = new KnowledgeGraphProjectionService();
  }
  return g[GLOBAL_KNOWLEDGE_GRAPH_SERVICE_KEY];
}
