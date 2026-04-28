import { NextRequest, NextResponse } from 'next/server';
import { getQRCodeByShortPath } from '@/lib/qr-actions';

/**
 * Dynamic QR code redirect handler.
 * GET /q/:shortPath → look up QR code → 302 redirect to destination
 * 
 * Scan event logging is fire-and-forget to avoid blocking the redirect.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortPath: string }> }
) {
  const { shortPath } = await params;

  if (!shortPath) {
    return NextResponse.json({ error: 'Invalid short path' }, { status: 400 });
  }

  try {
    const qr = await getQRCodeByShortPath(shortPath);

    if (!qr) {
      return NextResponse.json(
        { error: 'QR code not found' },
        { status: 404 }
      );
    }

    // If paused, show a simple paused page
    if (qr.status === 'paused') {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head><title>QR Code Paused</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; color: #333; }
              .container { text-align: center; padding: 2rem; }
              h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
              p { color: #666; font-size: 0.9rem; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>This QR code is currently paused</h1>
              <p>The owner has temporarily disabled this link. Please try again later.</p>
            </div>
          </body>
        </html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // If archived, 410 Gone
    if (qr.status === 'archived') {
      return NextResponse.json(
        { error: 'This QR code is no longer active' },
        { status: 410 }
      );
    }

    // Resolve destination URL
    const destinationUrl = qr.destination.url;
    if (!destinationUrl) {
      return NextResponse.json(
        { error: 'No destination configured' },
        { status: 404 }
      );
    }

    // Append UTM parameters if configured
    let finalUrl = destinationUrl;
    try {
      const url = new URL(destinationUrl);
      if (qr.tracking.utmSource) url.searchParams.set('utm_source', qr.tracking.utmSource);
      if (qr.tracking.utmMedium) url.searchParams.set('utm_medium', qr.tracking.utmMedium);
      if (qr.tracking.utmCampaign) url.searchParams.set('utm_campaign', qr.tracking.utmCampaign);
      finalUrl = url.toString();
    } catch {
      // If destination is not a valid URL (e.g. mailto:, sms:), use as-is
      finalUrl = destinationUrl;
    }

    // Fire-and-forget: Log scan event asynchronously
    // Using dynamic import to avoid loading scan-actions unless needed
    logScanAsync(qr, request).catch(() => {
      // Silently fail — scan logging should never block redirects
    });

    // 302 redirect
    return NextResponse.redirect(finalUrl, 302);
  } catch (err) {
    console.error(`[QR Redirect] Error for shortPath=${shortPath}:`, err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Non-blocking scan event logger.
 * Extracts device/browser info from request headers and logs to Firestore.
 */
async function logScanAsync(qr: any, request: NextRequest) {
  try {
    const { recordScanEvent } = await import('@/lib/qr-scan-actions');
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    await recordScanEvent({
      organizationId: qr.organizationId,
      workspaceId: qr.workspaceId,
      qrCodeId: qr.id,
      destinationUrl: qr.destination.url || '',
      resourceType: qr.destination.resourceType,
      resourceId: qr.destination.resourceId,
      userAgent,
      ipRaw: ip,
    });
  } catch (err) {
    console.error('[QR Redirect] Failed to log scan event:', err);
  }
}
