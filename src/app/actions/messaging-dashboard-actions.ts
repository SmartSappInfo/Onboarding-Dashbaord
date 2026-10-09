'use server';

/**
 * @fileOverview Multi-Tenant Backend Aggregator Action for the SmartSapp Messaging Hub.
 *
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any, schema-narrowed unknown.
 * - Rule 8 & Rule 18: Fail-closed multi-tenancy & session checks.
 * - Rule 9: High-load anti-exhaustion: in-memory 3-minute TTL cache, bounded queries.
 * - Rule 10: Inline architectural documentation and maintainer warnings.
 * - Rule 13: Trust Boundary Matrix validation before returning data.
 * - Rule 21: Graceful degradation for external provider handshakes.
 * - Rule 22: Structured observability logging.
 */

import { adminDb } from '@/lib/firebase-admin';
import { requireWorkspace } from '@/lib/auth/require-auth';
import { subDays, formatISO } from 'date-fns';
import {
  MessagingDashboardSummarySchema,
  calculateTrendDeltaPercentage,
  type MessagingDashboardSummary,
  type ProviderHealthStatus,
  type RecentCampaignItem,
  type InboxThreadPreviewItem,
  type MessagingDashboardChannel,
} from '@/lib/types/messaging-dashboard';
import { fetchSmsBalanceAction } from '@/lib/mnotify-actions';
import { WhatsAppCredentialRepository } from '@/lib/whatsapp/whatsapp-credential-repository';

export interface GetMessagingDashboardSummaryInput {
  organizationId: string;
  workspaceId: string;
  forceRefresh?: boolean;
}

export type MessagingDashboardActionResult =
  | { success: true; data: MessagingDashboardSummary }
  | { success: false; error: string; code?: string };

interface CacheEntry {
  data: MessagingDashboardSummary;
  expiresAt: number;
}

/**
 * In-memory TTL cache for dashboard summaries to protect Firestore
 * from query storms when users switch tabs or refresh pages frequently.
 * Key format: `dashboard:${organizationId}:${workspaceId}`
 */
const dashboardSummaryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

/** Test utility to clear memory cache between runs */
export function clearDashboardSummaryCacheForTests(): void {
  dashboardSummaryCache.clear();
}

/**
 * Wraps an asynchronous task with a strict timeout to guarantee bounded latency.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
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
  body?: string;
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
  input: GetMessagingDashboardSummaryInput
): Promise<MessagingDashboardActionResult> {
  const startTime = Date.now();
  const { organizationId, workspaceId, forceRefresh } = input;

  // 1. Fail-Closed Authentication & Multi-Tenant Authorization (Rule 8 & 18)
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

  // 2. Check In-Memory TTL Cache (Rule 9)
  const cacheKey = `dashboard:${organizationId}:${workspaceId}`;
  const nowMs = Date.now();
  if (!forceRefresh) {
    const cached = dashboardSummaryCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      return { success: true, data: cached.data };
    }
  }

  try {
    const nowDate = new Date();
    const sevenDaysAgoIso = formatISO(subDays(nowDate, 7));
    const fourteenDaysAgoIso = formatISO(subDays(nowDate, 14));

    // 3. Parallel Bounded Firestore Queries
    const [logsSnap, campaignsSnap, scheduledSnap, providerResults] = await Promise.all([
      // Logs query: bounded to 500 records by workspace
      adminDb
        .collection('message_logs')
        .where('workspaceIds', 'array-contains', workspaceId)
        .orderBy('sentAt', 'desc')
        .limit(500)
        .get(),

      // Campaigns query: latest 5 campaigns in this workspace
      adminDb
        .collection('message_campaigns')
        .where('workspaceId', '==', workspaceId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get(),

      // Scheduled queue query: up to 50 pending messages
      adminDb
        .collection('scheduled_messages')
        .where('status', '==', 'pending')
        .limit(50)
        .get(),

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
          null
        ),
      ]),
    ]);

    // 4. Extract and filter logs
    let rawLogs: RawMessageLogDoc[] = logsSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<RawMessageLogDoc, 'id'>),
    }));

    // If no logs matched the workspaceIds array, check by organizationId as fallback
    if (rawLogs.length === 0) {
      const orgLogsSnap = await adminDb
        .collection('message_logs')
        .where('organizationId', '==', organizationId)
        .orderBy('sentAt', 'desc')
        .limit(500)
        .get();

      rawLogs = orgLogsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<RawMessageLogDoc, 'id'>),
      }));
    }

    // Partition logs by time windows
    const currentWindowLogs = rawLogs.filter(
      (log) => log.sentAt && log.sentAt >= sevenDaysAgoIso
    );
    const previousWindowLogs = rawLogs.filter(
      (log) => log.sentAt && log.sentAt >= fourteenDaysAgoIso && log.sentAt < sevenDaysAgoIso
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

    // 5. Channel Breakdown Calculation
    const channelCounts: Record<MessagingDashboardChannel, number> = {
      sms: 0,
      whatsapp: 0,
      email: 0,
      in_app: 0,
    };

    // Aggregate channel counts across active window (or all recent logs if window is empty)
    const logsForChannels = currentWindowLogs.length > 0 ? currentWindowLogs : rawLogs;
    for (const log of logsForChannels) {
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

    // 6. Provider Health Resolution (Rule 21)
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
      waSuccess = !waConn || waConn.status !== 'error';
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

    // 7. Recent Campaigns
    const rawCampaigns: RawCampaignDoc[] = campaignsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<RawCampaignDoc, 'id'>),
    }));

    const recentCampaigns: RecentCampaignItem[] = rawCampaigns.map((camp) => {
      let mappedStatus: 'active' | 'completed' | 'scheduled' | 'draft' = 'draft';
      if (camp.status === 'active' || camp.status === 'in_progress') mappedStatus = 'active';
      else if (camp.status === 'sent' || camp.status === 'completed') mappedStatus = 'completed';
      else if (camp.status === 'scheduled') mappedStatus = 'scheduled';

      return {
        id: camp.id,
        name: camp.internalName || camp.name || 'Untitled Outreach',
        status: mappedStatus,
        recipientCount: camp.estimatedRecipientCount || camp.recipientCount || 0,
        sentAt: camp.sentAt || camp.createdAt || new Date().toISOString(),
        deliveryRate: camp.deliveryRate ?? 100,
        clickRate: camp.clickRate,
      };
    });

    // 8. Active Queues
    const rawScheduled: RawScheduledDoc[] = scheduledSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<RawScheduledDoc, 'id'>),
    }));

    const scheduledCount = rawScheduled.length;
    const failedCount = rawLogs.filter((l) => l.status === 'failed').length;

    // 9. Inbox Thread Previews (Grouped by entityId or recipient)
    const threadMap = new Map<string, InboxThreadPreviewItem>();
    for (const log of rawLogs) {
      const threadKey = log.entityId || log.recipient || log.id;
      if (!threadMap.has(threadKey) && threadMap.size < 10) {
        const rawCh = (log.channel ?? 'sms').toLowerCase();
        let ch: MessagingDashboardChannel = 'sms';
        if (rawCh === 'whatsapp' || rawCh === 'email' || rawCh === 'in_app') {
          ch = rawCh;
        }

        threadMap.set(threadKey, {
          threadId: threadKey,
          entityId: log.entityId,
          entityName: log.displayName || log.entityName || log.recipient || 'Unknown Contact',
          lastMessageSnippet: (log.body || 'No message content').slice(0, 120),
          lastMessageChannel: ch,
          lastMessageTimestamp: log.sentAt || new Date().toISOString(),
          unreadCount: 0,
          isGroup: false,
        });
      }
    }
    const inboxPreview = Array.from(threadMap.values());

    // 10. Assemble and Validate against Schema (Rule 4 & 13)
    const payload: MessagingDashboardSummary = {
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
        timeRangeLabel: 'Last 7 days',
      },
      channelBreakdown,
      recentCampaigns,
      activeQueues: {
        scheduledCount,
        pendingApprovalCount: 0,
        failedCount,
      },
      inboxPreview,
    };

    const validatedSummary = MessagingDashboardSummarySchema.parse(payload);

    // 11. Cache Result (Rule 9)
    dashboardSummaryCache.set(cacheKey, {
      data: validatedSummary,
      expiresAt: nowMs + CACHE_TTL_MS,
    });

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
