/**
 * @fileOverview Pure helpers for the WhatsApp connection record. No I/O — safe
 * to unit-test and (for the public projection) reason about in isolation.
 */

import { encrypt } from './crypto-vault';
import type { WhatsAppConnection, WhatsAppConnectionPublic } from './whatsapp-types';

/** Last 4 chars of a plaintext token, for masked display (e.g. "••••wxyz"). */
export function deriveTokenLast4(plaintextToken: string): string {
  return plaintextToken.slice(-4);
}

/** Plaintext input from the settings form / OAuth callback (secrets not yet sealed). */
export interface SaveConnectionInput {
  organizationId: string;
  connectionType?: 'manual' | 'embedded_signup';
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  businessName?: string;
  /** Plaintext Meta System User token — encrypted before storage. */
  accessToken: string;
  /** Plaintext app secret (for webhook signature validation) — encrypted if present. */
  appSecret?: string;
  createdBy?: string;
}

/**
 * Build the stored {@link WhatsAppConnection} from plaintext input, sealing
 * secrets via the crypto-vault. Pure (deterministic given `ctx`) so it is
 * unit-testable. On update, immutable fields (`createdAt`, `webhookVerifyToken`)
 * are carried over from `ctx.existing`.
 */
export function buildConnectionRecord(
  input: SaveConnectionInput,
  ctx: { now: string; webhookVerifyToken: string; existing?: WhatsAppConnection | null },
): WhatsAppConnection {
  return {
    id: input.organizationId,
    organizationId: input.organizationId,
    connectionType: input.connectionType ?? 'manual',
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    displayPhoneNumber: input.displayPhoneNumber,
    businessName: input.businessName,
    accessToken: encrypt(input.accessToken),
    ...(input.appSecret ? { appSecret: encrypt(input.appSecret) } : {}),
    tokenLast4: deriveTokenLast4(input.accessToken),
    // Verify token is stable for the life of the connection (Meta stores it).
    webhookVerifyToken: ctx.existing?.webhookVerifyToken ?? ctx.webhookVerifyToken,
    // Newly saved/edited credentials are unverified until a health check passes.
    status: 'pending',
    createdAt: ctx.existing?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
    createdBy: ctx.existing?.createdBy ?? input.createdBy,
  };
}

/**
 * Project a connection to its client-safe shape. This is the ONLY function that
 * should produce data sent to the client — it strips the encrypted token, app
 * secret, and webhook verify token (spec R5). Destructuring guarantees the
 * secret keys are physically removed, not merely undefined.
 */
export function toPublicConnection(conn: WhatsAppConnection): WhatsAppConnectionPublic {
  const { accessToken, appSecret, webhookVerifyToken, ...safe } = conn;
  return {
    ...safe,
    hasToken: !!accessToken,
    hasAppSecret: !!appSecret,
  };
}
