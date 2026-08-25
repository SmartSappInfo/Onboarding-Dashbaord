'use server';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Enterprise Security Server Actions:
 *    Authorizes document lifecycle actions against the RBAC permissions matrix (PRD Section 89 & Phase 13).
 * 2. Multi-Tenant Authorization Invariant:
 *    Strictly validates `workspaceId` before conducting security audits or permission checks.
 * 3. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  DocumentRole,
  DocumentPermission,
} from '@/lib/types/document-types';
import { verifyDocumentPermission } from './enterprise-security-service';

export async function checkDocumentPermissionAction(
  workspaceId: string,
  role: DocumentRole,
  permission: DocumentPermission
): Promise<{ success: boolean; allowed: boolean; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, allowed: false, error: 'Workspace ID is required.' };
    }

    const allowed = verifyDocumentPermission(role, permission);
    return { success: true, allowed };
  } catch (err) {
    console.error('Error checking document permission:', err);
    return { success: false, allowed: false, error: 'Failed to verify permission.' };
  }
}

export async function auditWorkspaceSecurityPostureAction(
  workspaceId: string
): Promise<{
  success: boolean;
  posture?: {
    totalDocumentsCount: number;
    passwordProtectedCount: number;
    leadGatedCount: number;
    publicCount: number;
  };
  error?: string;
}> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'Workspace ID is required.' };
    }

    const docsSnap = await adminDb
      .collection('documents')
      .where('workspaceId', '==', workspaceId)
      .get();

    let passwordProtectedCount = 0;
    let leadGatedCount = 0;
    let publicCount = 0;

    docsSnap.docs.forEach((d) => {
      const data = d.data();
      const access = data.accessPolicy;
      if (access?.passwordHash || access?.requirePassword) {
        passwordProtectedCount++;
      } else if (access?.requireEmail || data.leadGate?.enabled) {
        leadGatedCount++;
      } else {
        publicCount++;
      }
    });

    return {
      success: true,
      posture: {
        totalDocumentsCount: docsSnap.size,
        passwordProtectedCount,
        leadGatedCount,
        publicCount,
      },
    };
  } catch (err) {
    console.error('Error auditing workspace security posture:', err);
    return { success: false, error: 'Failed to audit security posture.' };
  }
}
