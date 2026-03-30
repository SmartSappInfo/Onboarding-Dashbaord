/**
 * API Route: Migration Metrics
 * 
 * Get migration metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMigrationMetrics } from '@/lib/migration-monitoring';
import type { MigrationOperationType } from '@/lib/migration-monitoring-types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get('collection') || undefined;
    const operationType = searchParams.get('operationType') as MigrationOperationType | undefined;
    const limit = searchParams.get('limit');

    const result = await getMigrationMetrics({
      collection,
      operationType,
      limit: limit ? parseInt(limit) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch metrics' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('metrics GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
