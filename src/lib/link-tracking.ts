
import { adminDb, FieldValue } from './firebase-admin';
import { nanoid } from 'nanoid';
import { getBaseUrl } from './utils/url-helpers';
import type { TrackedLink, TrackedLinkClickResult, PageEventChannel } from './types';

// ─── Short-ID generator ───────────────────────────────────────────────────────
// 8 Base62 chars = 218 trillion combinations — more than sufficient.
const generateShortId = (): string => nanoid(8);

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Creates a tracked link entry in Firestore and returns the short redirect URL.
 *
 * @param entityId - Optional entity ID attached at creation time.
 *   When present, the redirect route forwards ?ref=<entityId> to the destination
 *   so the landing page can identify the visitor without a separate Firestore read.
 */
export async function createTrackedLink(params: {
  originalUrl: string;
  campaignId: string;
  jobId: string;
  taskId: string;
  entityId?: string;
  channel?: PageEventChannel;
}): Promise<string> {
  const { originalUrl, campaignId, jobId, taskId, entityId, channel } = params;
  const id = generateShortId();

  const linkData: TrackedLink = {
    id,
    originalUrl,
    campaignId,
    jobId,
    taskId,
    clickCount: 0,
    createdAt: new Date().toISOString(),
    ...(entityId !== undefined && { entityId }),
    ...(channel !== undefined && { channel }),
  };

  await adminDb.collection('tracked_links').doc(id).set(linkData);

  const baseUrl = getBaseUrl();
  return `${baseUrl}/go/${id}`;
}

// ─── Read helpers (fast path — used by redirect route) ────────────────────────

/**
 * Fetches the original URL and entity ID for a tracked link.
 *
 * This is the FAST READ path called by the /api/l/[linkId] redirect route.
 * It does NOT update any stats — that is handled by recordLinkClickAsync()
 * which is fired in the background via after() so the 302 is never blocked.
 *
 * @returns TrackedLinkClickResult or null when the link does not exist.
 */
export async function getLinkData(linkId: string): Promise<TrackedLinkClickResult | null> {
  const snap = await adminDb.collection('tracked_links').doc(linkId).get();
  if (!snap.exists) return null;

  const data = snap.data() as TrackedLink;
  return {
    originalUrl: data.originalUrl,
    ...(data.entityId !== undefined && { entityId: data.entityId }),
    ...(data.channel !== undefined && { channel: data.channel }),
  };
}

// ─── Write helpers (async — never block the redirect) ─────────────────────────

/**
 * Records a click for a tracked link and increments campaign stats.
 *
 * Designed to be called inside after() so it never blocks the 302 redirect.
 * Safe to call multiple times — operations are idempotent where possible.
 */
export async function recordLinkClickAsync(linkId: string): Promise<void> {
  try {
    const linkRef = adminDb.collection('tracked_links').doc(linkId);
    const linkSnap = await linkRef.get();

    if (!linkSnap.exists) return;
    const link = linkSnap.data() as TrackedLink;

    // 1. Increment link click count
    await linkRef.update({ clickCount: FieldValue.increment(1) });

    // 2. Increment campaign stats (real-time)
    if (link.campaignId) {
      const { updateCampaignRealtimeStat } = await import('./campaign-analytics');
      await updateCampaignRealtimeStat(link.campaignId, 'totalClicked');
    }

    // 3. Update task status (idempotent — only transitions from non-clicked states)
    if (link.jobId && link.taskId) {
      const taskRef = adminDb
        .collection('message_jobs')
        .doc(link.jobId)
        .collection('tasks')
        .doc(link.taskId);

      await taskRef.update({
        status: 'clicked',
        clickedAt: new Date().toISOString(),
      });

      // 4. Trigger automation hooks
      if (link.campaignId) {
        const { emitSingleCampaignEvent } = await import('./campaign-events');
        const taskSnap = await taskRef.get();
        await emitSingleCampaignEvent({
          campaignId: link.campaignId,
          entityId: (taskSnap.data() as TrackedLink | undefined)?.entityId || '',
          event: 'campaign_clicked',
        });
      }
    }
  } catch (error) {
    console.error(`[LINK-TRACKING] Error recording click for ${linkId}:`, error);
  }
}

async function resolveContactSerial(contactId: string): Promise<number | null> {
  if (!contactId) return null;
  try {
    const docRef = adminDb.collection('contacts').doc(contactId);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data()!;
      let serial = data.contact_serial;
      if (serial === undefined || serial === null) {
        const { getNextSerial } = await import('./services/serial-allocator');
        serial = await getNextSerial('contacts');
        await docRef.update({ contact_serial: serial });
      }
      return serial as number;
    } else {
      // Lazy initialize contact document in root contacts collection
      const { getNextSerial } = await import('./services/serial-allocator');
      const serial = await getNextSerial('contacts');
      await docRef.set({
        contact_serial: serial,
        createdAt: new Date().toISOString()
      }, { merge: true });
      return serial;
    }
  } catch (err) {
    console.error('[resolveContactSerial] Failed:', err);
  }
  return null;
}

async function resolvePageSerialAndType(urlStr: string): Promise<{ pageSerial: number; type: string; id: string } | null> {
  try {
    const url = new URL(urlStr);
    const pathname = url.pathname;

    // 1. Survey matching (/surveys/[slug])
    if (pathname.includes('/surveys/')) {
      const parts = pathname.split('/');
      const slug = parts[parts.indexOf('surveys') + 1];
      if (slug) {
        const snap = await adminDb.collection('surveys')
          .where('slug', '==', slug)
          .limit(1)
          .get();
        let doc = snap.empty ? null : snap.docs[0];
        if (!doc) {
          // Fallback: check document ID
          const directSnap = await adminDb.collection('surveys').doc(slug).get();
          if (directSnap.exists) doc = directSnap;
        }
        if (doc) {
          let serial = doc.data()?.page_serial;
          if (serial === undefined || serial === null) {
            const { getNextSerial } = await import('./services/serial-allocator');
            serial = await getNextSerial('pages');
            await doc.ref.update({ page_serial: serial });
          }
          return { pageSerial: serial, type: 'survey', id: doc.id };
        }
      }
    }

    // 2. Forms matching (/forms/[pdfId] or /f/[pdfId])
    if (pathname.includes('/forms/') || pathname.includes('/f/')) {
      const parts = pathname.split('/');
      const trigger = pathname.includes('/forms/') ? 'forms' : 'f';
      const pdfId = parts[parts.indexOf(trigger) + 1];
      if (pdfId) {
        const snap = await adminDb.collection('pdfs').doc(pdfId).get();
        if (snap.exists) {
          let serial = snap.data()?.page_serial;
          if (serial === undefined || serial === null) {
            const { getNextSerial } = await import('./services/serial-allocator');
            serial = await getNextSerial('pages');
            await snap.ref.update({ page_serial: serial });
          }
          return { pageSerial: serial, type: 'pdf', id: snap.id };
        }
      }
    }

    // 3. Media matching (/m/[shareId])
    if (pathname.includes('/m/')) {
      const parts = pathname.split('/');
      const shareId = parts[parts.indexOf('m') + 1];
      if (shareId) {
        const snap = await adminDb.collection('media_shares').doc(shareId).get();
        if (snap.exists) {
          let serial = snap.data()?.page_serial;
          if (serial === undefined || serial === null) {
            const { getNextSerial } = await import('./services/serial-allocator');
            serial = await getNextSerial('pages');
            await snap.ref.update({ page_serial: serial });
          }
          return { pageSerial: serial, type: 'media', id: snap.id };
        }
      }
    }

    // 4. Booking matching (/book/[bookingId] or /meetings/[bookingId])
    if (pathname.includes('/book/') || pathname.includes('/meetings/')) {
      const parts = pathname.split('/');
      const trigger = pathname.includes('/book/') ? 'book' : 'meetings';
      const bookingId = parts[parts.indexOf(trigger) + 1];
      if (bookingId && bookingId !== 'parent-engagement') {
        const snap = await adminDb.collection('booking_pages').doc(bookingId).get();
        if (snap.exists) {
          let serial = snap.data()?.page_serial;
          if (serial === undefined || serial === null) {
            const { getNextSerial } = await import('./services/serial-allocator');
            serial = await getNextSerial('pages');
            await snap.ref.update({ page_serial: serial });
          }
          return { pageSerial: serial, type: 'booking', id: snap.id };
        }
      }
    }
  } catch (err) {
    // URL parsing failed or Firestore query failed
  }
  return null;
}

export async function transformBodyWithTracking(params: {
  body: string;
  campaignId: string;
  jobId: string;
  taskId: string;
  entityId?: string;
  contactId?: string;
  channel?: PageEventChannel;
}): Promise<string> {
  const { body, campaignId, jobId, taskId, entityId, contactId, channel } = params;

  // URL regex — matches http(s) URLs, stops at whitespace and common HTML terminators
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

  const allMatches = body.match(urlRegex);
  if (!allMatches) return body;

  // Deduplicate — create one tracked link per unique URL (not per occurrence)
  const uniqueUrls = [...new Set(allMatches)];

  // Create all tracked links in parallel
  const trackedUrls = await Promise.all(
    uniqueUrls.map(async (url) => {
      // If contactId is provided, check if it's an internal page we can shorten statelessly to 11 chars
      if (contactId) {
        try {
          const contactSerial = await resolveContactSerial(contactId);
          const pageInfo = await resolvePageSerialAndType(url);
          
          if (contactSerial !== null && pageInfo !== null) {
            const { encrypt64, packSerials, encodeBase58 } = await import('./utils/short-crypto');
            const cipher = encrypt64(packSerials(contactSerial, pageInfo.pageSerial));
            const token = encodeBase58(cipher);
            const baseUrl = getBaseUrl();
            return `${baseUrl}/go/${token}`;
          }
        } catch (err) {
          console.warn('[transformBodyWithTracking] Failed stateless link resolution:', err);
        }
      }
      return createTrackedLink({ originalUrl: url, campaignId, jobId, taskId, entityId, channel });
    })
  );

  // Build O(1) lookup map
  const urlMap = new Map<string, string>(
    uniqueUrls.map((url, i) => [url, trackedUrls[i]])
  );

  // Replace all occurrences (same URL may appear multiple times — all become same short link)
  return body.replace(urlRegex, (match) => urlMap.get(match) ?? match);
}

// ─── Legacy shim ─────────────────────────────────────────────────────────────
/**
 * @deprecated Use getLinkData() + recordLinkClickAsync() separately.
 *   This shim exists only to avoid breaking any callers outside the redirect route
 *   that may still call recordLinkClick(). It will be removed in a future cleanup pass.
 */
export async function recordLinkClick(linkId: string): Promise<string | null> {
  const data = await getLinkData(linkId);
  if (!data) return null;
  // Fire stats asynchronously — do not await
  recordLinkClickAsync(linkId).catch(() => {});
  return data.originalUrl;
}
