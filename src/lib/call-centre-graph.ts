import type { BranchingScriptGraph, ScriptNode, ScriptNodeType } from './types';

/**
 * Check if the script content string is a serialized JSON branching script graph.
 */
export function isJsonGraph(content: string | undefined): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed.nodes) && Array.isArray(parsed.edges);
  } catch {
    return false;
  }
}

/**
 * Converts script content (plain text OR JSON graph) into a human-readable
 * preview string suitable for thumbnails, cards, and search snippets.
 * JSON graphs are converted by concatenating all node text bodies in order.
 */
export function extractPreviewText(content: string | undefined, separator: string = ' … '): string {
  if (!content) return '';
  if (!isJsonGraph(content)) return content;

  try {
    const graph = JSON.parse(content);
    const nodeOrder: string[] = [];
    // Walk graph from start nodes outward via edges (BFS)
    const edgeMap = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
      edgeMap.get(e.source)!.push(e.target);
    }
    const startNodes: any[] = graph.nodes.filter((n: any) => n.type === 'start');
    const visited = new Set<string>();
    const queue = startNodes.map((n: any) => n.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      nodeOrder.push(id);
      for (const next of edgeMap.get(id) || []) queue.push(next);
    }
    // Append any unvisited nodes (disconnected)
    for (const n of graph.nodes) {
      if (!visited.has(n.id)) nodeOrder.push(n.id);
    }
    const nodeById = new Map(graph.nodes.map((n: any) => [n.id, n]));
    return nodeOrder
      .map((id) => {
        const node = nodeById.get(id) as any;
        if (!node) return '';
        const text = node.data?.text || '';
        if (node.type === 'question' && node.data?.options?.length) {
          return `${text} [${node.data.options.join(' / ')}]`;
        }
        return text;
      })
      .filter(Boolean)
      .join(separator);
  } catch {
    return content;
  }
}

/**
 * Parses script content into a BranchingScriptGraph.
 * If the content is plain text (legacy), it maps it to a default linear graph.
 */
export function parseGraph(content: string | undefined): BranchingScriptGraph {
  if (!content) {
    return { nodes: [], edges: [] };
  }

  if (isJsonGraph(content)) {
    try {
      return JSON.parse(content);
    } catch {
      // Fallback in case of parse failure
    }
  }

  // Legacy fallback: Create a simple linear start -> block -> end graph
  const startId = 'node-start';
  const blockId = 'node-legacy-block';
  const endId = 'node-end';

  return {
    nodes: [
      {
        id: startId,
        type: 'start',
        position: { x: 100, y: 150 },
        data: { label: 'Start Call', text: 'Initiate outbound call conversation.' }
      },
      {
        id: blockId,
        type: 'script_block',
        position: { x: 100, y: 300 },
        data: { label: 'Script Body', text: content }
      },
      {
        id: endId,
        type: 'end',
        position: { x: 100, y: 450 },
        data: { label: 'End Call', text: 'End of outbound call conversation.' }
      }
    ],
    edges: [
      { id: 'edge-1', source: startId, target: blockId },
      { id: 'edge-2', source: blockId, target: endId }
    ]
  };
}

/**
 * Get outgoing edges and target nodes for a specific conversation node.
 */
export function getNextNodeChoices(
  graph: BranchingScriptGraph,
  currentNodeId: string
): { edgeId: string; edgeLabel: string; targetNode: ScriptNode }[] {
  const outgoingEdges = graph.edges.filter(edge => edge.source === currentNodeId);
  return outgoingEdges.map(edge => {
    const targetNode = graph.nodes.find(n => n.id === edge.target);
    return {
      edgeId: edge.id,
      edgeLabel: edge.label || 'Continue',
      targetNode: targetNode || {
        id: edge.target,
        type: 'end',
        position: { x: 0, y: 0 },
        data: { label: 'End', text: 'End of conversation.' }
      }
    };
  });
}

/**
 * Resolves dynamic curly brace placeholders inside the script block text using Entity and Deal details.
 */
export function resolveScriptVariables(
  text: string | undefined,
  entity: any,
  deal: any,
  agentName: string
): string {
  if (!text) return '';

  const primaryContact = entity?.entityContacts?.find((c: any) => c.isPrimary) || entity?.entityContacts?.[0];

  const variables: Record<string, string> = {
    ENTITY_NAME: entity?.name || 'Contact',
    ENTITY_EMAIL: entity?.email || primaryContact?.email || '',
    ENTITY_PHONE: entity?.phone || primaryContact?.phone || '',
    ENTITY_TYPE: entity?.entityType || 'prospect',
    PRIMARY_CONTACT_NAME: primaryContact?.name || '',
    PRIMARY_CONTACT_PHONE: primaryContact?.phone || '',
    DEAL_NAME: deal?.name || '[No Active Deal]',
    DEAL_VALUE: deal?.value !== undefined ? String(deal.value) : '[No Active Deal Value]',
    DEAL_STAGE: deal?.stageName || '[No Stage]',
    DEAL_STATUS: deal?.status || 'open',
    DEAL_EXPECTED_CLOSE: deal?.expectedCloseDate || '',
    AGENT_NAME: agentName || 'Caller',
    // Legacy backwards compatibility variables
    FIRST_NAME: entity?.name || 'Contact',
    SCHOOL_NAME: entity?.name || 'SmartSapp HQ',
    EMAIL: entity?.email || primaryContact?.email || '',
    PHONE: entity?.phone || primaryContact?.phone || '',
  };

  return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, key) => {
    const vName = key.toUpperCase();
    return variables[vName] !== undefined ? variables[vName] : match;
  });
}

/**
 * Validates script node layout connections and detects orphaned nodes, loops, and missing endpoints.
 */
export function validateScriptGraph(graph: BranchingScriptGraph): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (graph.nodes.length === 0) {
    return { isValid: false, warnings: ['Script does not contain any nodes.'] };
  }

  const startNodes = graph.nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    warnings.push('Script must contain at least one Start node.');
  }

  const endNodes = graph.nodes.filter(n => n.type === 'end');
  if (endNodes.length === 0) {
    warnings.push('Script should contain at least one End node.');
  }

  // Check for orphaned nodes (no incoming and no outgoing connections)
  // Check for orphaned nodes and specific configuration constraints
  graph.nodes.forEach(node => {
    const incoming = graph.edges.filter(e => e.target === node.id);
    const outgoing = graph.edges.filter(e => e.source === node.id);

    if (node.type === 'start') {
      if (outgoing.length === 0) {
        warnings.push(`Start node "${node.data.label}" has no outgoing connections.`);
      }
      const sc = node.data.startConfig;
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (sc?.allowedHoursStart && !timeRegex.test(sc.allowedHoursStart)) {
        warnings.push(`Start Node "${node.data.label}" allowed start hours must match HH:MM 24h format.`);
      }
      if (sc?.allowedHoursEnd && !timeRegex.test(sc.allowedHoursEnd)) {
        warnings.push(`Start Node "${node.data.label}" allowed end hours must match HH:MM 24h format.`);
      }
    } else if (node.type === 'end') {
      if (incoming.length === 0) {
        warnings.push(`End node "${node.data.label}" has no incoming connections.`);
      }
    } else {
      if (incoming.length === 0 && outgoing.length === 0) {
        warnings.push(`Node "${node.data.label}" is orphaned (no incoming or outgoing connections).`);
      } else if (incoming.length === 0) {
        warnings.push(`Node "${node.data.label}" has no incoming connections.`);
      } else if (outgoing.length === 0 && node.type !== 'outcome' && node.type !== 'question') {
        // 'question' is excluded here: per-option connection warnings are generated below
        warnings.push(`Node "${node.data.label}" is a dead end (no outgoing connections).`);
      }
    }

    // Node configuration validations
    if (node.type === 'question') {
      const opts = node.data?.options;
      if (!opts || opts.length < 2) {
        // Question node must have at least 2 branching options (e.g. Yes / No)
        warnings.push(`Ask Node "${node.data.label}" needs at least 2 answer options.`);
      } else {
        // Check each option: label must not be blank
        opts.forEach((opt, idx) => {
          if (!opt || !opt.trim()) {
            warnings.push(`Ask Node "${node.data.label}" — Option ${idx + 1} has an empty label.`);
          }
        });

        // Check that every option handle (option-0, option-1, …) has at least one outgoing edge
        const connectedHandles = new Set(
          outgoing
            .filter(e => e.sourceHandle?.startsWith('option-'))
            .map(e => e.sourceHandle)
        );
        opts.forEach((opt, idx) => {
          if (!connectedHandles.has(`option-${idx}`)) {
            const label = opt?.trim() || `Option ${idx + 1}`;
            warnings.push(`Ask Node "${node.data.label}" — "${label}" has no exit connection.`);
          }
        });
      }
    }

    if (node.type === 'action') {
      const ac = node.data.actionConfig;
      if (node.data.actionType === 'WEBHOOK' && (!ac?.webhookUrl || !ac.webhookUrl.startsWith('http'))) {
        warnings.push(`Action Node "${node.data.label}" requires a valid HTTP/HTTPS Webhook URL.`);
      }
    }
  });

  // Cycle detection (simple DFS to notify loop existence)
  const visited = new Set<string>();
  const recStack = new Set<string>();
  let hasCycles = false;

  function dfs(nodeId: string) {
    visited.add(nodeId);
    recStack.add(nodeId);

    const edges = graph.edges.filter(e => e.source === nodeId);
    for (const edge of edges) {
      if (!visited.has(edge.target)) {
        dfs(edge.target);
      } else if (recStack.has(edge.target)) {
        hasCycles = true;
      }
    }

    recStack.delete(nodeId);
  }

  startNodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  });

  if (hasCycles) {
    warnings.push('The script contains loop cycles (nodes referencing each other). Ensure this is intended.');
  }

  return {
    isValid: warnings.length === 0 || !warnings.some(w => w.includes('must contain') || w.includes('orphaned')),
    warnings
  };
}
