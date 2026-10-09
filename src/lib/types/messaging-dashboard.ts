/**
 * @fileOverview Domain schemas and data contracts for the SmartSapp Messaging Hub & Dashboard.
 *
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any, schema-narrowed unknown.
 * - Rule 10: Comprehensive architectural documentation, maintainer pointers, and testability hooks.
 * - Rule 13: Trust Boundary Matrix: all database and external provider payloads are strictly validated before entry.
 * - Rule 14: Versioned tool definition fingerprinting for agent consumption.
 */

import { z } from 'zod';

/**
 * Supported messaging channels across the SmartSapp platform.
 */
export const MessagingChannelSchema = z.enum(['sms', 'whatsapp', 'email', 'in_app']);
export type MessagingDashboardChannel = z.infer<typeof MessagingChannelSchema>;

/**
 * Health status indicators for external gateway providers (mNotify, Meta Cloud API, Resend).
 */
export const ProviderHealthStatusSchema = z.enum(['healthy', 'degraded', 'error']);
export type ProviderHealthStatus = z.infer<typeof ProviderHealthStatusSchema>;

/**
 * Primary KPI metric cards displayed at the top of the Messaging Hub.
 */
export const MessagingKpiMetricsSchema = z.object({
  /** Total messages sent in the active window (e.g. last 7 days) */
  messagesSent: z.number().nonnegative(),
  /** Percentage trend comparison against the previous window (e.g. +24%) */
  messagesSentDeltaPercentage: z.number(),
  /** Delivery rate percentage (0 - 100) */
  deliveryRate: z.number().min(0).max(100),
  /** Delivery rate percentage delta (e.g. +1.2%) */
  deliveryRateDeltaPercentage: z.number(),
  /** Remaining SMS credit balance for the organization */
  smsBalance: z.number().nonnegative(),
  /** Provider network health state */
  providerStatus: ProviderHealthStatusSchema,
  /** Human-readable status label (e.g. "All Systems Active") */
  providerStatusLabel: z.string(),
});
export type MessagingKpiMetrics = z.infer<typeof MessagingKpiMetricsSchema>;

/**
 * Visual performance chart data point contract.
 */
export const PerformanceChartDataSchema = z.object({
  sentCount: z.number().nonnegative(),
  deliveredCount: z.number().nonnegative(),
  failedCount: z.number().nonnegative(),
  deliveryRatePercentage: z.number().min(0).max(100),
  timeRangeLabel: z.string(),
});
export type PerformanceChartData = z.infer<typeof PerformanceChartDataSchema>;

/**
 * Channel distribution breakdown item contract.
 */
export const ChannelBreakdownItemSchema = z.object({
  channel: MessagingChannelSchema,
  label: z.string(),
  count: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
  color: z.string(),
});
export type ChannelBreakdownItem = z.infer<typeof ChannelBreakdownItemSchema>;

/**
 * Recent campaign summary item contract.
 */
export const RecentCampaignItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'completed', 'scheduled', 'draft']),
  recipientCount: z.number().nonnegative(),
  sentAt: z.string(),
  deliveryRate: z.number().min(0).max(100),
  clickRate: z.number().min(0).max(100).optional(),
});
export type RecentCampaignItem = z.infer<typeof RecentCampaignItemSchema>;

/**
 * Active queue operational statistics.
 */
export const ActiveQueueStatsSchema = z.object({
  scheduledCount: z.number().nonnegative(),
  pendingApprovalCount: z.number().nonnegative(),
  failedCount: z.number().nonnegative(),
});
export type ActiveQueueStats = z.infer<typeof ActiveQueueStatsSchema>;

/**
 * Inbox conversation preview item contract.
 */
export const InboxThreadPreviewItemSchema = z.object({
  threadId: z.string(),
  entityId: z.string().optional(),
  entityName: z.string(),
  lastMessageSnippet: z.string(),
  lastMessageChannel: MessagingChannelSchema,
  lastMessageTimestamp: z.string(),
  unreadCount: z.number().nonnegative(),
  isGroup: z.boolean().default(false),
});
export type InboxThreadPreviewItem = z.infer<typeof InboxThreadPreviewItemSchema>;

/**
 * Unified aggregation contract for the Messaging Dashboard.
 * Serves as the single contract between the backend aggregator and frontend client widgets.
 */
export const MessagingDashboardSummarySchema = z.object({
  organizationId: z.string(),
  workspaceId: z.string(),
  calculatedAt: z.string(),
  kpi: MessagingKpiMetricsSchema,
  performance: PerformanceChartDataSchema,
  channelBreakdown: z.array(ChannelBreakdownItemSchema),
  recentCampaigns: z.array(RecentCampaignItemSchema),
  activeQueues: ActiveQueueStatsSchema,
  inboxPreview: z.array(InboxThreadPreviewItemSchema),
});
export type MessagingDashboardSummary = z.infer<typeof MessagingDashboardSummarySchema>;

/**
 * Calculates a trend percentage delta between current and previous periods safely.
 * Handles divide-by-zero scenarios gracefully to prevent `NaN` or `Infinity`.
 *
 * @param current - Current period metric value
 * @param previous - Previous period metric value
 * @returns Rounded percentage delta integer (e.g. 24 for +24%, -15 for -15%)
 */
export function calculateTrendDeltaPercentage(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  const delta = ((current - previous) / previous) * 100;
  return Math.round(delta);
}
