import { NextResponse } from 'next/server';
import { BulkVerificationService } from '@/lib/bulk-verifier';
import { ContactHygieneRepository } from '@/lib/hygiene-repository';
import { authenticateCronRequest } from '@/lib/security/cron-auth';

/**
 * GET /api/verify-email/cron
 *
 * Background sweeper endpoint for automatic email verification.
 * Discovers unchecked contact emails from Firestore entities and
 * verifies them in batches.
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

    console.log(`[verify-email/cron] Starting sweep — discovering up to ${limit} unchecked emails...`);

    // Discover unchecked emails from entity contacts
    const uncheckedEmails = await ContactHygieneRepository.getUncheckedEmails(limit);

    if (uncheckedEmails.length === 0) {
      console.log('[verify-email/cron] No unchecked emails found. All contacts are verified.');
      return NextResponse.json({
        success: true,
        message: 'No unchecked emails found.',
        processedCount: 0,
      });
    }

    console.log(`[verify-email/cron] Found ${uncheckedEmails.length} unchecked emails. Processing...`);

    // Set locks before processing
    await Promise.all(
      uncheckedEmails.map((email) => ContactHygieneRepository.setVerifyingLock(email))
    );

    // Process through the bulk verification service
    const service = new BulkVerificationService();
    const results = await service.processBulk(uncheckedEmails, { forceRefresh: true });

    console.log(`[verify-email/cron] Sweep complete. Processed ${results.length} emails.`);

    return NextResponse.json({
      success: true,
      discoveredCount: uncheckedEmails.length,
      processedCount: results.length,
      emails: uncheckedEmails,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown cron error';
    console.error('[verify-email/cron] Sweep error:', error);
    return NextResponse.json(
      { error: 'Cron sweep failed.', details: errMsg },
      { status: 500 }
    );
  }
}
