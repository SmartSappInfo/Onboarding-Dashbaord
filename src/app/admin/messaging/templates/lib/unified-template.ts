/**
 * @fileOverview Display-layer adapter that unifies two storage models into one
 * gallery list WITHOUT changing either schema:
 *   1. `MessageTemplate` (Firestore `message_templates`) — email/SMS, plus
 *      "adopted" WhatsApp docs that bind to an approved Meta template.
 *   2. `WhatsAppTemplate` (org-scoped Meta mirror) — the source of truth for
 *      WhatsApp approval status, read via server action.
 *
 * Everything here is PURE (no React, no Firestore) so the merge/map/dedup logic
 * is unit-testable in isolation; the UI just renders the result.
 */
import type { MessageTemplate, TemplateStatus } from '@/lib/types';
import type { WhatsAppTemplate, WhatsAppTemplateStatus } from '@/lib/whatsapp/whatsapp-types';
import { getBodyText, getTemplateRuntimeNeeds, hasRuntimeNeeds } from '@/lib/whatsapp/whatsapp-domain';

/**
 * A Firestore-backed template. `_source` is optional so a plain `MessageTemplate[]`
 * (e.g. from other gallery consumers) is assignable to `GalleryTemplate[]` without
 * tagging — `isWhatsAppDisplay` still discriminates correctly since only the
 * WhatsApp variant carries `_source: 'whatsapp_meta'`.
 */
export type FirestoreGalleryTemplate = MessageTemplate & { _source?: 'firestore' };

/**
 * A Meta-mirror WhatsApp template projected into a gallery-renderable shape.
 * Provides every field the gallery reads (so filtering/grouping/search work
 * uniformly) plus WhatsApp-only metadata for channel-aware rendering & actions.
 */
export interface WhatsAppDisplayTemplate {
  _source: 'whatsapp_meta';
  id: string;
  name: string;
  body: string;
  channel: 'whatsapp';
  category: MessageTemplate['category'];
  target: MessageTemplate['target'];
  /** Gallery-vocabulary status so the existing status filter never hides WA cards. */
  status: TemplateStatus;
  /** Used for sorting; mirrors the Firestore `createdAt` slot. */
  createdAt: string;

  // WhatsApp-specific
  waStatus: WhatsAppTemplateStatus;
  waCategory: WhatsAppTemplate['category'];
  language: string;
  paramCount: number;
  hasRuntimeNeeds: boolean;
  isAdopted: boolean;
  rejectedReason?: string;
  /** Original record, passed to the WhatsApp dialogs (send-test/adopt). */
  raw: WhatsAppTemplate;
}

export type GalleryTemplate = FirestoreGalleryTemplate | WhatsAppDisplayTemplate;

/** Single discriminator for the union — used everywhere instead of ad-hoc checks. */
export function isWhatsAppDisplay(t: GalleryTemplate): t is WhatsAppDisplayTemplate {
  return t._source === 'whatsapp_meta';
}

/**
 * Meta approval status → gallery status vocabulary. APPROVED templates behave
 * like "active", PENDING like "draft", and everything terminal like "archived",
 * so the Active/Draft/Archived filter stays meaningful. The card still shows the
 * real Meta status via `waStatus`.
 */
const META_TO_GALLERY_STATUS: Record<WhatsAppTemplateStatus, TemplateStatus> = {
  APPROVED: 'active',
  PENDING: 'draft',
  REJECTED: 'archived',
  PAUSED: 'archived',
  DISABLED: 'archived',
};

export function mapWhatsAppToGallery(
  wa: WhatsAppTemplate,
  adoptedNames: ReadonlySet<string>,
): WhatsAppDisplayTemplate {
  return {
    _source: 'whatsapp_meta',
    id: wa.id,
    name: wa.name,
    body: getBodyText(wa.components),
    channel: 'whatsapp',
    category: 'general',
    target: 'external_client',
    status: META_TO_GALLERY_STATUS[wa.status],
    createdAt: wa.syncedAt,
    waStatus: wa.status,
    waCategory: wa.category,
    language: wa.language,
    paramCount: wa.paramCount,
    hasRuntimeNeeds: hasRuntimeNeeds(getTemplateRuntimeNeeds(wa.components)),
    isAdopted: adoptedNames.has(wa.name),
    rejectedReason: wa.rejectedReason,
    raw: wa,
  };
}

/** True for a Firestore doc that is an adopted (Meta-bound) WhatsApp template. */
function isAdoptedWhatsAppDoc(t: MessageTemplate): boolean {
  return t.channel === 'whatsapp' && !!t.whatsappTemplateName;
}

/**
 * Split Firestore templates into the adopted-WhatsApp name set (so cards can show
 * "Enabled") and the templates that should remain visible in the gallery. Adopted
 * WhatsApp docs are hidden because their canonical card is the Meta-mirror entry —
 * preventing the same template from appearing twice.
 */
export function partitionAdopted(firestore: MessageTemplate[]): {
  adoptedNames: Set<string>;
  visible: MessageTemplate[];
} {
  const adoptedNames = new Set<string>();
  const visible: MessageTemplate[] = [];
  for (const t of firestore) {
    if (isAdoptedWhatsAppDoc(t)) {
      adoptedNames.add(t.whatsappTemplateName!);
      continue;
    }
    visible.push(t);
  }
  return { adoptedNames, visible };
}

/**
 * Normalize an arbitrary (AI-generated) name into a Meta-valid WhatsApp template
 * name: lowercase, only `[a-z0-9_]`, no leading/trailing underscores. Returns ''
 * for empty input so callers can fall back to `undefined`.
 */
export function toWhatsAppTemplateName(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Merge the visible Firestore docs with WhatsApp displays, newest first. */
export function mergeGalleryTemplates(
  visibleFirestore: MessageTemplate[],
  whatsappDisplays: WhatsAppDisplayTemplate[],
): GalleryTemplate[] {
  const tagged: FirestoreGalleryTemplate[] = visibleFirestore.map((t) => ({
    ...t,
    _source: 'firestore',
  }));
  return [...tagged, ...whatsappDisplays].toSorted((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );
}
