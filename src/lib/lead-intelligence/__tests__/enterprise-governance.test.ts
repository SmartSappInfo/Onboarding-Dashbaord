import { describe, it, expect } from 'vitest';
import { EnterpriseGovernanceEngine } from '../governance/EnterpriseGovernanceEngine';
import type { 
  Prospect, 
  ProviderHealthRecord, 
  ProviderRoutingRule, 
  TerritoryRule, 
  DataImportColumnMapping 
} from '../types';

describe('EnterpriseGovernanceEngine (Phase 14 Unit Tests)', () => {
  it('should generate default 10-dimension governance configuration', () => {
    const config = EnterpriseGovernanceEngine.getDefaultGovernanceConfig('ws_test', 'org_test');

    expect(config.workspaceId).toBe('ws_test');
    expect(config.discovery.defaultCity).toBe('Accra');
    expect(config.enrichment.routingRules.length).toBeGreaterThan(0);
    expect(config.verification.enforceDisposableBlock).toBe(true);
    expect(config.credits.monthlyBudget).toBe(10000);
    expect(config.territoryRules.length).toBe(2);
    expect(config.compliance.dpaConsentRequired).toBe(true);
  });

  describe('evaluateProviderHealth', () => {
    it('should evaluate healthy provider status', () => {
      const health = EnterpriseGovernanceEngine.evaluateProviderHealth(
        'google_places',
        true,
        220,
        1.2,
        1420,
        10000,
        2
      );

      expect(health.status).toBe('healthy');
      expect(health.successRate).toBe(99);
      expect(health.connected).toBe(true);
    });

    it('should trigger warning on high latency or near quota', () => {
      const highLatency = EnterpriseGovernanceEngine.evaluateProviderHealth(
        'builtwith',
        true,
        2800, // > 2500ms
        2.0,
        500,
        2000,
        5
      );

      expect(highLatency.status).toBe('warning');

      const nearQuota = EnterpriseGovernanceEngine.evaluateProviderHealth(
        'hunter',
        true,
        400,
        1.0,
        4600, // > 85% of 5000
        5000,
        3
      );

      expect(nearQuota.status).toBe('warning');
    });

    it('should trigger error status on quota exhaustion or high error rates', () => {
      const quotaExhausted = EnterpriseGovernanceEngine.evaluateProviderHealth(
        'builtwith',
        true,
        500,
        0,
        2000, // 100% of 2000
        2000,
        5
      );

      expect(quotaExhausted.status).toBe('error');

      const highError = EnterpriseGovernanceEngine.evaluateProviderHealth(
        'hunter',
        true,
        600,
        25, // 25% error rate
        100,
        5000,
        3
      );

      expect(highError.status).toBe('error');
    });

    it('should mark disconnected providers', () => {
      const disconnected = EnterpriseGovernanceEngine.evaluateProviderHealth(
        'hunter',
        false,
        0,
        0,
        0,
        5000,
        3
      );

      expect(disconnected.status).toBe('disconnected');
    });
  });

  describe('routeEnrichmentProvider', () => {
    const mockProviders: ProviderHealthRecord[] = [
      {
        providerId: 'hunter',
        name: 'Hunter.io',
        status: 'healthy',
        connected: true,
        latencyMs: 350,
        successRate: 98,
        monthlyQuota: 5000,
        monthlyUsed: 1000,
        costPerCall: 3,
        lastCheckedAt: '2026-08-30T10:00:00Z'
      },
      {
        providerId: 'email_verifier',
        name: 'Direct SMTP',
        status: 'healthy',
        connected: true,
        latencyMs: 500,
        successRate: 99,
        monthlyQuota: 25000,
        monthlyUsed: 2000,
        costPerCall: 1,
        lastCheckedAt: '2026-08-30T10:00:00Z'
      }
    ];

    it('should select primary provider within credit cap', () => {
      const rule: ProviderRoutingRule = {
        channel: 'email',
        priorityProviders: ['hunter', 'email_verifier'],
        fallbackEnabled: true,
        maxCreditsPerRecord: 3
      };

      const result = EnterpriseGovernanceEngine.routeEnrichmentProvider(rule, mockProviders, 500);

      expect(result.selectedProvider).toBe('hunter');
      expect(result.estimatedCost).toBe(3);
      expect(result.usedFallback).toBe(false);
    });

    it('should skip provider exceeding credit cap and select next priority', () => {
      const rule: ProviderRoutingRule = {
        channel: 'email',
        priorityProviders: ['hunter', 'email_verifier'],
        fallbackEnabled: true,
        maxCreditsPerRecord: 2 // Hunter costs 3, so skip to email_verifier which costs 1
      };

      const result = EnterpriseGovernanceEngine.routeEnrichmentProvider(rule, mockProviders, 500);

      expect(result.selectedProvider).toBe('email_verifier');
      expect(result.estimatedCost).toBe(1);
    });

    it('should trigger open web fallback when all providers exceed budget', () => {
      const rule: ProviderRoutingRule = {
        channel: 'email',
        priorityProviders: ['hunter'],
        fallbackEnabled: true,
        maxCreditsPerRecord: 1 // Hunter costs 3
      };

      const result = EnterpriseGovernanceEngine.routeEnrichmentProvider(rule, mockProviders, 500);

      expect(result.selectedProvider).toBeNull();
      expect(result.usedFallback).toBe(true);
    });
  });

  describe('assignTerritoryRep', () => {
    const rules: TerritoryRule[] = [
      {
        id: 'rule_accra',
        name: 'Greater Accra Hub',
        region: 'Greater Accra',
        assignedRepIds: ['rep_accra_1', 'rep_accra_2'],
        autoAssign: true,
        minScore: 70,
        createdAt: '2026-08-30T10:00:00Z',
        updatedAt: '2026-08-30T10:00:00Z'
      },
      {
        id: 'rule_ashanti',
        name: 'Ashanti Metro',
        region: 'Ashanti',
        assignedRepIds: ['rep_kumasi'],
        autoAssign: true,
        minScore: 60,
        createdAt: '2026-08-30T10:00:00Z',
        updatedAt: '2026-08-30T10:00:00Z'
      }
    ];

    it('should assign sales rep for matching region and score threshold', () => {
      const qualifiedProspect: Prospect = {
        id: 'p_accra_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        name: 'Accra Academy High',
        domain: 'accraacademy.edu.gh',
        address: 'East Legon, Greater Accra, Ghana',
        source: 'google_places',
        contacts: [],
        scoring: { overallScore: 82, needScore: 15, digitalMaturity: 15, buyingIntent: 15, budgetProbability: 15, decisionMakerFound: 15, engagement: 7 },
        syncStatus: 'unregistered',
        createdAt: '2026-08-30T10:00:00Z',
        updatedAt: '2026-08-30T10:00:00Z'
      };

      const assignment = EnterpriseGovernanceEngine.assignTerritoryRep(qualifiedProspect, rules);

      expect(assignment.matchedRuleId).toBe('rule_accra');
      expect(assignment.assignedRepId).toBeDefined();
      expect(['rep_accra_1', 'rep_accra_2']).toContain(assignment.assignedRepId);
    });

    it('should not assign if prospect score is below threshold', () => {
      const lowScoreProspect: Prospect = {
        id: 'p_accra_low',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        name: 'Small Kiosk',
        domain: 'smallkiosk.gh',
        address: 'Greater Accra, Ghana',
        source: 'google_places',
        contacts: [],
        scoring: { overallScore: 45, needScore: 5, digitalMaturity: 5, buyingIntent: 5, budgetProbability: 5, decisionMakerFound: 5, engagement: 20 },
        syncStatus: 'unregistered',
        createdAt: '2026-08-30T10:00:00Z',
        updatedAt: '2026-08-30T10:00:00Z'
      };

      const assignment = EnterpriseGovernanceEngine.assignTerritoryRep(lowScoreProspect, rules);

      expect(assignment.assignedRepId).toBeUndefined();
    });
  });

  describe('calculateCreditLedger', () => {
    it('should calculate consumption and remaining credits correctly', () => {
      const usage = {
        discoveryUsed: 2000,
        enrichmentUsed: 3500,
        aiUsed: 1500,
        verificationUsed: 500
      };

      const ledger = EnterpriseGovernanceEngine.calculateCreditLedger(usage, 10000, 70);

      expect(ledger.totalAllocated).toBe(10000);
      expect(ledger.used).toBe(7500);
      expect(ledger.remaining).toBe(2500);
      expect(ledger.warningTriggered).toBe(true); // 7500 / 10000 = 75% >= 70%
      expect(ledger.resetDate).toBeDefined();
    });
  });

  describe('validateImportPayload', () => {
    const mapping: DataImportColumnMapping = {
      name: 'Company',
      domain: 'Website',
      contactEmail: 'Email'
    };

    it('should validate clean CSV rows', () => {
      const rows = [
        { Company: 'St. Peter Int School', Website: 'stpeter.edu.gh', Email: 'smensah@stpeter.edu.gh' },
        { Company: 'Kumasi Tech High', Website: 'kumasitech.com', Email: 'info@kumasitech.com' }
      ];

      const validation = EnterpriseGovernanceEngine.validateImportPayload(rows, mapping);

      expect(validation.totalRows).toBe(2);
      expect(validation.validRows).toBe(2);
      expect(validation.invalidRows).toBe(0);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect missing names, invalid email formats, and duplicates', () => {
      const rows = [
        { Company: '', Website: 'noname.com', Email: 'test@noname.com' }, // missing name
        { Company: 'Bad Email School', Website: 'bademail.com', Email: 'notanemail' }, // bad email
        { Company: 'Duplicate A', Website: 'dupe.com', Email: 'a@dupe.com' },
        { Company: 'Duplicate B', Website: 'https://dupe.com', Email: 'b@dupe.com' } // duplicate domain
      ];

      const validation = EnterpriseGovernanceEngine.validateImportPayload(rows, mapping);

      expect(validation.validRows).toBe(1);
      expect(validation.invalidRows).toBe(3);
      expect(validation.duplicateRows).toBe(1);
      expect(validation.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
