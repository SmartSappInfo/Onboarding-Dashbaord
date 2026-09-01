/**
 * SmartSapp Forms 2.0: Distribution Hub & Public Embed Types
 * 
 * Defines domain models for distribution channels, trackable campaign links,
 * embed configurations, QR code generators, and developer API metadata.
 */

export type DistributionChannel =
  | 'hosted_link'
  | 'iframe_inline'
  | 'popup_widget'
  | 'slideover_widget'
  | 'qr_code'
  | 'email_campaign'
  | 'sms_campaign'
  | 'whatsapp_campaign'
  | 'api';

export interface UtmParameters {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface FormDistributionLink {
  id: string;
  formId: string;
  workspaceId: string;
  name: string;
  channel: DistributionChannel;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  generatedUrl: string;
  viewsCount?: number;
  submissionsCount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface EmbedConfig {
  embedType: 'inline' | 'popup' | 'slideover';
  width: string;
  height: string;
  autoResize: boolean;
  triggerText?: string;
  triggerColor?: string;
  popupDelaySeconds?: number;
  showOnExitIntent?: boolean;
}

export interface QrCodeConfig {
  foregroundColor: string;
  backgroundColor: string;
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  includeLogo: boolean;
  format: 'png' | 'svg';
}

export interface CreateDistributionLinkPayload {
  formId: string;
  workspaceId: string;
  name: string;
  channel: DistributionChannel;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}
