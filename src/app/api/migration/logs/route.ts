/**
 * API Route: Migration Logs
 * 
 * Get migration operation logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMigrationOperationLogs } from '@/lib/migration-monitoring';
import type { MigrationOperationType } from '@/lib/migration-monitoring-types';

export async function GET(request: NextRequest) {
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
      { error: error.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
