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

/**
 * Guard a template send: the template must exist, belong to this org, be
 * APPROVED, and receive exactly its parameter count. Pure so the rule is
 * unit-tested without Firebase; the action wires it to the repo lookup.
 */
export function validateApprovedSend(
  wa: { organizationId: string; status: WhatsAppTemplateStatus; paramCount: number } | null,
  organizationId: string,
  paramCount: number,
): { valid: boolean; error?: string } {
  if (!wa) return { valid: false, error: 'WhatsApp template not found.' };
  if (wa.organizationId !== organizationId) {
    return { valid: false, error: 'Template belongs to another organization.' };
  }
  if (wa.status !== 'APPROVED') {
    return { valid: false, error: `Template is ${wa.status}; only APPROVED templates can be sent.` };
  }
  if (paramCount !== wa.paramCount) {
    return { valid: false, error: `Expected ${wa.paramCount} value(s), got ${paramCount}.` };
  }
  return { valid: true };
}

// ── Authoring (create → submit to Meta for approval) ────────────────────────

/** Meta's allowed template-name shape: lowercase letters, digits, underscores. */
export const TEMPLATE_NAME_RE = /^[a-z0-9_]+$/;

/** What the builder UI collects to author a new template. */
export interface CreateTemplateInput {
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  /** BODY text, may contain positional {{1..n}} params. */
  bodyText: string;
  /** Sample value for each {{n}} — required by Meta when the body has params. */
  bodyExample?: string[];
  /** Optional plain-text header (no variables in this MVP). */
  headerText?: string;
  /** Optional footer line. */
  footerText?: string;
}

/** A single Meta template component (the subset the builder emits). */
export interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER';
  format?: 'TEXT';
  text?: string;
  example?: { body_text?: string[][]; header_text?: string[] };
}

/**
 * Validate authoring input before it's sent to Meta. Keeps the failure local
 * (and unit-testable) instead of round-tripping a Graph rejection.
 */
export function validateCreateTemplateInput(
  input: CreateTemplateInput,
): { valid: boolean; error?: string } {
  const name = input.name?.trim() ?? '';
  if (!name) return { valid: false, error: 'Template name is required.' };
  if (!TEMPLATE_NAME_RE.test(name)) {
    return { valid: false, error: 'Name may only contain lowercase letters, numbers, and underscores.' };
  }
  if (!input.language?.trim()) return { valid: false, error: 'Language is required.' };
  if (!input.bodyText?.trim()) return { valid: false, error: 'Body text is required.' };

  const paramCount = extractParamCount(input.bodyText);
  const examples = input.bodyExample ?? [];
  if (paramCount > 0) {
    if (examples.length !== paramCount) {
      return { valid: false, error: `Provide a sample value for each of the ${paramCount} body parameter(s).` };
    }
    if (examples.some((e) => !e || !e.trim())) {
      return { valid: false, error: 'Every body parameter needs a non-empty sample value.' };
    }
  }
  // Params must be exactly {{1}}..{{n}} (no gaps), or Meta rejects the template.
  const unique = [...new Set(extractParamIndices(input.bodyText))];
  if (unique.length && Math.max(...unique) !== unique.length) {
    return { valid: false, error: 'Body parameters must be numbered consecutively from {{1}} (no gaps).' };
  }
  return { valid: true };
}

/**
 * Build the `POST /{wabaId}/message_templates` payload from authoring input.
 * Pure — assumes {@link validateCreateTemplateInput} already passed.
 */
export function buildCreateTemplatePayload(input: CreateTemplateInput): {
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  components: MetaTemplateComponent[];
} {
  const components: MetaTemplateComponent[] = [];

  if (input.headerText?.trim()) {
    components.push({ type: 'HEADER', format: 'TEXT', text: input.headerText.trim() });
  }

  const paramCount = extractParamCount(input.bodyText);
  const body: MetaTemplateComponent = { type: 'BODY', text: input.bodyText.trim() };
  if (paramCount > 0) {
    body.example = { body_text: [(input.bodyExample ?? []).map((e) => e.trim())] };
  }
  components.push(body);

  if (input.footerText?.trim()) {
    components.push({ type: 'FOOTER', text: input.footerText.trim() });
  }

  return {
    name: input.name.trim(),
    language: input.language.trim(),
    category: input.category,
    components,
  };
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
