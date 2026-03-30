/**
 * API Route: Migration Dashboard
 * 
 * Returns migration dashboard summary with metrics, alerts, and recent operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMigrationDashboardSummary } from '@/lib/migration-monitoring';

export async function GET(request: NextRequest) {
  try {
    const result = await getMigrationDashboardSummary();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch dashboard summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('dashboard error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}
