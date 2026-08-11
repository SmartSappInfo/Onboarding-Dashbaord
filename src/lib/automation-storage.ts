import type { AutomationTriggerDef } from './types';

export interface MinimizedNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface MinimizedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
}

export interface AutomationBackup {
  version: number;
  name: string;
  description: string;
  triggers: AutomationTriggerDef[];
  nodes: MinimizedNode[];
  edges: MinimizedEdge[];
  timestamp: string;
  dbUpdatedAt: string;
}

const STORAGE_VERSION = 1;

/**
 * Minimizes a React Flow node to only preserve essential configuration
 * and coordinates to prevent localStorage bloat.
 */
function minimizeNode(node: Record<string, unknown>): MinimizedNode | null {
  if (!node || typeof node !== 'object') return null;
  return {
    id: String(node.id || ''),
    type: node.type ? String(node.type) : undefined,
    position: node.position as { x: number; y: number } | undefined,
    data: (node.data as Record<string, unknown>) || {},
  };
}

/**
 * Minimizes a React Flow edge to preserve only structural routing.
 */
function minimizeEdge(edge: Record<string, unknown>): MinimizedEdge | null {
  if (!edge || typeof edge !== 'object') return null;
  return {
    id: String(edge.id || ''),
    source: String(edge.source || ''),
    target: String(edge.target || ''),
    sourceHandle: edge.sourceHandle ? String(edge.sourceHandle) : null,
    targetHandle: edge.targetHandle ? String(edge.targetHandle) : null,
    type: edge.type ? String(edge.type) : undefined,
  };
}

/**
 * Safely saves a minimized backup payload to localStorage.
 */
export function saveAutomationBackup(
  id: string,
  payload: {
    name: string;
    description: string;
    triggers: AutomationTriggerDef[];
    nodes: Record<string, unknown>[];
    edges: Record<string, unknown>[];
    dbUpdatedAt: string;
  }
): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `automation-autosave-${id}`;
    const minimizedNodes = (payload.nodes || [])
      .map((n) => minimizeNode(n as Record<string, unknown>))
      .filter((n): n is MinimizedNode => n !== null);
    const minimizedEdges = (payload.edges || [])
      .map((e) => minimizeEdge(e as Record<string, unknown>))
      .filter((e): e is MinimizedEdge => e !== null);

    const backup: AutomationBackup = {
      version: STORAGE_VERSION,
      name: payload.name,
      description: payload.description,
      triggers: payload.triggers || [],
      nodes: minimizedNodes,
      edges: minimizedEdges,
      timestamp: new Date().toISOString(),
      dbUpdatedAt: payload.dbUpdatedAt || '',
    };

    localStorage.setItem(key, JSON.stringify(backup));
  } catch (err) {
    console.error('[AUTOMATION_STORAGE] Failed to save backup to localStorage:', err);
  }
}

/**
 * Safely retrieves and validates a backup payload from localStorage.
 * Returns null if no backup exists, parsing fails, or version mismatches.
 */
export function getAutomationBackup(id: string): AutomationBackup | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = `automation-autosave-${id}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const backup = JSON.parse(stored) as AutomationBackup;

    // Check version compatibility
    if (backup.version !== STORAGE_VERSION) {
      console.warn(`[AUTOMATION_STORAGE] Version mismatch: found version ${backup.version}, expected ${STORAGE_VERSION}. Discarding backup.`);
      localStorage.removeItem(key);
      return null;
    }

    return backup;
  } catch (err) {
    console.error('[AUTOMATION_STORAGE] Failed to parse backup from localStorage:', err);
    return null;
  }
}

/**
 * Clears the backup entry from localStorage.
 */
export function clearAutomationBackup(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `automation-autosave-${id}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.error('[AUTOMATION_STORAGE] Failed to clear backup from localStorage:', err);
  }
}
