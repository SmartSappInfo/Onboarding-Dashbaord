import { NextResponse } from 'next/server';
import { runDocumentCtaBackfillAction } from '@/app/actions/backfill-document-cta-action';

export async function GET() {
  try {
    const result = await runDocumentCtaBackfillAction();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
