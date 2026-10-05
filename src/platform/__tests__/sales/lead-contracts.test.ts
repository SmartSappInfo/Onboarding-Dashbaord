/**
 * @fileOverview Unit & Contract Tests for Sales & Lead Intelligence Types & Zod v4 Schemas.
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. Strict Typing Policy: Zero `any` or `any[]` (Rule 4).
 * 2. Zod v4 Schema Conformance: Validates data structures for all lead intelligence entities (Rule 10, 47).
 * 3. Error Taxonomy: Validates SalesIntelligenceError and SALES_INTELLIGENCE_ERROR_CODES (Rule 48).
 */

import { describe, it, expect } from 'vitest';
import {
  LeadEntitySummarySchema,
  LeadEnrichmentDataSchema,
  LeadContactSchema,
  LeadScoreBreakdownSchema,
  LeadBuyingSignalSchema,
  LeadIntelligenceDossierSchema,
  AssembleLeadContextInputSchema,
  LeadSearchResultSchema,
  LeadPitchRecommendationSchema,
  LeadObjectionHandlerSchema,
  SALES_INTELLIGENCE_ERROR_CODES,
  SalesIntelligenceError,
} from '../../agents/sales/context/lead-context-types';

describe('Sales Intelligence Contracts & Zod v4 Schemas', () => {
  it('validates a valid LeadContactSchema', () => {
    const validContact = {
      name: 'Sarah Connor',
      email: 'sarah@skynet-defense.com',
      role: 'VP of Technology',
      confidence: 95,
      verificationStatus: 'verified' as const,
      deliverabilityScore: 98,
    };
    const parsed = LeadContactSchema.safeParse(validContact);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid email in LeadContactSchema', () => {
    const invalidContact = {
      name: 'Sarah Connor',
      email: 'invalid-email-address',
      role: 'VP of Technology',
      confidence: 95,
      verificationStatus: 'verified' as const,
    };
    const parsed = LeadContactSchema.safeParse(invalidContact);
    expect(parsed.success).toBe(false);
  });

  it('validates a complete LeadIntelligenceDossierSchema', () => {
    const dossier = {
      prospectId: 'lead_123',
      organizationId: 'org_456',
      workspaceId: 'ws_789',
      name: 'Cyberdyne Systems',
      domain: 'cyberdyne.com',
      industry: 'Artificial Intelligence',
      contacts: [
        {
          name: 'Miles Dyson',
          email: 'miles@cyberdyne.com',
          role: 'Director of Special Projects',
          confidence: 90,
          verificationStatus: 'verified' as const,
        },
      ],
      scoring: {
        overallScore: 88,
        priorityTier: 'critical' as const,
        icpFitPoints: 30,
        needPoints: 20,
        intentPoints: 20,
        engagementPoints: 10,
        similarityPoints: 8,
        topPositiveDrivers: ['Strong Tech Stack Fit', 'Active Hiring Signal'],
        topNegativeDrivers: [],
      },
      technologies: ['React', 'Next.js', 'PostgreSQL', 'TailwindCSS'],
      buyingSignals: [
        {
          id: 'sig_1',
          type: 'tech_adoption',
          title: 'Adopting AI tooling',
          strength: 'high' as const,
          detectedAt: new Date().toISOString(),
        },
      ],
      assembledAt: new Date().toISOString(),
    };
    const parsed = LeadIntelligenceDossierSchema.safeParse(dossier);
    expect(parsed.success).toBe(true);
  });

  it('validates LeadPitchRecommendationSchema and LeadObjectionHandlerSchema', () => {
    const pitch = {
      prospectId: 'lead_123',
      pitchText: 'Transform your AI workflows with SmartSapp autonomous agents.',
      targetPersona: 'VP of Technology',
      valuePropositions: ['10x lead response time', 'Zero code governance'],
      groundingPoints: ['Recent website update adopting AI', 'High ICP fit'],
      confidence: 92,
    };
    expect(LeadPitchRecommendationSchema.safeParse(pitch).success).toBe(true);

    const objection = {
      objection: 'We already use a standard CRM',
      counter: 'SmartSapp operates as a governed agentic capability layer underneath your existing tools.',
      evidence: ['Preserves dual-tier data model', 'Zero rip-and-replace migration'],
    };
    expect(LeadObjectionHandlerSchema.safeParse(objection).success).toBe(true);
  });

  it('validates auxiliary lead context schemas', () => {
    expect(
      LeadEntitySummarySchema.safeParse({
        id: 'entity_1',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        name: 'Cyberdyne',
        domain: 'cyberdyne.com',
        syncStatus: 'synced',
        syncedEntityId: 'sync_1',
      }).success
    ).toBe(true);

    expect(
      LeadEnrichmentDataSchema.safeParse({
        prospectId: 'lead_1',
        scannedAt: new Date().toISOString(),
        technologies: ['React'],
        sslValid: true,
        verifiedEmailsCount: 1,
      }).success
    ).toBe(true);

    expect(
      LeadScoreBreakdownSchema.safeParse({
        overallScore: 85,
        priorityTier: 'high',
        icpFitPoints: 25,
        needPoints: 20,
        intentPoints: 20,
        engagementPoints: 10,
        similarityPoints: 10,
        topPositiveDrivers: ['Great Fit'],
        topNegativeDrivers: [],
      }).success
    ).toBe(true);

    expect(
      LeadBuyingSignalSchema.safeParse({
        id: 'sig_1',
        type: 'tech_adoption',
        title: 'Adopting AI',
        strength: 'high',
        detectedAt: new Date().toISOString(),
      }).success
    ).toBe(true);

    expect(
      AssembleLeadContextInputSchema.safeParse({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        prospectId: 'prospect_1',
      }).success
    ).toBe(true);

    expect(
      LeadSearchResultSchema.safeParse({
        id: 'lead_1',
        name: 'Cyberdyne',
        domain: 'cyberdyne.com',
        score: 90,
        priorityTier: 'critical',
        contactsCount: 2,
        verifiedContactsCount: 1,
        syncStatus: 'synced',
      }).success
    ).toBe(true);
  });

  it('throws structured SalesIntelligenceError with code and status', () => {
    const err = new SalesIntelligenceError(
      'Lead not found in tenant workspace',
      'LEAD_NOT_FOUND',
      404
    );
    expect(err.name).toBe('SalesIntelligenceError');
    expect(err.code).toBe(SALES_INTELLIGENCE_ERROR_CODES.LEAD_NOT_FOUND);
    expect(err.statusCode).toBe(404);
  });
});
