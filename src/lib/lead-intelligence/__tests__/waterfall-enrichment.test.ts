import { describe, it, expect, vi } from 'vitest';
import { WaterfallEnrichmentEngine } from '../waterfall/WaterfallEnrichmentEngine';
import type { Prospect, LeadIntelligenceSettings } from '../types';

describe('WaterfallEnrichmentEngine', () => {
  const baseProspect: Prospect = {
    id: 'pros_test_123',
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    name: 'Ridge International School',
    domain: 'ridgeinternationalschool.edu.gh',
    industry: 'Education',
    source: 'google_places',
    contacts: [],
    scoring: {
      overallScore: 50,
      needScore: 50,
      digitalMaturity: 50,
      buyingIntent: 50,
      budgetProbability: 50,
      decisionMakerFound: 50,
      engagement: 50
    },
    syncStatus: 'unregistered',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z'
  };

  const settings: LeadIntelligenceSettings = {
    waterfallEnabled: true
  };

  it('executes waterfall pipeline and tracks steps, latency, and credits', async () => {
    const mockGenkitFlow = vi.fn().mockImplementation(async (p: Prospect) => {
      return {
        ...p,
        scoring: {
          overallScore: 88,
          needScore: 90,
          digitalMaturity: 65,
          buyingIntent: 80,
          budgetProbability: 85,
          decisionMakerFound: 90,
          engagement: 75
        },
        aiInsights: {
          summary: 'High conversion opportunity.',
          problemsFound: ['No online fee collection portal'],
          opportunities: ['Implement automated fee billing'],
          suggestedProducts: ['SmartSapp School Management', 'Paystack Gateway'],
          estimatedRevenueOpportunity: 12000,
          recommendedPitch: 'Modernize student fee management with instant MoMo integration.',
          objectionsAnswered: []
        }
      };
    });

    const result = await WaterfallEnrichmentEngine.executeWaterfall(baseProspect, settings, mockGenkitFlow);

    expect(result).toBeDefined();
    expect(result.prospect).toBeDefined();
    expect(result.prospect.scoring?.overallScore).toBe(88);
    expect(result.prospect.aiInsights?.recommendedPitch).toContain('Modernize student fee management');
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.totalCreditsUsed).toBeGreaterThanOrEqual(1);
    expect(mockGenkitFlow).toHaveBeenCalledTimes(1);
  });

  it('preserves existing verified contacts and avoids unnecessary API calls', async () => {
    const prospectWithVerifiedContact: Prospect = {
      ...baseProspect,
      contacts: [
        {
          name: 'Kwame Mensah',
          email: 'principal@ridgeinternationalschool.edu.gh',
          role: 'Principal',
          confidence: 0.95,
          verificationStatus: 'verified'
        }
      ]
    };

    const result = await WaterfallEnrichmentEngine.executeWaterfall(prospectWithVerifiedContact, settings);

    expect(result.prospect.contacts.length).toBe(1);
    expect(result.prospect.contacts[0].email).toBe('principal@ridgeinternationalschool.edu.gh');
    // Hunter step should have been skipped because contact was already verified
    expect(result.steps.some(s => s.provider === 'hunter')).toBe(false);
  });
});
