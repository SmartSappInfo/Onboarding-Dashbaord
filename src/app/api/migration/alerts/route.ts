/**
 * API Route: Migration Alerts
 * 
 * Get and acknowledge migration alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMigrationAlerts, acknowledgeMigrationAlert } from '@/lib/migration-monitoring';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get('collection') || undefined;
    const acknowledged = searchParams.get('acknowledged');
    const limit = searchParams.get('limit');

    const result = await getMigrationAlerts({
      collection,
      acknowledged: acknowledged ? acknowledged === 'true' : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch alerts' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('alerts GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, acknowledgedBy } = body;

    if (!alertId || !acknowledgedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: alertId, acknowledgedBy' },
        { status: 400 }
      );
    }

    const result = await acknowledgeMigrationAlert(alertId, acknowledgedBy);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to acknowledge alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('alerts POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to acknowledge alert' },
      { status: 500 }
    );
  }
}
