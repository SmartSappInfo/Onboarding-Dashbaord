import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PhoneVerificationEngine } from '@/lib/phone-verifier';
import { PhoneHygieneRepository } from '@/lib/phone-hygiene-repository';

const SingleSchema = z.object({
  phone: z.string().min(1),
  defaultCountry: z.string().length(2).optional(),
  forceRefresh: z.boolean().optional(),
});

/**
 * POST /api/verify-phone
 * Executes the offline phone verification engine for a single number.
 * Cache-first with write-through: fresh results are persisted to the
 * phone_verification_cache and written back to matching contacts.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = SingleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid phone string is required.', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { phone, defaultCountry, forceRefresh } = parsed.data;

    // Cache-first: return a completed cached result unless a refresh is forced
    if (!forceRefresh) {
      const cached = await PhoneHygieneRepository.getCache(phone);
      if (cached && typeof cached.score === 'number' && cached._status === 'complete') {
        return NextResponse.json({ ...cached, cached: true }, { status: 200 });
      }
    }

    const engine = new PhoneVerificationEngine();
    const result = await engine.verify(phone, defaultCountry);

    // Write-through: persist cache + contact writebacks
    await PhoneHygieneRepository.commitBatch([[phone, result]]);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Phone Verification API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during verification.', details: error.message },
      { status: 500 }
    );
  }
}
