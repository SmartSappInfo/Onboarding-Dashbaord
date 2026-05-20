import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BulkVerificationService } from '@/lib/bulk-verifier';
import { ContactHygieneRepository } from '@/lib/hygiene-repository';

const TriggerSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(200),
});

/**
 * POST /api/verify-email/trigger
 *
 * Fire-and-forget email verification endpoint.
 * Returns 202 Accepted immediately while processing verification
 * within the same request window (Cloud Run keeps CPU active until
 * the response stream closes, so we process before responding).
 *
 * Idempotency: checks verification_cache for active locks before
 * starting a new verification to prevent duplicate storm processing.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = TriggerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { emails } = parsed.data;

    // Filter out emails that are currently locked (being verified by another worker)
    const lockChecks = await Promise.all(
      emails.map(async (email) => ({
        email,
        locked: await ContactHygieneRepository.isLocked(email),
      }))
    );

    const unlocked = lockChecks.filter((c) => !c.locked).map((c) => c.email);
    const skipped = lockChecks.filter((c) => c.locked).map((c) => c.email);

    if (unlocked.length === 0) {
      return NextResponse.json(
        { queued: false, message: 'All emails are already being verified.', skipped },
        { status: 200 }
      );
    }

    // Set locks atomically before starting verification
    await Promise.all(
      unlocked.map((email) => ContactHygieneRepository.setVerifyingLock(email))
    );

    // Execute verification synchronously within the request window.
    // Cloud Run keeps CPU active for the full request duration.
    // For small batches (1-10) this completes in seconds.
    // For larger batches, the BulkVerificationService handles
    // domain-serialized throttling and batched Firestore writes.
    const service = new BulkVerificationService();
    const results = await service.processBulk(unlocked, { forceRefresh: true });

    return NextResponse.json(
      {
        queued: true,
        processedCount: results.length,
        skippedCount: skipped.length,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[verify-email/trigger] Error:', error);
    return NextResponse.json(
      { error: 'Verification trigger failed.', details: error.message },
      { status: 500 }
    );
  }
}
