import { NextRequest, NextResponse } from 'next/server';
import { processScheduledMessages } from '@/lib/reminder-actions';

/**
 * Cron endpoint to process scheduled messages.
 * Called by Vercel Cron every minute to send pending scheduled messages.
 * 
 * Security: Validates CRON_SECRET header to prevent unauthorized access.
 */
export async function POST(request: NextRequest) {
  return processCronRequest(request);
}

export async function GET(request: NextRequest) {
  return processCronRequest(request);
}

async function processCronRequest(request: NextRequest) {
  try {
    // Verify cron secret for security (support both Header and Query Param)
    const authHeader = request.headers.get('authorization');
    const querySecret = request.nextUrl.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET environment variable not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      console.warn('[CRON] Unauthorized cron request attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process scheduled messages
    const result = await processScheduledMessages();

    console.log(`[CRON] Processed scheduled messages: ${result.sent} sent, ${result.failed} failed`);

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Error processing scheduled messages:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Prevent caching of this endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
