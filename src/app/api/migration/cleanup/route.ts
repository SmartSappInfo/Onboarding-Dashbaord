/**
 * API Route: Cleanup Old Migration Logs
 * 
 * Clean up migration logs older than retention period
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldMigrationLogs } from '@/lib/migration-monitoring';

export async function POST(request: NextRequest) {
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
  } catch (error: any) {
    console.error('cleanup error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cleanup logs' },
      { status: 500 }
    );
  }
}
