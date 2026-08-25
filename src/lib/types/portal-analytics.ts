/**
 * {{Org_name}} Experience Platform — Unified Analytics & Intelligence Domain Types
 *
 * Strict TypeScript models for Business Metrics, Learning Analytics, Community Health,
 * Unified 8-Stage Customer Journey Funnel, and AI Experience Correlation Insights.
 * Zero `any` or `any[]` typing.
 */

export type AnalyticsPeriod = 'all_time' | 'last_30_days' | 'last_7_days' | 'today';

export type JourneyStage =
  | 'visitor'
  | 'lead'
  | 'member'
  | 'enrolled'
  | 'engaged'
  | 'completed'
  | 'purchased'
  | 'advocate';

export interface DropOffLessonSummary {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  dropOffRatePercent: number;
  totalAttempts: number;
}

export interface TopContributorSummary {
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  totalPosts: number;
  totalComments: number;
  totalReactionsReceived: number;
  engagementScore: number;
}

export interface SpaceActivitySummary {
  spaceId: string;
  spaceName: string;
  postCount: number;
  commentCount: number;
  activeMemberCount: number;
}

export interface BusinessMetrics {
  totalVisitors: number;
  totalLeads: number;
  totalMembers: number;
  visitorToLeadRatePercent: number;
  leadToMemberRatePercent: number;
  grossRevenue: number;
  currency: string;
  mrr: number;
  churnRatePercent: number;
  averageOrderValue: number;
  estimatedLtv: number;
}

export interface LearningMetrics {
  totalEnrollments: number;
  activeLearners: number;
  averageCourseCompletionPercent: number;
  totalLessonsCompleted: number;
  averageAssessmentScorePercent: number;
  topDropOffLessons: DropOffLessonSummary[];
}

export interface CommunityMetrics {
  dau: number;
  mau: number;
  dauMauRatioPercent: number;
  totalPosts: number;
  totalComments: number;
  topContributors: TopContributorSummary[];
  spaceActivity: SpaceActivitySummary[];
}

export interface JourneyStageMetric {
  stage: JourneyStage;
  label: string;
  count: number;
  conversionFromPrevPercent: number;
  dropOffPercent: number;
}

export interface AiCorrelationInsight {
  id: string;
  category: 'learning' | 'revenue' | 'engagement' | 'retention';
  title: string;
  insight: string;
  actionableRecommendation: string;
  impactScore: number; // 0 - 100
}

/**
 * Unified Analytics Snapshot Container
 */
export interface PortalAnalyticsSnapshot {
  id: string;
  organizationId: string;
  portalId: string;
  period: AnalyticsPeriod;

  business: BusinessMetrics;
  learning: LearningMetrics;
  community: CommunityMetrics;
  journeyFunnel: JourneyStageMetric[];
  aiInsights: AiCorrelationInsight[];

  computedAt: string;
}
