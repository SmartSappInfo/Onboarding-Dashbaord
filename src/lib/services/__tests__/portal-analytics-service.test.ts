import { describe, it, expect } from 'vitest';
import { PortalAnalyticsService } from '../portal-analytics-service';

describe('PortalAnalyticsService Unit Logic', () => {
  it('computes 8-stage customer journey funnel conversion and drop-off rates accurately', () => {
    const funnel = PortalAnalyticsService.computeJourneyFunnelMetrics(
      1000, // visitors
      500,  // leads (50% conversion)
      300,  // members (60% conversion from leads)
      240,  // enrolled (80% from members)
      180,  // engaged (75% from enrolled)
      120,  // completed (67% from engaged)
      60,   // purchased (50% from completed)
      18    // advocates (30% from purchased)
    );

    expect(funnel.length).toBe(8);

    // Stage 1: Visitor
    expect(funnel[0].stage).toBe('visitor');
    expect(funnel[0].count).toBe(1000);
    expect(funnel[0].conversionFromPrevPercent).toBe(100);
    expect(funnel[0].dropOffPercent).toBe(0);

    // Stage 2: Lead
    expect(funnel[1].stage).toBe('lead');
    expect(funnel[1].count).toBe(500);
    expect(funnel[1].conversionFromPrevPercent).toBe(50);
    expect(funnel[1].dropOffPercent).toBe(50);

    // Stage 3: Member
    expect(funnel[2].stage).toBe('member');
    expect(funnel[2].count).toBe(300);
    expect(funnel[2].conversionFromPrevPercent).toBe(60);
    expect(funnel[2].dropOffPercent).toBe(40);

    // Stage 8: Advocate
    expect(funnel[7].stage).toBe('advocate');
    expect(funnel[7].count).toBe(18);
    expect(funnel[7].conversionFromPrevPercent).toBe(30);
    expect(funnel[7].dropOffPercent).toBe(70);
  });

  it('generates grounded AI correlation insights with actionable recommendations', () => {
    const business = {
      totalVisitors: 1000,
      totalLeads: 400,
      totalMembers: 200,
      visitorToLeadRatePercent: 40,
      leadToMemberRatePercent: 50,
      grossRevenue: 15000,
      currency: 'USD',
      mrr: 6000,
      churnRatePercent: 4.0,
      averageOrderValue: 199,
      estimatedLtv: 480,
    };

    const learning = {
      totalEnrollments: 180,
      activeLearners: 140,
      averageCourseCompletionPercent: 65,
      totalLessonsCompleted: 520,
      averageAssessmentScorePercent: 82,
      topDropOffLessons: [],
    };

    const community = {
      dau: 80,
      mau: 180,
      dauMauRatioPercent: 44,
      totalPosts: 40,
      totalComments: 150,
      topContributors: [],
      spaceActivity: [],
    };

    const insights = PortalAnalyticsService.generateAiCorrelationInsights(business, learning, community);

    expect(insights.length).toBeGreaterThanOrEqual(4);
    insights.forEach(ins => {
      expect(ins.id).toBeTruthy();
      expect(ins.category).toBeTruthy();
      expect(ins.title).toBeTruthy();
      expect(ins.insight).toBeTruthy();
      expect(ins.actionableRecommendation).toBeTruthy();
      expect(ins.impactScore).toBeGreaterThan(0);
    });
  });
});
