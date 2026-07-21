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
import type { MessageTemplate, TemplateCategory } from '@/lib/types';

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

// ── Meta template limits & documented rejection rules ──────────────────────
// Source: developers.facebook.com › business-messaging › whatsapp › templates
/** Max characters Meta accepts in a template BODY. */
export const MAX_BODY_CHARS = 1024;
/** Max characters Meta accepts in a template name. */
export const MAX_TEMPLATE_NAME_CHARS = 512;
/** Max characters Meta accepts in a HEADER or FOOTER text component. */
export const MAX_HEADER_FOOTER_CHARS = 60;
/** e.g. `en`, `en_US`, `pt_BR`, `zh_CN`. */
const LANGUAGE_CODE_RE = /^[a-z]{2,3}(_[A-Z]{2})?$/;
/** Meta rejects templates whose text begins or ends with a parameter. */
const STARTS_WITH_PARAM_RE = /^\{\{\s*\d+\s*\}\}/;
const ENDS_WITH_PARAM_RE = /\{\{\s*\d+\s*\}\}$/;
/** Flagged during Meta review (not auto-rejected) — surfaced as warnings. */
const FLAGGED_CHARS = ['#', '$', '%'] as const;

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
): { valid: boolean; error?: string; warnings?: string[] } {
  const warnings: string[] = [];

  const name = input.name?.trim() ?? '';
  if (!name) return { valid: false, error: 'Template name is required.' };
  if (!TEMPLATE_NAME_RE.test(name)) {
    return { valid: false, error: 'Name may only contain lowercase letters, numbers, and underscores.' };
  }
  if (name.length > MAX_TEMPLATE_NAME_CHARS) {
    return { valid: false, error: `Template name must be ${MAX_TEMPLATE_NAME_CHARS} characters or fewer.` };
  }

  const language = input.language?.trim() ?? '';
  if (!language) return { valid: false, error: 'Language is required.' };
  if (!LANGUAGE_CODE_RE.test(language)) {
    return {
      valid: false,
      error: `"${language}" is not a valid language code. Use a code such as en_US, en_GB or fr.`,
    };
  }

  // This builder authors text-body templates only; AUTHENTICATION requires a
  // fixed OTP/button structure Meta would auto-reject here.
  if (input.category === 'AUTHENTICATION') {
    return { valid: false, error: 'Authentication templates cannot be created here — choose Utility or Marketing.' };
  }

  if (!input.bodyText?.trim()) return { valid: false, error: 'Body text is required.' };

  const body = input.bodyText.trim();
  if (body.length > MAX_BODY_CHARS) {
    return { valid: false, error: `Body must be ${MAX_BODY_CHARS} characters or fewer (currently ${body.length}).` };
  }
  // Meta rejects templates whose text begins or ends with a parameter.
  if (STARTS_WITH_PARAM_RE.test(body)) {
    return { valid: false, error: 'The message cannot start with a variable — add some text before it.' };
  }
  if (ENDS_WITH_PARAM_RE.test(body)) {
    return { valid: false, error: 'The message cannot end with a variable — add some text after it.' };
  }

  if (input.headerText && input.headerText.trim().length > MAX_HEADER_FOOTER_CHARS) {
    return { valid: false, error: `Header must be ${MAX_HEADER_FOOTER_CHARS} characters or fewer.` };
  }
  if (input.footerText && input.footerText.trim().length > MAX_HEADER_FOOTER_CHARS) {
    return { valid: false, error: `Footer must be ${MAX_HEADER_FOOTER_CHARS} characters or fewer.` };
  }

  // Flagged during Meta review but not auto-rejected — surface, never block.
  const flagged = FLAGGED_CHARS.filter((c) => body.includes(c));
  if (flagged.length > 0) {
    warnings.push(
      `The characters ${flagged.join(' ')} are often flagged during Meta review — consider rewording.`,
    );
  }

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
  return warnings.length > 0 ? { valid: true, warnings } : { valid: true };
}

/**
 * Build the `POST /{wabaId}/message_templates` payload from authoring input.
 * Pure — assumes {@link validateCreateTemplateInput} already passed.
 */
export function buildCreateTemplatePayload(input: CreateTemplateInput): {
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  /** Meta accepts 'named' | 'positional' and defaults to positional; we author
   *  positional {{1}}..{{n}}, so we declare it rather than rely on the default. */
  parameter_format: 'positional';
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
    parameter_format: 'positional',
    components,
  };
}

/**
 * Allowed header media by MIME type, with a per-format size cap (bytes). Caps
 * are bounded by the upload transport's Cloud Run ~32MB request ceiling, not
 * Meta's higher limits — so documents are capped at 30MB (Meta allows 100MB).
 * Raising the doc cap requires raising the Cloud Run request limit too.
 */
const HEADER_MEDIA: Record<string, { format: MediaHeaderFormat; maxBytes: number }> = {
  'image/jpeg': { format: 'IMAGE', maxBytes: 5 * 1024 * 1024 },
  'image/png': { format: 'IMAGE', maxBytes: 5 * 1024 * 1024 },
  'video/mp4': { format: 'VIDEO', maxBytes: 16 * 1024 * 1024 },
  'video/3gpp': { format: 'VIDEO', maxBytes: 16 * 1024 * 1024 },
  'application/pdf': { format: 'DOCUMENT', maxBytes: 30 * 1024 * 1024 },
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

/** What a stored template needs supplied at SEND time (beyond body params). */
export interface TemplateRuntimeNeeds {
  /** Set when the template has a media header — a media URL/id is required. */
  mediaFormat?: MediaHeaderFormat;
  /** Button indexes whose URL has a {{1}} suffix — each needs a value. */
  dynamicUrlButtons: number[];
}

/**
 * Inspect a template's stored Meta components to determine which runtime values
 * a send must supply: a media header (image/video/document) and any dynamic
 * `{{1}}` URL buttons. Pure — drives the send-test UI and the server guard.
 */
export function getTemplateRuntimeNeeds(components: unknown[] | undefined): TemplateRuntimeNeeds {
  const needs: TemplateRuntimeNeeds = { dynamicUrlButtons: [] };
  for (const c of components ?? []) {
    const comp = c as {
      type?: string;
      format?: string;
      buttons?: Array<{ type?: string; url?: string }>;
    };
    if (comp?.type === 'HEADER' && comp.format) {
      const f = comp.format.toUpperCase();
      if (f === 'IMAGE' || f === 'VIDEO' || f === 'DOCUMENT') needs.mediaFormat = f;
    }
    if (comp?.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
      comp.buttons.forEach((b, i) => {
        if (b?.type === 'URL' && typeof b.url === 'string' && /\{\{\s*1\s*\}\}/.test(b.url)) {
          needs.dynamicUrlButtons.push(i);
        }
      });
    }
  }
  return needs;
}

/**
 * Whether a template requires runtime values (media header and/or dynamic URL
 * button) that the campaign/automation engine can't supply yet — so it must NOT
 * be adopted and can only be reached via the per-send test flow.
 */
export function hasRuntimeNeeds(needs: TemplateRuntimeNeeds): boolean {
  return !!needs.mediaFormat || needs.dynamicUrlButtons.length > 0;
}

/** True for an absolute http(s) URL — mirrors the server's button/media URL rule. */
export function isLikelyHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
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

/** Any `{{token}}` occurrence — the token may be a named variable or a number. */
const TEMPLATE_VAR_RE = /\{\{(.*?)\}\}/g;
/** Characters that must be escaped before embedding a token in a RegExp. */
const REGEX_ESCAPE_RE = /[-/\\^$*+?.()|[\]{}]/g;

/**
 * Convert an authored body using named variables (`{{firstName}}`) into the
 * positional form Meta requires (`{{1}}`), returning the ordered variable names
 * so they can be stored as the runtime parameter map.
 *
 * Variables are numbered by first appearance and de-duplicated, so a variable
 * used twice keeps a single index. Token matching is exact — `{{a}}` never
 * matches inside `{{ab}}`. Pure; shared by the single and bulk push paths so the
 * two can never drift.
 */
export function toPositionalBody(body: string): { text: string; paramMap: string[] } {
  const source = body ?? '';
  const matches = source.match(TEMPLATE_VAR_RE);
  if (!matches) return { text: source, paramMap: [] };

  const paramMap = Array.from(
    new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim())),
  ).filter((v) => v.length > 0);

  let text = source;
  paramMap.forEach((variable, idx) => {
    const escaped = variable.replace(REGEX_ESCAPE_RE, '\\$&');
    text = text.replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'g'), `{{${idx + 1}}}`);
  });

  return { text, paramMap };
}

/** Deterministic `message_templates` doc id for an adopted/auto-enabled WhatsApp template. */
export function adoptedTemplateDocId(whatsAppTemplateId: string): string {
  return `wa_${whatsAppTemplateId}`;
}

export interface BuildAdoptedTemplateOptions {
  /** Positional {{1}}..{{n}} → variable-key mapping. */
  paramMap: string[];
  /** Override display name; defaults to the WhatsApp template name. */
  name?: string;
  appCategory?: TemplateCategory;
  templateType?: string;
  createdBy?: string;
  /** Injectable timestamp for deterministic tests. */
  now?: string;
}

/**
 * Build the selectable `message_templates` doc (channel: 'whatsapp') for an
 * approved WhatsApp template. Pure — no I/O. Used by BOTH manual adopt and
 * auto-enable so the two paths converge on one shape + one deterministic id.
 * Classification falls back to the WhatsApp template's stored values, then to
 * the cross-channel defaults (general / 'whatsapp').
 */
export function buildAdoptedWhatsAppMessageTemplate(
  wa: WhatsAppTemplate,
  opts: BuildAdoptedTemplateOptions,
): MessageTemplate {
  const now = opts.now ?? new Date().toISOString();
  return {
    id: adoptedTemplateDocId(wa.id),
    scope: 'organization',
    organizationId: wa.organizationId,
    category: opts.appCategory ?? wa.appCategory ?? 'general',
    channel: 'whatsapp',
    target: 'external_client',
    name: opts.name || wa.name,
    contentMode: 'template',
    body: getBodyText(wa.components),
    templateType: opts.templateType ?? wa.templateType ?? 'whatsapp',
    variableContext: 'common',
    declaredVariables: opts.paramMap,
    status: 'active',
    version: 1,
    whatsappTemplateName: wa.name,
    whatsappLanguage: wa.language,
    whatsappParamMap: opts.paramMap,
    createdAt: now,
    updatedAt: now,
    ...(opts.createdBy ? { createdBy: opts.createdBy } : {}),
  };
}

/**
 * Whether an APPROVED template can be auto-enabled (a sendable doc created with
 * no human step). True only when it's approved, has no per-send runtime needs
 * (media/dynamic-URL buttons), and either has zero params or a complete variable
 * map. Parametrized templates without a stored map (e.g. Meta-Manager-authored)
 * return false and fall back to manual Enable. Pure.
 */
export function shouldAutoEnableWhatsApp(wa: WhatsAppTemplate): boolean {
  if (wa.status !== 'APPROVED') return false;
  if (hasRuntimeNeeds(getTemplateRuntimeNeeds(wa.components))) return false;
  if (wa.paramCount > 0 && !(wa.paramMap && wa.paramMap.length === wa.paramCount)) return false;
  return true;
}

function omitExample(obj: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...obj };
  delete copy.example;
  return copy;
}

/**
 * Strip Meta `example` fields from components before persisting to Firestore.
 * Meta's BODY example is a nested array (`example.body_text: [[...]]`), and
 * Firestore forbids arrays nested directly inside arrays ("Property array
 * contains an invalid nested entity"). Examples are only needed in the outbound
 * create payload — never read back from stored components (rendering reads
 * `text`/`format`/`buttons`; sample values live on `WhatsAppTemplate.exampleParams`).
 * Pure.
 */
export function stripComponentExamples(components: unknown[] | undefined): unknown[] {
  if (!Array.isArray(components)) return [];
  return components.map((c) => {
    if (!c || typeof c !== 'object') return c;
    const comp = omitExample(c as Record<string, unknown>);
    if (Array.isArray(comp.buttons)) {
      comp.buttons = comp.buttons.map((b) =>
        b && typeof b === 'object' ? omitExample(b as Record<string, unknown>) : b,
      );
    }
    return comp;
  });
}

/** Convert a raw Meta template into our stored shape (id + paramCount derived). */
export function normalizeMetaTemplate(
  organizationId: string,
  raw: MetaTemplateRaw,
  syncedAt: string,
): WhatsAppTemplate {
  const components = stripComponentExamples(raw.components ?? []);
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
