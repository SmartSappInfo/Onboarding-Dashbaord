import type { Node, Edge } from 'reactflow';

export interface SplicingOptions {
  action: 'move' | 'copy';
  scope: 'single' | 'subtree';
  healGap: boolean;
}

/**
 * Depth-First / Breadth-First search helper to find if a path exists between two nodes.
 */
export function hasPath(
  fromId: string,
  toId: string,
  edges: Edge[],
  excludeNodeIds: Set<string> = new Set()
): boolean {
  if (fromId === toId) return true;
  const visited = new Set<string>();
  const queue = [fromId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toId) return true;
    if (visited.has(current) || excludeNodeIds.has(current)) continue;
    visited.add(current);

    const children = edges
      .filter((e) => e.source === current && !excludeNodeIds.has(e.target))
      .map((e) => e.target);

    for (const child of children) {
      if (!visited.has(child)) {
        queue.push(child);
      }
    }
  }
  return false;
}

/**
 * Returns all downstream descendant node IDs of a given start node.
 */
export function getSubtreeNodeIds(startNodeId: string, edges: Edge[]): Set<string> {
  const visited = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const children = edges.filter((e) => e.source === current).map((e) => e.target);
    for (const child of children) {
      if (!visited.has(child)) {
        queue.push(child);
      }
    }
  }

  return visited;
}

/**
 * Finds all terminal nodes in a subtree (nodes that have no outgoing edges within the subtree).
 */
export function getSubtreeTerminalNodes(
  subtreeIds: Set<string>,
  edges: Edge[]
): Set<string> {
  const terminals = new Set<string>(subtreeIds);
  edges.forEach((e) => {
    if (subtreeIds.has(e.source) && subtreeIds.has(e.target)) {
      terminals.delete(e.source);
    }
  });
  return terminals;
}

/**
 * Checks if splicing a node on a target edge would create a cycle.
 */
export function canInsertNodeOnEdge(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
  edgeId: string,
  isCopy = false,
  isSubtree = false
): boolean {
  const targetEdge = edges.find((e) => e.id === edgeId);
  if (!targetEdge) return false;

  const S = targetEdge.source;
  const T = targetEdge.target;

  // Splicing onto self or direct borders is forbidden
  if (nodeId === S || nodeId === T) return false;

  // Gather set of nodes to exclude during drag simulation
  let excludeIds = new Set<string>();
  if (!isCopy) {
    if (isSubtree) {
      excludeIds = getSubtreeNodeIds(nodeId, edges);
    } else {
      excludeIds.add(nodeId);
    }
  }

  // Splicing target edge source/target should not belong to the excluded set
  if (excludeIds.has(S) || excludeIds.has(T)) return false;

  const edgesCleaned = edges.filter(
    (e) => !excludeIds.has(e.source) && !excludeIds.has(e.target)
  );

  // If moving, check cycles:
  // 1. Can T reach S? (completes S -> N -> T -> S)
  if (hasPath(T, S, edgesCleaned)) return false;

  // 2. Can T reach N/subtree-entry? (completes T -> N -> T)
  if (hasPath(T, nodeId, edgesCleaned)) return false;

  // 3. Can N/subtree-exit reach S? (completes S -> N -> S)
  if (isSubtree) {
    const terminals = getSubtreeTerminalNodes(excludeIds, edges);
    for (const term of Array.from(terminals)) {
      if (hasPath(term, S, edgesCleaned)) return false;
    }
  } else {
    if (hasPath(nodeId, S, edgesCleaned)) return false;
  }

  return true;
}

/**
 * Splicing core mutation logic.
 */
export function spliceNodeOnEdge(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
  edgeId: string,
  options: SplicingOptions
): { nodes: Node[]; edges: Edge[] } {
  const targetEdge = edges.find((e) => e.id === edgeId);
  if (!targetEdge) return { nodes, edges };

  const S = targetEdge.source;
  const T = targetEdge.target;
  const sourceHandle = targetEdge.sourceHandle;

  // 1. Clone or Move nodes
  let finalNodes = [...nodes];
  let finalEdges = [...edges];
  let insertionNodeId = nodeId;

  // Track displaced nodes for collision adjustment
  const displacedNodeIds = new Set<string>();

  if (options.action === 'copy') {
    // Clone step
    const sourceNode = nodes.find((n) => n.id === nodeId);
    if (!sourceNode) return { nodes, edges };

    const newId = `${sourceNode.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    insertionNodeId = newId;

    if (options.scope === 'subtree') {
      const subtreeIds = getSubtreeNodeIds(nodeId, edges);
      const cloneMap = new Map<string, string>();

      // First pass: create all cloned nodes
      const clonedNodes: Node[] = [];
      nodes.forEach((n) => {
        if (subtreeIds.has(n.id)) {
          const cid = n.id === nodeId ? newId : `${n.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          cloneMap.set(n.id, cid);
          clonedNodes.push({
            ...n,
            id: cid,
            position: { ...n.position },
            data: {
              ...JSON.parse(JSON.stringify(n.data)),
              label: `${n.data.label || 'Step'} (copy)`,
            },
          });
        }
      });

      finalNodes.push(...clonedNodes);

      // Second pass: clone intra-subtree edges
      const clonedEdges: Edge[] = [];
      edges.forEach((e) => {
        if (subtreeIds.has(e.source) && subtreeIds.has(e.target)) {
          clonedEdges.push({
            ...e,
            id: `edge_${cloneMap.get(e.source)}_to_${cloneMap.get(e.target)}_${Date.now()}`,
            source: cloneMap.get(e.source)!,
            target: cloneMap.get(e.target)!,
          });
        }
      });
      finalEdges.push(...clonedEdges);

      // Identify terminals of cloned subtree
      const clonedSubtreeIds = new Set<string>(cloneMap.values());
      const terminals = getSubtreeTerminalNodes(clonedSubtreeIds, finalEdges);

      // Wire targetEdge replacements: S -> cloned subtree entry -> cloned terminals -> T
      finalEdges = finalEdges.filter((e) => e.id !== edgeId);
      finalEdges.push({
        id: `edge_${S}_to_${insertionNodeId}_${Date.now()}`,
        source: S,
        sourceHandle,
        target: insertionNodeId,
        type: 'deletable',
      });

      terminals.forEach((term) => {
        finalEdges.push({
          id: `edge_${term}_to_${T}_${Date.now()}`,
          source: term,
          target: T,
          type: 'deletable',
        });
      });

      // Gather displacement targets
      clonedSubtreeIds.forEach((id) => displacedNodeIds.add(id));
    } else {
      // Single node copy
      const clonedNode: Node = {
        ...sourceNode,
        id: newId,
        position: { ...sourceNode.position },
        data: {
          ...JSON.parse(JSON.stringify(sourceNode.data)),
          label: `${sourceNode.data.label || 'Step'} (copy)`,
        },
      };
      finalNodes.push(clonedNode);

      // Re-wire edges: S -> copy -> T
      finalEdges = finalEdges.filter((e) => e.id !== edgeId);
      finalEdges.push(
        {
          id: `edge_${S}_to_${newId}_${Date.now()}`,
          source: S,
          sourceHandle,
          target: newId,
          type: 'deletable',
        },
        {
          id: `edge_${newId}_to_${T}_${Date.now()}`,
          source: newId,
          target: T,
          type: 'deletable',
        }
      );

      displacedNodeIds.add(newId);
    }
  } else {
    // Move step
    const subtreeIds = getSubtreeNodeIds(nodeId, edges);

    // Auto-heal original gap
    if (options.healGap) {
      const entryParentEdges = edges.filter((e) => e.target === nodeId);
      const exitChildEdges = edges.filter((e) => e.source === nodeId);

      // For subtree, exit edges are originating from subtree terminals to external targets
      const terminals = getSubtreeTerminalNodes(subtreeIds, edges);
      const subtreeExits = edges.filter(
        (e) => terminals.has(e.source) && !subtreeIds.has(e.target)
      );

      const exits = options.scope === 'subtree' ? subtreeExits : exitChildEdges;

      entryParentEdges.forEach((pEdge) => {
        exits.forEach((cEdge) => {
          finalEdges.push({
            id: `edge_${pEdge.source}_to_${cEdge.target}_${Date.now()}`,
            source: pEdge.source,
            sourceHandle: pEdge.sourceHandle,
            target: cEdge.target,
            type: 'deletable',
          });
        });
      });
    }

    // Clean edges connected to moved nodes
    const targetMoveIds = options.scope === 'subtree' ? subtreeIds : new Set([nodeId]);
    finalEdges = finalEdges.filter(
      (e) => !targetMoveIds.has(e.source) && !targetMoveIds.has(e.target) && e.id !== edgeId
    );

    // Splice in target edge: S -> nodeId -> terminals -> T
    finalEdges.push({
      id: `edge_${S}_to_${nodeId}_${Date.now()}`,
      source: S,
      sourceHandle,
      target: nodeId,
      type: 'deletable',
    });

    if (options.scope === 'subtree') {
      const terminals = getSubtreeTerminalNodes(subtreeIds, edges);
      terminals.forEach((term) => {
        finalEdges.push({
          id: `edge_${term}_to_${T}_${Date.now()}`,
          source: term,
          target: T,
          type: 'deletable',
        });
      });
      subtreeIds.forEach((id) => displacedNodeIds.add(id));
    } else {
      finalEdges.push({
        id: `edge_${nodeId}_to_${T}_${Date.now()}`,
        source: nodeId,
        target: T,
        type: 'deletable',
      });
      displacedNodeIds.add(nodeId);
    }
  }

  // 2. Position Alignment & Shift Downstream
  // Shift target node T and its downstream descendants by Y offset
  const downstreamOfT = getSubtreeNodeIds(T, finalEdges);
  const shiftIds = new Set<string>([T, ...Array.from(downstreamOfT)]);

  // Midpoint calculation for dropped/copied node
  const sourceNode = finalNodes.find((n) => n.id === S);
  const targetNode = finalNodes.find((n) => n.id === T);

  if (sourceNode && targetNode) {
    const midX = (sourceNode.position.x + targetNode.position.x) / 2;
    const midY = (sourceNode.position.y + targetNode.position.y) / 2;

    if (options.scope === 'subtree') {
      // Reposition whole subtree relative to the entry node N
      const originalN = nodes.find((n) => n.id === nodeId);
      if (originalN) {
        const dx = midX - originalN.position.x;
        const dy = midY - originalN.position.y;

        finalNodes = finalNodes.map((n) => {
          if (displacedNodeIds.has(n.id)) {
            return {
              ...n,
              position: { x: n.position.x + dx, y: n.position.y + dy },
            };
          }
          return n;
        });
      }
    } else {
      finalNodes = finalNodes.map((n) => {
        if (n.id === insertionNodeId) {
          return { ...n, position: { x: midX, y: midY } };
        }
        return n;
      });
    }
  }

  // Push downstream of T nodes down to make space
  finalNodes = finalNodes.map((n) => {
    if (shiftIds.has(n.id)) {
      return { ...n, position: { ...n.position, y: n.position.y + 140 } };
    }
    return n;
  });

  return { nodes: finalNodes, edges: finalEdges };
}

/**
 * Stretch edges to bridge deleted nodes (auto-healing).
 */
export function healGraphGap(
  nodes: Node[],
  edges: Edge[],
  nodeId: string
): { edges: Edge[] } {
  const entryParentEdges = edges.filter((e) => e.target === nodeId);
  const exitChildEdges = edges.filter((e) => e.source === nodeId);
  let finalEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

  entryParentEdges.forEach((pEdge) => {
    exitChildEdges.forEach((cEdge) => {
      finalEdges.push({
        id: `edge_${pEdge.source}_to_${cEdge.target}_${Date.now()}`,
        source: pEdge.source,
        sourceHandle: pEdge.sourceHandle,
        target: cEdge.target,
        type: 'deletable',
      });
    });
  });

  return { edges: finalEdges };
}
