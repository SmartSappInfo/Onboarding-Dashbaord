import { NextResponse } from 'next/server';
import { BulkVerificationService } from '@/lib/bulk-verifier';

/**
 * POST /api/verify-email/bulk
 * Executes the SmartSapp Verify engine across multiple emails.
 * Uses BulkVerificationService to automatically enforce domain serialization
 * and chunk database writes in strict batches.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { emails, forceRefresh } = body;

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json({ error: 'A valid array of email strings is required.' }, { status: 400 });
    }

    const service = new BulkVerificationService();
    
    // The service handles cache bypassing, single checks, and db batching inside.
    const resultsTuple = await service.processBulk(emails, { forceRefresh: !!forceRefresh });

    // Convert the returned Array<[email, VerifyEmailResult]> into a clean mapping
    const dataMapping = Object.fromEntries(resultsTuple);

    return NextResponse.json({
      success: true,
      processedCount: resultsTuple.length,
      data: dataMapping
    }, { status: 200 });
  } catch (error: any) {
    console.error('Bulk Email Verification API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during bulk verification.', details: error.message },
      { status: 500 }
    );
  }
}
