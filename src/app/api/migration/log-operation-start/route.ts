/**
 * API Route: Log Migration Operation Start
 * 
 * Logs the start of a migration operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { logMigrationOperationStart } from '@/lib/migration-monitoring';
import type { MigrationOperationType } from '@/lib/migration-monitoring-types';
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
    const { operationType, collection, userId, userName, organizationId } = body;

    if (!operationType || !collection) {
      return NextResponse.json(
        { error: 'Missing required fields: operationType, collection' },
        { status: 400 }
      );
    }

    const logId = await logMigrationOperationStart({
      operationType: operationType as MigrationOperationType,
      collection,
      userId,
      userName,
      organizationId,
    });

    return NextResponse.json({ success: true, logId });
  } catch (error: unknown) {
    console.error('log-operation-start error:', error);
    return NextResponse.json(
      { error: toClientErrorMessage('api.migration.log-operation-start', error, undefined, 'Failed to log operation start') },
      { status: 500 }
    );
  }
}
