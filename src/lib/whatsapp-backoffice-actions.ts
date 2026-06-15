'use server';

/**
 * @fileOverview Backoffice (control-plane) Server Actions for WhatsApp. These
 * span ALL organizations, so they require a platform system admin
 * (`requireSystemAdmin`), not an org admin. Reads return redacted projections
 * only — the backoffice never sees decrypted secrets.
 */

import { requireSystemAdmin } from './auth/require-org-admin';
import { WhatsAppCredentialRepository } from './whatsapp/whatsapp-credential-repository';
import type { WhatsAppConnectionPublic } from './whatsapp/whatsapp-types';

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: unknown): { success: false; error: string } {
  return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
}

/** List every organization's WhatsApp connection (redacted). */
export async function listAllWhatsAppConnections(
  idToken: string,
): Promise<ActionResult<WhatsAppConnectionPublic[]>> {
  try {
    await requireSystemAdmin(idToken);
    const data = await WhatsAppCredentialRepository.listAllPublic();
    return { success: true, data };
  } catch (e) {
    return fail(e);
  }
}

/** Force-remove an organization's WhatsApp connection from the control plane. */
export async function forceDisconnectWhatsApp(
  idToken: string,
  organizationId: string,
): Promise<ActionResult<null>> {
  try {
    await requireSystemAdmin(idToken);
    await WhatsAppCredentialRepository.disconnect(organizationId);
    return { success: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
