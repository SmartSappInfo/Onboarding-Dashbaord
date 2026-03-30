/**
 * API Route: Log Migration Operation Complete
 * 
 * Logs the completion of a migration operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { logMigrationOperationComplete } from '@/lib/migration-monitoring';
import type { MigrationOperationResult } from '@/lib/migration-monitoring-types';

export async function POST(request: NextRequest) {
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
      { error: error.message || 'Failed to log operation complete' },
      { status: 500 }
    );
  }
}
