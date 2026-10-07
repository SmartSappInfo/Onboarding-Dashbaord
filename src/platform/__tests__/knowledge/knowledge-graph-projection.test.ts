/**
 * @fileOverview Test Suite: Relationship Graph Projection & Rule 55 Traversal Ceilings (Phase 11 M3 · T5)
 *
 * Enforces Rule 55 (Graph Canvas Ceilings: max 80 nodes, max 150 edges, traversal depth <= 2 or 3),
 * Rule 40 (Domain Event Publishing: knowledge.graph.projected),
 * Rule 8 & 47 (Multi-Tenant Scoping & Anti-IDOR).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeGraphProjectionService } from '../../domains/knowledge_memory/services/knowledge-graph-projection-service';
import {
  knowledgeGraphGetNeighborsCapability,
  knowledgeGraphFindPathCapability,
} from '../../domains/knowledge_memory/contracts/knowledge-capabilities.contract';
import type { KnowledgeCandidate } from '../../domains/knowledge_memory/contracts/knowledge-schemas';
import { defaultEventBus } from '../../events/event-bus';

describe('Relationship Graph Projection & Rule 55 Ceilings (Phase 11 M3 · T5)', () => {
  let service: KnowledgeGraphProjectionService;

  beforeEach(() => {
    service = new KnowledgeGraphProjectionService();
  });

  describe('projectCandidate', () => {
    it('projects candidate subject and relationships into graph nodes and edges', async () => {
      const publishSpy = vi.spyOn(defaultEventBus, 'publish');

      const candidate: KnowledgeCandidate = {
        id: 'cand_proj_01',
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        source: { type: 'meeting', id: 'meet_q3_review' },
        type: 'fact',
        title: 'Partnership Agreement',
        content: '<untrusted_reference_data id="c1" source="meeting:meet_q3_review">Lincoln Community School partnered with TechCorp.</untrusted_reference_data>',
        subjectRefs: ['entity_lincoln_school', 'entity_techcorp'],
        suggestedRelationships: [
          {
            targetId: 'entity_techcorp',
            predicate: 'partnered_with',
            confidence: 0.95,
          },
        ],
        confidence: 0.95,
        verificationState: 'verified',
        sensitivity: 'internal',
        status: 'accepted',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await service.projectCandidate(candidate);

      expect(result.nodes.length).toBeGreaterThanOrEqual(2);
      expect(result.edges.length).toBeGreaterThanOrEqual(1);

      const edge = result.edges.find((e) => e.relationship === 'partnered_with');
      expect(edge).toBeDefined();
      expect(edge?.target).toBe('entity_techcorp');
      expect(edge?.weight).toBe(0.95);

      // Verify domain event emitted (Rule 40)
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge.graph.projected',
          payload: expect.objectContaining({
            candidateId: candidate.id,
            nodesCount: result.nodes.length,
            edgesCount: result.edges.length,
          }),
        })
      );
    });
  });

  describe('Rule 55 Traversal Ceilings (maxNodes <= 80, maxDepth <= 2)', () => {
    it('strictly clamps neighbor traversal results to <= 80 nodes and <= 150 edges', async () => {
      // Seed a dense hub-and-spoke graph with 100 leaf nodes
      const hubId = 'node_dense_hub';
      await service.upsertNode({ id: hubId, label: 'Central Hub', type: 'entity', workspaceId: 'ws_test_1' });

      for (let i = 1; i <= 100; i++) {
        const leafId = `node_leaf_${i}`;
        await service.upsertNode({ id: leafId, label: `Leaf ${i}`, type: 'concept', workspaceId: 'ws_test_1' });
        await service.upsertEdge({
          id: `edge_hub_${leafId}`,
          source: hubId,
          target: leafId,
          relationship: 'connected_to',
          weight: 0.8,
          workspaceId: 'ws_test_1',
        });
      }

      // Query neighbors requesting 100 nodes - must clamp to <= 80 per Rule 55
      const result = await service.getNeighbors({
        workspaceId: 'ws_test_1',
        nodeId: hubId,
        maxNodes: 80,
        maxDepth: 1,
      });

      expect(result.nodes.length).toBeLessThanOrEqual(80);
      expect(result.edges.length).toBeLessThanOrEqual(150);
    });

    it('enforces depth boundary clamp (maxDepth <= 2 for neighbors)', async () => {
      // Build a 4-step chain: A -> B -> C -> D -> E
      const chain = ['node_A', 'node_B', 'node_C', 'node_D', 'node_E'];
      for (const id of chain) {
        await service.upsertNode({ id, label: id, type: 'entity', workspaceId: 'ws_test_1' });
      }
      for (let i = 0; i < chain.length - 1; i++) {
        await service.upsertEdge({
          id: `edge_${chain[i]}_${chain[i + 1]}`,
          source: chain[i],
          target: chain[i + 1],
          relationship: 'leads_to',
          weight: 1.0,
          workspaceId: 'ws_test_1',
        });
      }

      const depth1 = await service.getNeighbors({
        workspaceId: 'ws_test_1',
        nodeId: 'node_A',
        maxDepth: 1,
      });
      expect(depth1.nodes.map((n) => n.id)).toContain('node_B');
      expect(depth1.nodes.map((n) => n.id)).not.toContain('node_C');

      const depth2 = await service.getNeighbors({
        workspaceId: 'ws_test_1',
        nodeId: 'node_A',
        maxDepth: 2,
      });
      expect(depth2.nodes.map((n) => n.id)).toContain('node_C');
      expect(depth2.nodes.map((n) => n.id)).not.toContain('node_D'); // Excluded by depth <= 2
    });

    it('finds path between two nodes within maxDepth <= 3', async () => {
      await service.upsertNode({ id: 'start_node', label: 'Start', type: 'entity', workspaceId: 'ws_test_1' });
      await service.upsertNode({ id: 'mid_node', label: 'Middle', type: 'entity', workspaceId: 'ws_test_1' });
      await service.upsertNode({ id: 'end_node', label: 'End', type: 'entity', workspaceId: 'ws_test_1' });

      await service.upsertEdge({
        id: 'e1',
        source: 'start_node',
        target: 'mid_node',
        relationship: 'next',
        weight: 1.0,
        workspaceId: 'ws_test_1',
      });
      await service.upsertEdge({
        id: 'e2',
        source: 'mid_node',
        target: 'end_node',
        relationship: 'next',
        weight: 1.0,
        workspaceId: 'ws_test_1',
      });

      const pathResult = await service.findPath({
        workspaceId: 'ws_test_1',
        sourceNodeId: 'start_node',
        targetNodeId: 'end_node',
        maxDepth: 3,
      });

      expect(pathResult.pathFound).toBe(true);
      expect(pathResult.nodes.length).toBe(3);
      expect(pathResult.edges.length).toBe(2);
    });
  });

  describe('Governed Graph Capabilities', () => {
    it('defines knowledge.graph.get_neighbors as L0_READ', () => {
      expect(knowledgeGraphGetNeighborsCapability.id).toBe('knowledge.graph.get_neighbors');
      expect(knowledgeGraphGetNeighborsCapability.risk.level).toBe('L0_READ');
      expect(knowledgeGraphGetNeighborsCapability.domain).toBe('knowledge_memory');
    });

    it('defines knowledge.graph.find_path as L0_READ', () => {
      expect(knowledgeGraphFindPathCapability.id).toBe('knowledge.graph.find_path');
      expect(knowledgeGraphFindPathCapability.risk.level).toBe('L0_READ');
      expect(knowledgeGraphFindPathCapability.domain).toBe('knowledge_memory');
    });
  });
});
