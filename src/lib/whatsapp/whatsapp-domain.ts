/**
 * @fileOverview Pure WhatsApp template logic — parsing positional {{n}} params,
 * reading Meta's component structure, validating param maps, and normalizing the
 * Graph API shape into our {@link WhatsAppTemplate}. No I/O; fully unit-tested.
 */

import type {
  WhatsAppTemplate,
  WhatsAppTemplateStatus,
  WhatsAppTemplateCategory,
} from './whatsapp-types';

/** Raw template as returned by `GET /{wabaId}/message_templates`. */
export interface MetaTemplateRaw {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components?: unknown[];
  rejected_reason?: string;
}

const PARAM_RE = /\{\{\s*(\d+)\s*\}\}/g;

/** All positional indices referenced in a string, e.g. "{{1}} {{2}}" → [1, 2]. */
export function extractParamIndices(text: string): number[] {
  return [...text.matchAll(PARAM_RE)].map((m) => parseInt(m[1], 10));
}

/** Number of params a body needs = the highest index referenced (0 if none). */
export function extractParamCount(text: string): number {
  const indices = extractParamIndices(text);
  return indices.length ? Math.max(...indices) : 0;
}

/** The text of the BODY component (the only component with {{n}} params we map). */
export function getBodyText(components: unknown[] | undefined): string {
  const body = (components as Array<{ type?: string; text?: string }> | undefined)?.find(
    (c) => c?.type === 'BODY',
  );
  return body?.text ?? '';
}

export function deriveParamCount(components: unknown[] | undefined): number {
  return extractParamCount(getBodyText(components));
}

/**
 * Validate a positional → variable-key map against the template's param count.
 * Every slot must be present and non-empty.
 */
export function validateParamMap(
  paramMap: string[] | undefined,
  paramCount: number,
): { valid: boolean; error?: string } {
  const map = paramMap ?? [];
  if (map.length !== paramCount) {
    return { valid: false, error: `Expected ${paramCount} parameter(s), got ${map.length}.` };
  }
  if (map.some((v) => !v || !v.trim())) {
    return { valid: false, error: 'Every parameter slot must be mapped to a variable.' };
  }
  return { valid: true };
}

export function buildWhatsAppTemplateId(orgId: string, name: string, language: string): string {
  return `${orgId}_${name}_${language}`;
}

const KNOWN_STATUSES: WhatsAppTemplateStatus[] = [
  'APPROVED',
  'PENDING',
  'REJECTED',
  'PAUSED',
  'DISABLED',
];
const KNOWN_CATEGORIES: WhatsAppTemplateCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

function coerceStatus(s: string): WhatsAppTemplateStatus {
  const up = s?.toUpperCase() as WhatsAppTemplateStatus;
  return KNOWN_STATUSES.includes(up) ? up : 'PENDING';
}

function coerceCategory(c: string): WhatsAppTemplateCategory {
  const up = c?.toUpperCase() as WhatsAppTemplateCategory;
  return KNOWN_CATEGORIES.includes(up) ? up : 'UTILITY';
}

/** Convert a raw Meta template into our stored shape (id + paramCount derived). */
export function normalizeMetaTemplate(
  organizationId: string,
  raw: MetaTemplateRaw,
  syncedAt: string,
): WhatsAppTemplate {
  const components = raw.components ?? [];
  return {
    id: buildWhatsAppTemplateId(organizationId, raw.name, raw.language),
    organizationId,
    metaTemplateId: raw.id,
    name: raw.name,
    language: raw.language,
    category: coerceCategory(raw.category),
    status: coerceStatus(raw.status),
    components,
    paramCount: deriveParamCount(components),
    ...(raw.rejected_reason ? { rejectedReason: raw.rejected_reason } : {}),
    syncedAt,
  };
}
