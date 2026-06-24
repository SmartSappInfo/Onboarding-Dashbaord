import type { BranchingScriptGraph, ScriptNode, ScriptNodeType, Entity, EntityContact, CallOutcomeAutomation, CallActionParams } from './types';

// ─── Rich-text (formatted) script body helpers ───────────────────────────────
// Node `data.text` (and the legacy text-builder string) may contain inline HTML
// produced by the formatting toolbar in the script editor (bold/italic/lists/
// alignment/font/spacing). Variables are still stored as plain `{{VAR}}` tokens.
// These helpers let display surfaces render that HTML — or strip it back to plain
// text for compact previews — without each surface re-implementing the logic.

/** Detect whether a script body string carries inline formatting markup. */
export function isRichText(input: string | undefined): boolean {
  if (!input) return false;
  return /<(?:b|strong|i|em|u|span|div|p|ul|ol|li|br)\b[^>]*>/i.test(input);
}

/** Strip formatting markup back to readable plain text (for cards/previews/search). */
export function stripScriptHtml(input: string | undefined): string {
  if (!input) return '';
  if (!isRichText(input)) return input;
  return input
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|\u00a0/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeScriptHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const SCRIPT_VAR_PILL_STYLE = [
  'display:inline-block', 'padding:1px 6px', 'margin:0 2px',
  'font-size:0.85em', 'font-weight:700', 'border-radius:4px',
  'font-family:ui-monospace,monospace', 'vertical-align:baseline',
  'background:hsl(217 91% 60% / 0.12)', 'color:hsl(221 83% 53%)',
  'border:1px solid hsl(217 91% 60% / 0.25)',
].join(';');

/**
 * Convert a script body string into HTML suitable for dangerouslySetInnerHTML.
 * • Already-formatted bodies are passed through (markup is editor-controlled).
 * • Plain bodies are escaped and newlines become <br>.
 * • When highlightVariables is set, remaining {{VAR}} / [VAR] tokens become pills.
 */
export function scriptTextToDisplayHtml(
  input: string | undefined,
  options?: { highlightVariables?: boolean }
): string {
  if (!input) return '';
  const cleanInput = input.replace(/&nbsp;|\u00a0/gi, ' ');
  let html = isRichText(cleanInput)
    ? cleanInput
    : escapeScriptHtml(cleanInput).replace(/\n/g, '<br>');

  if (options?.highlightVariables) {
    html = html.replace(/\{\{([A-Za-z0-9_]+)\}\}|\[([A-Za-z0-9_]+)\]/g, (_m, a, b) => {
      const name = a || b;
      return `<span style="${SCRIPT_VAR_PILL_STYLE}">${name}</span>`;
    });
  }
  return html;
}

/** Tailwind class fragment so rendered lists/alignment display correctly. */
export const RICH_SCRIPT_DISPLAY_CLASS =
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5';

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
        const text = stripScriptHtml(node.data?.text || '');
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

function getValueFromObject(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const raw = obj as Record<string, unknown>;

  // Try exact key
  if (raw[key] !== undefined) return String(raw[key]);

  const lowerKey = key.toLowerCase();
  // Try lowercase key
  if (raw[lowerKey] !== undefined) return String(raw[lowerKey]);

  // Try camelCase key
  const camelKey = lowerKey.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
  if (raw[camelKey] !== undefined) return String(raw[camelKey]);

  // Special mapping for X_TWITTER -> x
  if (lowerKey === 'xtwitter' || lowerKey === 'x_twitter') {
    if (raw['x'] !== undefined) return String(raw['x']);
  }

  // Try case-insensitive scan
  const matchKey = Object.keys(raw).find(
    k => k.toLowerCase() === lowerKey || k.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerKey.replace(/_/g, '')
  );
  if (matchKey !== undefined && raw[matchKey] !== undefined) {
    return String(raw[matchKey]);
  }

  return undefined;
}

export interface ScriptVariableEntity extends Partial<Entity> {
  primaryEmail?: string;
  email?: string;
  primaryPhone?: string;
  phone?: string;
  tags?: Array<string | { name: string }>;
  doNotCall?: boolean;
  dnc?: boolean;
  timezone?: string;
  address?: {
    timezone?: string;
  };
}

/**
 * Resolves dynamic curly brace placeholders inside the script block text using Entity and Deal details.
 */
function getDynamicVariableValue(key: string, entity: ScriptVariableEntity | null | undefined): string | undefined {
  if (!entity) return undefined;

  // 1. Try root entity fields first
  const rootVal = getValueFromObject(entity, key);
  if (rootVal !== undefined) return rootVal;

  // 2. Special location handling (handled as a nested object locationString)
  const lowerKey = key.toLowerCase();
  if (lowerKey === 'location') {
    if (entity.location && typeof entity.location === 'object') {
      const locObj = entity.location as Record<string, unknown>;
      if (typeof locObj.locationString === 'string') {
        return locObj.locationString;
      }
    }
    return typeof entity.location === 'string' ? entity.location : undefined;
  }

  // 3. Scan sub-objects (personData, onlinePresence, financeData, industryData, customData)
  const subObjects = ['personData', 'onlinePresence', 'financeData', 'industryData', 'customData'];
  for (const subKey of subObjects) {
    const subObj = (entity as Record<string, unknown>)[subKey];
    if (subObj && typeof subObj === 'object') {
      const val = getValueFromObject(subObj, key);
      if (val !== undefined) return val;
    }
  }

  return undefined;
}

export function resolveScriptVariables(
  text: string | undefined,
  entity: ScriptVariableEntity | null | undefined,
  deal: { name?: string; value?: number; stageName?: string; status?: string; expectedCloseDate?: string } | null | undefined,
  agentName: string,
  currentContact?: EntityContact | null
): string {
  if (!text) return '';

  const primaryContact = entity?.entityContacts?.find(c => c.isPrimary) || entity?.entityContacts?.[0];
  const activeContact = currentContact || primaryContact;

  const primaryEmail = entity?.primaryEmail || entity?.email || primaryContact?.email || '';
  const primaryPhone = entity?.primaryPhone || entity?.phone || primaryContact?.phone || '';

  const variables: Record<string, string> = {
    ENTITY_NAME: entity?.name || 'Contact',
    ENTITY_EMAIL: primaryEmail,
    ENTITY_PHONE: primaryPhone,
    ENTITY_TYPE: entity?.entityType || 'prospect',
    PRIMARY_CONTACT_NAME: primaryContact?.name || entity?.name || 'Contact',
    PRIMARY_CONTACT_PHONE: primaryContact?.phone || primaryPhone,
    CURRENT_CONTACT_NAME: activeContact?.name || primaryContact?.name || entity?.name || 'Contact',
    CURRENT_CONTACT_PHONE: activeContact?.phone || primaryContact?.phone || primaryPhone,
    CURRENT_CONTACT_EMAIL: activeContact?.email || primaryContact?.email || primaryEmail,
    DEAL_NAME: deal?.name || '[No Active Deal]',
    DEAL_VALUE: deal?.value !== undefined ? String(deal.value) : '[No Active Deal Value]',
    DEAL_STAGE: deal?.stageName || '[No Stage]',
    DEAL_STATUS: deal?.status || 'open',
    DEAL_EXPECTED_CLOSE: deal?.expectedCloseDate || '',
    AGENT_NAME: agentName || 'Agent',
  };

  return text.replace(/\{\{([A-Za-z0-9_]+)\}\}|\[([A-Za-z0-9_]+)\]/g, (match, a, b) => {
    const key = a || b;
    const vName = key.toUpperCase();
    
    // 1. Try static variables map first
    if (variables[vName] !== undefined) {
      return variables[vName];
    }
    
    // 2. Try dynamic lookup from entity object
    const dynamicVal = getDynamicVariableValue(vName, entity);
    if (dynamicVal !== undefined) {
      return dynamicVal;
    }
    
    return match;
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
  } else if (startNodes.length > 1) {
    warnings.push('A script must have exactly one Start Call node.');
  }

  const endNodes = graph.nodes.filter(n => n.type === 'end');
  if (endNodes.length === 0) {
    warnings.push('Script should contain at least one End node.');
  } else if (endNodes.length > 1) {
    warnings.push('A script must have exactly one End Call node.');
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
    isValid: warnings.length === 0 || !warnings.some(w => w.includes('must contain') || w.includes('orphaned') || w.includes('exactly one')),
    warnings
  };
}

// ─── Outcome automation helpers ───────────────────────────────────────────────
// Outcomes (and the post-call automations they trigger) live on the script's
// `outcome` nodes — the campaign derives them from `scriptSnapshot`. These pure
// helpers are the single source of truth shared by the engine, workspace, wizard
// and analytics, so every surface reads outcomes the same way.

/** Distinct outcome values declared by `outcome` nodes, in graph order. */
export function extractOutcomesFromGraph(graph: BranchingScriptGraph): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const node of graph.nodes) {
    if (node.type !== 'outcome') continue;
    const value = node.data.outcomeValue?.trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

/**
 * Automations configured on the first outcome node matching `outcome`.
 * Returns `null` (not `[]`) when the script defines none, so callers can
 * distinguish "script says run nothing" from "fall back to legacy campaign rules".
 */
export function getOutcomeAutomations(
  graph: BranchingScriptGraph,
  outcome: string,
): CallOutcomeAutomation[] | null {
  const node = graph.nodes.find(n => n.type === 'outcome' && n.data.outcomeValue === outcome);
  const list = node?.data.outcomeConfig?.automations;
  return Array.isArray(list) && list.length > 0 ? list : null;
}

/** Org-scoped reference keys cleared when importing a `.cflow` from another org. */
const ORG_SCOPED_PARAM_KEYS: ReadonlyArray<keyof CallActionParams> = [
  'templateId', 'tagId', 'stageId', 'pipelineId', 'meetingId', 'meetingTypeId',
  'campaignId', 'taskAssigneeId', 'webhookUrl',
];

/**
 * Strip org-scoped ids + webhook URLs from imported outcome automations. Imported
 * scripts come from other organizations, so their template/tag/stage/campaign ids
 * and webhook targets are meaningless (and a webhook URL is an SSRF risk) here —
 * the importer must reconfigure them. Free-text params (notes, task titles) survive.
 */
export function sanitizeImportedAutomations(graph: BranchingScriptGraph): BranchingScriptGraph {
  return {
    edges: graph.edges,
    nodes: graph.nodes.map(node => {
      const automations = node.data.outcomeConfig?.automations;
      if (node.type !== 'outcome' || !automations) return node;
      return {
        ...node,
        data: {
          ...node.data,
          outcomeConfig: {
            ...node.data.outcomeConfig,
            automations: automations.map(automation => {
              const params: CallActionParams = { ...automation.params };
              for (const key of ORG_SCOPED_PARAM_KEYS) {
                if (params[key] !== undefined) {
                  (params as Record<string, unknown>)[key] = '';
                }
              }
              return { type: automation.type, params };
            }),
          },
        },
      };
    }),
  };
}
