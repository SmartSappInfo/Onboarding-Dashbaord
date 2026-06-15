'use server';

/**
 * @fileOverview Server Actions for WhatsApp template sync, listing, and the
 * "adopt" bridge that turns a Meta-approved template into a selectable
 * `MessageTemplate` (channel: 'whatsapp'). All actions authenticate via
 * `requireOrgAdmin` + validate input with Zod.
 */

import * as z from 'zod';
import { adminDb } from './firebase-admin';
import { requireOrgAdmin } from './auth/require-org-admin';
import { WhatsAppCredentialRepository } from './whatsapp/whatsapp-credential-repository';
import { WhatsAppTemplateRepository } from './whatsapp/whatsapp-template-repository';
import { MetaCloudApiClient } from './whatsapp/meta-cloud-client';
import { getBodyText, normalizeMetaTemplate, validateParamMap } from './whatsapp/whatsapp-domain';
import type { WhatsAppTemplate, WhatsAppTemplateStatus } from './whatsapp/whatsapp-types';
import type { MessageTemplate } from './types';

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: unknown): { success: false; error: string } {
  return { success: false, error: error instanceof Error ? error.message : 'Unexpected error' };
}

/** Pull templates from Meta and upsert the local mirror. */
export async function syncWhatsAppTemplates(
  idToken: string,
  organizationId: string,
): Promise<ActionResult<{ count: number; templates: WhatsAppTemplate[] }>> {
  try {
    await requireOrgAdmin(idToken, organizationId);
    const creds = await WhatsAppCredentialRepository.getCredentials(organizationId);
    if (!creds) return { success: false, error: 'No WhatsApp connection configured.' };

    const raw = await new MetaCloudApiClient(creds).listMessageTemplates();
    const syncedAt = new Date().toISOString();
    const templates = raw.map((t) => normalizeMetaTemplate(organizationId, t, syncedAt));
    const count = await WhatsAppTemplateRepository.upsertMany(templates);
    return { success: true, data: { count, templates } };
  } catch (e) {
    return fail(e);
  }
}

/** List the org's synced templates (optionally filtered by status). */
export async function listWhatsAppTemplates(
  idToken: string,
  organizationId: string,
  opts?: { status?: WhatsAppTemplateStatus },
): Promise<ActionResult<WhatsAppTemplate[]>> {
  try {
    await requireOrgAdmin(idToken, organizationId);
    const data = await WhatsAppTemplateRepository.list(organizationId, opts);
    return { success: true, data };
  } catch (e) {
    return fail(e);
  }
}

const AdoptSchema = z.object({
  organizationId: z.string().min(1),
  templateId: z.string().min(1),
  /** Positional {{1..n}} → variable-key mapping. */
  paramMap: z.array(z.string()).default([]),
  name: z.string().trim().optional(),
});

/**
 * Adopt an APPROVED WhatsApp template into a selectable `MessageTemplate`
 * (channel: 'whatsapp'), wiring positional params to existing variable keys.
 */
export async function adoptWhatsAppTemplate(
  idToken: string,
  payload: z.infer<typeof AdoptSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { organizationId, templateId, paramMap, name } = AdoptSchema.parse(payload);
    const { uid } = await requireOrgAdmin(idToken, organizationId);

    const wa = await WhatsAppTemplateRepository.get(templateId);
    if (!wa) return { success: false, error: 'WhatsApp template not found.' };
    if (wa.organizationId !== organizationId) return { success: false, error: 'Template belongs to another organization.' };
    if (wa.status !== 'APPROVED') return { success: false, error: `Template is ${wa.status}; only APPROVED templates can be adopted.` };

    const check = validateParamMap(paramMap, wa.paramCount);
    if (!check.valid) return { success: false, error: check.error ?? 'Invalid parameter mapping.' };

    const now = new Date().toISOString();
    const ref = adminDb.collection('message_templates').doc();
    const template: MessageTemplate = {
      id: ref.id,
      scope: 'organization',
      organizationId,
      category: 'general',
      channel: 'whatsapp',
      target: 'external_client',
      name: name || wa.name,
      contentMode: 'template',
      body: getBodyText(wa.components),
      templateType: 'whatsapp',
      variableContext: 'common',
      declaredVariables: paramMap,
      status: 'active',
      version: 1,
      whatsappTemplateName: wa.name,
      whatsappLanguage: wa.language,
      whatsappParamMap: paramMap,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
    };
    await ref.set(template);
    return { success: true, data: { id: ref.id } };
  } catch (e) {
    return fail(e);
  }
}
