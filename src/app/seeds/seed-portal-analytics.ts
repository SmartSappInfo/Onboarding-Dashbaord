/**
 * {{Org_name}} Experience Platform — Analytics & Telemetry Seeder
 *
 * Seeds initial Analytics Snapshot data for the flagship School Bursar Academy portal.
 */

import { adminDb } from '@/lib/firebase-admin';
import { PortalAnalyticsService } from '@/lib/services/portal-analytics-service';
import type { PortalAnalyticsSnapshot } from '@/lib/types/portal-analytics';

export async function seedPortalAnalytics(
  portalId: string,
  organizationId: string
): Promise<void> {
  const now = new Date().toISOString();
  const snapshotRef = adminDb.collection('portal_analytics_snapshots').doc(`snapshot_${portalId}_all_time`);

  const business = {
    totalVisitors: 1420,
    totalLeads: 540,
    totalMembers: 380,
    visitorToLeadRatePercent: 38,
    leadToMemberRatePercent: 70,
    grossRevenue: 18450,
    currency: 'USD',
    mrr: 7380,
    churnRatePercent: 3.8,
    averageOrderValue: 194,
    estimatedLtv: 465,
  };

  const learning = {
    totalEnrollments: 310,
    activeLearners: 240,
    averageCourseCompletionPercent: 68,
    totalLessonsCompleted: 980,
    averageAssessmentScorePercent: 84,
    topDropOffLessons: [
      {
        courseId: 'course_school_bursar',
        courseTitle: 'Strategic School Budgeting & Fee Collection',
        lessonId: 'lesson_2_reconciliations',
        lessonTitle: 'Financial Reconciliations & Audit Spreadsheets',
        dropOffRatePercent: 34,
        totalAttempts: 165,
      },
      {
        courseId: 'course_school_bursar',
        courseTitle: 'Strategic School Budgeting & Fee Collection',
        lessonId: 'lesson_3_procurement',
        lessonTitle: 'Vendor Procurement & Invoice Approvals',
        dropOffRatePercent: 18,
        totalAttempts: 120,
      },
    ],
  };

  const community = {
    dau: 125,
    mau: 320,
    dauMauRatioPercent: 39,
    totalPosts: 84,
    totalComments: 340,
    topContributors: [
      {
        userId: 'user_kwame',
        userName: 'Kwame Mensah',
        totalPosts: 24,
        totalComments: 68,
        totalReactionsReceived: 184,
        engagementScore: 680,
      },
      {
        userId: 'user_grace',
        userName: 'Sister Grace Osei',
        totalPosts: 18,
        totalComments: 52,
        totalReactionsReceived: 142,
        engagementScore: 520,
      },
      {
        userId: 'user_ebenezer',
        userName: 'Ebenezer Boateng',
        totalPosts: 12,
        totalComments: 36,
        totalReactionsReceived: 98,
        engagementScore: 390,
      },
    ],
    spaceActivity: [
      {
        spaceId: 'space_general',
        spaceName: 'General Discussion',
        postCount: 42,
        commentCount: 160,
        activeMemberCount: 88,
      },
      {
        spaceId: 'space_bursars',
        spaceName: 'Bursars & Finance Roundtable',
        postCount: 28,
        commentCount: 114,
        activeMemberCount: 64,
      },
      {
        spaceId: 'space_compliance',
        spaceName: 'Regulatory Audits & Compliance',
        postCount: 14,
        commentCount: 66,
        activeMemberCount: 42,
      },
    ],
  };

  const journeyFunnel = PortalAnalyticsService.computeJourneyFunnelMetrics(
    business.totalVisitors,
    business.totalLeads,
    business.totalMembers,
    learning.totalEnrollments,
    240, // engaged
    165, // completed
    95,  // purchased
    28   // advocates
  );

  const aiInsights = PortalAnalyticsService.generateAiCorrelationInsights(business, learning, community);

  const snapshot: PortalAnalyticsSnapshot = {
    id: snapshotRef.id,
    organizationId,
    portalId,
    period: 'all_time',
    business,
    learning,
    community,
    journeyFunnel,
    aiInsights,
    computedAt: now,
  };

  await snapshotRef.set(snapshot, { merge: true });
  console.log(`[SEED] Successfully seeded Portal Analytics snapshot for: ${portalId}`);
}
