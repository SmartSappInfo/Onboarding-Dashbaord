'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import type { AuditActor, PlatformTemplate } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Template Server Actions
// Operations for managing global platform templates.
// ─────────────────────────────────────────────────

export async function listAllTemplates(): Promise<{
  success: boolean;
  data?: PlatformTemplate[];
  error?: string;
}> {
  try {
    const snap = await adminDb.collection('platform_templates').orderBy('name', 'asc').get();
    const templates = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformTemplate));

    return { success: true, data: templates };
  } catch (error: any) {
    console.error('[BACKOFFICE_TEMPLATE] listAllTemplates failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getTemplateDetail(templateId: string): Promise<{
  success: boolean;
  data?: PlatformTemplate;
  error?: string;
}> {
  try {
    const doc = await adminDb.collection('platform_templates').doc(templateId).get();
    if (!doc.exists) {
      return { success: false, error: 'Template not found' };
    }

    return { success: true, data: { id: doc.id, ...doc.data() } as PlatformTemplate };
  } catch (error: any) {
    console.error('[BACKOFFICE_TEMPLATE] getTemplateDetail failed:', error);
    return { success: false, error: error.message };
  }
}

export async function publishTemplate(
  templateId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const ref = adminDb.collection('platform_templates').doc(templateId);
    const snap = await ref.get();
    
    if (!snap.exists) {
      return { success: false, error: 'Template not found' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    await ref.update({
      status: 'published',
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    });

    const afterSnap = await ref.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'template.publish', 'template', templateId, {
      before,
      after,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_TEMPLATE] publishTemplate failed:', error);
    return { success: false, error: error.message };
  }
}

export async function deprecateTemplate(
  templateId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const ref = adminDb.collection('platform_templates').doc(templateId);
    const snap = await ref.get();
    
    if (!snap.exists) {
      return { success: false, error: 'Template not found' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    await ref.update({
      status: 'deprecated',
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    });

    const afterSnap = await ref.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'template.deprecate', 'template', templateId, {
      before,
      after,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_TEMPLATE] deprecateTemplate failed:', error);
    return { success: false, error: error.message };
  }
}
