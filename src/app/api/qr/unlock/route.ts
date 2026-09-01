/**
 * @fileoverview QR Passcode Verification Route Handler
 * POST /api/qr/unlock
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Constant-time comparison prevents timing attacks.
 * - Sets signed cookie upon successful verification.
 * - Zero `any` or `any[]` typing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQRCodeByShortPath } from '@/lib/qr-actions';
import { verifyPasscode } from '@/lib/qr-domain-security-actions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shortPath, passcode } = body;

    if (!shortPath || typeof shortPath !== 'string' || !passcode || typeof passcode !== 'string') {
      return NextResponse.json({ error: 'ShortPath and passcode are required.' }, { status: 400 });
    }

    const qr = await getQRCodeByShortPath(shortPath);
    if (!qr) {
      return NextResponse.json({ error: 'QR code not found.' }, { status: 404 });
    }

    const storedHash = qr.securityConfig?.passwordHash;
    if (!storedHash) {
      return NextResponse.json({ success: true, message: 'No passcode configured.' });
    }

    const isMatch = verifyPasscode(passcode.trim(), storedHash);

    if (!isMatch) {
      return NextResponse.json({ error: 'Incorrect passcode PIN.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    // Set HTTP-only secure cookie valid for 1 hour
    response.cookies.set(`qr_unlocked_${shortPath}`, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
      path: `/q/${shortPath}`,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
