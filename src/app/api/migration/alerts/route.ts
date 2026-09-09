/**
 * API Route: Migration Alerts
 * 
 * Get and acknowledge migration alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMigrationAlerts, acknowledgeMigrationAlert } from '@/lib/migration-monitoring';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';

export async function GET(request: NextRequest) {
  // SECURITY (audit F3): migration endpoints mutate and expose cross-tenant
  // operational data via adminDb. Restricted to platform system admins.
  const auth = await authenticateApiRequest(request, { requireSystemAdmin: true });
  if (!auth.success) return auth.errorResponse;

  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get('collection') || undefined;
    const acknowledged = searchParams.get('acknowledged');
    const limit = searchParams.get('limit');

    const result = await getMigrationAlerts({
      collection,
      acknowledged: acknowledged ? acknowledged === 'true' : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch alerts' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('alerts GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // SECURITY (audit F3): migration endpoints mutate and expose cross-tenant
  // operational data via adminDb. Restricted to platform system admins.
  const auth = await authenticateApiRequest(request, { requireSystemAdmin: true });
  if (!auth.success) return auth.errorResponse;

  try {
    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: 'Missing required field: alertId' },
        { status: 400 }
      );
    }

    // Derive the actor from the verified token — never from the request body, which
    // the caller controls (audit F2). Previously the client sent the literal string
    // 'current-user', so the audit trail recorded nothing useful either.
    const acknowledgedBy = auth.user.email ?? auth.user.uid;

    const result = await acknowledgeMigrationAlert(alertId, acknowledgedBy);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to acknowledge alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('alerts POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to acknowledge alert' },
      { status: 500 }
    );
  }
}
