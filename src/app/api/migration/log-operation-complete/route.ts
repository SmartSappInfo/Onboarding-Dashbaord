/**
 * API Route: Log Migration Operation Complete
 * 
 * Logs the completion of a migration operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { logMigrationOperationComplete } from '@/lib/migration-monitoring';
import type { MigrationOperationResult } from '@/lib/migration-monitoring-types';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';
// SECURITY (audit F9): report the detail server-side, return an opaque message.
import { toClientErrorMessage } from '@/lib/errors/report-error';

export async function POST(request: NextRequest) {
  // SECURITY (audit F3): migration endpoints mutate and expose cross-tenant
  // operational data via adminDb. Restricted to platform system admins.
  const auth = await authenticateApiRequest(request, { requireSystemAdmin: true });
  if (!auth.success) return auth.errorResponse;

  try {
    const body = await request.json();
    const { logId, result } = body;

    if (!logId || !result) {
      return NextResponse.json(
        { error: 'Missing required fields: logId, result' },
        { status: 400 }
      );
    }

    await logMigrationOperationComplete(logId, result as MigrationOperationResult);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('log-operation-complete error:', error);
    return NextResponse.json(
      { error: toClientErrorMessage('api.migration.log-operation-complete', error, undefined, 'Failed to log operation complete') },
      { status: 500 }
    );
  }
}
