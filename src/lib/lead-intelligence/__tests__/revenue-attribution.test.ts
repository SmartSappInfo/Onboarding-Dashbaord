import { describe, it, expect } from 'vitest';
import { RevenueAttributionEngine, type BasicDealRecord } from '../attribution/RevenueAttributionEngine';
import type { Prospect } from '../types';

describe('RevenueAttributionEngine (Phase 11 Unit Tests)', () => {
  const sampleProspects: Prospect[] = [
    {
      id: 'p_accra_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      name: 'Accra Premier Grammar School',
      domain: 'accrapremier.edu.gh',
      address: 'Airport Residential, Accra, Greater Accra',
      industry: 'Education',
      rating: 4.8,
      source: 'google_places',
      websiteScan: {
        url: 'https://accrapremier.edu.gh',
        technologies: ['WordPress', 'Paystack'],
        hasFacebook: true,
        hasInstagram: true,
        hasLinkedIn: true,
        hasTwitter: false,
        sslValid: true,
        scannedAt: '2026-08-28T10:00:00Z'
      },
      contacts: [
        {
          name: 'Rev. Emmanuel Darko',
          email: 'edarko@accrapremier.edu.gh',
          role: 'Principal',
          confidence: 95,
          verificationStatus: 'verified',
          deliverabilityScore: 95
        }
      ],
      scoring: {
        overallScore: 85,
        needScore: 18,
        digitalMaturity: 15,
        buyingIntent: 20,
        budgetProbability: 15,
        decisionMakerFound: 15,
        engagement: 12
      },
      activeSignalsCount: 1,
      syncStatus: 'synced',
      syncedEntityId: 'ent_accra_1',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-29T12:00:00Z'
    },
    {
      id: 'p_kumasi_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      name: 'Kumasi Heritage Academy',
      domain: 'kumasiheritage.com',
      address: 'Ahodwo, Kumasi, Ashanti Region',
      industry: 'Education',
      rating: 4.2,
      source: 'csv_import',
      websiteScan: {
        url: 'https://kumasiheritage.com',
        technologies: ['Wix'],
        hasFacebook: true,
        hasInstagram: false,
        hasLinkedIn: false,
        hasTwitter: false,
        sslValid: true,
        scannedAt: '2026-06-01T10:00:00Z' // Stale (>30 days)
      },
      contacts: [
        {
          name: 'Sarah Mensah',
          email: 'smensah@kumasiheritage.com',
          role: 'Administrator',
          confidence: 80,
          verificationStatus: 'unverified'
        }
      ],
      scoring: {
        overallScore: 60,
        needScore: 12,
        digitalMaturity: 10,
        buyingIntent: 10,
        budgetProbability: 10,
        decisionMakerFound: 8,
        engagement: 10
      },
      activeSignalsCount: 0,
      syncStatus: 'unregistered',
      createdAt: '2026-06-01T10:00:00Z',
      updatedAt: '2026-06-01T10:00:00Z'
    }
  ];

  const sampleDeals: BasicDealRecord[] = [
    {
      id: 'deal_1',
      entityId: 'ent_accra_1',
      value: 45000,
      status: 'won',
      stageName: 'Closed Won',
      createdAt: '2026-08-05T10:00:00Z',
      closedAt: '2026-08-25T10:00:00Z' // 20 days cycle
    },
    {
      id: 'deal_2',
      entityId: 'ent_active_pipeline',
      value: 60000,
      status: 'active',
      stageName: 'Proposal Review',
      createdAt: '2026-08-15T10:00:00Z'
    }
  ];

  it('should calculate executive summary with pipeline and won revenue', () => {
    const summary = RevenueAttributionEngine.calculateExecutiveSummary(sampleProspects, sampleDeals, 'GHS');
    
    expect(summary.pipelineGenerated).toBe(60000);
    expect(summary.wonDealsCount).toBe(1);
    expect(summary.totalRevenue).toBe(45000);
    expect(summary.qualifiedLeads).toBe(1); // p_accra_1 has score 85 >= 70
    expect(summary.winRatePercent).toBe(50); // 1 won out of 2 deals
    expect(summary.avgSalesCycleDays).toBe(20);
    expect(summary.currency).toBe('GHS');
  });

  it('should handle empty cohorts gracefully with safe zero values (no NaN)', () => {
    const summary = RevenueAttributionEngine.calculateExecutiveSummary([], [], 'USD');
    
    expect(summary.pipelineGenerated).toBe(0);
    expect(summary.wonDealsCount).toBe(0);
    expect(summary.totalRevenue).toBe(0);
    expect(summary.winRatePercent).toBe(0);
    expect(summary.avgSalesCycleDays).toBe(21);
  });

  it('should compute channel source performance and conversion yield', () => {
    const sources = RevenueAttributionEngine.calculateSourcePerformance(sampleProspects, sampleDeals);
    
    expect(sources.length).toBeGreaterThanOrEqual(2);
    const placesSource = sources.find(s => s.source === 'google_places');
    expect(placesSource).toBeDefined();
    expect(placesSource?.leadsCount).toBe(1);
    expect(placesSource?.qualifiedCount).toBe(1);
    expect(placesSource?.wonCount).toBe(1);
    expect(placesSource?.revenue).toBe(45000);
    expect(placesSource?.conversionRate).toBe(100);

    const csvSource = sources.find(s => s.source === 'csv_import');
    expect(csvSource).toBeDefined();
    expect(csvSource?.leadsCount).toBe(1);
    expect(csvSource?.wonCount).toBe(0);
  });

  it('should analyze RevOps vendor credit efficiency and latency', () => {
    const providers = RevenueAttributionEngine.calculateProviderPerformance(sampleProspects);
    
    expect(providers.length).toBeGreaterThan(0);
    const builtWith = providers.find(p => p.providerName === 'BuiltWith API');
    expect(builtWith).toBeDefined();
    expect(builtWith?.successRate).toBe(100);

    const hunter = providers.find(p => p.providerName === 'Hunter.io');
    expect(hunter).toBeDefined();
    expect(hunter?.creditsUsed).toBeGreaterThan(0);
  });

  it('should evaluate 5-dimension Data Quality audit and suggest remediations', () => {
    const audit = RevenueAttributionEngine.calculateDataQualityAudit(sampleProspects);
    
    expect(audit.completenessScore).toBeGreaterThan(0);
    expect(audit.overallScore).toBeGreaterThan(0);
    expect(audit.remediationSuggestions.length).toBeGreaterThan(0);

    // Unverified contact in p_kumasi_1 should trigger remediation
    const emailRemediation = audit.remediationSuggestions.find(r => r.type === 'verify_emails');
    expect(emailRemediation).toBeDefined();
    expect(emailRemediation?.affectedCount).toBe(1);

    // Stale website scan in p_kumasi_1 should trigger remediation
    const staleRemediation = audit.remediationSuggestions.find(r => r.type === 'enrich_stale');
    expect(staleRemediation).toBeDefined();
  });

  it('should calculate geographic territory intelligence with density and high intent metrics', () => {
    const territories = RevenueAttributionEngine.calculateTerritoryIntelligence(sampleProspects);
    
    const accra = territories.find(t => t.region === 'Greater Accra');
    expect(accra).toBeDefined();
    expect(accra?.prospectsCount).toBe(1);
    expect(accra?.qualifiedCount).toBe(1);
    expect(accra?.highIntentCount).toBe(1);

    const ashanti = territories.find(t => t.region === 'Ashanti Region');
    expect(ashanti).toBeDefined();
    expect(ashanti?.prospectsCount).toBe(1);
    expect(ashanti?.qualifiedCount).toBe(0);
  });

  it('should generate complete consolidated report with ISO timestamp', () => {
    const report = RevenueAttributionEngine.generateCompleteReport(sampleProspects, sampleDeals, 'GHS');
    
    expect(report.summary).toBeDefined();
    expect(report.sources).toBeDefined();
    expect(report.providers).toBeDefined();
    expect(report.dataQuality).toBeDefined();
    expect(report.territories).toBeDefined();
    expect(report.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
