/**
 * API Route: Export Migration Logs
 * 
 * Export migration logs for audit purposes
 */

import { NextRequest, NextResponse } from 'next/server';
import { exportMigrationLogs } from '@/lib/migration-monitoring';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get('collection') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const result = await exportMigrationLogs({
      collection,
      startDate,
      endDate,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to export logs' },
        { status: 500 }
      );
    }

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(result.data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="migration-logs-${new Date().toISOString()}.json"`,
      },
    });
  } catch (error: any) {
    console.error('export error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export logs' },
      { status: 500 }
    );
  }
}
