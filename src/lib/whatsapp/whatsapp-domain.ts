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

export type MediaHeaderFormat = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

/** A media header — the `handle` comes from the resumable upload (see client). */
export interface MediaHeaderInput {
  format: MediaHeaderFormat;
  handle: string;
}

/** Interactive buttons the builder can attach (Meta max 10 per template). */
export type TemplateButtonInput =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; urlExample?: string }
  | { type: 'PHONE_NUMBER'; text: string; phoneNumber: string };

/** Max buttons Meta accepts on a single template. */
export const MAX_TEMPLATE_BUTTONS = 10;

/** What the builder UI collects to author a new template. */
export interface CreateTemplateInput {
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  /** BODY text, may contain positional {{1..n}} params. */
  bodyText: string;
  /** Sample value for each {{n}} — required by Meta when the body has params. */
  bodyExample?: string[];
  /** Optional plain-text header (mutually exclusive with `mediaHeader`). */
  headerText?: string;
  /** Optional media header (IMAGE/VIDEO/DOCUMENT). Takes precedence over text. */
  mediaHeader?: MediaHeaderInput;
  /** Optional footer line. */
  footerText?: string;
  /** Optional interactive buttons. */
  buttons?: TemplateButtonInput[];
}

/** A single Meta button as the Graph API expects it. */
export interface MetaButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

/** A single Meta template component (the subset the builder emits). */
export interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | MediaHeaderFormat;
  text?: string;
  example?: { body_text?: string[][]; header_text?: string[]; header_handle?: string[] };
  buttons?: MetaButton[];
}

const URL_VAR_RE = /\{\{\s*1\s*\}\}/;

/** Map builder buttons to Meta's wire shape. Assumes validation passed. */
function toMetaButton(b: TemplateButtonInput): MetaButton {
  if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text.trim() };
  if (b.type === 'PHONE_NUMBER') {
    return { type: 'PHONE_NUMBER', text: b.text.trim(), phone_number: b.phoneNumber.trim() };
  }
  const url = b.url.trim();
  return {
    type: 'URL',
    text: b.text.trim(),
    url,
    ...(URL_VAR_RE.test(url) && b.urlExample?.trim() ? { example: [b.urlExample.trim()] } : {}),
  };
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

  if (input.mediaHeader && !input.mediaHeader.handle?.trim()) {
    return { valid: false, error: 'Upload the header media before submitting.' };
  }

  const buttons = input.buttons ?? [];
  if (buttons.length > MAX_TEMPLATE_BUTTONS) {
    return { valid: false, error: `A template can have at most ${MAX_TEMPLATE_BUTTONS} buttons.` };
  }
  for (const b of buttons) {
    if (!b.text?.trim()) return { valid: false, error: 'Every button needs a label.' };
    if (b.type === 'URL') {
      if (!b.url?.trim()) return { valid: false, error: 'URL buttons need a URL.' };
      if (URL_VAR_RE.test(b.url) && !b.urlExample?.trim()) {
        return { valid: false, error: 'A URL with {{1}} needs a sample value.' };
      }
    }
    if (b.type === 'PHONE_NUMBER' && !b.phoneNumber?.trim()) {
      return { valid: false, error: 'Phone buttons need a phone number.' };
    }
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

  // HEADER — media takes precedence over text (Meta allows only one header).
  if (input.mediaHeader?.handle?.trim()) {
    components.push({
      type: 'HEADER',
      format: input.mediaHeader.format,
      example: { header_handle: [input.mediaHeader.handle.trim()] },
    });
  } else if (input.headerText?.trim()) {
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

  // BUTTONS last, per Meta's component ordering.
  if (input.buttons?.length) {
    components.push({ type: 'BUTTONS', buttons: input.buttons.map(toMetaButton) });
  }

  return {
    name: input.name.trim(),
    language: input.language.trim(),
    category: input.category,
    components,
  };
}

/** Allowed header media by MIME type, with Meta's per-format size cap (bytes). */
const HEADER_MEDIA: Record<string, { format: MediaHeaderFormat; maxBytes: number }> = {
  'image/jpeg': { format: 'IMAGE', maxBytes: 5 * 1024 * 1024 },
  'image/png': { format: 'IMAGE', maxBytes: 5 * 1024 * 1024 },
  'video/mp4': { format: 'VIDEO', maxBytes: 16 * 1024 * 1024 },
  'video/3gpp': { format: 'VIDEO', maxBytes: 16 * 1024 * 1024 },
  'application/pdf': { format: 'DOCUMENT', maxBytes: 100 * 1024 * 1024 },
};

/**
 * Validate a header-media file before upload — pure so the rule is tested
 * without network. Returns the derived {@link MediaHeaderFormat} on success.
 */
export function validateHeaderMedia(
  fileType: string,
  fileSize: number,
): { valid: boolean; format?: MediaHeaderFormat; error?: string } {
  const spec = HEADER_MEDIA[fileType?.toLowerCase()];
  if (!spec) {
    return { valid: false, error: 'Unsupported file type. Use JPEG/PNG, MP4/3GP, or PDF.' };
  }
  if (!fileSize || fileSize <= 0) return { valid: false, error: 'File is empty.' };
  if (fileSize > spec.maxBytes) {
    const mb = Math.round(spec.maxBytes / (1024 * 1024));
    return { valid: false, error: `File exceeds the ${mb}MB limit for ${spec.format.toLowerCase()} headers.` };
  }
  return { valid: true, format: spec.format };
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

// ── Webhook: asynchronous template approval/rejection/category events ─────────

/** A normalized template lifecycle event from a Meta webhook. */
export interface TemplateStatusEvent {
  /** From `entry[].id` — the WABA, used to resolve the org. */
  wabaId: string;
  metaTemplateId: string;
  name: string;
  language?: string;
  /** Set by `message_template_status_update`; omitted for category-only updates. */
  status?: WhatsAppTemplateStatus;
  rejectedReason?: string;
  /** Set by `template_category_update`. */
  category?: WhatsAppTemplateCategory;
}

const TEMPLATE_STATUS_FIELDS = new Set([
  'message_template_status_update',
  'template_category_update',
]);

/**
 * Extract template lifecycle events from a Meta webhook body. Pure — the route
 * resolves the org by `wabaId` and applies the patch. Non-template fields
 * (`messages`, `statuses`) and malformed entries yield nothing.
 */
export function parseTemplateStatusEvents(body: unknown): TemplateStatusEvent[] {
  const out: TemplateStatusEvent[] = [];
  const entries = (body as { entry?: unknown[] } | null)?.entry ?? [];
  for (const entry of entries) {
    const wabaId = String((entry as { id?: string | number })?.id ?? '');
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const field = (change as { field?: string })?.field;
      if (!field || !TEMPLATE_STATUS_FIELDS.has(field)) continue;
      const value = (change as { value?: Record<string, unknown> })?.value ?? {};
      const metaTemplateId = value.message_template_id != null ? String(value.message_template_id) : '';
      if (!metaTemplateId) continue;

      const name = String(value.message_template_name ?? '');
      const language = value.message_template_language ? String(value.message_template_language) : undefined;

      if (field === 'message_template_status_update') {
        const reason = value.reason != null ? String(value.reason) : '';
        out.push({
          wabaId,
          metaTemplateId,
          name,
          language,
          status: coerceStatus(String(value.event ?? '')),
          ...(reason && reason.toUpperCase() !== 'NONE' ? { rejectedReason: reason } : {}),
        });
      } else {
        out.push({ wabaId, metaTemplateId, name, language, category: coerceCategory(String(value.new_category ?? '')) });
      }
    }
  }
  return out;
}
