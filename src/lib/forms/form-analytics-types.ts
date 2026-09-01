/**
 * SmartSapp Forms 2.0: Event & Conversion Funnel Analytics Types
 * 
 * Defines domain models for telemetry events, daily aggregate rollups,
 * conversion funnels, question-level friction metrics, and campaign attribution.
 */

export type FormTelemetryEventType = 
  | 'page_view' 
  | 'form_started' 
  | 'page_step' 
  | 'field_dwell' 
  | 'form_submitted' 
  | 'form_abandoned';

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface FormTelemetryEventPayload {
  formId: string;
  workspaceId: string;
  organizationId?: string;
  eventType: FormTelemetryEventType;
  sessionId: string;
  pageIndex?: number;
  pageId?: string;
  fieldId?: string;
  dwellSeconds?: number;
  deviceType?: DeviceType;
  browser?: string;
  os?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}

/**
 * Daily aggregate summary stored in `form_metrics_daily/${formId}_${YYYY-MM-DD}`
 */
export interface FormMetricsDaily {
  id: string; // `${formId}_${date}`
  formId: string;
  workspaceId: string;
  organizationId?: string;
  date: string; // YYYY-MM-DD
  visitors: number;
  starts: number;
  submissions: number;
  totalDwellSeconds: number;
  dropOffs: number;
  pageViews: Record<string, number>; // pageId or stepIndex -> count
  fieldDwellSeconds: Record<string, number>; // fieldId -> total seconds
  fieldDropOffs: Record<string, number>; // fieldId -> count
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  utmBreakdown: {
    sources: Record<string, number>;
    mediums: Record<string, number>;
    campaigns: Record<string, number>;
    referrers: Record<string, number>;
  };
  updatedAt: string;
}

export type AnalyticsDateRangePreset = '7d' | '30d' | '90d' | 'all' | 'custom';

export interface AnalyticsDateRange {
  preset: AnalyticsDateRangePreset;
  from?: string; // ISO date string
  to?: string;   // ISO date string
}

export interface FormFunnelStage {
  id: string;
  name: string;
  count: number;
  overallConversionRate: number; // percentage of original visitors (0-100)
  stepDropOffRate: number;       // percentage lost from previous step (0-100)
}

export type FrictionStatus = 'optimal' | 'moderate' | 'high_friction';

export interface QuestionFrictionMetric {
  fieldId: string;
  variableName: string;
  label: string;
  type: string;
  views: number;
  completions: number;
  dropOffs: number;
  completionRate: number;     // 0-100%
  dropOffRate: number;        // 0-100%
  avgDwellSeconds: number;
  status: FrictionStatus;
  recommendation?: string;
}

export interface UtmAttributionItem {
  name: string;
  visitors: number;
  submissions: number;
  conversionRate: number;
}

export interface UtmAttributionSummary {
  sources: UtmAttributionItem[];
  mediums: UtmAttributionItem[];
  campaigns: UtmAttributionItem[];
  referrers: UtmAttributionItem[];
}

export interface TimeSeriesTrendPoint {
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "Sep 01"
  visitors: number;
  starts: number;
  submissions: number;
  conversionRate: number;
}

export interface FormAnalyticsSummary {
  formId: string;
  workspaceId: string;
  dateRange: AnalyticsDateRange;
  // Level 1: Form Performance KPIs
  totalVisitors: number;
  totalStarts: number;
  totalSubmissions: number;
  overallConversionRate: number; // (submissions / visitors) * 100
  completionRate: number;        // (submissions / starts) * 100
  dropOffRate: number;           // ((starts - submissions) / starts) * 100
  avgCompletionTimeSeconds: number;
  // Level 2: Funnel & Friction
  funnelStages: FormFunnelStage[];
  questionFriction: QuestionFrictionMetric[];
  // Level 3: Traffic & Attribution
  attribution: UtmAttributionSummary;
  // Level 4: Environment & Demographics
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
    desktopPercent: number;
    mobilePercent: number;
    tabletPercent: number;
  };
  // Trends
  trends: TimeSeriesTrendPoint[];
}
