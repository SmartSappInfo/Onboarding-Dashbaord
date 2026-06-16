'use server';

/**
 * @fileOverview Server Actions for per-organization WhatsApp credential
 * management. Every action authenticates INSIDE the action via
 * `requireOrgAdmin` (spec R1, `vercel:server-auth-actions`) and validates input
 * with Zod. Secrets are never returned — reads yield `WhatsAppConnectionPublic`.
 */

import * as z from 'zod';
import { requireOrgAdmin } from './auth/require-org-admin';
import { WhatsAppCredentialRepository } from './whatsapp/whatsapp-credential-repository';
import { MetaCloudApiClient, exchangeEmbeddedSignupCode } from './whatsapp/meta-cloud-client';
import type { WhatsAppConnectionPublic } from './whatsapp/whatsapp-types';

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: unknown): { success: false; error: string } {
  return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
}

const SaveConnectionSchema = z.object({
  organizationId: z.string().min(1),
  connectionType: z.enum(['manual', 'embedded_signup']).optional(),
  wabaId: z.string().trim().min(1, 'WABA ID is required'),
  phoneNumberId: z.string().trim().min(1, 'Phone Number ID is required'),
  displayPhoneNumber: z.string().trim().min(1, 'Display phone number is required'),
  businessName: z.string().trim().optional(),
  accessToken: z.string().trim().min(10, 'Access token looks too short'),
  appSecret: z.string().trim().optional(),
});

export type SaveConnectionPayload = z.infer<typeof SaveConnectionSchema>;

/** Create or update this org's WhatsApp connection. */
export async function saveWhatsAppConnection(
  idToken: string,
  payload: SaveConnectionPayload,
): Promise<ActionResult<WhatsAppConnectionPublic>> {
  try {
    const input = SaveConnectionSchema.parse(payload);
    const { uid } = await requireOrgAdmin(idToken, input.organizationId);
    const data = await WhatsAppCredentialRepository.save({ ...input, createdBy: uid });
    return { success: true, data };
  } catch (e) {
    return fail(e);
  }
}

const OAuthConnectSchema = z.object({
  organizationId: z.string().min(1),
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
});

/**
 * Embedded Signup (OAuth) — "just connect & synchronize". The client runs Meta's
 * hosted popup and returns an auth `code` plus the selected `wabaId`/`phoneNumberId`.
 * This exchanges the code for a token (via the platform Meta app), provisions the
 * connection, auto-subscribes webhooks, and runs a health check — no manual paste.
 */
export async function connectWhatsAppViaOAuth(
  idToken: string,
  payload: z.infer<typeof OAuthConnectSchema>,
): Promise<ActionResult<WhatsAppConnectionPublic>> {
  try {
    const { organizationId, code, wabaId, phoneNumberId } = OAuthConnectSchema.parse(payload);
    const { uid } = await requireOrgAdmin(idToken, organizationId);

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      return { success: false, error: 'Embedded Signup is not configured on this platform (META_APP_ID/SECRET).' };
    }

    // 1. Exchange the auth code for a long-lived access token.
    const accessToken = await exchangeEmbeddedSignupCode(code, { appId, appSecret });

    // 2. Read the number's display + health using the new token.
    const client = new MetaCloudApiClient({ accessToken, phoneNumberId, wabaId });
    const health = await client.getPhoneNumberHealth();

    // 3. Persist (encrypted) as an embedded-signup connection.
    await WhatsAppCredentialRepository.save({
      organizationId,
      connectionType: 'embedded_signup',
      wabaId,
      phoneNumberId,
      displayPhoneNumber: health.displayPhoneNumber || '',
      businessName: health.verifiedName,
      accessToken,
      createdBy: uid,
    });

    // 4. Auto-wire webhooks (no callback URL for the org to configure).
    try {
      await client.subscribeAppToWaba(wabaId);
    } catch (subErr) {
      console.warn('[WA-OAUTH] subscribed_apps failed:', (subErr as Error).message);
    }

    // 5. Mark health.
    await WhatsAppCredentialRepository.updateHealth(organizationId, {
      status: 'connected',
      qualityRating: health.qualityRating,
      messagingLimit: health.messagingLimit,
      lastError: null,
    });

    const data = await WhatsAppCredentialRepository.getPublic(organizationId);
    return { success: true, data: data! };
  } catch (e) {
    return fail(e);
  }
}

/** Read the redacted connection for the settings UI. */
export async function getWhatsAppConnection(
  idToken: string,
  organizationId: string,
): Promise<ActionResult<WhatsAppConnectionPublic | null>> {
  try {
    await requireOrgAdmin(idToken, organizationId);
    const data = await WhatsAppCredentialRepository.getPublic(organizationId);
    return { success: true, data };
  } catch (e) {
    return fail(e);
  }
}

/** Live health check against Meta; persists status/quality/tier. */
export async function testWhatsAppConnection(
  idToken: string,
  organizationId: string,
): Promise<ActionResult<WhatsAppConnectionPublic | null>> {
  try {
    await requireOrgAdmin(idToken, organizationId);
    const creds = await WhatsAppCredentialRepository.getCredentials(organizationId);
    if (!creds) return { success: false, error: 'No WhatsApp connection configured.' };

    try {
      const health = await new MetaCloudApiClient(creds).getPhoneNumberHealth();
      await WhatsAppCredentialRepository.updateHealth(organizationId, {
        status: 'connected',
        qualityRating: health.qualityRating,
        messagingLimit: health.messagingLimit,
        lastError: null,
      });
    } catch (healthErr) {
      await WhatsAppCredentialRepository.updateHealth(organizationId, {
        status: 'error',
        lastError: healthErr instanceof Error ? healthErr.message : 'Health check failed',
      });
    }

    const data = await WhatsAppCredentialRepository.getPublic(organizationId);
    return { success: true, data };
  } catch (e) {
    return fail(e);
  }
}

const RotateTokenSchema = z.object({
  organizationId: z.string().min(1),
  accessToken: z.string().trim().min(10, 'Access token looks too short'),
});

/** Replace only the access token (preserves other config + app secret). */
export async function rotateWhatsAppToken(
  idToken: string,
  payload: z.infer<typeof RotateTokenSchema>,
): Promise<ActionResult<WhatsAppConnectionPublic>> {
  try {
    const { organizationId, accessToken } = RotateTokenSchema.parse(payload);
    await requireOrgAdmin(idToken, organizationId);
    const data = await WhatsAppCredentialRepository.rotateToken(organizationId, accessToken);
    return { success: true, data };
  } catch (e) {
    return fail(e);
  }
}

/** Remove this org's WhatsApp connection (revokes stored credentials). */
export async function disconnectWhatsApp(
  idToken: string,
  organizationId: string,
): Promise<ActionResult<null>> {
  try {
    await requireOrgAdmin(idToken, organizationId);
    await WhatsAppCredentialRepository.disconnect(organizationId);
    return { success: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
