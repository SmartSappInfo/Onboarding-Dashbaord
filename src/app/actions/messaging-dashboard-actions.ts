'use server';

/**
 * @fileOverview Multi-Tenant Backend Aggregator Action for the SmartSapp Messaging Hub.
 *
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any, schema-narrowed unknown.
 * - Rule 8 & Rule 18: Fail-closed multi-tenancy & session checks.
 * - Rule 9: High-load anti-exhaustion: bounded memory cache (max 500 entries), bounded queries.
 * - Rule 10: Inline architectural documentation and maintainer warnings.
 * - Rule 11 & Rule 14: MCP Tool Input Schema boundary enforcement & versioning.
 * - Rule 13: Trust Boundary Matrix validation before returning data.
 * - Rule 21: Graceful degradation for external provider handshakes with unhandled rejection protection.
 * - Rule 22: Structured observability logging.
 */

import { adminDb } from '@/lib/firebase-admin';
import { requireWorkspace } from '@/lib/auth/require-auth';
import { subDays, formatISO } from 'date-fns';
import {
  GetMessagingDashboardSummaryInputSchema,
  MessagingDashboardSummarySchema,
  calculateTrendDeltaPercentage,
  type GetMessagingDashboardSummaryInput,
  type MessagingDashboardSummary,
  type ProviderHealthStatus,
  type RecentCampaignItem,
  type InboxThreadPreviewItem,
  type MessagingDashboardChannel,
} from '@/lib/types/messaging-dashboard';
import { fetchSmsBalanceAction } from '@/lib/mnotify-actions';
import { WhatsAppCredentialRepository } from '@/lib/whatsapp/whatsapp-credential-repository';
import { getWorkspaceMessagingSettingsAction } from './messaging-settings-actions';
import { DEFAULT_MESSAGING_SETTINGS } from '@/lib/types/messaging-settings';
import { resolveMessagePreviewSnippet } from '@/lib/messaging/preview-utils';
import { extractThreadIdentity } from '@/app/admin/messaging/conversations/utils/thread-identity';
import type { MessageLog } from '@/lib/types';

export { type GetMessagingDashboardSummaryInput };

export type MessagingDashboardActionResult =
  | { success: true; data: MessagingDashboardSummary }
  | { success: false; error: string; code?: string };

import {
  getCachedDashboardSummary,
  setCachedDashboardSummary,
} from '@/lib/messaging/messaging-dashboard-cache';

/**
 * Wraps an asynchronous task with a strict timeout to guarantee bounded latency.
 * Attaches a catch handler to the input promise to prevent unhandled rejections
 * if the underlying external operation rejects after the timeout window has closed (Rule 21).
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });

  // Prevent unhandled promise rejection in the Node runtime if the caller rejects late
  const safePromise = promise.catch((err) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[withTimeout] Swallowed late promise rejection:', err instanceof Error ? err.message : err);
    }
    return fallbackValue;
  });

  try {
    return await Promise.race([safePromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Raw document shapes narrowed from Firestore snapshot reads.
 */
interface RawMessageLogDoc {
  id: string;
  organizationId?: string;
  workspaceIds?: string[];
  workspaceId?: string;
  channel?: string;
  status?: string;
  sentAt?: string;
  recipient?: string;
  displayName?: string;
  entityName?: string;
  entityId?: string;
  title?: string;
  subject?: string | null;
  previewText?: string | null;
  body?: string;
  variables?: Record<string, unknown> | null;
}

interface RawCampaignDoc {
  id: string;
  internalName?: string;
  name?: string;
  status?: string;
  estimatedRecipientCount?: number;
  recipientCount?: number;
  sentAt?: string;
  createdAt?: string;
  deliveryRate?: number;
  clickRate?: number;
  stats?: {
    totalTargeted?: number;
    totalSent?: number;
    totalFailed?: number;
    totalOpened?: number;
    totalClicked?: number;
  };
}

interface RawScheduledDoc {
  id: string;
  status?: string;
  workspaceId?: string;
  organizationId?: string;
}

/**
 * Aggregates all KPIs, performance metrics, channel breakdowns, queues, and
 * thread previews for the SmartSapp Messaging Hub.
 */
export async function getMessagingDashboardSummaryAction(
  rawInput: GetMessagingDashboardSummaryInput
): Promise<MessagingDashboardActionResult> {
  const startTime = Date.now();

  // 1. Validate Input at System Boundary (Rules 4, 11, 13)
  let input: GetMessagingDashboardSummaryInput;
  try {
    input = GetMessagingDashboardSummaryInputSchema.parse(rawInput);
  } catch (validationErr) {
    const errorMsg = validationErr instanceof Error ? validationErr.message : 'Invalid request payload';
    return { success: false, error: errorMsg, code: 'VALIDATION_FAILED' };
  }
  const { organizationId, workspaceId, forceRefresh, timeRange = '7d' } = input;

  // 2. Fail-Closed Authentication & Multi-Tenant Authorization (Rules 8 & 18)
  let authContext: Awaited<ReturnType<typeof requireWorkspace>>;
  try {
    authContext = await requireWorkspace(workspaceId);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
    return { success: false, error: errorMsg, code: 'UNAUTHORIZED' };
  }

  // Cross-tenant verification: Caller must belong to the requested organization unless system_admin
  if (!authContext.isSystemAdmin && authContext.profile.organizationId !== organizationId) {
    return {
      success: false,
      error: 'No access to this organization.',
      code: 'FORBIDDEN',
    };
  }

  // 3. Check In-Memory TTL Cache (Rule 9)
  const cacheKey = `dashboard:${organizationId}:${workspaceId}:${timeRange}`;
  const nowMs = Date.now();
  if (!forceRefresh) {
    const cachedData = getCachedDashboardSummary(cacheKey, nowMs);
    if (cachedData) {
      return { success: true, data: cachedData };
    }
  }

  try {
    const nowDate = new Date();
    let days = 7;
    let timeRangeLabel = 'Last 7 days';
    if (timeRange === '30d') {
      days = 30;
      timeRangeLabel = 'Last 30 days';
    } else if (timeRange === '24h') {
      days = 1;
      timeRangeLabel = 'Last 24 hours';
    }

    const currentWindowIso = formatISO(subDays(nowDate, days));
    const previousWindowIso = formatISO(subDays(nowDate, days * 2));

    // 4. Parallel Bounded Firestore Queries with Fault Isolation (Rule 21)
    const logsQueryPromise = adminDb
      .collection('message_logs')
      .where('workspaceIds', 'array-contains', workspaceId)
      .orderBy('sentAt', 'desc')
      .limit(500)
      .get()
      .catch(async (primaryErr) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[MessagingDashboardAggregator] Primary message_logs query degraded, trying fallback:', primaryErr?.message);
        }
        try {
          return await adminDb
            .collection('message_logs')
            .where('workspaceId', '==', workspaceId)
            .orderBy('sentAt', 'desc')
            .limit(500)
            .get();
        } catch (fallbackErr) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MessagingDashboardAggregator] Fallback message_logs query also degraded:', fallbackErr);
          }
          return { docs: [] } as unknown as FirebaseFirestore.QuerySnapshot;
        }
      });

    const campaignsQueryPromise = adminDb
      .collection('message_campaigns')
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[MessagingDashboardAggregator] message_campaigns query degraded:', err?.message);
        }
        return { docs: [] } as unknown as FirebaseFirestore.QuerySnapshot;
      });

    const scheduledQueryPromise = adminDb
      .collection('scheduled_messages')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'pending')
      .limit(50)
      .get()
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[MessagingDashboardAggregator] scheduled_messages query degraded:', err?.message);
        }
        return { docs: [] } as unknown as FirebaseFirestore.QuerySnapshot;
      });

    // Message jobs pending / queued count with fault isolation (Rule 21)
    const pendingJobsPromise = adminDb
      .collection('message_jobs')
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', 'queued')
      .count()
      .get()
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[MessagingDashboardAggregator] message_jobs queued query degraded:', err?.message);
        }
        return { data: () => ({ count: 0 }) } as unknown as FirebaseFirestore.AggregateQuerySnapshot<{ count: FirebaseFirestore.AggregateField<number> }>;
      });

    const [logsSnap, campaignsSnap, scheduledSnap, pendingJobsSnap, providerResults, settingsRes] = await Promise.all([
      logsQueryPromise,
      campaignsQueryPromise,
      scheduledQueryPromise,
      pendingJobsPromise,

      // External Provider Health (Rule 21: Graceful Degradation with 3.5s timeout)
      Promise.allSettled([
        withTimeout(
          fetchSmsBalanceAction(organizationId),
          3500,
          { success: false, error: 'SMS balance check timed out' }
        ),
        withTimeout(
          WhatsAppCredentialRepository.getPublic(organizationId),
          3500,
          { status: 'error' } as unknown as Awaited<ReturnType<typeof WhatsAppCredentialRepository.getPublic>>
        ),
      ]),

      // 5. Workspace Governance Settings (Rule 3)
      getWorkspaceMessagingSettingsAction(workspaceId).catch(() => ({
        success: true as const,
        data: DEFAULT_MESSAGING_SETTINGS,
      })),
    ]);

    const settings = settingsRes.success ? settingsRes.data : DEFAULT_MESSAGING_SETTINGS;

    // 5. Extract and filter logs
    let rawLogs: RawMessageLogDoc[] = logsSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<RawMessageLogDoc, 'id'>),
    }));

    // Fallback for legacy logs with single workspaceId field (uses indexed: workspaceId asc, sentAt desc)
    if (rawLogs.length === 0) {
      try {
        const legacyLogsSnap = await adminDb
          .collection('message_logs')
          .where('workspaceId', '==', workspaceId)
          .orderBy('sentAt', 'desc')
          .limit(500)
          .get();

        rawLogs = legacyLogsSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<RawMessageLogDoc, 'id'>),
        }));
      } catch (legacyErr) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[MessagingDashboardAggregator] Legacy logs read failed or unindexed:', legacyErr);
        }
      }
    }

    // Partition logs by time windows
    const currentWindowLogs = rawLogs.filter(
      (log) => log.sentAt && log.sentAt >= currentWindowIso
    );
    const previousWindowLogs = rawLogs.filter(
      (log) => log.sentAt && log.sentAt >= previousWindowIso && log.sentAt < currentWindowIso
    );

    // Compute volume & delivery metrics
    const currentSentCount = currentWindowLogs.length;
    const currentDeliveredCount = currentWindowLogs.filter(
      (log) => log.status === 'sent' || log.status === 'delivered'
    ).length;
    const currentFailedCount = currentWindowLogs.filter((log) => log.status === 'failed').length;

    const previousSentCount = previousWindowLogs.length;
    const previousDeliveredCount = previousWindowLogs.filter(
      (log) => log.status === 'sent' || log.status === 'delivered'
    ).length;

    const deliveryRate = currentSentCount > 0
      ? Number(((currentDeliveredCount / currentSentCount) * 100).toFixed(1))
      : 100;

    const previousDeliveryRate = previousSentCount > 0
      ? Number(((previousDeliveredCount / previousSentCount) * 100).toFixed(1))
      : 100;

    const messagesSentDelta = calculateTrendDeltaPercentage(currentSentCount, previousSentCount);
    const deliveryRateDelta = Number((deliveryRate - previousDeliveryRate).toFixed(1));

    // 6. Channel Breakdown Calculation (aligned with active window)
    const channelCounts: Record<MessagingDashboardChannel, number> = {
      sms: 0,
      whatsapp: 0,
      email: 0,
      in_app: 0,
    };

    // Aggregate channel counts across active window
    for (const log of currentWindowLogs) {
      const ch = (log.channel ?? 'sms').toLowerCase();
      if (ch === 'whatsapp') channelCounts.whatsapp++;
      else if (ch === 'email') channelCounts.email++;
      else if (ch === 'in_app') channelCounts.in_app++;
      else channelCounts.sms++;
    }

    const totalChannelLogs = Object.values(channelCounts).reduce((a, b) => a + b, 0);
    const channelBreakdown = [
      {
        channel: 'sms' as const,
        label: 'SMS',
        count: channelCounts.sms,
        percentage: totalChannelLogs > 0 ? Math.round((channelCounts.sms / totalChannelLogs) * 100) : 0,
        color: '#3B82F6',
      },
      {
        channel: 'whatsapp' as const,
        label: 'WhatsApp',
        count: channelCounts.whatsapp,
        percentage: totalChannelLogs > 0 ? Math.round((channelCounts.whatsapp / totalChannelLogs) * 100) : 0,
        color: '#10B981',
      },
      {
        channel: 'email' as const,
        label: 'Email',
        count: channelCounts.email,
        percentage: totalChannelLogs > 0 ? Math.round((channelCounts.email / totalChannelLogs) * 100) : 0,
        color: '#8B5CF6',
      },
      {
        channel: 'in_app' as const,
        label: 'In-App',
        count: channelCounts.in_app,
        percentage: totalChannelLogs > 0 ? Math.round((channelCounts.in_app / totalChannelLogs) * 100) : 0,
        color: '#F59E0B',
      },
    ];

    // 7. Provider Health Resolution (Rule 21)
    let smsBalance = 0;
    let smsSuccess = false;
    let waSuccess = false;

    const [smsSettled, waSettled] = providerResults;

    if (smsSettled.status === 'fulfilled' && smsSettled.value.success) {
      smsBalance = Number(smsSettled.value.balance ?? 0);
      smsSuccess = true;
    }

    if (waSettled.status === 'fulfilled') {
      const waConn = waSettled.value;
      // If WhatsApp is configured, it must be in connected state; if not configured, it is considered healthy
      waSuccess = !waConn || waConn.status === 'connected';
    }

    let providerStatus: ProviderHealthStatus = 'healthy';
    let providerStatusLabel = 'All Systems Active';

    if (!smsSuccess && !waSuccess) {
      providerStatus = 'error';
      providerStatusLabel = 'Service Interruptions';
    } else if (!smsSuccess || !waSuccess) {
      providerStatus = 'degraded';
      providerStatusLabel = 'Degraded Performance';
    }

    // 8. Recent Campaigns (with stats normalization)
    const rawCampaigns: RawCampaignDoc[] = campaignsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<RawCampaignDoc, 'id'>),
    }));

    const recentCampaigns: RecentCampaignItem[] = rawCampaigns.map((camp) => {
      let mappedStatus: 'active' | 'completed' | 'scheduled' | 'draft' = 'draft';
      if (camp.status === 'active' || camp.status === 'in_progress') mappedStatus = 'active';
      else if (camp.status === 'sent' || camp.status === 'completed') mappedStatus = 'completed';
      else if (camp.status === 'scheduled') mappedStatus = 'scheduled';

      const stats = camp.stats;
      const targeted = stats?.totalTargeted || camp.estimatedRecipientCount || camp.recipientCount || 0;
      const sent = stats?.totalSent || 0;
      const failed = stats?.totalFailed || 0;
      const clicked = stats?.totalClicked || 0;

      const deliveryRate = targeted > 0
        ? Math.round(((sent - failed) / targeted) * 100)
        : (camp.deliveryRate ?? 100);

      const clickRate = sent > 0
        ? Number(((clicked / sent) * 100).toFixed(1))
        : camp.clickRate;

      return {
        id: camp.id,
        name: camp.internalName || camp.name || 'Untitled Outreach',
        status: mappedStatus,
        recipientCount: targeted,
        sentAt: camp.sentAt || camp.createdAt || new Date().toISOString(),
        deliveryRate: Math.min(100, Math.max(0, deliveryRate)),
        clickRate: clickRate !== undefined ? Math.min(100, Math.max(0, clickRate)) : undefined,
      };
    });

    // 9. Active Queues
    const rawScheduled: RawScheduledDoc[] = scheduledSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<RawScheduledDoc, 'id'>),
    }));

    const scheduledCount = rawScheduled.length;
    const failedCount = rawLogs.filter((l) => l.status === 'failed').length;

    // 10. Inbox Thread Previews (Grouped by entityId or recipient)
    const groupedLogs = new Map<string, RawMessageLogDoc[]>();
    for (const log of rawLogs) {
      const threadKey = log.entityId || log.recipient || log.id;
      if (!groupedLogs.has(threadKey)) {
        if (groupedLogs.size >= 10) continue;
        groupedLogs.set(threadKey, []);
      }
      groupedLogs.get(threadKey)!.push(log);
    }

    // Batch-lookup real CRM entities if valid entityIds exist
    const entityIdsToFetch = Array.from(groupedLogs.values())
      .map((logs) => logs[0]?.entityId)
      .filter((id): id is string => Boolean(id && !id.includes('@') && !id.startsWith('+')));

    const entityDocsMap = new Map<string, { name?: string; contactName?: string; email?: string; phone?: string }>();
    if (entityIdsToFetch.length > 0) {
      try {
        const entitySnaps = await Promise.all(
          entityIdsToFetch.map((id) =>
            adminDb
              .collection('entities')
              .doc(id)
              .get()
              .catch(() => null)
          )
        );
        for (const snap of entitySnaps) {
          if (snap && snap.exists) {
            const data = snap.data();
            if (data) {
              entityDocsMap.set(snap.id, {
                name: (data.name as string | undefined) || (data.displayName as string | undefined) || (data.institutionName as string | undefined),
                contactName: (data.primaryContactName as string | undefined) || (data.contactPerson as string | undefined),
                email: (data.primaryEmail as string | undefined) || (data.email as string | undefined),
                phone: (data.primaryPhone as string | undefined) || (data.phone as string | undefined),
              });
            }
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[MessagingDashboardAggregator] entities batch lookup degraded (non-fatal):', err);
        }
      }
    }

    const inboxPreview: InboxThreadPreviewItem[] = [];
    for (const [threadKey, logs] of groupedLogs.entries()) {
      const latestLog = logs[0];
      const rawCh = (latestLog.channel ?? 'sms').toLowerCase();
      let ch: MessagingDashboardChannel = 'sms';
      if (rawCh === 'whatsapp' || rawCh === 'email' || rawCh === 'in_app') {
        ch = rawCh;
      }

      const snippet = resolveMessagePreviewSnippet({
        channel: ch,
        title: latestLog.title,
        subject: latestLog.subject,
        previewText: latestLog.previewText,
        body: latestLog.body,
        maxLength: 120,
      });

      // Extract rich multi-tier identity from log history & template variables
      const identity = extractThreadIdentity(logs as unknown as MessageLog[]);
      const entityDoc = latestLog.entityId ? entityDocsMap.get(latestLog.entityId) : null;

      const recipientName =
        entityDoc?.contactName ||
        identity.contactName ||
        latestLog.displayName ||
        'Direct Contact';

      const institutionName =
        entityDoc?.name ||
        identity.institutionName ||
        latestLog.entityName ||
        '';

      const email = entityDoc?.email || identity.email || (latestLog.recipient?.includes('@') ? latestLog.recipient : null);
      const phone = entityDoc?.phone || identity.phone || (!latestLog.recipient?.includes('@') ? latestLog.recipient : null);

      // Contact address depending on the channel type
      let contactAddress = latestLog.recipient || '';
      if (ch === 'email' && email) {
        contactAddress = email;
      } else if ((ch === 'sms' || ch === 'whatsapp') && phone) {
        contactAddress = phone;
      }

      // Display headline: prioritize recipient name with optional institution
      const headline =
        recipientName && institutionName && recipientName !== institutionName
          ? `${recipientName} · ${institutionName}`
          : recipientName || institutionName || latestLog.recipient || 'Unknown Contact';

      inboxPreview.push({
        threadId: threadKey,
        entityId: latestLog.entityId,
        entityName: headline,
        recipientName: recipientName !== institutionName ? recipientName : undefined,
        institutionName: institutionName || undefined,
        email: email || null,
        phone: phone || null,
        contactAddress,
        lastMessageSnippet: snippet,
        lastMessageChannel: ch,
        lastMessageTimestamp: latestLog.sentAt || new Date().toISOString(),
        unreadCount: 0,
        isGroup: false,
        isDirect: true,
      });
    }
    const pendingApprovalCount = pendingJobsSnap?.data?.().count ?? 0;

    // 11. Assemble and Validate against Schema (Rule 4, 13, 14)
    const payload: MessagingDashboardSummary = {
      version: 1,
      organizationId,
      workspaceId,
      calculatedAt: new Date().toISOString(),
      kpi: {
        messagesSent: currentSentCount,
        messagesSentDeltaPercentage: messagesSentDelta,
        deliveryRate,
        deliveryRateDeltaPercentage: deliveryRateDelta,
        smsBalance,
        providerStatus,
        providerStatusLabel,
      },
      performance: {
        sentCount: currentSentCount,
        deliveredCount: currentDeliveredCount,
        failedCount: currentFailedCount,
        deliveryRatePercentage: deliveryRate,
        timeRangeLabel,
      },
      channelBreakdown,
      recentCampaigns,
      activeQueues: {
        scheduledCount,
        pendingApprovalCount,
        failedCount,
      },
      inboxPreview,
      settings,
    };

    const validatedSummary = MessagingDashboardSummarySchema.parse(payload);

    // 12. Cache Result with Bounded Capacity Guard (Rule 9)
    setCachedDashboardSummary(cacheKey, validatedSummary, nowMs);

    const elapsedMs = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MessagingDashboardAggregator] Calculated summary for ${cacheKey} in ${elapsedMs}ms`);
    }

    return {
      success: true,
      data: validatedSummary,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal aggregation error';
    console.error(`[MessagingDashboardAggregator] Aggregation failed:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
      code: 'AGGREGATION_FAILED',
    };
  }
}
