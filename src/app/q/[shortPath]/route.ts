/**
 * @fileoverview Dynamic QR Code Redirect Engine
 * 
 * ROUTE: GET /q/:shortPath
 * 
 * PERFORMANCE & ARCHITECTURAL DIRECTIVES:
 * 1. Low Latency (<50ms): Evaluates lifecycle constraints, shortlink index, and fires
 *    scan telemetry asynchronously without blocking the client's HTTP 302 redirect.
 * 2. Canonical Lifecycle Handling: Evaluates 'draft', 'scheduled', 'paused', 'expired',
 *    'suspended', and 'archived' states with custom branded HTML screens or fallback URLs.
 * 3. Parameter Preservation: Preserves both configured UTM tracking codes and incoming
 *    query parameters passed by the scanner.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQRCodeByShortPath } from '@/lib/qr-actions';
import { evaluateSecurityRules } from '@/lib/qr-helpers';
import type { QRCode } from '@/lib/types';

function renderBrandedStatusPage(options: {
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  subtext?: string;
  actionUrl?: string;
  actionText?: string;
}) {
  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${options.title} — SmartSapp</title>
        <style>
          :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --muted: #94a3b8; --border: #334155; }
          @media (prefers-color-scheme: light) {
            :root { --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; --border: #e2e8f0; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 1.5rem;
          }
          .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 1.25rem;
            padding: 2.5rem 2rem;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          }
          .badge {
            display: inline-block;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 0.35rem 0.85rem;
            border-radius: 9999px;
            margin-bottom: 1.25rem;
            background: ${options.badgeColor}15;
            color: ${options.badgeColor};
            border: 1px solid ${options.badgeColor}30;
          }
          h1 { font-size: 1.35rem; font-weight: 700; margin-bottom: 0.75rem; line-height: 1.3; }
          p { color: var(--muted); font-size: 0.925rem; line-height: 1.6; margin-bottom: 1.25rem; }
          .subtext { font-size: 0.8rem; color: var(--muted); opacity: 0.8; margin-top: 1.5rem; }
          .btn {
            display: inline-block;
            background: #2563eb;
            color: #ffffff;
            font-weight: 600;
            font-size: 0.875rem;
            text-decoration: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.75rem;
            transition: opacity 0.2s ease;
          }
          .btn:hover { opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">${options.badge}</div>
          <h1>${options.title}</h1>
          <p>${options.description}</p>
          ${options.actionUrl ? `<a href="${options.actionUrl}" class="btn">${options.actionText || 'Continue'}</a>` : ''}
          ${options.subtext ? `<div class="subtext">${options.subtext}</div>` : ''}
        </div>
      </body>
    </html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

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

    const now = new Date();
    const fallbackUrl = qr.lifecycleConfig?.fallbackUrl || qr.destination.fallbackUrl;

    // 1. Archived State
    if (qr.status === 'archived') {
      return NextResponse.json(
        { error: 'This QR code is no longer active' },
        { status: 410 }
      );
    }

    // 2. Draft / Suspended State
    if (qr.status === 'draft') {
      return renderBrandedStatusPage({
        badge: 'Draft Mode',
        badgeColor: '#64748b',
        title: 'QR Code in Draft',
        description: 'This QR code has not been published yet. Please contact the administrator.',
      });
    }

    if (qr.status === 'suspended') {
      return renderBrandedStatusPage({
        badge: 'Suspended',
        badgeColor: '#ef4444',
        title: 'Link Temporarily Suspended',
        description: 'This link has been flagged or suspended for review.',
      });
    }

    // 3. Scheduled State Check
    const startAt = qr.lifecycleConfig?.startAt ? new Date(qr.lifecycleConfig.startAt) : null;
    const isScheduled = qr.status === 'scheduled' || (startAt !== null && startAt > now);

    if (isScheduled) {
      if (fallbackUrl) return NextResponse.redirect(fallbackUrl, 302);
      const formattedDate = startAt ? startAt.toUTCString() : 'soon';
      return renderBrandedStatusPage({
        badge: 'Coming Soon',
        badgeColor: '#3b82f6',
        title: 'Campaign Starting Soon',
        description: `This QR code is scheduled to activate on ${formattedDate}.`,
        subtext: 'Please check back once the campaign officially begins.',
      });
    }

    // 4. Expiration State Check (Time-based or Scan threshold)
    const expiresAt = qr.lifecycleConfig?.expiresAt ? new Date(qr.lifecycleConfig.expiresAt) : null;
    const maxScans = qr.lifecycleConfig?.maxScans;
    const isExpired =
      qr.status === 'expired' ||
      (expiresAt !== null && expiresAt <= now) ||
      (typeof maxScans === 'number' && maxScans > 0 && qr.stats.totalScans >= maxScans);

    if (isExpired) {
      if (fallbackUrl) return NextResponse.redirect(fallbackUrl, 302);
      return renderBrandedStatusPage({
        badge: 'Expired',
        badgeColor: '#f59e0b',
        title: 'This Link Has Expired',
        description: 'The campaign or destination associated with this QR code is no longer available.',
        subtext: 'If you believe this is an error, please reach out to the organization.',
      });
    }

    // 5. Paused State Check
    if (qr.status === 'paused') {
      if (fallbackUrl) return NextResponse.redirect(fallbackUrl, 302);
      return renderBrandedStatusPage({
        badge: 'Paused',
        badgeColor: '#8b5cf6',
        title: 'This QR Code is Paused',
        description: 'The owner has temporarily disabled this link. Please try again later.',
      });
    }

    // 6. Enterprise Security Guardrails (Passcode, Geofence, IP Allowlists)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const clientCountry =
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-country') ||
      undefined;

    const isUnlockedCookie = request.cookies.get(`qr_unlocked_${shortPath}`)?.value === '1';
    const isUnlockedParam = request.nextUrl.searchParams.get('unlocked') === 'true';
    const isPasscodeUnlocked = isUnlockedCookie || isUnlockedParam;

    const securityEval = evaluateSecurityRules(qr, clientIp, clientCountry, isPasscodeUnlocked);

    if (!securityEval.allowed) {
      if (securityEval.requiresPasscode) {
        // Redirect to branded PIN unlock screen
        const unlockUrl = new URL(`/q/${shortPath}/unlock`, request.url);
        return NextResponse.redirect(unlockUrl, 302);
      }

      if (fallbackUrl) return NextResponse.redirect(fallbackUrl, 302);

      if (securityEval.reason === 'country_restricted') {
        return renderBrandedStatusPage({
          badge: 'Restricted Location',
          badgeColor: '#ef4444',
          title: 'Access Restricted in Your Region',
          description: securityEval.message || 'This campaign is only accessible within authorized geographical regions.',
        });
      }

      if (securityEval.reason === 'ip_restricted') {
        return renderBrandedStatusPage({
          badge: 'Network Restricted',
          badgeColor: '#ef4444',
          title: 'Access Restricted to Authorized Networks',
          description: securityEval.message || 'Your network IP is not permitted to access this destination.',
        });
      }
    }

    // 7. Destination URL Resolution
    const destinationUrl = qr.destination.url;
    if (!destinationUrl) {
      return NextResponse.json(
        { error: 'No destination configured' },
        { status: 404 }
      );
    }

    // 7. URL Parameter Processing & UTM Forwarding
    let finalUrl = destinationUrl;
    try {
      const url = new URL(destinationUrl);
      if (qr.tracking.utmSource) url.searchParams.set('utm_source', qr.tracking.utmSource);
      if (qr.tracking.utmMedium) url.searchParams.set('utm_medium', qr.tracking.utmMedium);
      if (qr.tracking.utmCampaign) url.searchParams.set('utm_campaign', qr.tracking.utmCampaign);

      // Forward incoming search parameters from the scanner
      request.nextUrl.searchParams.forEach((value, key) => {
        if (!url.searchParams.has(key)) {
          url.searchParams.set(key, value);
        }
      });

      finalUrl = url.toString();
    } catch {
      // Non-HTTP protocols (e.g. mailto:, sms:, tel:) used as-is
      finalUrl = destinationUrl;
    }

    // 8. Fire-and-Forget Asynchronous Scan Telemetry
    logScanAsync(qr, request).catch(() => {
      // Intentionally decoupled — scan logging must never block redirect latency
    });

    // 9. Low Latency 302 Redirection
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
 * Asynchronous, non-blocking scan event logger.
 * Salt-hashes the IP address for GDPR compliance and aggregates scan counters.
 */
async function logScanAsync(qr: QRCode, request: NextRequest): Promise<void> {
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
