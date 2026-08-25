/**
 * @fileoverview Domain Types for Outbound Webhook Subscriptions & Developer Platform.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Webhook signatures use HMAC-SHA256 with timestamp headers for replay protection.
 * - Zero 'any' policy strictly enforced.
 */

export type MeetingWebhookEvent =
  | 'booking.created'
  | 'booking.rescheduled'
  | 'booking.cancelled'
  | 'meeting.completed'
  | 'participant.joined'
  | 'intelligence.generated';

export interface MeetingWebhookEndpoint {
  id: string;
  workspaceId: string;
  url: string;
  description?: string;
  secretKey: string; // Used for HMAC-SHA256 signing
  subscribedEvents: MeetingWebhookEvent[];
  enabled: boolean;
  consecutiveFailuresCount: number;
  lastDeliveredAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryLog {
  id: string;
  endpointId: string;
  workspaceId: string;
  event: MeetingWebhookEvent;
  targetUrl: string;
  statusCode?: number;
  payload: Record<string, unknown>;
  responseBody?: string;
  deliveredAt: string;
  success: boolean;
  durationMs: number;
  retryAttempt?: number;
}
