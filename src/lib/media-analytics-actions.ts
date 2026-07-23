'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';
import { adminDb, FieldValue } from './firebase-admin';
import type { CallOutcomeAutomation } from './types';

// ─── Types & Interfaces ──────────────────────────────────────────────────────

export type MediaPageEventType =
  | 'view'
  | 'cta_click'
  | 'download'
  | 'media_play'
  | 'media_progress'
  | 'media_complete';

export interface MediaPageEvent {
  id?: string;
  type: MediaPageEventType;
  sessionId: string;
  timestamp: string;
  contactId: string | null;
  progressPercent: number | null;
  sessionTimeSeconds: number | null;
}

export interface MediaPageEventWithContact extends MediaPageEvent {
  contactName?: string;
}

export interface MediaPageStats {
  views: number;
  uniqueViews: number;
  ctaClicks: number;
  downloads: number;
  mediaPlays: number;
  mediaCompletions: number;
  mediaHalfway: number;
}

export interface MediaSessionRecord {
  sessionId: string;
  contactId: string | null;
  firstSeen: string;
  ctaClicked: boolean;
  downloaded: boolean;
  maxProgress: number;
  sessionTimeSeconds: number;
  updatedAt: string;
  userAgents?: string[];
}

export interface MediaSessionRecordWithContact extends MediaSessionRecord {
  contactName?: string;
}

export interface MediaShareAnalyticsDoc {
  shareId: string;
  workspaceId: string;
  assetId: string;
  stats: MediaPageStats;
  updatedAt: string;
}

export interface MediaAnalyticsResult {
  stats: MediaPageStats;
  recentEvents: MediaPageEventWithContact[];
  sessions: MediaSessionRecordWithContact[];
  anonymousCount: number;
  totalKnownContacts: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ANALYTICS_COLLECTION = 'media_share_analytics';

const DEFAULT_STATS: MediaPageStats = {
  views: 0,
  uniqueViews: 0,
  ctaClicks: 0,
  downloads: 0,
  mediaPlays: 0,
  mediaCompletions: 0,
  mediaHalfway: 0,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function statFieldForEvent(type: MediaPageEventType): keyof MediaPageStats | null {
  const map: Record<MediaPageEventType, keyof MediaPageStats | null> = {
    view: 'views',
    cta_click: 'ctaClicks',
    download: 'downloads',
    media_play: 'mediaPlays',
    media_progress: null, // Custom handled
    media_complete: 'mediaCompletions',
  };
  return map[type] ?? null;
}

// ─── Write Actions ────────────────────────────────────────────────────────────

/**
 * Records a single media page tracking event.
 * Appends the event to events subcollection and atomically increments parent aggregates.
 */
export async function recordMediaPageEventAction(params: {
  shareId: string;
  workspaceId: string;
  assetId: string;
  type: MediaPageEventType;
  sessionId: string;
  contactId?: string | null;
  entityId?: string | null;
  progressPercent?: number;
  sessionTimeSeconds?: number;
}): Promise<{ success: boolean; error?: string }> {
  const {
    shareId,
    workspaceId,
    assetId,
    type,
    sessionId,
    contactId = null,
    entityId = null,
    progressPercent = null,
    sessionTimeSeconds = null,
  } = params;

  if (!shareId || !workspaceId || !assetId) {
    return { success: false, error: 'Missing required configuration parameters.' };
  }

  try {
    let userAgent = 'Unknown';
    try {
      const headersList = await headers();
      userAgent = headersList.get('user-agent') || 'Unknown';
    } catch {
      // Safe fallback for testing or non-request contexts
    }

    const pageRef = adminDb.collection(ANALYTICS_COLLECTION).doc(shareId);
    const now = new Date().toISOString();

    const event: MediaPageEvent = {
      type,
      sessionId,
      timestamp: now,
      contactId: contactId || null,
      progressPercent: progressPercent !== null && progressPercent !== undefined ? Number(progressPercent) : null,
      sessionTimeSeconds: sessionTimeSeconds !== null && sessionTimeSeconds !== undefined ? Number(sessionTimeSeconds) : null,
    };

    const batch = adminDb.batch();

    // 1. Log event
    const eventRef = pageRef.collection('events').doc();
    batch.set(eventRef, event);

    // 2. Increment stats counters
    const stats: Record<string, unknown> = {};
    const primaryStat = statFieldForEvent(type);
    if (primaryStat) {
      stats[primaryStat] = FieldValue.increment(1);
    }

    if (type === 'media_progress' && progressPercent === 50) {
      stats.mediaHalfway = FieldValue.increment(1);
    }

    // Set document meta and aggregate counters
    batch.set(
      pageRef,
      {
        shareId,
        workspaceId,
        assetId,
        updatedAt: now,
        ...(Object.keys(stats).length > 0 ? { stats } : {}),
      },
      { merge: true }
    );

    await batch.commit();

    // 3. Track unique views session transaction
    if (type === 'view') {
      const sessionRef = pageRef.collection('sessions').doc(sessionId);
      await adminDb.runTransaction(async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (sessionSnap.exists) return;

        transaction.set(sessionRef, {
          sessionId,
          contactId: contactId || null,
          firstSeen: now,
          ctaClicked: false,
          downloaded: false,
          maxProgress: 0,
          sessionTimeSeconds: 0,
          updatedAt: now,
          userAgents: [userAgent],
        });

        transaction.set(
          pageRef,
          {
            stats: {
              uniqueViews: FieldValue.increment(1),
            },
          },
          { merge: true }
        );
      });
    } else {
      // Keep session record state matching current updates (self-healing for out-of-order logs)
      const sessionRef = pageRef.collection('sessions').doc(sessionId);
      await adminDb.runTransaction(async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);

        const updates: Partial<MediaSessionRecord> = {
          updatedAt: now,
        };

        const oldAgents = sessionSnap.exists
          ? ((sessionSnap.data() as MediaSessionRecord).userAgents || [])
          : [];
        if (!oldAgents.includes(userAgent)) {
          updates.userAgents = [...oldAgents, userAgent];
        }

        if (type === 'cta_click') updates.ctaClicked = true;
        if (type === 'download') updates.downloaded = true;

        const currentMaxProgress = sessionSnap.exists
          ? ((sessionSnap.data() as MediaSessionRecord).maxProgress || 0)
          : 0;
        if (progressPercent !== null && progressPercent !== undefined) {
          updates.maxProgress = Math.max(currentMaxProgress, progressPercent);
        } else {
          updates.maxProgress = currentMaxProgress;
        }

        const currentSessionTime = sessionSnap.exists
          ? ((sessionSnap.data() as MediaSessionRecord).sessionTimeSeconds || 0)
          : 0;
        if (sessionTimeSeconds !== null && sessionTimeSeconds !== undefined) {
          updates.sessionTimeSeconds = Math.max(currentSessionTime, sessionTimeSeconds);
        } else {
          updates.sessionTimeSeconds = currentSessionTime;
        }

        if (!sessionSnap.exists) {
          // Initialize session record
          transaction.set(sessionRef, {
            sessionId,
            contactId: contactId || null,
            firstSeen: now,
            ctaClicked: updates.ctaClicked || false,
            downloaded: updates.downloaded || false,
            maxProgress: updates.maxProgress || 0,
            sessionTimeSeconds: updates.sessionTimeSeconds || 0,
            updatedAt: now,
            userAgents: updates.userAgents || [userAgent],
          });

          // Increment uniqueViews on parent page record since this is a new session
          transaction.set(
            pageRef,
            {
              stats: {
                uniqueViews: FieldValue.increment(1),
              },
            },
            { merge: true }
          );
        } else {
          // Update existing session record
          transaction.update(sessionRef, updates);
        }
      });
    }

    // 4. Trigger event-based CRM automations asynchronously (non-blocking)
    let triggerKey: string | null = null;
    if (type === 'view') {
      triggerKey = 'on_view';
    } else if (type === 'media_play') {
      triggerKey = 'on_play';
    } else if (type === 'media_progress') {
      if (progressPercent === 25) triggerKey = 'on_progress_25';
      else if (progressPercent === 50) triggerKey = 'on_progress_50';
      else if (progressPercent === 75) triggerKey = 'on_progress_75';
    } else if (type === 'media_complete') {
      triggerKey = 'on_complete';
    } else if (type === 'cta_click') {
      triggerKey = 'on_cta_click';
    } else if (type === 'download') {
      triggerKey = 'on_download';
    }

    if (entityId && triggerKey) {
      try {
        after(async () => {
          try {
            const configSnap = await adminDb.collection('media_shares').doc(shareId).get();
            if (configSnap.exists) {
              const data = configSnap.data();
              const automationRules = data?.automationRules as Record<string, CallOutcomeAutomation[]> | undefined;
              const rules = automationRules?.[triggerKey!];

              if (rules && rules.length > 0) {
                const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
                const organizationId = wsSnap.exists ? wsSnap.data()?.organizationId || 'default' : 'default';

                const { CallCentreService } = await import('./services/call-centre-service');
                for (const rule of rules) {
                  const result = await CallCentreService.executeScriptAction({
                    actionType: rule.type,
                    actionConfig: rule.params,
                    entityId,
                    userId: 'system-media-automation',
                    workspaceId,
                    organizationId,
                    contactId: contactId || undefined,
                  });
                  if (!result.success && !result.unsupported) {
                    console.error(`>>> [MEDIA_AUTOMATION] Automation rule "${rule.type}" failed:`, result.error);
                  }
                }
              }
            }
          } catch (execErr) {
            console.error('[MEDIA_AUTOMATION] Error running media page trigger rules:', execErr);
          }
        });
      } catch {
        // Fallback for non-after runtimes (e.g. testing)
        Promise.resolve().then(async () => {
          try {
            const configSnap = await adminDb.collection('media_shares').doc(shareId).get();
            if (configSnap.exists) {
              const data = configSnap.data();
              const automationRules = data?.automationRules as Record<string, CallOutcomeAutomation[]> | undefined;
              const rules = automationRules?.[triggerKey!];

              if (rules && rules.length > 0) {
                const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
                const organizationId = wsSnap.exists ? wsSnap.data()?.organizationId || 'default' : 'default';

                const { CallCentreService } = await import('./services/call-centre-service');
                for (const rule of rules) {
                  await CallCentreService.executeScriptAction({
                    actionType: rule.type,
                    actionConfig: rule.params,
                    entityId,
                    userId: 'system-media-automation',
                    workspaceId,
                    organizationId,
                    contactId: contactId || undefined,
                  });
                }
              }
            }
          } catch (err) {
            console.error('[MEDIA_AUTOMATION] Fallback execute rules failed:', err);
          }
        }).catch(err => console.error('[MEDIA_AUTOMATION] Fallback run failed:', err));
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[recordMediaPageEventAction] Error recording event:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown database error' };
  }
}

// ─── Read Actions ─────────────────────────────────────────────────────────────

/**
 * Returns all media shares and their pre-aggregated stats for a specific workspace.
 */
export async function listMediaSharesWithStatsAction(
  workspaceId: string
): Promise<{ shareId: string; title: string; type: string; stats: MediaPageStats; updatedAt: string }[]> {
  if (!workspaceId) return [];

  try {
    // 1. Fetch configs
    const configsSnap = await adminDb
      .collection('media_shares')
      .where('workspaceId', '==', workspaceId)
      .get();

    if (configsSnap.empty) return [];

    const shareIds = configsSnap.docs.map((d) => d.id);
    const configMap = new Map(
      configsSnap.docs.map((d) => {
        const data = d.data();
        return [d.id, { title: String(data.title || ''), assetId: String(data.assetId || '') }];
      })
    );

    // Fetch corresponding assets in chunks of 30
    const assetIds = configsSnap.docs.map((d) => d.data().assetId).filter(Boolean);
    const assetTypeMap = new Map<string, string>();

    if (assetIds.length > 0) {
      const CHUNK = 30;
      for (let i = 0; i < assetIds.length; i += CHUNK) {
        const chunk = assetIds.slice(i, i + CHUNK);
        const assetsSnap = await adminDb
          .collection('media')
          .where('__name__', 'in', chunk)
          .select('type')
          .get();
        assetsSnap.docs.forEach((doc) => {
          assetTypeMap.set(doc.id, String(doc.data().type || ''));
        });
      }
    }

    // 2. Fetch stats doc summaries in chunks of 30
    const statsMap = new Map<string, MediaPageStats>();
    const CHUNK = 30;
    for (let i = 0; i < shareIds.length; i += CHUNK) {
      const chunk = shareIds.slice(i, i + CHUNK);
      const statsSnap = await adminDb
        .collection(ANALYTICS_COLLECTION)
        .where('shareId', 'in', chunk)
        .get();
      statsSnap.docs.forEach((doc) => {
        const data = doc.data() as MediaShareAnalyticsDoc;
        statsMap.set(doc.id, { ...DEFAULT_STATS, ...(data.stats || {}) });
      });
    }

    return configsSnap.docs.map((d) => {
      const config = configMap.get(d.id);
      const assetId = config?.assetId || '';
      return {
        shareId: d.id,
        title: config?.title || d.id,
        type: assetTypeMap.get(assetId) || 'video',
        stats: statsMap.get(d.id) || { ...DEFAULT_STATS },
        updatedAt: d.data().updatedAt || d.data().createdAt || '',
      };
    });
  } catch (err) {
    console.error('[listMediaSharesWithStatsAction] Error listing stats:', err);
    return [];
  }
}

/**
 * Returns detailed analytics drilldown reports for a single shared media page.
 */
export async function getMediaShareDrilldownAction(
  shareId: string,
  workspaceId: string
): Promise<MediaAnalyticsResult | null> {
  if (!shareId || !workspaceId) return null;

  try {
    // Authorization Check
    const configSnap = await adminDb.collection('media_shares').doc(shareId).get();
    let finalShareId = shareId;
    if (!configSnap.exists) {
      // Fallback lookup by slug
      const slugSnap = await adminDb
        .collection('media_shares')
        .where('slug', '==', shareId)
        .limit(1)
        .get();
      if (slugSnap.empty) return null;
      const data = slugSnap.docs[0].data();
      if (data.workspaceId !== workspaceId) return null;
      finalShareId = slugSnap.docs[0].id;
    } else {
      const data = configSnap.data();
      if (data?.workspaceId !== workspaceId) return null;
    }

    const finalPageRef = adminDb.collection(ANALYTICS_COLLECTION).doc(finalShareId);

    // Fetch aggregates, sessions and recent event logs in parallel
    const [pageSnap, eventsSnap, sessionsSnap] = await Promise.all([
      finalPageRef.get(),
      finalPageRef.collection('events').orderBy('timestamp', 'desc').limit(100).get(),
      finalPageRef.collection('sessions').orderBy('updatedAt', 'desc').limit(100).get(),
    ]);

    const pageData = pageSnap.exists ? (pageSnap.data() as MediaShareAnalyticsDoc) : null;
    const stats: MediaPageStats = { ...DEFAULT_STATS, ...(pageData?.stats || {}) };

    const rawEvents = eventsSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<MediaPageEvent, 'id'>),
    })) as MediaPageEvent[];

    const rawSessions = sessionsSnap.docs.map((doc) => ({
      sessionId: doc.id,
      ...(doc.data() as Omit<MediaSessionRecord, 'sessionId'>),
    })) as MediaSessionRecord[];

    // Extract unique contact IDs to resolve profiles
    const contactIds = [
      ...new Set([
        ...rawEvents.map((e) => e.contactId).filter(Boolean),
        ...rawSessions.map((s) => s.contactId).filter(Boolean),
      ]),
    ] as string[];

    const contactNameMap = await buildContactNameMap(contactIds);

    const recentEvents: MediaPageEventWithContact[] = rawEvents.map((event) => ({
      ...event,
      ...(event.contactId && {
        contactName: contactNameMap.get(event.contactId),
      }),
    }));

    const sessions: MediaSessionRecordWithContact[] = rawSessions.map((session) => ({
      ...session,
      ...(session.contactId && {
        contactName: contactNameMap.get(session.contactId),
      }),
    }));

    const anonymousCount = rawSessions.filter((s) => !s.contactId).length;
    const totalKnownContacts = contactIds.length;

    return {
      stats,
      recentEvents,
      sessions,
      anonymousCount,
      totalKnownContacts,
    };
  } catch (err) {
    console.error('[getMediaShareDrilldownAction] Error:', err);
    return null;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function buildContactNameMap(contactIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (contactIds.length === 0) return map;

  const CHUNK = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    chunks.push(contactIds.slice(i, i + CHUNK));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const snaps = await adminDb
        .collection('contacts')
        .where('__name__', 'in', chunk)
        .select('name', 'displayName', 'firstName', 'lastName')
        .get();

      snaps.docs.forEach((doc) => {
        const data = doc.data() as {
          name?: string;
          displayName?: string;
          firstName?: string;
          lastName?: string;
        };
        const fullName =
          data.displayName ??
          data.name ??
          ([data.firstName, data.lastName].filter(Boolean).join(' ') || doc.id);
        map.set(doc.id, fullName);
      });
    })
  );

  contactIds.forEach((id) => {
    if (!map.has(id)) map.set(id, id);
  });

  return map;
}

/**
 * Checks if a custom slug is available for a media share page.
 * Returns true if available (no conflict), false if already taken.
 */
export async function checkSlugAvailabilityAction(slug: string, shareId: string): Promise<boolean> {
  const sanitizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (!sanitizedSlug) return true;

  try {
    // 1. Check if direct doc ID matches
    const directSnap = await adminDb
      .collection('media_shares')
      .doc(sanitizedSlug)
      .get();
    if (directSnap.exists && directSnap.id !== shareId) {
      return false;
    }

    // 2. Check if another document has this slug field
    const slugSnap = await adminDb
      .collection('media_shares')
      .where('slug', '==', sanitizedSlug)
      .limit(1)
      .get();
    
    if (!slugSnap.empty && slugSnap.docs[0].id !== shareId) {
      return false;
    }

    return true;
  } catch (err) {
    console.error('[checkSlugAvailabilityAction] Error checking slug:', err);
    return false;
  }
}
