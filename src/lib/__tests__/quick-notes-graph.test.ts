import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRelationDisplayLabel,
  buildAdjacencyGraph,
  findShortestGraphPath,
  extractSubGraph,
  detectGraphClusters,
  computeGraphMetrics,
  filterKnowledgeGraph,
  extractBacklinks,
} from '../quick-notes-domain';
import type {
  UnifiedNote,
  KnowledgeRelation,
  GraphNode,
  GraphEdge,
} from '../quick-notes-types';

describe('Company Brain Phase 5: Knowledge Graph Domain Logic', () => {
  const mockNotes: UnifiedNote[] = [
    {
      id: 'note-1',
      source: 'quick_note',
      sourceId: 'note-1',
      workspaceId: 'ws-1',
      title: 'Automated Billing Proposal',
      plainText: 'Proposes term billing automation for secondary schools.',
      knowledgeType: 'idea',
      status: 'active',
      visibility: 'workspace',
      tags: ['billing', 'schools'],
      attachments: [],
      links: {
        entityId: 'school-100',
        entityName: 'St. Peter Senior High',
        contactId: 'contact-200',
        contactName: 'Kofi Mensah',
      },
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      createdBy: 'user-1',
      createdByName: 'Alice Johnson',
      isPinned: false,
      editable: true,
      originHref: '/admin/quick-notes?id=note-1',
    },
    {
      id: 'note-2',
      source: 'quick_note',
      sourceId: 'note-2',
      workspaceId: 'ws-1',
      title: 'Principal Call Observation',
      plainText: 'Principal explicitly complained about manual receipt reconciliations.',
      knowledgeType: 'observation',
      status: 'active',
      visibility: 'workspace',
      tags: ['complaints', 'receipts'],
      attachments: [],
      links: {
        entityId: 'school-100',
        entityName: 'St. Peter Senior High',
      },
      createdAt: '2026-09-02T11:00:00.000Z',
      updatedAt: '2026-09-02T11:00:00.000Z',
      createdBy: 'user-2',
      createdByName: 'Bob Smith',
      isPinned: false,
      editable: true,
      originHref: '/admin/quick-notes?id=note-2',
    },
    {
      id: 'note-3',
      source: 'quick_note',
      sourceId: 'note-3',
      workspaceId: 'ws-1',
      title: 'Mobile Money Gateway Decision',
      plainText: 'Decided to integrate Direct Debit with telecom aggregators.',
      knowledgeType: 'decision',
      status: 'active',
      visibility: 'workspace',
      tags: ['momo', 'payments'],
      attachments: [],
      links: {},
      createdAt: '2026-09-03T12:00:00.000Z',
      updatedAt: '2026-09-03T12:00:00.000Z',
      createdBy: 'user-1',
      createdByName: 'Alice Johnson',
      isPinned: false,
      editable: true,
      originHref: '/admin/quick-notes?id=note-3',
    },
    {
      id: 'note-4',
      source: 'quick_note',
      sourceId: 'note-4',
      workspaceId: 'ws-1',
      title: 'Isolated Marketing Note',
      plainText: 'A note with no connections to other items.',
      knowledgeType: 'note',
      status: 'active',
      visibility: 'workspace',
      tags: ['marketing'],
      attachments: [],
      links: {},
      createdAt: '2026-09-04T08:00:00.000Z',
      updatedAt: '2026-09-04T08:00:00.000Z',
      createdBy: 'user-3',
      createdByName: 'Charlie Green',
      isPinned: false,
      editable: true,
      originHref: '/admin/quick-notes?id=note-4',
    },
  ];

  const mockRelations: KnowledgeRelation[] = [
    {
      id: 'rel-1',
      workspaceId: 'ws-1',
      fromObjectId: 'note-2',
      fromObjectType: 'observation',
      toObjectId: 'note-1',
      toObjectType: 'idea',
      relationType: 'supports',
      confidence: 0.95,
      source: 'user',
      createdBy: 'user-1',
      createdAt: '2026-09-02T12:00:00.000Z',
    },
    {
      id: 'rel-2',
      workspaceId: 'ws-1',
      fromObjectId: 'note-1',
      fromObjectType: 'idea',
      toObjectId: 'note-3',
      toObjectType: 'decision',
      relationType: 'depends_on',
      confidence: 0.88,
      source: 'ai',
      createdBy: 'user-1',
      createdAt: '2026-09-03T13:00:00.000Z',
    },
  ];

  describe('getRelationDisplayLabel', () => {
    it('returns human-readable labels for standard relations', () => {
      expect(getRelationDisplayLabel('supports')).toBe('Supports');
      expect(getRelationDisplayLabel('depends_on')).toBe('Depends On');
      expect(getRelationDisplayLabel('derived_from')).toBe('Derived From');
      expect(getRelationDisplayLabel('about_school')).toBe('About School');
      expect(getRelationDisplayLabel('about_contact')).toBe('About Contact');
    });
  });

  describe('buildAdjacencyGraph', () => {
    it('correctly constructs nodes and edges from notes and explicit relations', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);

      // Note nodes + synthesized CRM entity nodes (school-100, contact-200)
      expect(graph.nodes.length).toBeGreaterThanOrEqual(6);
      expect(graph.nodes.find((n) => n.id === 'note-1')).toBeDefined();
      expect(graph.nodes.find((n) => n.id === 'school-100')).toBeDefined();
      expect(graph.nodes.find((n) => n.id === 'contact-200')).toBeDefined();

      // Edges must include explicit relations (rel-1, rel-2) + implicit entity links
      expect(graph.edges.length).toBeGreaterThanOrEqual(2);
      expect(graph.edges.some((e) => e.source === 'note-2' && e.target === 'note-1')).toBe(true);
      expect(graph.edges.some((e) => e.source === 'note-1' && e.target === 'note-3')).toBe(true);
    });

    it('computes metrics accurately', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      expect(graph.metrics.totalNodes).toBe(graph.nodes.length);
      expect(graph.metrics.totalEdges).toBe(graph.edges.length);
      expect(graph.metrics.density).toBeGreaterThanOrEqual(0);
      expect(graph.metrics.clustersCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('findShortestGraphPath (Path Mode BFS)', () => {
    it('finds direct connection between connected nodes', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      const res = findShortestGraphPath(graph.nodes, graph.edges, 'note-2', 'note-1');

      expect(res.found).toBe(true);
      expect(res.distance).toBe(1);
      expect(res.path).toEqual(['note-2', 'note-1']);
    });

    it('finds multi-hop connection across transitive relationships', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      // note-2 -> note-1 -> note-3 (2 hops)
      const res = findShortestGraphPath(graph.nodes, graph.edges, 'note-2', 'note-3');

      expect(res.found).toBe(true);
      expect(res.distance).toBe(2);
      expect(res.path).toEqual(['note-2', 'note-1', 'note-3']);
      expect(res.explanation).toContain('Supports');
      expect(res.explanation).toContain('Depends On');
    });

    it('returns found: false when components are disconnected', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      const res = findShortestGraphPath(graph.nodes, graph.edges, 'note-4', 'note-1');

      expect(res.found).toBe(false);
      expect(res.distance).toBe(Infinity);
      expect(res.path).toEqual([]);
    });

    it('handles identical start and end node without loop', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      const res = findShortestGraphPath(graph.nodes, graph.edges, 'note-1', 'note-1');

      expect(res.found).toBe(true);
      expect(res.distance).toBe(0);
      expect(res.path).toEqual(['note-1']);
    });

    it('finds symmetric reverse path regardless of selection order', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      // Querying backwards from note-3 to note-2 still finds the 2-hop connection
      const res = findShortestGraphPath(graph.nodes, graph.edges, 'note-3', 'note-2');

      expect(res.found).toBe(true);
      expect(res.distance).toBe(2);
      expect(res.path).toEqual(['note-3', 'note-1', 'note-2']);
    });
  });

  describe('extractSubGraph (Focus Mode)', () => {
    it('extracts immediate 1-hop neighborhood around a focused node', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      const subGraph = extractSubGraph(graph, 'note-1', 1);

      expect(subGraph.nodes.some((n) => n.id === 'note-1')).toBe(true);
      expect(subGraph.nodes.some((n) => n.id === 'note-2')).toBe(true);
      expect(subGraph.nodes.some((n) => n.id === 'note-3')).toBe(true);
      // note-4 is isolated and must not be in the subGraph
      expect(subGraph.nodes.some((n) => n.id === 'note-4')).toBe(false);
    });
  });

  describe('detectGraphClusters', () => {
    it('identifies separate cluster groups for connected vs isolated components', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      const clusters = detectGraphClusters(graph.nodes, graph.edges);

      expect(clusters.size).toBeGreaterThanOrEqual(2);
      // Check that note-4 is in its own cluster
      let note4Cluster: string | undefined;
      for (const [clusterId, nodeIds] of clusters.entries()) {
        if (nodeIds.includes('note-4')) {
          note4Cluster = clusterId;
          break;
        }
      }
      expect(note4Cluster).toBeDefined();
    });
  });

  describe('filterKnowledgeGraph', () => {
    it('filters graph by node types', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      const filtered = filterKnowledgeGraph(graph, {
        nodeTypes: ['idea', 'decision'],
      });

      expect(filtered.nodes.every((n) => n.type === 'idea' || n.type === 'decision')).toBe(true);
      expect(filtered.edges.every((e) => filtered.nodes.some((n) => n.id === e.source))).toBe(true);
    });

    it('filters graph by search query', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      const filtered = filterKnowledgeGraph(graph, {
        searchQuery: 'Billing Proposal',
      });

      expect(filtered.nodes.length).toBe(1);
      expect(filtered.nodes[0].id).toBe('note-1');
    });

    it('filters out isolated nodes when showIsolated is false', () => {
      const graph = buildAdjacencyGraph(mockRelations, mockNotes);
      const filtered = filterKnowledgeGraph(graph, {
        showIsolated: false,
      });

      expect(filtered.nodes.some((n) => n.id === 'note-4')).toBe(false);
    });
  });

  describe('extractBacklinks', () => {
    it('extracts incoming backlinks referencing target note', () => {
      const notesMap = new Map(mockNotes.map((n) => [n.id, n]));
      // note-1 is referenced by note-2 (via rel-1)
      const backlinks = extractBacklinks('note-1', mockRelations, notesMap);

      expect(backlinks.length).toBe(1);
      expect(backlinks[0].sourceNodeId).toBe('note-2');
      expect(backlinks[0].sourceTitle).toBe('Principal Call Observation');
      expect(backlinks[0].relationType).toBe('supports');
    });

    it('returns empty array when no backlink exists', () => {
      const notesMap = new Map(mockNotes.map((n) => [n.id, n]));
      const backlinks = extractBacklinks('note-4', mockRelations, notesMap);
      expect(backlinks).toEqual([]);
    });
  });
});
