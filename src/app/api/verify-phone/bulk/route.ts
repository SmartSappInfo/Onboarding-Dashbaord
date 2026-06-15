import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BulkPhoneVerificationService } from '@/lib/bulk-phone-verifier';

const BulkSchema = z.object({
  phones: z.array(z.string()).min(1).max(200),
  defaultCountry: z.string().length(2).optional(),
  forceRefresh: z.boolean().optional(),
});

/**
 * POST /api/verify-phone/bulk
 * Executes the offline phone verification engine across multiple numbers.
 * Synchronous: waits for verification and batched db writes to complete.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = BulkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A valid array of phone strings is required (1-200).', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { phones, defaultCountry, forceRefresh } = parsed.data;

    const service = new BulkPhoneVerificationService();
    const resultsTuple = await service.processBulk(
      phones.map((phone) => ({ phone, defaultCountry })),
      { forceRefresh: !!forceRefresh }
    );

    const dataMapping = Object.fromEntries(resultsTuple);

    return NextResponse.json({
      success: true,
      processedCount: resultsTuple.length,
      data: dataMapping,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Bulk Phone Verification API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during bulk verification.', details: error.message },
      { status: 500 }
    );
  }
}
