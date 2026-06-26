import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getLinkData, recordLinkClickAsync } from '@/lib/link-tracking';
import type { PageEventChannel } from '@/lib/types';

/**
 * High-performance redirect route for multi-channel tracked links.
 *
 * Architecture:
 * 1. getLinkData()         — fast Firestore read for originalUrl, entityId, and channel
 * 2. Build redirect URL    — append ?ref=<entityId>&ch=<channel>
 * 3. 302 redirect          — fires immediately, never blocked by analytics
 * 4. recordLinkClickAsync  — stats, campaign increments, automation hooks
 *                            run in after() so they never delay the redirect
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;

  if (!linkId) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  try {
    const linkData = await getLinkData(linkId);

    if (!linkData) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Build the destination URL, forwarding entity identity and channel
    const destinationUrl = buildDestinationUrl(linkData.originalUrl, linkData.entityId, linkData.channel);

    // Fire analytics in the background — 302 is never blocked
    after(async () => {
      await recordLinkClickAsync(linkId);
    });

    return NextResponse.redirect(new URL(destinationUrl), 302);
  } catch (error) {
    console.error(`[REDIRECT-ERROR] Failed for ${linkId}:`, error);
    return NextResponse.redirect(new URL('/', req.url));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Appends ?ref=<entityId>&ch=<channel> to a destination URL.
 * Preserves any existing query parameters on the original URL.
 */
function buildDestinationUrl(originalUrl: string, entityId?: string, channel?: PageEventChannel): string {
  try {
    const url = new URL(originalUrl);
    if (entityId) url.searchParams.set('ref', entityId);
    if (channel) url.searchParams.set('ch', channel);
    return url.toString();
  } catch {
    // Fallback for malformed URLs
    let out = originalUrl;
    if (entityId) {
      out += out.includes('?') ? '&' : '?';
      out += `ref=${encodeURIComponent(entityId)}`;
    }
    if (channel) {
      out += out.includes('?') ? '&' : '?';
      out += `ch=${encodeURIComponent(channel)}`;
    }
    return out;
  }
}
