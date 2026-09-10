/**
 * API Route: Cleanup Old Migration Logs
 * 
 * Clean up migration logs older than retention period
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldMigrationLogs } from '@/lib/migration-monitoring';
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
    const { retentionDays } = body;

    const result = await cleanupOldMigrationLogs(retentionDays || 90);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to cleanup logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Cleaned up ${result.deletedCount} old migration logs`,
    });
  } catch (error: unknown) {
    console.error('cleanup error:', error);
    return NextResponse.json(
      { error: toClientErrorMessage('api.migration.cleanup', error, undefined, 'Failed to cleanup logs') },
      { status: 500 }
    );
  }
}
