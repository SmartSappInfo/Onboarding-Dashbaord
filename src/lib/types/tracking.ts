export enum MessageProvider {
  Resend = 'resend',
  BmsSms = 'bms_sms',
  Twilio = 'twilio',
  WhatsAppCloud = 'whatsapp',
}

export enum MessageStatus {
  Queued = 'queued',
  Sent = 'sent',
  Delivered = 'delivered',
  Opened = 'opened',
  Clicked = 'clicked',
  Bounced = 'bounced',
  Failed = 'failed',
  Suppressed = 'suppressed',
}

export enum ResendTrigger {
  NoOpen = 'no_open',
  NoClick = 'no_click',
}

// State weight mapping to prevent out-of-order overwrites
export const MESSAGE_STATUS_WEIGHT: Record<MessageStatus, number> = {
  [MessageStatus.Queued]: 1,
  [MessageStatus.Failed]: 1,
  [MessageStatus.Sent]: 2,
  [MessageStatus.Delivered]: 3,
  [MessageStatus.Opened]: 4,
  [MessageStatus.Clicked]: 5,
  [MessageStatus.Bounced]: 6,
  [MessageStatus.Suppressed]: 6,
};

export type DeliveryState =
  | { status: MessageStatus.Queued | MessageStatus.Failed; timestamp: string }
  | { status: MessageStatus.Sent; sentAt: string }
  | { status: MessageStatus.Delivered; deliveredAt: string }
  | { status: MessageStatus.Opened; openedAt: string }
  | { status: MessageStatus.Clicked; clickedAt: string }
  | { status: MessageStatus.Bounced; bounceInfo: BounceInfo }
  | { status: MessageStatus.Suppressed; suppressionInfo: SuppressionInfo };

export interface BounceInfo {
  type: 'permanent' | 'temporary';
  reason: string;
  bouncedAt: string;
}

export interface SuppressionInfo {
  reason: 'unsubscribe' | 'bounce' | 'complaint' | 'manual';
  suppressedAt: string;
}

export interface MessageTrackingRecord {
  id: string;
  automationId: string;
  runId: string;
  nodeId: string;
  workspaceId: string;
  organizationId: string;
  provider: MessageProvider;
  channel: 'email' | 'sms' | 'whatsapp';
  providerMessageId: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientIdentifier: string;
  deliveryState: DeliveryState;
  resendConfig: ResendConfiguration | null;
  resendHistory: ResendHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ResendConfiguration {
  enabled: boolean;
  maxResends: number;
  resendCount: number;
  triggerCondition: ResendTrigger;
  resendDelay: number; // in hours
}

export interface ResendHistoryEntry {
  resendNumber: number;
  resendedAt: string;
  resendedMessageId: string;
  title: string;
  previewText: string;
}

export interface MessageNodeStatistics {
  id: string; // automationId_nodeId
  automationId: string;
  nodeId: string;
  workspaceId: string;
  organizationId: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplaints: number;
  totalSuppressed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  lastUpdatedAt: string;
}

export interface ResendJob {
  id: string;
  automationId: string;
  runId: string;
  nodeId: string;
  workspaceId: string;
  originalMessageTrackingId: string;
  recipientIdentifier: string;
  resendNumber: number;
  maxResends: number;
  triggerCondition: ResendTrigger;
  title: string;
  previewText: string;
  messageContent: string;
  scheduledFor: string;
  checkAfter: string;
  status: ResendJobStatus;
  statusReason: string | null;
  checkedAt: string | null;
  sentAt: string | null;
  newMessageTrackingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export enum ResendJobStatus {
  Pending = 'pending',
  Checked = 'checked',
  Sent = 'sent',
  Skipped = 'skipped',
  Failed = 'failed',
}
