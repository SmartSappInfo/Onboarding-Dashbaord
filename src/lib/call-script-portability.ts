import { isJsonGraph } from './call-centre-graph';
import type { CallScript } from './types';

/**
 * Portable call-script format (".cflow").
 *
 * A `.cflow` file is an org-agnostic JSON envelope describing a single call script.
 * It deliberately carries ONLY presentation/content fields — never identity fields
 * (id / organizationId / workspaceId / createdBy / timestamps) — so a script can be
 * recreated inside any organization. All logic here is pure and side-effect free so it
 * can be unit-tested and shared by both the client (early UX validation) and the server
 * (authoritative validation / trust boundary).
 */

export const CFLOW_FORMAT = 'minex360.callscript' as const;
export const CFLOW_VERSION = 1 as const;
export const CFLOW_EXTENSION = '.cflow' as const;
/** Hard cap on script body size to guard against oversized/DoS imports. */
export const MAX_CFLOW_BYTES = 1_000_000;

/** Variable token pattern — matches `ScriptBuilderClient` variable detection. */
const VARIABLE_PATTERN = /\{\{([A-Za-z0-9_]+)\}\}/g;

/** The org-agnostic subset of a script carried in a `.cflow` file. */
export interface PortableScript {
  name: string;
  description?: string;
  content: string;
  variables: string[];
}

export interface ScriptExportEnvelope {
  format: typeof CFLOW_FORMAT;
  version: typeof CFLOW_VERSION;
  exportedAt: string;
  script: PortableScript;
}

export type ParseResult =
  | { ok: true; script: PortableScript }
  | { ok: false; error: string };

/** Derive the variable list from a script body (single source of truth on import). */
export function deriveVariables(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    found.add(match[1].toUpperCase());
  }
  return Array.from(found);
}

/**
 * Build a portable export envelope. Only the four portable fields are copied, so identity
 * fields can never leak even if a richer object is passed in.
 */
export function buildScriptExport(
  script: Pick<CallScript, 'name' | 'description' | 'content' | 'variables'>
): ScriptExportEnvelope {
  const portable: PortableScript = {
    name: script.name,
    content: script.content,
    variables: Array.isArray(script.variables) ? script.variables : deriveVariables(script.content),
  };
  if (script.description) portable.description = script.description;

  return {
    format: CFLOW_FORMAT,
    version: CFLOW_VERSION,
    exportedAt: new Date().toISOString(),
    script: portable,
  };
}

export function serializeScriptExport(envelope: ScriptExportEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/**
 * Parse + validate raw `.cflow` text into a trusted PortableScript.
 * Identity fields in the file are ignored; variables are re-derived from the content.
 */
export function parseScriptExport(raw: string): ParseResult {
  if (typeof raw !== 'string' || raw.length > MAX_CFLOW_BYTES * 2) {
    return { ok: false, error: 'File is empty or too large.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Not a valid .cflow file (invalid JSON).' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Not a valid .cflow file.' };
  }
  const env = parsed as Record<string, unknown>;

  if (env.format !== CFLOW_FORMAT) {
    return { ok: false, error: 'Unrecognised file format — not a call-script (.cflow) export.' };
  }
  if (env.version !== CFLOW_VERSION) {
    return { ok: false, error: `Unsupported .cflow version (expected ${CFLOW_VERSION}).` };
  }

  const script = env.script;
  if (!script || typeof script !== 'object') {
    return { ok: false, error: 'The .cflow file has no script payload.' };
  }
  const s = script as Record<string, unknown>;

  const name = typeof s.name === 'string' ? s.name.trim() : '';
  if (!name) {
    return { ok: false, error: 'The script is missing a name.' };
  }

  if (typeof s.content !== 'string') {
    return { ok: false, error: 'The script body is missing or invalid.' };
  }
  const content = s.content;
  if (content.length > MAX_CFLOW_BYTES) {
    return { ok: false, error: 'The script body is too large to import.' };
  }

  // If the body is a branching graph, require at least one node (reject empty/garbage graphs).
  if (isJsonGraph(content)) {
    try {
      const graph = JSON.parse(content);
      if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
        return { ok: false, error: 'The script flow is empty or malformed.' };
      }
    } catch {
      return { ok: false, error: 'The script flow could not be read.' };
    }
  }

  const portable: PortableScript = {
    name,
    content,
    // Never trust the file's variable list — derive it from the content.
    variables: deriveVariables(content),
  };
  if (typeof s.description === 'string' && s.description.trim()) {
    portable.description = s.description.trim();
  }

  return { ok: true, script: portable };
}

/** Filesystem-safe slug for the download filename. */
export function slugifyScriptName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'call-script';
}
