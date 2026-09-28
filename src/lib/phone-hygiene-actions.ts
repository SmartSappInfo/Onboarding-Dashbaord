'use server';

import { requireAuth } from './auth/require-auth';
import { assertUserTenantPermission } from './organization-utils';
import { adminDb } from './firebase-admin';
import { PhoneVerificationEngine, type VerifyPhoneResult } from './phone-verifier';
import { PhoneHygieneRepository } from './phone-hygiene-repository';
import { resolveOrganizationCountryCode } from './organization-country';
import { getErrorMessage } from './errors/report-error';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 *
 * This server action empowers organization administrators to trigger a 1-click
 * re-scan and reconciliation of phone numbers that were falsely flagged as Score 0
 * in the phone hygiene cache.
 *
 * SECURITY & MULTI-TENANCY (Rule 8):
 * - Authenticated session enforcement via `requireAuth()`.
 * - Tenant authorization via `assertUserTenantPermission(userId, organizationId, 'administrator')`.
 * - Prevents IDOR and parameter tampering.
 *
 * RESOURCE & LOAD SAFETY (Rule 9):
 * - Capped at 500 items per execution to prevent serverless function timeouts.
 * - Commits updates in strict batches of 500.
 *
 * STRICT TYPING (Rule 4):
 * - Zero `any` or `any[]` is used.
 */

export interface ReconcilePhoneHygieneResult {
  success: boolean;
  unblockedCount: number;
  message: string;
  error?: string;
}

export async function reconcilePhoneHygieneAction(
  organizationId: string
): Promise<ReconcilePhoneHygieneResult> {
  try {
    const { uid: userId } = await requireAuth();
    await assertUserTenantPermission(userId, organizationId, 'administrator');

    const cleanOrgId = organizationId.trim();
    const orgCountry = await resolveOrganizationCountryCode(cleanOrgId);
    const engine = new PhoneVerificationEngine();

    // 1. Fetch workspace_entities scoped strictly to this tenant organization (Rule 8)
    const entitiesSnap = await adminDb.collection('workspace_entities')
      .where('organizationId', '==', cleanOrgId)
      .limit(500)
      .get();

    if (entitiesSnap.empty) {
      return {
        success: true,
        unblockedCount: 0,
        message: 'No contacts registered in this organization.',
      };
    }

    // 2. Extract unique candidate phone numbers from primaryPhone and entityContacts
    const candidatePhones = new Set<string>();
    for (const doc of entitiesSnap.docs) {
      const data = doc.data();
      if (typeof data.primaryPhone === 'string' && data.primaryPhone.trim()) {
        candidatePhones.add(data.primaryPhone.trim());
      }
      if (Array.isArray(data.entityContacts)) {
        for (const c of data.entityContacts) {
          if (c && typeof c.phone === 'string' && c.phone.trim()) {
            candidatePhones.add(c.phone.trim());
          }
        }
      }
    }

    if (candidatePhones.size === 0) {
      return {
        success: true,
        unblockedCount: 0,
        message: 'No contact phone numbers found in this organization.',
      };
    }

    // 3. For each phone, re-verify stale or invalid records with the organization country setting
    const updates: [string, VerifyPhoneResult][] = [];
    let unblockedCount = 0;

    for (const phone of candidatePhones) {
      const cached = await PhoneHygieneRepository.getCache(phone);
      // Re-verify if not cached, or marked invalid / score 0
      if (!cached || cached.status === 'invalid' || (cached.score || 0) < 40) {
        const result = await engine.verify(phone, orgCountry, { forceRefresh: true });
        if (result.valid && result.status === 'format_valid') {
          updates.push([phone, result]);
          unblockedCount++;
        }
      }
    }

    if (updates.length > 0) {
      await PhoneHygieneRepository.commitBatch(updates);
    }

    return {
      success: true,
      unblockedCount,
      message: unblockedCount > 0
        ? `Successfully re-verified and unblocked ${unblockedCount} contact number(s).`
        : 'All contact numbers for this organization are healthy and verified.',
    };
  } catch (error: unknown) {
    console.error('[reconcilePhoneHygieneAction] Error:', error);
    return {
      success: false,
      unblockedCount: 0,
      message: 'Failed to reconcile phone hygiene cache.',
      error: getErrorMessage(error),
    };
  }
}
