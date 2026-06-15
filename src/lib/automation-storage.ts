import type { AutomationTriggerDef } from './types';

export interface AutomationBackup {
  version: number;
  name: string;
  description: string;
  triggers: AutomationTriggerDef[];
  nodes: any[];
  edges: any[];
  timestamp: string;
  dbUpdatedAt: string;
}

const STORAGE_VERSION = 1;

/**
 * Minimizes a React Flow node to only preserve essential configuration
 * and coordinates to prevent localStorage bloat.
 */
function minimizeNode(node: any): any {
  if (!node) return null;
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data || {},
  };
}

/**
 * Minimizes a React Flow edge to preserve only structural routing.
 */
function minimizeEdge(edge: any): any {
  if (!edge) return null;
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
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
    nodes: any[];
    edges: any[];
    dbUpdatedAt: string;
  }
): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `automation-autosave-${id}`;
    const minimizedNodes = (payload.nodes || []).map(minimizeNode).filter(Boolean);
    const minimizedEdges = (payload.edges || []).map(minimizeEdge).filter(Boolean);

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
