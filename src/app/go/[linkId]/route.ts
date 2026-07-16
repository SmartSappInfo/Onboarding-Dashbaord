import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getLinkData, recordLinkClickAsync } from '@/lib/link-tracking';
import { adminDb } from '@/lib/firebase-admin';
import type { PageEventChannel } from '@/lib/types';

/**
 * High-performance redirect route for multi-channel tracked links.
 * Supports:
 * 1. Stateful 8-character codes (`tracked_links` collection read + click analytics).
 * 2. Stateless 11-character encrypted codes (Feistel decryption + context cookie propagation).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;

  if (!linkId) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // CASE 1: Stateless 11-Character Cryptographic Token
  if (linkId.length === 11) {
    try {
      const { decodeBase58, decrypt64, unpackSerials } = await import('@/lib/utils/short-crypto');
      const decryptedVal = decrypt64(decodeBase58(linkId));
      const { contactSerial, pageSerial } = unpackSerials(decryptedVal);

      // Look up contact by unique contact_serial
      const contactSnap = await adminDb.collection('contacts')
        .where('contact_serial', '==', contactSerial)
        .limit(1)
        .get();

      if (contactSnap.empty) {
        console.warn(`[REDIRECT] Contact serial not found: ${contactSerial}`);
        return NextResponse.redirect(new URL('/', req.url));
      }

      const contactDoc = contactSnap.docs[0];
      const contactId = contactDoc.id;
      const contactData = contactDoc.data();
      const entityId = contactData.entityId || '';
      const workspaceId = contactData.workspaceId || '';

      // Look up target page route by unique page_serial
      let originalUrl = '';
      let workspaceIds: string[] = [];

      // 1. Search Surveys
      const surveySnap = await adminDb.collection('surveys')
        .where('page_serial', '==', pageSerial)
        .limit(1)
        .get();
      if (!surveySnap.empty) {
        const data = surveySnap.docs[0].data();
        originalUrl = `/surveys/${data.slug || surveySnap.docs[0].id}`;
        workspaceIds = data.workspaceIds || [];
      } else {
        // 2. Search PDF Forms
        const pdfSnap = await adminDb.collection('pdfs')
          .where('page_serial', '==', pageSerial)
          .limit(1)
          .get();
        if (!pdfSnap.empty) {
          const data = pdfSnap.docs[0].data();
          originalUrl = `/forms/${pdfSnap.docs[0].id}`;
          workspaceIds = data.workspaceIds || [];
        } else {
          // 3. Search Media Shares
          const mediaSnap = await adminDb.collection('media_shares')
            .where('page_serial', '==', pageSerial)
            .limit(1)
            .get();
          if (!mediaSnap.empty) {
            const data = mediaSnap.docs[0].data();
            originalUrl = `/m/${mediaSnap.docs[0].id}`;
            workspaceIds = [data.workspaceId].filter(Boolean);
          } else {
            // 4. Search Booking Pages
            const bookingSnap = await adminDb.collection('booking_pages')
              .where('page_serial', '==', pageSerial)
              .limit(1)
              .get();
            if (!bookingSnap.empty) {
              const data = bookingSnap.docs[0].data();
              originalUrl = `/book/${bookingSnap.docs[0].id}`;
              workspaceIds = [data.workspaceId].filter(Boolean);
            }
          }
        }
      }

      if (!originalUrl) {
        console.warn(`[REDIRECT] Page serial not found: ${pageSerial}`);
        return NextResponse.redirect(new URL('/', req.url));
      }

      // Write secure cookie with contact details and issue redirect
      const { encryptToken } = await import('@/lib/crypto');
      const response = NextResponse.redirect(new URL(originalUrl, req.url), 302);
      
      const payload = JSON.stringify({
        contactId,
        entityId,
        workspaceId: workspaceId || workspaceIds[0] || ''
      });

      response.cookies.set('__onb_context', encryptToken(payload), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 86400 // 24 hours
      });

      return response;
    } catch (err) {
      console.error(`[REDIRECT-STATELESS-ERROR] Failed for ${linkId}:`, err);
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // CASE 2: Stateful 8-Character Link
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
