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

    // Query records in phone_verification_cache that have score === 0
    const cacheSnap = await adminDb.collection('phone_verification_cache')
      .where('score', '==', 0)
      .limit(500)
      .get();

    if (cacheSnap.empty) {
      return {
        success: true,
        unblockedCount: 0,
        message: 'All contact phones in cache are already healthy.',
      };
    }

    const updates: [string, VerifyPhoneResult][] = [];
    let unblockedCount = 0;

    for (const doc of cacheSnap.docs) {
      const data = doc.data();
      let rawPhone = typeof data.e164 === 'string' ? data.e164.trim() : '';

      // Decode base64 document ID if rawPhone is missing from payload
      if (!rawPhone) {
        try {
          rawPhone = Buffer.from(doc.id, 'base64').toString('utf-8').trim();
        } catch {
          continue;
        }
      }

      if (!rawPhone) continue;

      // Re-evaluate number with universal calling code pre-pass and tenant country setting
      const result = await engine.verify(rawPhone, orgCountry, { forceRefresh: true });

      if (result.valid && result.status === 'format_valid') {
        updates.push([rawPhone, result]);
        unblockedCount++;
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
        : 'All re-scanned numbers were confirmed invalid.',
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
