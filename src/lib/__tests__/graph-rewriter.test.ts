import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import {
  canInsertNodeOnEdge,
  spliceNodeOnEdge,
  healGraphGap,
  hasPath,
} from '../automations/graph-rewriter';

describe('Graph Splicing & Re-wiring Utilities', () => {
  // Setup a basic linear flow:
  // Node A (Trigger) -> Node B (Action 1) -> Node C (Action 2)
  const initialNodes: Node[] = [
    { id: 'node-A', type: 'triggerNode', position: { x: 400, y: 100 }, data: { label: 'Trigger' } },
    { id: 'node-B', type: 'actionNode', position: { x: 400, y: 240 }, data: { label: 'Action 1' } },
    { id: 'node-C', type: 'actionNode', position: { x: 400, y: 380 }, data: { label: 'Action 2' } },
    { id: 'node-D', type: 'actionNode', position: { x: 100, y: 500 }, data: { label: 'Orphan/MoveTarget' } },
  ];

  const initialEdges: Edge[] = [
    { id: 'edge-AB', source: 'node-A', target: 'node-B', type: 'deletable' },
    { id: 'edge-BC', source: 'node-B', target: 'node-C', type: 'deletable' },
  ];

  describe('hasPath', () => {
    it('accurately checks reachability', () => {
      expect(hasPath('node-A', 'node-C', initialEdges)).toBe(true);
      expect(hasPath('node-C', 'node-A', initialEdges)).toBe(false);
      expect(hasPath('node-A', 'node-D', initialEdges)).toBe(false);
    });

    it('honors node exclusions', () => {
      const excludes = new Set(['node-B']);
      expect(hasPath('node-A', 'node-C', initialEdges, excludes)).toBe(false);
    });
  });

  describe('canInsertNodeOnEdge', () => {
    it('allows valid splicing of a separate node', () => {
      // Splicing orphan node-D onto edge-AB is perfectly valid
      const result = canInsertNodeOnEdge(initialNodes, initialEdges, 'node-D', 'edge-AB');
      expect(result).toBe(true);
    });

    it('forbids splicing onto self or borders', () => {
      // Cannot splice node-B onto edge-AB (source node-A, target node-B)
      const resSource = canInsertNodeOnEdge(initialNodes, initialEdges, 'node-A', 'edge-AB');
      const resTarget = canInsertNodeOnEdge(initialNodes, initialEdges, 'node-B', 'edge-AB');
      expect(resSource).toBe(false);
      expect(resTarget).toBe(false);
    });

    it('detects and blocks cycle creation when splicing a subtree onto an internal edge', () => {
      // Setup a graph: A -> B -> C -> D
      // Subtree starting at B is [B, C, D]
      // Splicing subtree B onto C -> D is blocked because C -> D is internal to the subtree.
      const result = canInsertNodeOnEdge(initialNodes, initialEdges, 'node-B', 'edge-BC', false, true);
      expect(result).toBe(false);
    });
  });

  describe('spliceNodeOnEdge', () => {
    it('correctly splices a single node between two steps', () => {
      const options = { action: 'move' as const, scope: 'single' as const, healGap: true };
      const { nodes, edges } = spliceNodeOnEdge(initialNodes, initialEdges, 'node-D', 'edge-AB', options);

      // Verify node positions: node-D is inserted between A and B
      const nodeD = nodes.find((n) => n.id === 'node-D')!;
      expect(nodeD.position.x).toBe(400);
      expect(nodeD.position.y).toBe(170); // midpoint of 100 and 240

      // Verify downstream nodes shifted down (node-B and node-C)
      const nodeB = nodes.find((n) => n.id === 'node-B')!;
      const nodeC = nodes.find((n) => n.id === 'node-C')!;
      expect(nodeB.position.y).toBe(380); // 240 + 140
      expect(nodeC.position.y).toBe(520); // 380 + 140

      // Verify connections: A -> D -> B -> C
      expect(edges.some((e) => e.source === 'node-A' && e.target === 'node-D')).toBe(true);
      expect(edges.some((e) => e.source === 'node-D' && e.target === 'node-B')).toBe(true);
      expect(edges.some((e) => e.source === 'node-B' && e.target === 'node-C')).toBe(true);
      // Original edge-AB must be deleted
      expect(edges.some((e) => e.id === 'edge-AB')).toBe(false);
    });

    it('clones a node on copy action', () => {
      const options = { action: 'copy' as const, scope: 'single' as const, healGap: false };
      const { nodes, edges } = spliceNodeOnEdge(initialNodes, initialEdges, 'node-C', 'edge-AB', options);

      // Expect 5 nodes total (Trigger, Action 1, Action 2, Orphan, and the clone of Action 2)
      expect(nodes.length).toBe(5);

      const clone = nodes.find((n) => n.id !== 'node-C' && n.data.label === 'Action 2 (copy)')!;
      expect(clone).toBeDefined();

      // Connections: A -> Clone -> B -> C
      expect(edges.some((e) => e.source === 'node-A' && e.target === clone.id)).toBe(true);
      expect(edges.some((e) => e.source === clone.id && e.target === 'node-B')).toBe(true);
    });

    it('heals the original gap when moving a node', () => {
      // Graph: A -> B -> C, D is orphan.
      // Move B onto D's (hypothetical) edge, or rather, move B onto a different edge
      // and heal B's gap: A should connect directly to C.
      // Let's create an edge: D -> C
      const testEdges = [
        { id: 'edge-AB', source: 'node-A', target: 'node-B', type: 'deletable' },
        { id: 'edge-BC', source: 'node-B', target: 'node-C', type: 'deletable' },
        { id: 'edge-AD', source: 'node-A', target: 'node-D', type: 'deletable' },
      ];

      const options = { action: 'move' as const, scope: 'single' as const, healGap: true };
      const { edges } = spliceNodeOnEdge(initialNodes, testEdges, 'node-B', 'edge-AD', options);

      // Expect A -> C to be created to heal B's gap
      expect(edges.some((e) => e.source === 'node-A' && e.target === 'node-C')).toBe(true);
    });
  });

  describe('healGraphGap', () => {
    it('bridges deleted node connections', () => {
      const { edges } = healGraphGap(initialNodes, initialEdges, 'node-B');
      // A -> B and B -> C should be healed into A -> C
      expect(edges.length).toBe(1);
      expect(edges[0].source).toBe('node-A');
      expect(edges[0].target).toBe('node-C');
    });
  });
});
