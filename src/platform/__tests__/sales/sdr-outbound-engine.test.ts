/**
 * @fileOverview Unit & Integration Tests for SDR Outbound Engine (Phase 10 Milestone 4 Task 2)
 */

import { describe, it, expect, vi } from 'vitest';
import { SdrOutboundEngine } from '@/platform/agents/sales/outbound/sdr-outbound-engine';
import type { Prospect } from '@/lib/lead-intelligence/types';

// Mock FieldsVariablesService to verify workspace rule SSOT delegation
vi.mock('@/lib/services/fields-variables-service', () => ({
  FieldsVariablesService: {
    resolveTemplateVariables: vi.fn(async (text: string, _ctx: unknown) => {
      return text.replace('{{prospect.name}}', 'Accra Grammar School');
    }),
  },
  resolveTemplateVariablesAction: vi.fn(),
  getVariablesAction: vi.fn(),
  getVariableValuesMapAction: vi.fn(),
  resolveEntityContextFromParamsAction: vi.fn(),
}));

const mockProspect: Prospect = {
  id: 'prosp_accra_grammar',
  name: 'Accra Grammar School',
  address: 'East Legon, Accra, Ghana',
  phone: '020 123 4567',
  website: 'https://accragrammar.edu.gh',
  status: 'new',
  contacts: [
    {
      id: 'con_sarah',
      name: 'Sarah Mensah',
      role: 'Head of Admissions',
      email: 'sarah@accragrammar.edu.gh',
      phone: '024 987 6543',
      verificationStatus: 'verified',
    },
  ],
  scoring: {
    overallScore: 82,
    icpFit: 30,
    needIntensity: 25,
    buyingIntent: 15,
    engagementVelocity: 12,
  },
  websiteScan: {
    technologies: ['WordPress', 'WooCommerce'],
    hasStudentPortal: false,
    hasOnlineFeePayment: false,
  },
  researchDossier: {
    summary: 'Established private K-12 institution in Accra looking for automated tuition fees.',
    highlights: ['Expanding to a second campus in 2027'],
    painPoints: ['Manual Mobile Money fee reconciliation delays'],
    techGaps: ['No direct parent communication or online portal'],
  },
};

describe('SdrOutboundEngine', () => {
  it('sanitizes Ghana local phone numbers to E.164 for WhatsApp Web launcher URLs', () => {
    // 10-digit standard Ghana number: 024 987 6543 -> 233249876543
    const url1 = SdrOutboundEngine.formatWhatsAppLauncherUrl('024 987 6543', 'Hello Sarah');
    expect(url1).toBe('https://wa.me/233249876543?text=Hello%20Sarah');

    // 9-digit without leading zero: 249876543 -> 233249876543
    const url2 = SdrOutboundEngine.formatWhatsAppLauncherUrl('249876543', 'Hello');
    expect(url2).toBe('https://wa.me/233249876543?text=Hello');

    // Number with leading 2330: +233 (0) 20 123 4567 -> 233201234567
    const url3 = SdrOutboundEngine.formatWhatsAppLauncherUrl('+233 (0) 20 123 4567', 'Test');
    expect(url3).toBe('https://wa.me/233201234567?text=Test');
  });

  it('computes deterministic canonical SHA-256 payloadHash across sorted keys', () => {
    const hash1 = SdrOutboundEngine.computeOutreachPayloadHash({
      b_field: 'beta',
      a_field: 'alpha',
    });
    const hash2 = SdrOutboundEngine.computeOutreachPayloadHash({
      a_field: 'alpha',
      b_field: 'beta',
    });
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('drafts personalized WhatsApp message with E.164 phone and grounding points', async () => {
    const result = await SdrOutboundEngine.draftOutreach(
      {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        prospectId: mockProspect.id,
        contactId: 'con_sarah',
        channel: 'whatsapp',
        sdrPersonaId: 'lead_sdr',
      },
      mockProspect,
      mockProspect.contacts?.[0]
    );

    expect(result.draft.channel).toBe('whatsapp');
    expect(result.draft.recipientName).toBe('Sarah Mensah');
    expect(result.draft.recipientAddress).toBe('+233249876543');
    expect(result.draft.whatsappUrl).toContain('https://wa.me/233249876543');
    expect(result.draft.body).toContain('Sarah Mensah');
    expect(result.draft.body).toContain('Accra Grammar School');
    expect(result.draft.groundingPoints.length).toBeGreaterThan(0);
    expect(result.explainability.what).toBeDefined();
    expect(result.explainability.why).toBeDefined();
    expect(result.explainability.expectedStateChange).toBeDefined();
  });

  it('drafts personalized Email with subject line and mailtoUrl', async () => {
    const result = await SdrOutboundEngine.draftOutreach(
      {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        prospectId: mockProspect.id,
        contactId: 'con_sarah',
        channel: 'email',
        sdrPersonaId: 'lead_sdr',
      },
      mockProspect,
      mockProspect.contacts?.[0]
    );

    expect(result.draft.channel).toBe('email');
    expect(result.draft.recipientAddress).toBe('sarah@accragrammar.edu.gh');
    expect(result.draft.subject).toBeDefined();
    expect(result.draft.mailtoUrl).toContain('mailto:sarah@accragrammar.edu.gh');
    expect(result.draft.payloadHash).toHaveLength(64);
  });

  it('delegates template token interpolation to FieldsVariablesService (Workspace SSOT)', async () => {
    const { FieldsVariablesService } = await import('@/lib/services/fields-variables-service');

    const result = await SdrOutboundEngine.draftOutreach(
      {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        prospectId: mockProspect.id,
        contactId: 'con_sarah',
        channel: 'whatsapp',
        templateText: 'Hello {{prospect.name}}, this is custom template outreach.',
        sdrPersonaId: 'lead_sdr',
      },
      mockProspect,
      mockProspect.contacts?.[0]
    );

    expect(FieldsVariablesService.resolveTemplateVariables).toHaveBeenCalled();
    expect(result.draft.body).toContain('Accra Grammar School');
  });

  it('compiles multi-touch sequence for multiple prospects with daily limits', async () => {
    const prepResult = await SdrOutboundEngine.compileSequence(
      {
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        leadIds: [mockProspect.id],
        sequenceConfig: {
          id: 'seq_3touch',
          name: 'Standard 3-Touch',
          steps: [
            { stepIndex: 1, dayOffset: 0, channel: 'whatsapp', name: 'Intro', condition: 'always' },
            { stepIndex: 2, dayOffset: 2, channel: 'email', name: 'Followup', condition: 'no_reply' },
          ],
          dailySendingLimit: 20,
        },
        sdrPersonaId: 'lead_sdr',
      },
      [mockProspect]
    );

    expect(prepResult.totalRecipients).toBe(1);
    expect(prepResult.totalDrafts).toBe(2);
    expect(prepResult.drafts).toHaveLength(2);
    expect(prepResult.payloadHash).toHaveLength(64);
    expect(prepResult.status).toBe('staged');
  });
});
