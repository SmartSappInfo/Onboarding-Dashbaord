import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  CompanyBrainGraphNode,
  CompanyBrainGraphEdge,
} from '../graph-types';
import { memoryTypeToRelationship } from '../graph-types';

const { inMemoryNodes, inMemoryEdges } = vi.hoisted(() => {
  const inMemoryNodes = new Map<string, CompanyBrainGraphNode>();
  const inMemoryEdges = new Map<string, CompanyBrainGraphEdge>();
  return { inMemoryNodes, inMemoryEdges };
});

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((id?: string) => ({
        id: id || 'doc_gen',
        get: vi.fn(async () => {
          const store = colName === 'graph_nodes' ? inMemoryNodes : inMemoryEdges;
          const data = id ? store.get(id) : undefined;
          return {
            exists: data !== undefined,
            data: () => data,
          };
        }),
        set: vi.fn(async (data: unknown) => {
          if (id) {
            if (colName === 'graph_nodes') {
              inMemoryNodes.set(id, data as CompanyBrainGraphNode);
            } else {
              inMemoryEdges.set(id, data as CompanyBrainGraphEdge);
            }
          }
        }),
        delete: vi.fn(async () => {
          if (id) {
            if (colName === 'graph_nodes') {
              inMemoryNodes.delete(id);
            } else {
              inMemoryEdges.delete(id);
            }
          }
        }),
      })),
      where: vi.fn((field: string, op: string, val: unknown) => {
        let filtered: Array<CompanyBrainGraphNode | CompanyBrainGraphEdge> =
          colName === 'graph_nodes'
            ? Array.from(inMemoryNodes.values())
            : Array.from(inMemoryEdges.values());
        if (op === '==') {
          filtered = filtered.filter((item) => (item as unknown as Record<string, unknown>)[field] === val);
        }
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn(async () => ({
            docs: filtered.map((item) => ({
              id: item.id,
              data: () => item,
            })),
          })),
        };
      }),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(async () => {
        const items =
          colName === 'graph_nodes'
            ? Array.from(inMemoryNodes.values())
            : Array.from(inMemoryEdges.values());
        return {
          docs: items.map((item) => ({
            id: item.id,
            data: () => item,
          })),
        };
      }),
    })),
    batch: vi.fn(() => ({
      set: vi.fn((docRef: { id: string }, data: unknown) => {
        if (data && typeof data === 'object' && 'nodeType' in data) {
          inMemoryNodes.set(docRef.id, data as CompanyBrainGraphNode);
        } else if (data && typeof data === 'object' && 'relationshipType' in data) {
          inMemoryEdges.set(docRef.id, data as CompanyBrainGraphEdge);
        }
      }),
      delete: vi.fn((docRef: { id: string }) => {
        inMemoryNodes.delete(docRef.id);
        inMemoryEdges.delete(docRef.id);
      }),
      commit: vi.fn(async () => []),
    })),
    getAll: vi.fn(async (...refs: Array<{ id: string }>) => {
      return refs.map((ref) => {
        const data = inMemoryNodes.get(ref.id);
        return {
          exists: data !== undefined,
          data: () => data,
        };
      });
    }),
  },
}));

import { GraphRepository } from '../graph-repository';
import { KnowledgeGraphService } from '../services/knowledge-graph-service';

beforeEach(() => {
  inMemoryNodes.clear();
  inMemoryEdges.clear();
  vi.clearAllMocks();
});

describe('KnowledgeGraphService & GraphRepository', () => {
  const nodeA: CompanyBrainGraphNode = {
    id: 'ent_school_1',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    nodeType: 'entity',
    sourceId: 'school_1',
    label: 'Bright Future Academy',
    createdAt: new Date().toISOString(),
  };

  const nodeB: CompanyBrainGraphNode = {
    id: 'deal_101',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    nodeType: 'deal',
    sourceId: 'deal_101',
    label: 'SmartSapp Annual Renewal',
    createdAt: new Date().toISOString(),
  };

  const nodeC: CompanyBrainGraphNode = {
    id: 'mem_202',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    nodeType: 'memory',
    sourceId: 'mem_202',
    label: 'Pricing Objection on Multi-Campus Setup',
    createdAt: new Date().toISOString(),
  };

  const edgeAB: CompanyBrainGraphEdge = {
    id: 'edge_a_b',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    sourceNodeId: nodeA.id,
    targetNodeId: nodeB.id,
    relationshipType: 'OWNS_DEAL',
    confidence: 1.0,
    sourceType: 'system',
    createdAt: new Date().toISOString(),
  };

  const edgeBC: CompanyBrainGraphEdge = {
    id: 'edge_b_c',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    sourceNodeId: nodeB.id,
    targetNodeId: nodeC.id,
    relationshipType: 'DISCUSSED',
    confidence: 0.9,
    sourceType: 'ai',
    createdAt: new Date().toISOString(),
  };

  it('persists and retrieves nodes correctly', async () => {
    await GraphRepository.upsertNode(nodeA);
    const retrieved = await GraphRepository.getNode(nodeA.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(nodeA.id);
    expect(retrieved?.label).toBe('Bright Future Academy');
    expect(retrieved?.nodeType).toBe('entity');
  });

  it('finds the shortest path between multi-hop connected nodes', async () => {
    // Seed A -> B -> C
    inMemoryNodes.set(nodeA.id, nodeA);
    inMemoryNodes.set(nodeB.id, nodeB);
    inMemoryNodes.set(nodeC.id, nodeC);

    inMemoryEdges.set(edgeAB.id, edgeAB);
    inMemoryEdges.set(edgeBC.id, edgeBC);

    const path = await KnowledgeGraphService.findPath(nodeA.id, nodeC.id, 4);

    expect(path).not.toBeNull();
    expect(path?.length).toBe(2);
    expect(path?.nodes.map((n) => n.id)).toEqual([nodeA.id, nodeB.id, nodeC.id]);
    expect(path?.edges.map((e) => e.relationshipType)).toEqual(['OWNS_DEAL', 'DISCUSSED']);
  });

  it('handles cyclical graph paths without infinite loops', async () => {
    // Seed cycle: A -> B -> C -> A
    inMemoryNodes.set(nodeA.id, nodeA);
    inMemoryNodes.set(nodeB.id, nodeB);
    inMemoryNodes.set(nodeC.id, nodeC);

    inMemoryEdges.set(edgeAB.id, edgeAB);
    inMemoryEdges.set(edgeBC.id, edgeBC);
    const edgeCA: CompanyBrainGraphEdge = {
      id: 'edge_c_a',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      sourceNodeId: nodeC.id,
      targetNodeId: nodeA.id,
      relationshipType: 'MENTIONS',
      confidence: 0.8,
      sourceType: 'ai',
      createdAt: new Date().toISOString(),
    };
    inMemoryEdges.set(edgeCA.id, edgeCA);

    // Traversal should terminate safely due to visited set
    const traversal = await KnowledgeGraphService.traverse(nodeA.id, 3);
    expect(traversal.nodes.length).toBe(3);
    expect(traversal.totalVisited).toBe(3);
  });

  it('maps memory types to semantic graph relationships accurately', () => {
    expect(memoryTypeToRelationship('problem')).toBe('HAS_PROBLEM');
    expect(memoryTypeToRelationship('opportunity')).toBe('HAS_OPPORTUNITY');
    expect(memoryTypeToRelationship('risk')).toBe('HAS_RISK');
    expect(memoryTypeToRelationship('insight')).toBe('INTERESTED_IN');
    expect(memoryTypeToRelationship('decision')).toBe('INTERESTED_IN');
  });

  it('cascades deletion of incident edges when a node is removed', async () => {
    inMemoryNodes.set(nodeA.id, nodeA);
    inMemoryNodes.set(nodeB.id, nodeB);
    inMemoryEdges.set(edgeAB.id, edgeAB);

    await GraphRepository.deleteNode(nodeA.id, 'ws_test');

    expect(inMemoryNodes.has(nodeA.id)).toBe(false);
    expect(inMemoryEdges.has(edgeAB.id)).toBe(false);
  });
});
