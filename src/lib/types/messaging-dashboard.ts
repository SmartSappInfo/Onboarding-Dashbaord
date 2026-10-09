/**
 * @fileOverview Domain schemas and data contracts for the SmartSapp Messaging Hub & Dashboard.
 *
 * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
 * - Rule 1 & Rule 4: Strict typing, zero any, schema-narrowed unknown.
 * - Rule 10: Comprehensive architectural documentation, maintainer pointers, and testability hooks.
 * - Rule 11 & Rule 14: Model Context Protocol (MCP) tool schema definitions with versioning & `.describe()`.
 * - Rule 13: Trust Boundary Matrix: all database and external provider payloads are strictly validated before entry.
 */

import { z } from 'zod';

/**
 * Supported messaging channels across the SmartSapp platform.
 */
export const MessagingChannelSchema = z
  .enum(['sms', 'whatsapp', 'email', 'in_app'])
  .describe('The transmission channel for communications');
export type MessagingDashboardChannel = z.infer<typeof MessagingChannelSchema>;

/**
 * Health status indicators for external gateway providers (mNotify, Meta Cloud API, Resend).
 */
export const ProviderHealthStatusSchema = z
  .enum(['healthy', 'degraded', 'error'])
  .describe('Operational status of external communication gateways');
export type ProviderHealthStatus = z.infer<typeof ProviderHealthStatusSchema>;

/**
 * Input validation schema for fetching messaging dashboard summaries (MCP Tool boundary).
 */
export const GetMessagingDashboardSummaryInputSchema = z.object({
  organizationId: z.string().min(1).describe('The tenant organization unique identifier'),
  workspaceId: z.string().min(1).describe('The active operational workspace identifier'),
  forceRefresh: z.boolean().optional().default(false).describe('Bypass the 3-minute in-memory cache if true'),
});
export type GetMessagingDashboardSummaryInput = z.input<typeof GetMessagingDashboardSummaryInputSchema>;

/**
 * Primary KPI metric cards displayed at the top of the Messaging Hub.
 */
export const MessagingKpiMetricsSchema = z.object({
  messagesSent: z.number().nonnegative().describe('Total messages sent in the active window (last 7 days)'),
  messagesSentDeltaPercentage: z.number().describe('Percentage trend comparison against previous window'),
  deliveryRate: z.number().min(0).max(100).describe('Delivery success rate percentage (0 - 100)'),
  deliveryRateDeltaPercentage: z.number().describe('Delivery rate percentage point delta against previous window'),
  smsBalance: z.number().nonnegative().describe('Remaining SMS credit balance for the organization'),
  providerStatus: ProviderHealthStatusSchema.describe('Combined provider network health state'),
  providerStatusLabel: z.string().describe('Human-readable status label (e.g. "All Systems Active")'),
});
export type MessagingKpiMetrics = z.infer<typeof MessagingKpiMetricsSchema>;

/**
 * Visual performance chart data point contract.
 */
export const PerformanceChartDataSchema = z.object({
  sentCount: z.number().nonnegative().describe('Number of messages sent in the period'),
  deliveredCount: z.number().nonnegative().describe('Number of messages successfully delivered'),
  failedCount: z.number().nonnegative().describe('Number of failed messages'),
  deliveryRatePercentage: z.number().min(0).max(100).describe('Computed delivery rate percentage'),
  timeRangeLabel: z.string().describe('Readable window label, e.g. "Last 7 days"'),
});
export type PerformanceChartData = z.infer<typeof PerformanceChartDataSchema>;

/**
 * Channel distribution breakdown item contract.
 */
export const ChannelBreakdownItemSchema = z.object({
  channel: MessagingChannelSchema.describe('Communication channel type'),
  label: z.string().describe('Display label for channel, e.g. "WhatsApp"'),
  count: z.number().nonnegative().describe('Message volume in this channel'),
  percentage: z.number().min(0).max(100).describe('Share of total messages (0 - 100)'),
  color: z.string().describe('Hex color token for chart visualization'),
});
export type ChannelBreakdownItem = z.infer<typeof ChannelBreakdownItemSchema>;

/**
 * Recent campaign summary item contract.
 */
export const RecentCampaignItemSchema = z.object({
  id: z.string().describe('Campaign unique identifier'),
  name: z.string().describe('Campaign display name'),
  status: z.enum(['active', 'completed', 'scheduled', 'draft']).describe('Campaign lifecycle stage'),
  recipientCount: z.number().nonnegative().describe('Total audience size targeted'),
  sentAt: z.string().describe('ISO timestamp of campaign dispatch'),
  deliveryRate: z.number().min(0).max(100).describe('Overall campaign delivery rate percentage'),
  clickRate: z.number().min(0).max(100).optional().describe('Link click-through rate percentage if tracked'),
});
export type RecentCampaignItem = z.infer<typeof RecentCampaignItemSchema>;

/**
 * Active queue operational statistics.
 */
export const ActiveQueueStatsSchema = z.object({
  scheduledCount: z.number().nonnegative().describe('Count of pending scheduled messages'),
  pendingApprovalCount: z.number().nonnegative().describe('Count of messages awaiting administrative approval'),
  failedCount: z.number().nonnegative().describe('Count of messages requiring failure recovery or resend'),
});
export type ActiveQueueStats = z.infer<typeof ActiveQueueStatsSchema>;

/**
 * Inbox conversation preview item contract.
 */
export const InboxThreadPreviewItemSchema = z.object({
  threadId: z.string().describe('Unique conversation thread identifier'),
  entityId: z.string().optional().describe('Associated CRM contact or institution identifier'),
  entityName: z.string().describe('Contact or entity display name'),
  lastMessageSnippet: z.string().describe('Truncated preview snippet of the most recent message'),
  lastMessageChannel: MessagingChannelSchema.describe('Channel used by the last message in this thread'),
  lastMessageTimestamp: z.string().describe('ISO timestamp of the latest communication'),
  unreadCount: z.number().nonnegative().describe('Unread messages awaiting staff attention'),
  isGroup: z.boolean().default(false).describe('Whether this thread represents a group communication'),
});
export type InboxThreadPreviewItem = z.infer<typeof InboxThreadPreviewItemSchema>;

/**
 * Unified aggregation contract for the Messaging Dashboard.
 * Serves as the single contract between the backend aggregator, visual widgets, and AI MCP tools.
 */
export const MessagingDashboardSummarySchema = z.object({
  version: z.literal(1).default(1).describe('Contract schema version for MCP backward compatibility'),
  organizationId: z.string().describe('Tenant organization identifier'),
  workspaceId: z.string().describe('Target workspace identifier'),
  calculatedAt: z.string().describe('ISO timestamp when metrics were calculated'),
  kpi: MessagingKpiMetricsSchema.describe('Primary volume and health KPI cards'),
  performance: PerformanceChartDataSchema.describe('Delivery performance metrics for charts'),
  channelBreakdown: z.array(ChannelBreakdownItemSchema).describe('Volume breakdown by communication channel'),
  recentCampaigns: z.array(RecentCampaignItemSchema).describe('Recent outreach campaigns and performance'),
  activeQueues: ActiveQueueStatsSchema.describe('Queue metrics for scheduled, pending, and failed queues'),
  inboxPreview: z.array(InboxThreadPreviewItemSchema).describe('Recent incoming conversations and message history'),
});
export type MessagingDashboardSummary = z.infer<typeof MessagingDashboardSummarySchema>;

/**
 * Calculates a trend percentage delta between current and previous periods safely.
 * Handles non-finite values and divide-by-zero scenarios gracefully to prevent `NaN` or `Infinity`.
 *
 * @param current - Current period metric value
 * @param previous - Previous period metric value
 * @returns Rounded percentage delta integer (e.g. 24 for +24%, -15 for -15%)
 */
export function calculateTrendDeltaPercentage(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return 0;
  }
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  const delta = ((current - previous) / previous) * 100;
  return Math.round(delta);
}
