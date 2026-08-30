/**
 * Enterprise Governance, Territory Rules & Provider Routing Engine (Lead Intelligence 2.0 - Phase 14)
 * UI Spec Sections 56-63, PRD Sections 3.10 & 4.9, Idea Doc Sections 20, 56-63
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Pure deterministic logic for provider health evaluation, circuit breakers, dynamic waterfall routing, and territory assignment.
 * 2. 10-Dimension governance defaults for autonomous backoffice control.
 * 3. 7-Step Import payload validation with strict format checks.
 * 4. Strict Zero-`any` typing.
 */

import type {
  ProviderId,
  ProviderHealthRecord,
  ProviderRoutingRule,
  TerritoryRule,
  EnterpriseGovernanceConfig,
  CreditLedgerSummary,
  DataImportColumnMapping,
  DataImportValidationResult,
  Prospect
} from '../types';

export class EnterpriseGovernanceEngine {
  /**
   * Generates default Enterprise Governance Configuration across all 10 dimensions (UI Spec Section 56).
   */
  public static getDefaultGovernanceConfig(
    workspaceId: string,
    organizationId: string
  ): EnterpriseGovernanceConfig {
    return {
      workspaceId,
      organizationId,
      discovery: {
        defaultRadiusKm: 25,
        defaultCity: 'Accra',
        rateLimitRps: 5
      },
      enrichment: {
        cacheTtlDays: 30,
        routingRules: [
          {
            channel: 'email',
            priorityProviders: ['hunter', 'email_verifier'],
            fallbackEnabled: true,
            maxCreditsPerRecord: 3
          },
          {
            channel: 'technographics',
            priorityProviders: ['builtwith'],
            fallbackEnabled: true,
            maxCreditsPerRecord: 5
          },
          {
            channel: 'firmographics',
            priorityProviders: ['google_places'],
            fallbackEnabled: false,
            maxCreditsPerRecord: 2
          }
        ]
      },
      verification: {
        enforceDisposableBlock: true,
        smtpTimeoutMs: 3000,
        catchAllRiskThreshold: 65
      },
      scoring: {
        autoRescoreOnSignal: true,
        defaultModelId: 'default_model'
      },
      credits: {
        monthlyBudget: 10000,
        warningThresholdPercent: 80,
        enforceHardCap: false
      },
      territoryRules: [
        {
          id: 'rule_greater_accra',
          name: 'Greater Accra Strategic Accounts',
          region: 'Greater Accra',
          assignedRepIds: ['rep_accra_1', 'rep_accra_2'],
          autoAssign: true,
          minScore: 70,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'rule_ashanti',
          name: 'Ashanti & Kumasi Metro',
          region: 'Ashanti',
          assignedRepIds: ['rep_kumasi_1'],
          autoAssign: true,
          minScore: 60,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      compliance: {
        retentionDays: 365,
        dpaConsentRequired: true,
        autoAnonymizeUnclaimed: false
      },
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Evaluates Provider Health, Circuit Breaker State & Latency (UI Spec Section 57).
   */
  public static evaluateProviderHealth(
    providerId: ProviderId,
    connected: boolean,
    latencyMs: number,
    errorRate: number, // 0 - 100
    monthlyUsed: number,
    monthlyQuota: number,
    costPerCall: number,
    lastError?: string
  ): ProviderHealthRecord {
    const names: Record<ProviderId, string> = {
      google_places: 'Google Places API',
      hunter: 'Hunter.io Email Discovery',
      builtwith: 'BuiltWith Technographics API',
      email_verifier: 'SMTP / MX Direct Verifier',
      gemini_dossier: 'Gemini AI Research Engine'
    };

    let status: 'healthy' | 'warning' | 'error' | 'disconnected' = 'healthy';

    if (!connected) {
      status = 'disconnected';
    } else if (errorRate >= 20 || (monthlyQuota > 0 && monthlyUsed >= monthlyQuota)) {
      status = 'error';
    } else if (latencyMs > 2500 || errorRate >= 5 || (monthlyQuota > 0 && monthlyUsed / monthlyQuota >= 0.85)) {
      status = 'warning';
    }

    const successRate = Math.max(0, Math.min(100, Math.round(100 - errorRate)));

    return {
      providerId,
      name: names[providerId] || providerId,
      status,
      connected,
      latencyMs,
      successRate,
      monthlyQuota,
      monthlyUsed,
      costPerCall,
      lastError,
      lastCheckedAt: new Date().toISOString()
    };
  }

  /**
   * Evaluates dynamic waterfall routing based on priority, provider health, and credit caps (UI Spec Section 58).
   */
  public static routeEnrichmentProvider(
    rule: ProviderRoutingRule,
    healthyProviders: ProviderHealthRecord[],
    currentCreditBalance: number
  ): {
    selectedProvider: ProviderId | null;
    estimatedCost: number;
    usedFallback: boolean;
    reason: string;
  } {
    for (const pid of rule.priorityProviders) {
      const record = healthyProviders.find(p => p.providerId === pid);
      if (record && record.connected && record.status !== 'error') {
        if (record.costPerCall <= rule.maxCreditsPerRecord && record.costPerCall <= currentCreditBalance) {
          return {
            selectedProvider: pid,
            estimatedCost: record.costPerCall,
            usedFallback: false,
            reason: `Selected primary provider ${record.name} within budget (${record.costPerCall} credits)`
          };
        }
      }
    }

    if (rule.fallbackEnabled) {
      return {
        selectedProvider: null,
        estimatedCost: 0,
        usedFallback: true,
        reason: 'Fallback to zero-cost open web scraper heuristic enabled'
      };
    }

    return {
      selectedProvider: null,
      estimatedCost: 0,
      usedFallback: false,
      reason: 'No healthy provider found within cost cap and fallback disabled'
    };
  }

  /**
   * Evaluates Territory Rules and assigns sales rep based on region and score thresholds (UI Spec Section 49 & 56).
   */
  public static assignTerritoryRep(
    prospect: Prospect,
    rules: TerritoryRule[]
  ): {
    matchedRuleId?: string;
    assignedRepId?: string;
    ruleName?: string;
  } {
    const score = prospect.scoring?.overallScore ?? 0;
    const addressLower = (prospect.address || '').toLowerCase();
    const industryLower = (prospect.industry || '').toLowerCase();

    for (const rule of rules) {
      if (!rule.autoAssign || rule.assignedRepIds.length === 0) continue;
      if (score < rule.minScore) continue;

      const regionMatch = addressLower.includes(rule.region.toLowerCase());
      const industryMatch = !rule.targetIndustry || industryLower.includes(rule.targetIndustry.toLowerCase());

      if (regionMatch && industryMatch) {
        // Deterministic round-robin index based on prospect ID hash
        const charSum = prospect.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const repIndex = charSum % rule.assignedRepIds.length;
        const assignedRepId = rule.assignedRepIds[repIndex];

        return {
          matchedRuleId: rule.id,
          assignedRepId,
          ruleName: rule.name
        };
      }
    }

    return {};
  }

  /**
   * Aggregates Credit Ledger and computes warning status (UI Spec Section 59 & 60).
   */
  public static calculateCreditLedger(
    usage: {
      discoveryUsed: number;
      enrichmentUsed: number;
      aiUsed: number;
      verificationUsed: number;
    },
    monthlyBudget: number,
    warningThresholdPercent: number = 80
  ): CreditLedgerSummary {
    const used = usage.discoveryUsed + usage.enrichmentUsed + usage.aiUsed + usage.verificationUsed;
    const remaining = Math.max(0, monthlyBudget - used);
    const warningTriggered = (used / Math.max(1, monthlyBudget)) >= (warningThresholdPercent / 100);

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const resetDate = nextMonth.toISOString();

    return {
      totalAllocated: monthlyBudget,
      used,
      remaining,
      discoveryUsed: usage.discoveryUsed,
      enrichmentUsed: usage.enrichmentUsed,
      aiUsed: usage.aiUsed,
      verificationUsed: usage.verificationUsed,
      warningTriggered,
      resetDate
    };
  }

  /**
   * Validates 7-Step Import Wizard CSV rows before committing to Firestore (UI Spec Section 62).
   */
  public static validateImportPayload(
    rows: Record<string, string>[],
    mapping: DataImportColumnMapping
  ): DataImportValidationResult {
    const errors: { row: number; field: string; message: string }[] = [];
    const seenDomains = new Set<string>();
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    rows.forEach((row, index) => {
      const rowNum = index + 1;
      let isRowValid = true;

      // 1. Mandatory Name Validation
      const name = row[mapping.name]?.trim();
      if (!name) {
        errors.push({ row: rowNum, field: 'name', message: 'Institution or Company Name is required' });
        isRowValid = false;
      }

      // 2. Email Validation (if mapped)
      if (mapping.contactEmail && row[mapping.contactEmail]) {
        const email = row[mapping.contactEmail].trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push({ row: rowNum, field: 'contactEmail', message: `Invalid email address: ${email}` });
          isRowValid = false;
        }
      }

      // 3. Domain Deduplication Check
      if (mapping.domain && row[mapping.domain]) {
        const domain = row[mapping.domain].trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (domain) {
          if (seenDomains.has(domain)) {
            duplicateRows++;
            errors.push({ row: rowNum, field: 'domain', message: `Duplicate domain "${domain}" in CSV payload` });
            isRowValid = false;
          } else {
            seenDomains.add(domain);
          }
        }
      }

      if (isRowValid) {
        validRows++;
      } else {
        invalidRows++;
      }
    });

    return {
      totalRows: rows.length,
      validRows,
      invalidRows,
      duplicateRows,
      errors
    };
  }
}
