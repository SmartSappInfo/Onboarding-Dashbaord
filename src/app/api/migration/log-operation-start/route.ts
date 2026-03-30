/**
 * API Route: Log Migration Operation Start
 * 
 * Logs the start of a migration operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { logMigrationOperationStart } from '@/lib/migration-monitoring';
import type { MigrationOperationType } from '@/lib/migration-monitoring-types';

export async function POST(request: NextRequest) {
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
  } catch (error: any) {
    console.error('log-operation-start error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log operation start' },
      { status: 500 }
    );
  }
}
