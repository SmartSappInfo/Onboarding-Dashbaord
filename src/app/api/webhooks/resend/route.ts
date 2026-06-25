import { NextResponse } from 'next/server';

/**
 * @fileOverview DEPRECATED Resend webhook receiver.
 *
 * This route performed UNVERIFIED (no Svix signature) writes to `message_logs`
 * and has been superseded by the canonical, Svix-verified handler at
 * `/api/webhooks/messaging/resend`, which covers both the campaign path and the
 * automation/transactional `message_logs` + per-node stats path.
 *
 * Point your Resend webhook at `/api/webhooks/messaging/resend`. This endpoint is
 * intentionally inert to avoid processing unauthenticated events.
 */
export async function POST(): Promise<NextResponse> {
  console.warn(
    '>>> [WEBHOOK:RESEND] Deprecated endpoint hit. Configure Resend to use /api/webhooks/messaging/resend.'
  );
  return NextResponse.json(
    {
      error: 'Deprecated endpoint',
      use: '/api/webhooks/messaging/resend',
    },
    { status: 410 }
  );
}
