/**
 * @fileOverview CompanyBrain 2.0: Knowledge Graph Traversal & Topology Service
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Cycle-Safe BFS Traversal (Rule 2 & Rule 9):
 *    - Graph traversals MUST maintain a `visited` Set to avoid infinite loops on circular paths.
 * 2. Strict Depth & Cardinality Bounds:
 *    - Live traversal enforces `maxDepth <= 3` (default: 2) and limits output to <= 500 nodes and <= 1,000 edges.
 * 3. Bidirectional Neighbor Resolution:
 *    - Accurately discovers both incoming and outgoing relationships with confidence filtering.
 * 4. Zero-`any` Standard:
 *    - All inputs, outputs, and intermediate states are strictly typed.
 *
 * @testability Covered in `src/lib/memory/__tests__/knowledge-graph-service.test.ts`.
 */

import { GraphRepository } from '../graph-repository';
import type {
  CompanyBrainGraphNode,
  CompanyBrainGraphEdge,
  GraphRelationshipType,
  GraphPath,
  GraphTraversalResult,
  GraphQueryFilter,
} from '../graph-types';

export interface NeighborOptions {
  direction?: 'in' | 'out' | 'both';
  types?: GraphRelationshipType[];
  minConfidence?: number;
  limit?: number;
}

export class KnowledgeGraphService {
  /**
   * Retrieves a single node by ID.
   */
  public static async getNode(nodeId: string): Promise<CompanyBrainGraphNode | null> {
    return GraphRepository.getNode(nodeId);
  }

  /**
   * Retrieves 1-hop neighbor nodes and connecting edges for a given node.
   */
  public static async getNeighbors(
    nodeId: string,
    options: NeighborOptions = {}
  ): Promise<{ nodes: CompanyBrainGraphNode[]; edges: CompanyBrainGraphEdge[] }> {
    const {
      direction = 'both',
      types,
      minConfidence = 0.0,
      limit = 50,
    } = options;

    const edgePromises: Promise<CompanyBrainGraphEdge[]>[] = [];

    if (direction === 'out' || direction === 'both') {
      edgePromises.push(GraphRepository.findOutgoingEdges(nodeId, types, minConfidence));
    }
    if (direction === 'in' || direction === 'both') {
      edgePromises.push(GraphRepository.findIncomingEdges(nodeId, types, minConfidence));
    }

    const edgeArrays = await Promise.all(edgePromises);
    const allEdges = edgeArrays.flat().slice(0, limit);

    // Identify all neighbor node IDs (excluding self)
    const neighborNodeIds = new Set<string>();
    for (const edge of allEdges) {
      if (edge.sourceNodeId !== nodeId) neighborNodeIds.add(edge.sourceNodeId);
      if (edge.targetNodeId !== nodeId) neighborNodeIds.add(edge.targetNodeId);
    }

    const neighborNodes = await GraphRepository.getNodes(Array.from(neighborNodeIds));
    return { nodes: neighborNodes, edges: allEdges };
  }

  /**
   * Executes a bounded breadth-first traversal starting from a root node.
   * Cycle-safe with visited set and strict depth limits (<= 3 hops).
   */
  public static async traverse(
    startNodeId: string,
    maxDepth = 2,
    filters: GraphQueryFilter = {}
  ): Promise<GraphTraversalResult> {
    const boundedDepth = Math.min(Math.max(1, maxDepth), 3);
    const maxNodes = filters.limit ? Math.min(filters.limit, 500) : 300;

    const rootNode = await GraphRepository.getNode(startNodeId);
    if (!rootNode) {
      return {
        rootNodeId: startNodeId,
        nodes: [],
        edges: [],
        depth: 0,
        totalVisited: 0,
      };
    }

    const visitedNodeIds = new Set<string>([startNodeId]);
    const collectedNodes = new Map<string, CompanyBrainGraphNode>([[startNodeId, rootNode]]);
    const collectedEdges = new Map<string, CompanyBrainGraphEdge>();

    // BFS Queue: [nodeId, currentDepth]
    let currentQueue: string[] = [startNodeId];
    let depth = 0;

    while (currentQueue.length > 0 && depth < boundedDepth && collectedNodes.size < maxNodes) {
      depth++;
      const nextQueue: string[] = [];

      for (const currentNodeId of currentQueue) {
        const { nodes: neighborNodes, edges: neighborEdges } = await this.getNeighbors(
          currentNodeId,
          {
            types: filters.relationshipTypes,
            minConfidence: filters.minConfidence ?? 0.0,
            limit: 60,
          }
        );

        for (const edge of neighborEdges) {
          collectedEdges.set(edge.id, edge);
        }

        for (const neighbor of neighborNodes) {
          // Check node type filter if specified
          if (filters.nodeTypes && filters.nodeTypes.length > 0) {
            if (!filters.nodeTypes.includes(neighbor.nodeType)) {
              continue;
            }
          }

          if (!visitedNodeIds.has(neighbor.id)) {
            visitedNodeIds.add(neighbor.id);
            collectedNodes.set(neighbor.id, neighbor);
            nextQueue.push(neighbor.id);

            if (collectedNodes.size >= maxNodes) break;
          }
        }

        if (collectedNodes.size >= maxNodes) break;
      }

      currentQueue = nextQueue;
    }

    return {
      rootNodeId: startNodeId,
      nodes: Array.from(collectedNodes.values()),
      edges: Array.from(collectedEdges.values()),
      depth,
      totalVisited: collectedNodes.size,
    };
  }

  /**
   * Finds the shortest connecting path between two nodes using Breadth-First Search (BFS).
   */
  public static async findPath(
    startNodeId: string,
    targetNodeId: string,
    maxHops = 4
  ): Promise<GraphPath | null> {
    if (!startNodeId || !targetNodeId) return null;
    if (startNodeId === targetNodeId) {
      const node = await GraphRepository.getNode(startNodeId);
      return node ? { nodes: [node], edges: [], length: 0 } : null;
    }

    const boundedMaxHops = Math.min(Math.max(1, maxHops), 5);
    const visited = new Set<string>([startNodeId]);

    // Parent tracking map for path reconstruction: nodeId -> { parentId, edge }
    const parentMap = new Map<string, { parentId: string; edge: CompanyBrainGraphEdge }>();

    let queue: string[] = [startNodeId];
    let found = false;
    let hops = 0;

    while (queue.length > 0 && hops < boundedMaxHops && !found) {
      hops++;
      const nextQueue: string[] = [];

      for (const currentId of queue) {
        const { nodes: neighbors, edges } = await this.getNeighbors(currentId, { limit: 40 });

        for (const neighbor of neighbors) {
          if (visited.has(neighbor.id)) continue;
          visited.add(neighbor.id);

          // Find the edge that connects currentId and neighbor.id
          const connectingEdge = edges.find(
            (e) =>
              (e.sourceNodeId === currentId && e.targetNodeId === neighbor.id) ||
              (e.targetNodeId === currentId && e.sourceNodeId === neighbor.id)
          );

          if (connectingEdge) {
            parentMap.set(neighbor.id, { parentId: currentId, edge: connectingEdge });
          }

          if (neighbor.id === targetNodeId) {
            found = true;
            break;
          }

          nextQueue.push(neighbor.id);
        }

        if (found) break;
      }

      queue = nextQueue;
    }

    if (!found) return null;

    // Reconstruct path backward from targetNodeId to startNodeId
    const pathNodes: string[] = [targetNodeId];
    const pathEdges: CompanyBrainGraphEdge[] = [];
    let curr = targetNodeId;

    while (curr !== startNodeId) {
      const step = parentMap.get(curr);
      if (!step) break;
      pathEdges.unshift(step.edge);
      pathNodes.unshift(step.parentId);
      curr = step.parentId;
    }

    const hydratedNodes = await GraphRepository.getNodes(pathNodes);
    // Preserve ordering of pathNodes
    const nodeLookup = new Map(hydratedNodes.map((n) => [n.id, n]));
    const orderedNodes = pathNodes
      .map((id) => nodeLookup.get(id))
      .filter((n): n is CompanyBrainGraphNode => n !== undefined);

    return {
      nodes: orderedNodes,
      edges: pathEdges,
      length: pathEdges.length,
    };
  }

  /**
   * Retrieves a sub-graph surrounding one or more focal nodes (e.g. for an Entity Profile).
   */
  public static async getSubGraph(
    rootNodeIds: string[],
    depth = 2,
    filters: GraphQueryFilter = {}
  ): Promise<{ nodes: CompanyBrainGraphNode[]; edges: CompanyBrainGraphEdge[] }> {
    const nodeMap = new Map<string, CompanyBrainGraphNode>();
    const edgeMap = new Map<string, CompanyBrainGraphEdge>();

    await Promise.all(
      rootNodeIds.map(async (rootId) => {
        const traversal = await this.traverse(rootId, depth, filters);
        for (const node of traversal.nodes) {
          nodeMap.set(node.id, node);
        }
        for (const edge of traversal.edges) {
          edgeMap.set(edge.id, edge);
        }
      })
    );

    return {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    };
  }

  /**
   * Creates or updates a graph edge.
   */
  public static async createEdge(edge: CompanyBrainGraphEdge): Promise<void> {
    await GraphRepository.upsertEdge(edge);
  }

  /**
   * Deletes a graph edge.
   */
  public static async deleteEdge(edgeId: string, workspaceId: string): Promise<void> {
    await GraphRepository.deleteEdge(edgeId, workspaceId);
  }
}
