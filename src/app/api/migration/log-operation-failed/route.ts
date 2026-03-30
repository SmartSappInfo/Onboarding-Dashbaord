/**
 * API Route: Log Migration Operation Failed
 * 
 * Logs a failed migration operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { logMigrationOperationFailed } from '@/lib/migration-monitoring';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logId, error } = body;

    if (!logId || !error) {
      return NextResponse.json(
        { error: 'Missing required fields: logId, error' },
        { status: 400 }
      );
    }

    await logMigrationOperationFailed(logId, error);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('log-operation-failed error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to log operation failure' },
      { status: 500 }
    );
  }
}
