/**
 * @fileOverview Unit & Integration Tests for Canonical Sales Capabilities (lead.*).
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. Wraps existing LeadIntelligenceEngine, ExplainableScoringEngine, and AutonomousSDREngine (Rule 69 Strangler Fig).
 * 2. Risk Categorization: L0_READ for searches/scores, L1_INTERNAL_DRAFT for enrichments/pitches (Rule 12).
 * 3. Anti-IDOR Tenant Scoping: Bound to principal organizationId and workspaceId (Rule 8, 47).
 * 4. Untrusted Content Defense: Scraped text & meta tags isolated in XML containers (Rule 13, 30).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  leadSearchCapability,
  leadEnrichCapability,
  leadScoreCapability,
  leadGetIntelligenceCapability,
  leadGetDecisionMakersCapability,
  leadGetBuyingSignalsCapability,
  leadGetRecommendedPitchCapability,
  leadGetObjectionHandlersCapability,
} from '../../capabilities/sales/lead-capabilities';
import { getCapability } from '../../capabilities/registry/capability-registry';

describe('Sales Canonical Capabilities (lead.*)', () => {
  const mockContext = {
    principal: {
      actorType: 'user' as const,
      userId: 'user_789',
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      grantedScopes: ['crm:entities:read', 'crm:entities:edit'],
      effectiveRole: 'admin',
    },
    correlationId: 'corr_001',
    timestamp: new Date().toISOString(),
  };

  it('exposes all 8 canonical capability contracts with correct risk levels and domains', () => {
    expect(leadSearchCapability.id).toBe('lead.search');
    expect(leadSearchCapability.risk.level).toBe('L0_READ');
    expect(leadSearchCapability.domain).toBe('lead_intelligence');

    expect(leadEnrichCapability.id).toBe('lead.enrich');
    expect(leadEnrichCapability.risk.level).toBe('L1_INTERNAL_DRAFT');

    expect(leadScoreCapability.id).toBe('lead.score');
    expect(leadScoreCapability.risk.level).toBe('L0_READ');

    expect(leadGetIntelligenceCapability.id).toBe('lead.get_intelligence');
    expect(leadGetIntelligenceCapability.risk.level).toBe('L0_READ');

    expect(leadGetDecisionMakersCapability.id).toBe('lead.get_decision_makers');
    expect(leadGetDecisionMakersCapability.risk.level).toBe('L0_READ');

    expect(leadGetBuyingSignalsCapability.id).toBe('lead.get_buying_signals');
    expect(leadGetBuyingSignalsCapability.risk.level).toBe('L0_READ');

    expect(leadGetRecommendedPitchCapability.id).toBe('lead.get_recommended_pitch');
    expect(leadGetRecommendedPitchCapability.risk.level).toBe('L1_INTERNAL_DRAFT');

    expect(leadGetObjectionHandlersCapability.id).toBe('lead.get_objection_handlers');
    expect(leadGetObjectionHandlersCapability.risk.level).toBe('L1_INTERNAL_DRAFT');
  });

  it('registers all 8 capabilities in the global capability registry', () => {
    expect(getCapability('lead.search')).toBeDefined();
    expect(getCapability('lead.enrich')).toBeDefined();
    expect(getCapability('lead.score')).toBeDefined();
    expect(getCapability('lead.get_intelligence')).toBeDefined();
    expect(getCapability('lead.get_decision_makers')).toBeDefined();
    expect(getCapability('lead.get_buying_signals')).toBeDefined();
    expect(getCapability('lead.get_recommended_pitch')).toBeDefined();
    expect(getCapability('lead.get_objection_handlers')).toBeDefined();
  });

  it('executes lead.search and returns typed result structure', async () => {
    const input = { queryText: 'Technology', limit: 10 };
    const result = await leadSearchCapability.execute(input, mockContext);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('leads');
      expect(result.data).toHaveProperty('totalCount');
      expect(Array.isArray(result.data.leads)).toBe(true);
    }
  });

  it('executes lead.score and returns explainable score breakdown', async () => {
    const input = { prospectId: 'lead_test_01', domain: 'example.com', industry: 'EdTech' };
    const result = await leadScoreCapability.execute(input, mockContext);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.data).toHaveProperty('priorityTier');
      expect(Array.isArray(result.data.topPositiveDrivers)).toBe(true);
    }
  });

  it('executes lead.get_decision_makers and returns verified contact list', async () => {
    const input = { prospectId: 'lead_test_01' };
    const result = await leadGetDecisionMakersCapability.execute(input, mockContext);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('contacts');
      expect(Array.isArray(result.data.contacts)).toBe(true);
    }
  });

  it('executes lead.get_buying_signals and returns signals array', async () => {
    const input = { prospectId: 'lead_test_01' };
    const result = await leadGetBuyingSignalsCapability.execute(input, mockContext);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('signals');
      expect(Array.isArray(result.data.signals)).toBe(true);
    }
  });

  it('executes lead.get_recommended_pitch and returns grounded pitch text', async () => {
    const input = { prospectId: 'lead_test_01' };
    const result = await leadGetRecommendedPitchCapability.execute(input, mockContext);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('pitchText');
      expect(typeof result.data.pitchText).toBe('string');
      expect(result.data.confidence).toBeGreaterThan(0);
    }
  });

  it('executes lead.get_objection_handlers and returns counterpoints', async () => {
    const input = { prospectId: 'lead_test_01' };
    const result = await leadGetObjectionHandlersCapability.execute(input, mockContext);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('objections');
      expect(result.data.objections.length).toBeGreaterThan(0);
      expect(result.data.objections[0]).toHaveProperty('counter');
    }
  });
});
