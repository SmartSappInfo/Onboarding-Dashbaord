'use server';

import { adminDb } from '@/lib/firebase-admin';
import { requireOrgAdmin } from '@/lib/auth/require-org-admin';

export async function registerSkeletonWhatsAppAction(
  idToken: string,
  organizationId: string,
  skeletonId: string,
  whatsappTemplateName: string,
  whatsappLanguage: string,
  paramMap: string[]
): Promise<{ success: boolean }> {
  await requireOrgAdmin(idToken, organizationId);
  await adminDb.collection('message_templates').doc(skeletonId).update({
    whatsappTemplateName,
    whatsappLanguage,
    whatsappParamMap: paramMap,
    declaredVariables: paramMap,
    updatedAt: new Date().toISOString()
  });
  return { success: true };
}
