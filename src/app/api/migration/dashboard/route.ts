/**
 * API Route: Migration Dashboard
 * 
 * Returns migration dashboard summary with metrics, alerts, and recent operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMigrationDashboardSummary } from '@/lib/migration-monitoring';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';

export async function GET(request: NextRequest) {
  // SECURITY (audit F3): migration endpoints mutate and expose cross-tenant
  // operational data via adminDb. Restricted to platform system admins.
  const auth = await authenticateApiRequest(request, { requireSystemAdmin: true });
  if (!auth.success) return auth.errorResponse;

  try {
    const result = await getMigrationDashboardSummary();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch dashboard summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('dashboard error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}
