'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Workspace Branding & White-Labeling Server Actions (Phase 6):
 * 1. Purpose & Security (FM-P6-09):
 *    Allows workspace administrators to customize signer-facing portals,
 *    emails, and PDF completion certificates with institutional branding.
 *    Strictly validates hex color codes (`^#([A-Fa-f0-9]{6})$`) and URLs to
 *    prevent HTML/CSS/XSS injection.
 * 2. Tenant Isolation (Rule 5 & 8):
 *    All branding configurations are saved in `workspaces/{workspaceId}/system_branding/default`.
 *    SECURITY (PR-0 review, 2026-09-29): both actions were unauthenticated (anyone could overwrite a
 *    workspace's signer-facing branding). They now require a session member with Doc Signing
 *    (studios / pdfs) view or edit — the same permission the Doc Signing screens use.
 *    CAUTION: public signing pages must not call these actions; read branding server-side there.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { requireDocSigningPermission } from '@/lib/documents/docsigning-authz';
import {
  WorkspaceBranding,
  WorkspaceBrandingSchema,
} from '@/lib/types/document-signing';

export async function getWorkspaceBrandingAction(
  workspaceId: string
): Promise<WorkspaceBranding | null> {
  try {
    await requireDocSigningPermission(workspaceId, 'signing_branding', 'view');
    const docSnap = await adminDb
      .collection(`workspaces/${workspaceId}/system_branding`)
      .doc('default')
      .get();

    if (!docSnap.exists) {
      // Default fallback branding
      return {
        workspaceId,
        primaryColor: '#4F46E5',
        logoUrl: '',
        companyDisplayName: 'SmartSapp Documents',
        emailSenderName: 'Document Operations',
        customInviteMessage: 'Please review and sign the attached agreement.',
        portalSlug: '',
        updatedAt: new Date().toISOString(),
      };
    }

    const parsed = WorkspaceBrandingSchema.safeParse(docSnap.data());
    return parsed.success ? parsed.data : null;
  } catch (error: unknown) {
    console.error('[getWorkspaceBrandingAction] error:', error);
    return null;
  }
}

export async function updateWorkspaceBrandingAction(
  workspaceId: string,
  input: {
    primaryColor: string;
    logoUrl?: string;
    companyDisplayName: string;
    emailSenderName: string;
    customInviteMessage?: string;
    portalSlug?: string;
  }
): Promise<{ success: boolean; data?: WorkspaceBranding; error?: string }> {
  try {
    await requireDocSigningPermission(workspaceId, 'signing_branding', 'edit');
    const nowIso = new Date().toISOString();
    const payload: WorkspaceBranding = {
      workspaceId,
      primaryColor: input.primaryColor,
      logoUrl: input.logoUrl ?? '',
      companyDisplayName: input.companyDisplayName,
      emailSenderName: input.emailSenderName,
      customInviteMessage: input.customInviteMessage,
      portalSlug: input.portalSlug || undefined,
      updatedAt: nowIso,
    };

    const validated = WorkspaceBrandingSchema.parse(payload);

    await adminDb
      .collection(`workspaces/${workspaceId}/system_branding`)
      .doc('default')
      .set(validated);

    return { success: true, data: validated };
  } catch (error: unknown) {
    console.error('[updateWorkspaceBrandingAction] validation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid branding configuration',
    };
  }
}
