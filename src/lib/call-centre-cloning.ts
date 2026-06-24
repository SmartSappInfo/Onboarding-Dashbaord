import type { Node, Edge } from 'reactflow';

/**
 * Returns the primary source handle id for a given node type.
 * • question  → option-0
 * • objection → "handled"
 * • all others → null
 */
export function getPrimarySourceHandle(
  type: string | undefined,
  data: Record<string, unknown>
): string | null {
  if (type === 'question') {
    return 'option-0';
  }
  if (type === 'objection') {
    return 'handled';
  }
  return null;
}

/**
 * Traverses downstream edges starting from a node to find all descendant node IDs.
 */
export function getDescendantNodeIds(nodeId: string, edges: Edge[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = edges
      .filter(e => e.source === current)
      .map(e => e.target);
    for (const child of children) {
      if (!descendants.has(child)) {
        descendants.add(child);
        queue.push(child);
      }
    }
  }
  return descendants;
}

/**
 * Clones a single node in the graph, inserting it directly below the originator.
 * Outgoing edges from the originator are transferred to exit from the duplicate node.
 * All downstream descendant nodes are shifted vertically to make space.
 */
export function cloneSingleNode(
  nodes: Node[],
  edges: Edge[],
  targetNodeId: string,
  nodeHeights: Record<string, number>,
  verticalGap: number
): { nodes: Node[]; edges: Edge[]; newId?: string; newRootId?: string } {
  const targetNode = nodes.find(n => n.id === targetNodeId);
  if (!targetNode) {
    return { nodes, edges, newId: '' };
  }

  const descendants = getDescendantNodeIds(targetNodeId, edges);
  const nodeHeight = nodeHeights[targetNode.type || ''] || 120;
  const dy = nodeHeight + verticalGap;

  // Shift descendants down
  const updatedNodes = nodes.map(n => {
    if (descendants.has(n.id)) {
      return {
        ...n,
        position: {
          ...n.position,
          y: n.position.y + dy
        }
      };
    }
    return n;
  });

  // Create new duplicated node
  const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const label = targetNode.data.label 
    ? `${targetNode.data.label} (Copy)` 
    : 'Step (Copy)';

  const newNode: Node = {
    ...targetNode,
    id: newId,
    position: {
      x: targetNode.position.x,
      y: targetNode.position.y + dy
    },
    data: {
      ...targetNode.data,
      label
    },
    selected: true,
  };

  const outgoing = edges.filter(e => e.source === targetNodeId);
  const otherEdges = edges.filter(e => e.source !== targetNodeId);
  const replacementEdges: Edge[] = [];

  if (outgoing.length === 0) {
    // If no outgoing edges, just link targetNode -> newNode
    const sourceHandle = getPrimarySourceHandle(targetNode.type, targetNode.data);
    replacementEdges.push({
      id: `edge-${targetNodeId}-${newId}`,
      source: targetNodeId,
      target: newId,
      sourceHandle,
      targetHandle: null,
      label: sourceHandle ? sourceHandle.replace('option-', 'Option ') : undefined,
      type: 'deletable',
      className: 'group',
      data: {},
    } as Edge);
  } else {
    // Split each outgoing edge:
    // 1. targetNode -> newNode
    // 2. newNode -> child
    outgoing.forEach((e, idx) => {
      replacementEdges.push({
        id: `edge-${targetNodeId}-${newId}-${e.sourceHandle || 'default'}-${idx}`,
        source: targetNodeId,
        target: newId,
        sourceHandle: e.sourceHandle,
        targetHandle: null,
        label: e.label,
        type: 'deletable',
        className: 'group',
        data: {},
      } as Edge);

      replacementEdges.push({
        id: `edge-${newId}-${e.target}-${e.sourceHandle || 'default'}-${idx}`,
        source: newId,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: 'deletable',
        className: 'group',
        data: {},
      } as Edge);
    });
  }

  // De-select all other nodes
  const finalNodes: Node[] = updatedNodes.map(n => ({ ...n, selected: false }));
  finalNodes.push(newNode);

  return {
    nodes: finalNodes,
    edges: [...otherEdges, ...replacementEdges],
    newId
  };
}

/**
 * Clones a node and its entire downstream subtree.
 * The cloned subtree is shifted horizontally to the right by horizontalShift.
 * The root of the cloned subtree is connected to all parents of the originator.
 */
export function cloneSubtree(
  nodes: Node[],
  edges: Edge[],
  targetNodeId: string,
  horizontalShift: number
): { nodes: Node[]; edges: Edge[]; newId?: string; newRootId?: string } {
  const targetNode = nodes.find(n => n.id === targetNodeId);
  if (!targetNode) {
    return { nodes, edges, newRootId: '' };
  }

  const descendants = getDescendantNodeIds(targetNodeId, edges);
  const subtreeNodeIds = [targetNodeId, ...Array.from(descendants)];

  const idMap: Record<string, string> = {};
  const newNodesList: Node[] = [];
  const newEdgesList: Edge[] = [];

  const timePrefix = Date.now();

  // Create duplicate nodes
  nodes.forEach(n => {
    if (subtreeNodeIds.includes(n.id)) {
      const newId = `node-${timePrefix}-${Math.random().toString(36).substr(2, 9)}`;
      idMap[n.id] = newId;

      const label = n.id === targetNodeId
        ? `${n.data.label || 'Untitled Step'} (Copy)`
        : (n.data.label || 'Untitled Step');

      newNodesList.push({
        ...n,
        id: newId,
        position: {
          x: n.position.x + horizontalShift,
          y: n.position.y
        },
        data: {
          ...n.data,
          label
        },
        selected: n.id === targetNodeId,
      });
    }
  });

  // Duplicate internal edges
  edges.forEach(e => {
    if (subtreeNodeIds.includes(e.source) && subtreeNodeIds.includes(e.target)) {
      const newEdgeId = `edge-${idMap[e.source]}-${idMap[e.target]}-${Math.random().toString(36).substr(2, 4)}`;
      newEdgesList.push({
        ...e,
        id: newEdgeId,
        source: idMap[e.source],
        target: idMap[e.target],
      });
    }
  });

  // Duplicate incoming edges from parents to targetNode
  edges.forEach(e => {
    if (e.target === targetNodeId) {
      const newEdgeId = `edge-${e.source}-${idMap[targetNodeId]}-${Math.random().toString(36).substr(2, 4)}`;
      newEdgesList.push({
        ...e,
        id: newEdgeId,
        source: e.source,
        target: idMap[targetNodeId],
      });
    }
  });

  // De-select old nodes
  const updatedNodes: Node[] = nodes.map(n => ({ ...n, selected: false }));

  return {
    nodes: [...updatedNodes, ...newNodesList],
    edges: [...edges, ...newEdgesList],
    newRootId: idMap[targetNodeId] || ''
  };
}
