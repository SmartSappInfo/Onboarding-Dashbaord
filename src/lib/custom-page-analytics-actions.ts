
'use server';

import { adminDb, FieldValue } from './firebase-admin';
import type {
  PageEventType,
  PageEventChannel,
  CustomPageEvent,
  CustomPageStats,
  CustomPageAnalyticsDoc,
  CustomPageEventWithEntity,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ANALYTICS_COLLECTION = 'custom_page_analytics';

/** Default stats document — used when a page doc doesn't exist yet. */
const DEFAULT_STATS: CustomPageStats = {
  views: 0,
  uniqueViews: 0,
  videoStarts: 0,
  videoCompletions: 0,
  videoReplays: 0,
  ctaClicks: 0,
};

// ─── Stat increment mapping ───────────────────────────────────────────────────

/**
 * Maps a PageEventType to the stats field it should increment.
 * Returns null for events that don't increment a stats counter directly.
 */
function statFieldForEvent(type: PageEventType): keyof CustomPageStats | null {
  const map: Record<PageEventType, keyof CustomPageStats | null> = {
    page_view: 'views',
    video_start: 'videoStarts',
    video_complete: 'videoCompletions',
    video_replay: 'videoReplays',
    cta_click: 'ctaClicks',
  };
  return map[type] ?? null;
}

// ─── Write actions ────────────────────────────────────────────────────────────

/**
 * Records a single page event.
 *
 * Operations performed atomically where possible:
 * 1. Append to events/{autoId} subcollection
 * 2. Increment the corresponding stats field with FieldValue.increment (no race condition)
 * 3. For page_view: attempt to register the sessionId in sessions/{sessionId}.
 *    If the session already exists the set is a no-op and uniqueViews is NOT incremented.
 *
 * Designed to be called fire-and-forget from the client:
 *   recordCustomPageEvent({...}).catch(() => {});
 */
export async function recordCustomPageEvent(params: {
  slug: string;
  type: PageEventType;
  entityId?: string;
  sessionId: string;
  channel: PageEventChannel;
}): Promise<void> {
  const { slug, type, entityId, sessionId, channel } = params;

  const pageRef = adminDb.collection(ANALYTICS_COLLECTION).doc(slug);
  const now = new Date().toISOString();

  const event: CustomPageEvent = {
    type,
    sessionId,
    channel,
    timestamp: now,
    ...(entityId !== undefined && { entityId }),
  };

  // Batch: event append + stats increment (two writes, both atomic)
  const batch = adminDb.batch();

  // 1. Append event
  const eventRef = pageRef.collection('events').doc();
  batch.set(eventRef, event);

  // 2. Increment primary stat counter
  const statField = statFieldForEvent(type);
  if (statField) {
    batch.set(
      pageRef,
      {
        slug,
        stats: { [statField]: FieldValue.increment(1) },
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await batch.commit();

  // 3. Handle uniqueViews separately — must be conditional on session existence
  if (type === 'page_view') {
    await incrementUniqueViewIfNew({ pageRef, sessionId, entityId, channel, now });
  }
}

/**
 * Attempts to register a new session.
 * If the session document already exists (returning visitor), uniqueViews is not incremented.
 * Uses Firestore create semantics (ALREADY_EXISTS error = duplicate session).
 */
async function incrementUniqueViewIfNew(params: {
  pageRef: FirebaseFirestore.DocumentReference;
  sessionId: string;
  entityId?: string;
  channel: PageEventChannel;
  now: string;
}): Promise<void> {
  const { pageRef, sessionId, entityId, channel, now } = params;

  const sessionRef = pageRef.collection('sessions').doc(sessionId);
  try {
    await adminDb.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(sessionRef);
      if (sessionSnap.exists) return; // Already seen — no uniqueViews increment

      tx.set(sessionRef, {
        firstSeen: now,
        channel,
        ...(entityId !== undefined && { entityId }),
      });

      tx.set(
        pageRef,
        { stats: { uniqueViews: FieldValue.increment(1) }, updatedAt: now },
        { merge: true }
      );
    });
  } catch {
    // Non-fatal — uniqueViews deduplication is best-effort
  }
}

// ─── Read actions ─────────────────────────────────────────────────────────────

export interface CustomPageAnalyticsResult {
  stats: CustomPageStats;
  recentEvents: CustomPageEventWithEntity[];
  anonymousCount: number;
  totalKnownContacts: number;
}

/**
 * Fetches aggregate stats and the most recent 100 events for a page.
 * Enriches known events with entity display names via a batched entity lookup.
 *
 * Read path is intentionally simple — stats are pre-aggregated on write
 * so this is always a constant-time read regardless of total event volume.
 */
export async function getCustomPageAnalytics(slug: string): Promise<CustomPageAnalyticsResult> {
  const pageRef = adminDb.collection(ANALYTICS_COLLECTION).doc(slug);

  const [pageSnap, eventsSnap] = await Promise.all([
    pageRef.get(),
    pageRef
      .collection('events')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get(),
  ]);

  const pageData = pageSnap.exists
    ? (pageSnap.data() as CustomPageAnalyticsDoc)
    : null;

  const stats: CustomPageStats = pageData?.stats ?? { ...DEFAULT_STATS };

  // Collect unique entity IDs from recent events
  const rawEvents = eventsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<CustomPageEvent, 'id'>),
  })) as CustomPageEvent[];

  const entityIds = [
    ...new Set(rawEvents.filter((e) => e.entityId).map((e) => e.entityId as string)),
  ];

  // Fetch entity display names in parallel (one read per entity — bounded by LIMIT 100)
  const entityNameMap = await buildEntityNameMap(entityIds);

  const recentEvents: CustomPageEventWithEntity[] = rawEvents.map((event) => ({
    ...event,
    ...(event.entityId && {
      entityDisplayName: entityNameMap.get(event.entityId),
    }),
  }));

  const anonymousCount = rawEvents.filter((e) => !e.entityId).length;
  const totalKnownContacts = entityIds.length;

  return { stats, recentEvents, anonymousCount, totalKnownContacts };
}

/**
 * Returns a summary list of all tracked pages (for the /admin/analytics/custom-pages list).
 */
export async function listTrackedPages(): Promise<
  { slug: string; stats: CustomPageStats; updatedAt: string }[]
> {
  const snap = await adminDb
    .collection(ANALYTICS_COLLECTION)
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get();

  return snap.docs.map((d) => {
    const data = d.data() as CustomPageAnalyticsDoc;
    return {
      slug: data.slug,
      stats: data.stats ?? { ...DEFAULT_STATS },
      updatedAt: data.updatedAt ?? '',
    };
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Builds a Map<entityId, displayName> for a list of entity IDs.
 * Tries the 'entities' collection first (institutions/families), then 'contacts'.
 * Falls back to the entity ID itself if nothing is found.
 */
async function buildEntityNameMap(entityIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (entityIds.length === 0) return map;

  // Firestore 'in' queries are capped at 30 — chunk accordingly
  const CHUNK = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < entityIds.length; i += CHUNK) {
    chunks.push(entityIds.slice(i, i + CHUNK));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const [entitySnaps, contactSnaps] = await Promise.all([
        adminDb
          .collection('entities')
          .where('__name__', 'in', chunk)
          .select('name', 'displayName')
          .get(),
        adminDb
          .collection('contacts')
          .where('__name__', 'in', chunk)
          .select('name', 'displayName', 'firstName', 'lastName')
          .get(),
      ]);

      entitySnaps.docs.forEach((d) => {
        const data = d.data() as { name?: string; displayName?: string };
        map.set(d.id, data.displayName ?? data.name ?? d.id);
      });

      contactSnaps.docs.forEach((d) => {
        if (!map.has(d.id)) {
          const data = d.data() as {
            name?: string;
            displayName?: string;
            firstName?: string;
            lastName?: string;
          };
          const fullName =
            data.displayName ??
            data.name ??
            ([data.firstName, data.lastName].filter(Boolean).join(' ') ||
            d.id);
          map.set(d.id, fullName);
        }
      });
    })
  );

  // Fallback — use entity ID if no document found
  entityIds.forEach((id) => {
    if (!map.has(id)) map.set(id, id);
  });

  return map;
}
