/**
 * API Route: Migration Logs
 * 
 * Get migration operation logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMigrationOperationLogs } from '@/lib/migration-monitoring';
import type { MigrationOperationType } from '@/lib/migration-monitoring-types';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';
// SECURITY (audit F9): report the detail server-side, return an opaque message.
import { toClientErrorMessage } from '@/lib/errors/report-error';

export async function GET(request: NextRequest) {
  // SECURITY (audit F3): migration endpoints mutate and expose cross-tenant
  // operational data via adminDb. Restricted to platform system admins.
  const auth = await authenticateApiRequest(request, { requireSystemAdmin: true });
  if (!auth.success) return auth.errorResponse;

  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get('collection') || undefined;
    const operationType = searchParams.get('operationType') as MigrationOperationType | undefined;
    const status = searchParams.get('status') as 'started' | 'completed' | 'failed' | undefined;
    const limit = searchParams.get('limit');

    const result = await getMigrationOperationLogs({
      collection,
      operationType,
      status,
      limit: limit ? parseInt(limit) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('logs GET error:', error);
    return NextResponse.json(
      { error: toClientErrorMessage('api.migration.logs', error, undefined, 'Failed to fetch logs') },
      { status: 500 }
    );
  }
}
