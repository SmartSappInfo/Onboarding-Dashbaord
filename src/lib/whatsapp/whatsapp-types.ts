/**
 * @fileOverview WhatsApp domain types (spec §4). Kept in the WhatsApp module
 * rather than the 4k-line global `types.ts` so the things that change together
 * live together (writing-plans). Channel-union edits to shared types
 * (`MessageChannel`, `SenderProfile`, `MessageLog`, `MessageJob`) stay in
 * `types.ts`; these are WhatsApp-only collections.
 */

import type { EncryptedEnvelope } from './crypto-vault';
import type { TemplateCategory } from '@/lib/types';

export type WhatsAppConnectionStatus = 'connected' | 'pending' | 'error' | 'disconnected';
export type WhatsAppQualityRating = 'GREEN' | 'YELLOW' | 'RED';

/**
 * One WhatsApp Business Account connection per organization (server-only;
 * secrets encrypted at rest). NEVER serialized to a client — use
 * {@link WhatsAppConnectionPublic} for that.
 */
export interface WhatsAppConnection {
  id: string; // = organizationId
  organizationId: string;
  /** Forward-compat: manual entry now, Meta Embedded Signup (OAuth) later. */
  connectionType: 'manual' | 'embedded_signup';
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  businessName?: string;

  // Secrets — encrypted; never leave the server.
  accessToken: EncryptedEnvelope;
  appSecret?: EncryptedEnvelope;
  /** Last 4 chars of the plaintext token, kept for UI display without decrypting. */
  tokenLast4?: string;
  webhookVerifyToken: string;

  // Health
  status: WhatsAppConnectionStatus;
  qualityRating?: WhatsAppQualityRating;
  messagingLimit?: string; // TIER_250 | TIER_1K | TIER_10K | TIER_100K | UNLIMITED
  lastHealthCheckAt?: string;
  lastError?: string;
  tokenRotatedAt?: string;

  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Client-safe projection — the ONLY shape that may cross the server→client
 * boundary (spec R5). All secret material is stripped.
 */
export type WhatsAppConnectionPublic = Omit<
  WhatsAppConnection,
  'accessToken' | 'appSecret' | 'webhookVerifyToken'
> & {
  hasToken: boolean;
  hasAppSecret: boolean;
};

export type WhatsAppTemplateStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'PAUSED'
  | 'DISABLED';

export type WhatsAppTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

/** Org-scoped mirror of a Meta-registered template (synced via Graph API). */
export interface WhatsAppTemplate {
  id: string; // `${orgId}_${name}_${language}`
  organizationId: string;
  metaTemplateId: string;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  status: WhatsAppTemplateStatus;
  components: unknown[]; // HEADER/BODY/FOOTER/BUTTONS verbatim from Meta
  paramCount: number; // derived from BODY {{n}}
  exampleParams?: string[];
  rejectedReason?: string;
  syncedAt: string;

  // Cross-channel classification (parity with MessageTemplate), captured at
  // in-app create time so the template groups/filters like email/SMS and can be
  // auto-enabled for campaigns. Absent on Meta-Manager-synced templates.
  /** App-level category (general/campaigns/reminders/…) — NOT the Meta category. */
  appCategory?: TemplateCategory;
  /** Sub-type label, e.g. 'status_update'. */
  templateType?: string;
  /** Positional {{1}}..{{n}} → variable-key mapping for runtime resolution. */
  paramMap?: string[];
}

/** 24h customer-service window state, keyed by `${orgId}_${e164}`. */
export interface WhatsAppSession {
  id: string;
  organizationId: string;
  contactPhone: string;
  lastInboundAt: string;
  expiresAt: string;
  entityId?: string;
}

/** Idempotency marker; presence means the Meta event id was already handled. */
export interface WebhookEvent {
  id: string; // Meta message/status id
  provider: 'whatsapp';
  processedAt: string;
}
