/**
 * SmartSapp Forms 2.0: Reports & Advanced Analytics Domain Models
 * 
 * Defines data structures for executive multi-form dashboards, custom report presets,
 * cohort performance comparisons, revenue attribution, and scheduled email reports.
 */

import type { FormAnalyticsSummary, FormFunnelStage, QuestionFrictionMetric, UtmAttributionSummary } from './form-analytics-types';
import type { FormAiTopicClusterSummary } from './form-intelligence-types';

export type FormReportPreset =
  | 'executive_summary'
  | 'lead_generation'
  | 'qualitative_research'
  | 'campaign_attribution'
  | 'ux_friction'
  | 'custom';

export type ReportDateRange = '7d' | '30d' | '90d' | 'all';
export type ScheduledReportFrequency = 'daily' | 'weekly' | 'monthly';

export interface ReportWidgetToggle {
  kpiStrip: boolean;
  funnelProgression: boolean;
  submissionsTrend: boolean;
  frictionHeatmap: boolean;
  topicClusters: boolean;
  utmAttribution: boolean;
  revenueAttribution: boolean;
  deviceBreakdown: boolean;
}

export interface FormRevenueAttribution {
  totalDealsCreated: number;
  totalDealsWon: number;
  winRate: number; // 0 to 100
  totalPipelineValue: number; // in USD / currency
  totalClosedWonRevenue: number;
  averageDealSize: number;
  averageDaysToClose: number;
}

export interface CohortComparisonData {
  periodLabel: string;
  submissions: number;
  views: number;
  completionRate: number;
  percentageChangeVsPrevious: number;
}

export interface TopPerformingFormLeaderboardItem {
  formId: string;
  title: string;
  slug: string;
  purpose?: string;
  totalSubmissions: number;
  totalViews: number;
  completionRate: number;
  pipelineValueAttributed: number;
  positiveSentimentPercentage: number;
}

export interface WorkspaceExecutiveReportData {
  workspaceId: string;
  dateRange: ReportDateRange;
  totalForms: number;
  totalSubmissions: number;
  totalViews: number;
  averageCompletionRate: number;
  totalPipelineRevenue: number;
  totalClosedWonRevenue: number;
  totalDealsWon: number;
  positiveSentimentPercentage: number;
  topPerformingForms: TopPerformingFormLeaderboardItem[];
  cohortComparison: CohortComparisonData[];
  channelBreakdown: Array<{
    channel: string;
    submissions: number;
    percentage: number;
  }>;
  generatedAt: string;
}

export interface FormReportConfig {
  id: string;
  formId: string;
  workspaceId: string;
  title: string;
  preset: FormReportPreset;
  dateRange: ReportDateRange;
  widgets: ReportWidgetToggle;
  createdAt: string;
  updatedAt?: string;
}

export interface FormReportData {
  config: FormReportConfig;
  formTitle: string;
  formSlug: string;
  formPurpose?: string;
  kpiSummary: {
    totalSubmissions: number;
    totalViews: number;
    completionRate: number;
    avgDwellSeconds: number;
    totalPipelineValue: number;
    closedWonRevenue: number;
  };
  funnelStages: FormFunnelStage[];
  revenueAttribution: FormRevenueAttribution;
  topicClusters?: FormAiTopicClusterSummary;
  frictionPoints: QuestionFrictionMetric[];
  utmAttribution?: UtmAttributionSummary;
  executiveSummary: string;
  strategicRecommendations: string[];
  generatedAt: string;
}

export interface ScheduledReportRecipient {
  email: string;
  name?: string;
  userId?: string;
}

export interface ScheduledFormReportConfig {
  id: string;
  workspaceId: string;
  formId: string;
  formTitle: string;
  enabled: boolean;
  frequency: ScheduledReportFrequency;
  timeOfDay: string; // '08:00'
  dayOfWeek?: number; // 1 = Monday
  recipients: ScheduledReportRecipient[];
  preset: FormReportPreset;
  lastSentAt?: string;
  nextScheduledAt?: string;
  createdAt: string;
  updatedAt?: string;
}
