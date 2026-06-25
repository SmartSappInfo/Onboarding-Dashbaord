import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken, processUnsubscribe } from '@/lib/services/unsubscribe-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const recipient = searchParams.get('recipient') || '';
    const token = searchParams.get('token') || '';
    const workspaceId = searchParams.get('ws') || 'global';

    if (!recipient || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify cryptographic HMAC signature to prevent malicious opt-outs
    const isValid = verifyUnsubscribeToken(recipient, token);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // 2. Read the body format (Must carry List-Unsubscribe=One-Click)
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      if (text !== 'List-Unsubscribe=One-Click') {
         return NextResponse.json({ error: 'Invalid body contents' }, { status: 400 });
      }
    }

    // 3. Apply opt-out suppression
    await processUnsubscribe(recipient, {
      emailStatus: 'unsubscribed',
      workspaceId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[RFC-8058-UNSUBSCRIBE] Failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal processing error: ${message}` }, { status: 500 });
  }
}
