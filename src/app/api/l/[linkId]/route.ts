
import { NextRequest, NextResponse } from 'next/server';
import { recordLinkClick } from '@/lib/link-tracking';

/**
 * High-performance redirect route for tracked links.
 * Increments click counts and triggers campaign automations.
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
    // Record the click and get original URL
    // Note: recordLinkClick handles all the fire-and-forget stats/automation logic
    const originalUrl = await recordLinkClick(linkId);

    if (originalUrl) {
      return NextResponse.redirect(new URL(originalUrl));
    }

    // Fallback if link not found
    return NextResponse.redirect(new URL('/', req.url));

  } catch (error) {
    console.error(`[REDIRECT-ERROR] Failed for ${linkId}:`, error);
    return NextResponse.redirect(new URL('/', req.url));
  }
}
