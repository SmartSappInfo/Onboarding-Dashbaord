/**
 * @fileOverview WhatsApp outbound send: pure payload/session/decision helpers
 * plus the `sendWhatsApp` orchestration the messaging engine delegates to.
 *
 * The pure helpers (payload shape, 24h window, send-mode decision) are
 * unit-tested with no I/O. `sendWhatsApp` lazily imports Firestore-backed
 * repositories so this module stays importable in pure tests and out of client
 * bundles (matching the engine's dynamic-import style).
 */

import type { MessageTemplate } from '@/lib/types';
import { getTemplateRuntimeNeeds, hasRuntimeNeeds, toPositionalBody } from './whatsapp-domain';

const WINDOW_HOURS = 24;

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Whether the customer-service window is still open (≤24h since last inbound). */
export function isSessionOpen(
  lastInboundAt: string | undefined,
  now: Date = new Date(),
  windowHours = WINDOW_HOURS,
): boolean {
  if (!lastInboundAt) return false;
  const last = new Date(lastInboundAt).getTime();
  if (Number.isNaN(last)) return false;
  return now.getTime() - last <= windowHours * 3_600_000;
}

/** Meta expects digits only (E.164 without the leading '+'). */
export function normalizeWaPhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

/**
 * Common semantic alias mappings to resolve named workspace fields to positional parameters.
 */
const SEMANTIC_ALIAS_MAP: Record<string, string[]> = {
  // Contact name aliases (index 1 or contact_name)
  '1': ['contact_name', 'contactName', 'firstName', 'name', 'recipientName', 'primaryContactName'],
  'contact_name': ['contact_name', 'contactName', 'firstName', 'name', 'recipientName', 'primaryContactName'],
  'first_name': ['firstName', 'contact_name', 'contactName', 'name'],
  
  // Entity / school aliases (index 2 or entity_name)
  '2': ['entity_name', 'entityName', 'schoolName', 'organizationName', 'companyName', 'workspace_name'],
  'entity_name': ['entity_name', 'entityName', 'schoolName', 'organizationName', 'companyName', 'workspace_name'],
  'school_name': ['schoolName', 'entity_name', 'entityName', 'organizationName'],
  
  // Meeting / time aliases (index 3 or meeting_time)
  '3': ['meeting_time', 'meetingTime', 'meeting_date', 'time', 'scheduleTime'],
  'meeting_time': ['meeting_time', 'meetingTime', 'meeting_date', 'time', 'scheduleTime'],
  
  // Link aliases
  '4': ['survey_link', 'surveyUrl', 'link', 'registrant_join_link'],
  'survey_link': ['survey_link', 'surveyUrl', 'link'],
  '5': ['dashboard_link', 'dashboardUrl', 'link'],
  'dashboard_link': ['dashboard_link', 'dashboardUrl', 'link'],
  'visibility_report': ['visibility_report', 'visibilityReport', 'visibility_audit', 'report_link'],
  'encrypted_recipient_token': ['encrypted_recipient_token', 'encryptedRecipientToken', 'ref_token', 'token'],
};

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Single Source of Truth helper for resolving Meta WhatsApp template parameters.
 * 
 * CAUTION:
 * 1. Meta Cloud API strictly rejects empty text values (`{ type: 'text', text: "" }`) with Meta Error 131008.
 *    Therefore, all resolved parameters MUST be sanitized to non-empty strings.
 * 2. Parameter maps are resolved with a multi-source fallback: `paramMap || whatsappParamMap || toPositionalBody(body).paramMap`.
 * 3. Lookups perform cascading multi-alias resolution (exact key -> positional token -> camelCase -> semantic aliases).
 */
export function buildTemplateParams(
  paramMapInput: string[] | null | undefined,
  variables: Record<string, unknown>,
  options?: {
    whatsappParamMap?: string[] | null;
    body?: string | null;
  }
): string[] {
  let paramMap: string[] = Array.isArray(paramMapInput) && paramMapInput.length > 0 ? paramMapInput : [];

  if (paramMap.length === 0 && Array.isArray(options?.whatsappParamMap) && options.whatsappParamMap.length > 0) {
    paramMap = options.whatsappParamMap;
  }

  if (paramMap.length === 0 && options?.body) {
    paramMap = toPositionalBody(options.body).paramMap;
  }

  return paramMap.map((rawKey, idx) => {
    const posIndex = idx + 1;
    let key = (rawKey || '').trim();
    let pipeFallback = '';

    // Handle pipe fallback text if present, e.g., 'entity_name | Your School'
    if (key.includes('|')) {
      const parts = key.split('|');
      key = parts[0].trim();
      pipeFallback = parts.slice(1).join('|').trim();
    }

    // Stripped brace format, e.g., '{{1}}' -> '1'
    const cleanKey = key.replace(/[\{\}]/g, '').trim();

    // Cascading lookup candidates
    const candidates: string[] = [
      key,
      cleanKey,
      String(posIndex),
      `{{${posIndex}}}`,
      `var_${posIndex}`,
      `variable_${posIndex}`,
    ];

    // Add semantic alias candidates
    const aliases = SEMANTIC_ALIAS_MAP[cleanKey] || SEMANTIC_ALIAS_MAP[String(posIndex)] || [];
    candidates.push(...aliases);

    // Also add camelCase and snake_case variations
    const snakeCase = cleanKey.replace(/([A-Z])/g, '_$1').toLowerCase();
    const camelCase = cleanKey.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    candidates.push(snakeCase, camelCase);

    let resolvedVal: unknown = undefined;
    for (const cand of candidates) {
      if (cand in variables && variables[cand] !== undefined && variables[cand] !== null) {
        resolvedVal = variables[cand];
        break;
      }
    }

    let valStr = resolvedVal === undefined || resolvedVal === null ? '' : String(resolvedVal).trim();

    // Non-empty text guard to prevent Meta Error 131008 ("Parameter of type text is missing text value")
    if (!valStr) {
      if (pipeFallback) {
        valStr = pipeFallback;
      } else if (cleanKey === '1' || cleanKey === 'contact_name' || cleanKey === 'firstName') {
        valStr = 'Customer';
      } else if (cleanKey === '2' || cleanKey === 'entity_name' || cleanKey === 'schoolName') {
        valStr = 'Organization';
      } else if (cleanKey === '3' || cleanKey === 'meeting_time') {
        valStr = 'Upcoming';
      } else {
        valStr = 'N/A';
      }
    }

    return valStr;
  });
}

type TemplateTextParam = { type: 'text'; text: string };
type MediaRef = { link: string } | { id: string };
type HeaderMediaParam =
  | { type: 'image'; image: MediaRef }
  | { type: 'video'; video: MediaRef }
  | { type: 'document'; document: MediaRef };

export type TemplateComponent =
  | { type: 'header'; parameters: HeaderMediaParam[] }
  | { type: 'body'; parameters: TemplateTextParam[] }
  | { type: 'button'; sub_type: string; index: string; parameters: TemplateTextParam[] };

export interface TemplatePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
}

/** Runtime media supplied at send time for a media-header template. */
export interface HeaderMediaRef {
  type: 'image' | 'video' | 'document';
  /** A public URL, or a Meta media id — exactly one. */
  link?: string;
  id?: string;
}

/** A dynamic button parameter (e.g. the {{1}} suffix of a URL button). */
export interface ButtonParam {
  subType: 'url' | 'quick_reply';
  index: number;
  text: string;
}

function buildHeaderComponent(media: HeaderMediaRef): TemplateComponent {
  const ref: MediaRef = media.id ? { id: media.id } : { link: media.link ?? '' };
  if (media.type === 'image') return { type: 'header', parameters: [{ type: 'image', image: ref }] };
  if (media.type === 'video') return { type: 'header', parameters: [{ type: 'video', video: ref }] };
  return { type: 'header', parameters: [{ type: 'document', document: ref }] };
}

/**
 * Build a Meta template message. Body params are the common case; the optional
 * `headerMedia` and `buttonParams` emit header/button components only when a
 * template actually has those dynamic parts. With neither supplied, the output
 * is byte-identical to the body-only payload (regression-guarded by tests).
 * Component order follows Meta's: header → body → button.
 */
export function buildTemplatePayload(input: {
  to: string;
  name: string;
  language: string;
  params: string[];
  headerMedia?: HeaderMediaRef;
  buttonParams?: ButtonParam[];
}): TemplatePayload {
  const components: TemplateComponent[] = [];

  if (input.headerMedia) components.push(buildHeaderComponent(input.headerMedia));

  if (input.params.length > 0) {
    components.push({ type: 'body', parameters: input.params.map((text) => ({ type: 'text', text })) });
  }

  for (const b of input.buttonParams ?? []) {
    components.push({
      type: 'button',
      sub_type: b.subType,
      index: String(b.index),
      parameters: [{ type: 'text', text: b.text }],
    });
  }

  return {
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: input.name,
      language: { code: input.language },
      ...(components.length > 0 ? { components } : {}),
    },
  };
}

export interface TextPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string };
}

export function buildTextPayload(to: string, body: string): TextPayload {
  return { messaging_product: 'whatsapp', to, type: 'text', text: { body } };
}

/** Decide how to send: bound template → 'template'; else open session → 'text'; else blocked. */
export function decideSendMode(input: { hasTemplate: boolean; sessionOpen: boolean }): 'template' | 'text' | 'blocked' {
  if (input.hasTemplate) return 'template';
  if (input.sessionOpen) return 'text';
  return 'blocked';
}

// ── Orchestration (I/O) ──────────────────────────────────────────────────────

export interface SendWhatsAppInput {
  organizationId: string;
  recipient: string;
  /** Optional template object for templated WABA dispatches; omitted for direct 24h window messages. */
  template?: MessageTemplate;
  resolvedBody: string;
  variables?: Record<string, unknown>;
  /** Optional correlation fields for automation run analytics */
  workspaceId?: string;
  automationId?: string;
  runId?: string;
  nodeId?: string;
  entityId?: string;
}

export interface SendWhatsAppResult {
  metaMessageId: string | null;
  status: string;
}

/**
 * Send a WhatsApp message for the engine. Resolves the org connection,
 * re-checks the session window at send time (F6), enforces approved-template /
 * session rules (F5/F7), and returns the Meta message id for status
 * reconciliation. Throws a descriptive error on any guard failure (the engine
 * surfaces it the same way as the SMS hygiene block).
 */
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const { organizationId, template, resolvedBody, variables } = input;

  const [{ WhatsAppCredentialRepository }, { WhatsAppTemplateRepository }, { MetaCloudApiClient }, { adminDb }] =
    await Promise.all([
      import('./whatsapp-credential-repository'),
      import('./whatsapp-template-repository'),
      import('./meta-cloud-client'),
      import('@/lib/firebase-admin'),
    ]);

  const creds = await WhatsAppCredentialRepository.getCredentials(organizationId);
  if (!creds) throw new Error('No WhatsApp connection configured for this organization.');

  const to = normalizeWaPhone(input.recipient);
  if (!to) throw new Error('Recipient has no valid WhatsApp phone number.');

  // Re-check the session window at SEND time, not compose time (F6).
  const sessionSnap = await adminDb.collection('whatsapp_sessions').doc(`${organizationId}_${to}`).get();
  const sessionOpen = isSessionOpen(
    sessionSnap.exists ? (sessionSnap.data()?.lastInboundAt as string | undefined) : undefined,
  );

  const hasTemplate = !!template?.whatsappTemplateName;
  const mode = decideSendMode({ hasTemplate, sessionOpen });

  const client = new MetaCloudApiClient(creds);
  let payload: TemplatePayload | TextPayload;

  if (mode === 'template') {
    if (!template || !template.whatsappTemplateName) {
      throw new Error('WhatsApp template configuration is required for templated dispatches.');
    }
    // F5: refuse to send a template Meta hasn't (still) approved.
    const waId = `${organizationId}_${template.whatsappTemplateName}_${template.whatsappLanguage}`;
    const wa = await WhatsAppTemplateRepository.get(waId);
    if (!wa) throw new Error(`WhatsApp template "${template.whatsappTemplateName}" not found — re-sync from Meta.`);
    if (wa.status !== 'APPROVED') {
      throw new Error(`WhatsApp template "${wa.name}" is ${wa.status}; cannot send.`);
    }
    // The engine can't supply per-send media / dynamic-URL values, so refuse
    // rather than let Meta reject. Adoption is blocked for such templates, so
    // this guards any adopted before that rule existed.
    if (hasRuntimeNeeds(getTemplateRuntimeNeeds(wa.components))) {
      throw new Error(
        `WhatsApp template "${wa.name}" needs a media header or dynamic URL value, which campaign sends don't support — use the per-message test send.`,
      );
    }
    payload = buildTemplatePayload({
      to,
      name: wa.name,
      language: wa.language,
      params: buildTemplateParams(template.paramMap ?? [], variables ?? {}, {
        whatsappParamMap: template.whatsappParamMap,
        body: template.body,
      }),
    });
  } else if (mode === 'text') {
    payload = buildTextPayload(to, resolvedBody);
  } else {
    throw new Error(
      'WhatsApp requires an approved template outside the 24-hour customer-service window.',
    );
  }

  const res = await client.sendMessage(payload);
  
  // Post-send writeback: Mark matching contacts as active WhatsApp confirmed (hasWhatsapp = true)
  if (input.entityId) {
    try {
      const entityRef = adminDb.collection('entities').doc(input.entityId);
      await adminDb.runTransaction(async (txn) => {
        const snap = await txn.get(entityRef);
        if (!snap.exists) return;
        const contacts = (snap.data()?.entityContacts || []) as import('@/lib/types').EntityContact[];
        let updated = false;
        const nextContacts = contacts.map(c => {
          if (c.phone && c.phone.includes(to.replace('+', ''))) {
            updated = true;
            return { ...c, hasWhatsapp: true, phoneStatus: 'active' as const };
          }
          return c;
        });
        if (updated) {
          txn.set(entityRef, { entityContacts: nextContacts }, { merge: true });
        }
      });
    } catch (err) {
      console.warn(`[sendWhatsApp] Best-effort hasWhatsapp writeback failed for entity ${input.entityId}:`, err);
    }
  }

  return { metaMessageId: res.metaMessageId, status: 'sent' };
}
