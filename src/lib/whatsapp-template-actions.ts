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
import {
  getBodyText,
  normalizeMetaTemplate,
  validateParamMap,
  validateCreateTemplateInput,
  buildCreateTemplatePayload,
  buildWhatsAppTemplateId,
  deriveParamCount,
} from './whatsapp/whatsapp-domain';
import type { WhatsAppTemplate, WhatsAppTemplateStatus, WhatsAppTemplateCategory } from './whatsapp/whatsapp-types';
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

const CreateSchema = z.object({
  organizationId: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, 'Name may only contain lowercase letters, numbers, and underscores.'),
  language: z.string().trim().min(2),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  bodyText: z.string().trim().min(1).max(1024),
  bodyExample: z.array(z.string()).default([]),
  headerText: z.string().trim().max(60).optional(),
  footerText: z.string().trim().max(60).optional(),
});

/**
 * Author a brand-new template and submit it to Meta for approval, then mirror
 * it locally (PENDING) so it appears immediately. Sync later reflects the
 * APPROVED/REJECTED outcome. Templates cannot send until Meta approves them.
 */
export async function createWhatsAppTemplate(
  idToken: string,
  payload: z.infer<typeof CreateSchema>,
): Promise<ActionResult<WhatsAppTemplate>> {
  try {
    const input = CreateSchema.parse(payload);
    await requireOrgAdmin(idToken, input.organizationId);

    const creds = await WhatsAppCredentialRepository.getCredentials(input.organizationId);
    if (!creds) return { success: false, error: 'No WhatsApp connection configured.' };

    const category = input.category as WhatsAppTemplateCategory;
    const check = validateCreateTemplateInput({ ...input, category });
    if (!check.valid) return { success: false, error: check.error ?? 'Invalid template.' };

    const metaPayload = buildCreateTemplatePayload({ ...input, category });
    const res = await new MetaCloudApiClient(creds).createMessageTemplate(metaPayload);

    // Mirror locally as PENDING so the panel shows it without a manual sync.
    const now = new Date().toISOString();
    const template: WhatsAppTemplate = {
      id: buildWhatsAppTemplateId(input.organizationId, input.name, input.language),
      organizationId: input.organizationId,
      metaTemplateId: res.id,
      name: input.name,
      language: input.language,
      category,
      status: 'PENDING',
      components: metaPayload.components,
      paramCount: deriveParamCount(metaPayload.components),
      ...(input.bodyExample.length ? { exampleParams: input.bodyExample } : {}),
      syncedAt: now,
    };
    await WhatsAppTemplateRepository.upsertMany([template]);
    return { success: true, data: template };
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
