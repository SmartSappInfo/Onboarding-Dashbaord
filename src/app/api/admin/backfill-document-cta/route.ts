import { NextRequest, NextResponse } from 'next/server';
import { runDocumentCtaBackfillAction } from '@/app/actions/backfill-document-cta-action';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';

/**
 * @fileOverview Administrative Document CTA Backfill API Route
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Security: Strictly restricted to platform system administrators (`permissions: ['system_admin']`).
 * - Zero `any` or `any[]` typing.
 */

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateApiRequest(req, { requireSystemAdmin: true });
    if (!authResult.success) {
      return authResult.errorResponse;
    }

    const result = await runDocumentCtaBackfillAction();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
