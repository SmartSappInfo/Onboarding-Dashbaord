import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { BulkPhoneVerificationService } from '@/lib/bulk-phone-verifier';
import { PhoneHygieneRepository } from '@/lib/phone-hygiene-repository';

const TriggerSchema = z.object({
  phones: z.array(z.string()).min(1).max(200),
  defaultCountry: z.string().length(2).optional(),
});

/**
 * POST /api/verify-phone/trigger
 *
 * Fire-and-forget phone verification endpoint.
 * Returns 202 Accepted immediately while processing verification
 * asynchronously in the background using Next.js after().
 *
 * Idempotency: checks phone_verification_cache for active locks before
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

    const { defaultCountry } = parsed.data;
    const rawPhones = parsed.data.phones;

    // Gracefully filter out empty or blank strings, keeping all actual values to be verified/flagged
    const phones = rawPhones
      .map((p) => p?.trim())
      .filter((p) => p !== '');

    if (phones.length === 0) {
      return NextResponse.json(
        { queued: false, message: 'No phones found in the batch.', skippedCount: rawPhones.length },
        { status: 200 }
      );
    }

    // Filter out phones that are currently locked (being verified by another worker)
    const lockChecks = await Promise.all(
      phones.map(async (phone) => ({
        phone,
        locked: await PhoneHygieneRepository.isLocked(phone),
      }))
    );

    const unlocked = lockChecks.filter((c) => !c.locked).map((c) => c.phone);
    const skipped = lockChecks.filter((c) => c.locked).map((c) => c.phone);

    if (unlocked.length === 0) {
      return NextResponse.json(
        { queued: false, message: 'All phones are already being verified.', skipped },
        { status: 200 }
      );
    }

    // Set locks atomically before starting verification
    await Promise.all(
      unlocked.map((phone) => PhoneHygieneRepository.setVerifyingLock(phone))
    );

    // Execute verification asynchronously in the background via Next.js after()
    after(async () => {
      try {
        const service = new BulkPhoneVerificationService();
        await service.processBulk(
          unlocked.map((phone) => ({ phone, defaultCountry })),
          { forceRefresh: true }
        );
      } catch (err: any) {
        console.error('[verify-phone/trigger] Background verification failed:', err.message);
      }
    });

    return NextResponse.json(
      {
        queued: true,
        processedCount: unlocked.length,
        skippedCount: skipped.length,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[verify-phone/trigger] Error:', error);
    return NextResponse.json(
      { error: 'Verification trigger failed.', details: error.message },
      { status: 500 }
    );
  }
}
