import { NextResponse } from 'next/server';
import { BulkVerificationService } from '@/lib/bulk-verifier';
import { ContactHygieneRepository } from '@/lib/hygiene-repository';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/verify-email/cron
 *
 * Background sweeper endpoint for automatic email verification.
 * Discovers unchecked contact emails from Firestore entities and
 * verifies them in batches. Designed to be triggered by:
 *   - GCP Cloud Scheduler
 *   - Vercel Cron
 *   - GitHub Actions
 *   - Manual curl with authorization header
 *
 * Protected by CRON_SECRET environment variable.
 */
export async function GET(req: Request) {
  try {
    // Auth guard: require secret token
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (CRON_SECRET && token !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  } catch (error: any) {
    console.error('[verify-email/cron] Sweep error:', error);
    return NextResponse.json(
      { error: 'Cron sweep failed.', details: error.message },
      { status: 500 }
    );
  }
}
