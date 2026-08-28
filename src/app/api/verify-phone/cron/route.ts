import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { BulkPhoneVerificationService, PhoneVerificationInput } from '@/lib/bulk-phone-verifier';
import { PhoneHygieneRepository } from '@/lib/phone-hygiene-repository';
import { authenticateCronRequest } from '@/lib/security/cron-auth';

/**
 * GET /api/verify-phone/cron
 *
 * Background sweeper endpoint for automatic phone verification.
 * Discovers unchecked contact phones from workspace_entities and verifies
 * them in batches.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Protected by `authenticateCronRequest` (fail-closed).
 * - Zero `any` or `any[]` typing.
 */
export async function GET(req: Request) {
  try {
    const auth = authenticateCronRequest(req);
    if (!auth.isAuthorized) {
      return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse optional limit from query params (default: 50, max: 100)
    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(rawLimit, 1), 100);

    console.log(`[verify-phone/cron] Starting sweep — discovering up to ${limit} unchecked phones...`);

    // Discover unchecked phones (with owning org) from entity contacts
    const unchecked = await PhoneHygieneRepository.getUncheckedPhones(limit);

    if (unchecked.length === 0) {
      console.log('[verify-phone/cron] No unchecked phones found. All contacts are verified.');
      return NextResponse.json({
        success: true,
        message: 'No unchecked phones found.',
        processedCount: 0,
      });
    }

    console.log(`[verify-phone/cron] Found ${unchecked.length} unchecked phones. Processing...`);

    // Resolve each org's default country once (for legacy local-format parsing)
    const orgIds = Array.from(new Set(unchecked.map((u) => u.organizationId).filter(Boolean))) as string[];
    const defaultCountryByOrg = new Map<string, string>();
    await Promise.all(
      orgIds.map(async (orgId) => {
        try {
          const snap = await adminDb.collection('organizations').doc(orgId).get();
          const code = snap.data()?.defaultCountryCode;
          if (typeof code === 'string' && code.length === 2) {
            defaultCountryByOrg.set(orgId, code);
          }
        } catch {
          // No default country — E.164-stored numbers still verify fine
        }
      })
    );

    const inputs: PhoneVerificationInput[] = unchecked.map((u) => ({
      phone: u.phone,
      defaultCountry: u.organizationId ? defaultCountryByOrg.get(u.organizationId) : undefined,
    }));

    // Set locks before processing
    await Promise.all(
      inputs.map((input) => PhoneHygieneRepository.setVerifyingLock(input.phone))
    );

    // Process through the bulk verification service
    const service = new BulkPhoneVerificationService();
    const results = await service.processBulk(inputs, { forceRefresh: true });

    console.log(`[verify-phone/cron] Sweep complete. Processed ${results.length} phones.`);

    return NextResponse.json({
      success: true,
      discoveredCount: unchecked.length,
      processedCount: results.length,
      phones: unchecked.map((u) => u.phone),
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown phone sweep failure';
    console.error('[verify-phone/cron] Sweep error:', error);
    return NextResponse.json(
      { error: 'Cron sweep failed.', details: errMsg },
      { status: 500 }
    );
  }
}
