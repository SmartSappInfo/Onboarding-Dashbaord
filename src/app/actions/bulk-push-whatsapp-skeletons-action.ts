'use server';

import { requireOrgAdmin } from '@/lib/auth/require-org-admin';
import { adminDb } from '@/lib/firebase-admin';
import { WhatsAppCredentialRepository } from '@/lib/whatsapp/whatsapp-credential-repository';
import { MetaCloudApiClient } from '@/lib/whatsapp/meta-cloud-client';
import {
  buildCreateTemplatePayload,
  buildWhatsAppTemplateId,
  stripComponentExamples
} from '@/lib/whatsapp/whatsapp-domain';
import { WhatsAppTemplateRepository } from '@/lib/whatsapp/whatsapp-template-repository';
import { toWhatsAppTemplateName } from '@/app/admin/messaging/templates/lib/unified-template';
import type { WhatsAppTemplate, WhatsAppTemplateCategory } from '@/lib/whatsapp/whatsapp-types';

export async function bulkPushWhatsAppSkeletonsAction(
  idToken: string,
  organizationId: string,
  skeletonIds: string[]
): Promise<{ success: boolean; count: number }> {
  await requireOrgAdmin(idToken, organizationId);
  
  const creds = await WhatsAppCredentialRepository.getCredentials(organizationId);
  if (!creds) {
    throw new Error('No WhatsApp connection configured.');
  }

  const client = new MetaCloudApiClient(creds);
  let count = 0;

  for (const skeletonId of skeletonIds) {
    const snap = await adminDb.collection('message_templates').doc(skeletonId).get();
    if (!snap.exists) continue;
    const data = snap.data();
    if (!data || data.channel !== 'whatsapp' || data.whatsappTemplateName) continue;

    const bodyText = data.body || '';
    const varMatches = bodyText.match(/\{\{(.*?)\}\}/g);
    const paramMap: string[] = varMatches
      ? Array.from(new Set(varMatches.map((m: string) => m.replace(/\{\{|\}\}/g, '').trim())))
      : [];

    let processedBody = bodyText;
    paramMap.forEach((v: string, idx: number) => {
      processedBody = processedBody.replaceAll(`{{${v}}}`, `{{${idx + 1}}}`);
    });

    const cleanName = toWhatsAppTemplateName(data.name || '');
    if (!cleanName) continue;

    const category: WhatsAppTemplateCategory = 'UTILITY';
    const metaPayload = buildCreateTemplatePayload({
      name: cleanName,
      language: 'en_US',
      category,
      bodyText: processedBody,
      bodyExample: Array(paramMap.length).fill('Sample'),
    });

    const res = await client.createMessageTemplate(metaPayload);

    // Update the skeleton template
    await adminDb.collection('message_templates').doc(skeletonId).update({
      whatsappTemplateName: cleanName,
      whatsappLanguage: 'en_US',
      whatsappParamMap: paramMap,
      declaredVariables: paramMap,
      updatedAt: new Date().toISOString()
    });

    // Mirror locally as PENDING
    const now = new Date().toISOString();
    const mirrorTemplate: WhatsAppTemplate = {
      id: buildWhatsAppTemplateId(organizationId, cleanName, 'en_US'),
      organizationId,
      metaTemplateId: res.id,
      name: cleanName,
      language: 'en_US',
      category,
      status: 'PENDING',
      components: stripComponentExamples(metaPayload.components),
      paramCount: paramMap.length,
      ...(paramMap.length ? { exampleParams: Array(paramMap.length).fill('Sample') } : {}),
      appCategory: data.category || 'general',
      templateType: data.templateType || `custom_general_${Date.now()}`,
      paramMap,
      syncedAt: now,
    };

    await WhatsAppTemplateRepository.upsertMany([mirrorTemplate]);
    count++;
  }

  return { success: true, count };
}
