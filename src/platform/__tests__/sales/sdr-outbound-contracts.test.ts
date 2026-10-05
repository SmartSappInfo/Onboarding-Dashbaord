/**
 * @fileOverview Unit & Contract Tests for SDR Outbound Contracts (Phase 10 Milestone 4 Task 1)
 */

import { describe, it, expect } from 'vitest';
import {
  OutreachChannelSchema,
  OutreachStatusSchema,
  OutreachMessageDraftSchema,
  DraftOutreachParamsSchema,
  DraftOutreachResultSchema,
  OutboundSequenceConfigSchema,
  PrepareSequenceParamsSchema,
  PrepareSequenceResultSchema,
  DispatchOutreachParamsSchema,
  DispatchOutreachResultSchema,
  OutreachApprovalBindingSchema,
  OutreachMetricsSchema,
  SDR_OUTBOUND_ERROR_CODES,
  SdrOutboundError,
} from '@/platform/agents/sales/outbound/sdr-outbound-types';

describe('SDR Outbound Contracts & Zod v4 Schemas', () => {
  it('validates supported outreach channels', () => {
    expect(OutreachChannelSchema.parse('email')).toBe('email');
    expect(OutreachChannelSchema.parse('whatsapp')).toBe('whatsapp');
    expect(OutreachChannelSchema.parse('phone_script')).toBe('phone_script');
    expect(() => OutreachChannelSchema.parse('telegram')).toThrow();
  });

  it('validates outreach status lifecycle', () => {
    expect(OutreachStatusSchema.parse('draft')).toBe('draft');
    expect(OutreachStatusSchema.parse('pending_approval')).toBe('pending_approval');
    expect(OutreachStatusSchema.parse('approved')).toBe('approved');
    expect(OutreachStatusSchema.parse('rejected')).toBe('rejected');
    expect(OutreachStatusSchema.parse('dispatched')).toBe('dispatched');
    expect(OutreachStatusSchema.parse('failed')).toBe('failed');
    expect(() => OutreachStatusSchema.parse('invalid')).toThrow();
  });

  it('validates OutreachMessageDraftSchema with complete fields', () => {
    const validDraft = {
      id: 'draft_123',
      prospectId: 'prosp_456',
      contactId: 'con_789',
      channel: 'whatsapp',
      recipientName: 'Kofi Mensah',
      recipientAddress: '+233201234567',
      subject: undefined,
      body: 'Hello Kofi, reaching out from SmartSapp regarding tuition portal automation.',
      whatsappUrl: 'https://wa.me/233201234567?text=Hello',
      variablesUsed: ['prospect.name', 'contact.name'],
      groundingPoints: ['Detected tech: WordPress', 'Tuition portal missing'],
      status: 'draft',
      payloadHash: 'a'.repeat(64),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = OutreachMessageDraftSchema.parse(validDraft);
    expect(parsed.id).toBe('draft_123');
    expect(parsed.channel).toBe('whatsapp');
    expect(parsed.payloadHash).toHaveLength(64);
  });

  it('validates DraftOutreachParamsSchema and DraftOutreachResultSchema', () => {
    const validParams = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      prospectId: 'prosp_123',
      channel: 'email',
      sdrPersonaId: 'lead_sdr',
    };
    const parsedParams = DraftOutreachParamsSchema.parse(validParams);
    expect(parsedParams.organizationId).toBe('org_test');

    const validResult = {
      draft: {
        id: 'draft_999',
        prospectId: 'prosp_123',
        channel: 'email',
        recipientName: 'Sarah Doe',
        recipientAddress: 'sarah@academiacollege.edu.gh',
        subject: 'Modernizing Fees at Academia College',
        body: 'Dear Sarah...',
        variablesUsed: ['contact.name'],
        groundingPoints: ['High buying intent'],
        status: 'draft',
        payloadHash: 'b'.repeat(64),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      explainability: {
        what: 'Targeted outbound email for Academic Director',
        why: 'Verified school contact with high ICP score',
        expectedStateChange: 'Transition to pending human approval',
      },
    };
    const parsedResult = DraftOutreachResultSchema.parse(validResult);
    expect(parsedResult.explainability.what).toBeDefined();
  });

  it('validates OutboundSequenceConfigSchema constraints', () => {
    const validSequence = {
      id: 'seq_education_standard',
      name: 'Education Outbound 3-Touch',
      steps: [
        {
          stepIndex: 1,
          dayOffset: 0,
          channel: 'whatsapp',
          name: 'WhatsApp Intro',
          condition: 'always',
        },
        {
          stepIndex: 2,
          dayOffset: 2,
          channel: 'email',
          name: 'Value Proposition Followup',
          condition: 'no_reply',
        },
        {
          stepIndex: 3,
          dayOffset: 4,
          channel: 'phone_script',
          name: 'Direct Call Followup',
          condition: 'no_reply',
        },
      ],
      dailySendingLimit: 40,
    };

    const parsed = OutboundSequenceConfigSchema.parse(validSequence);
    expect(parsed.steps).toHaveLength(3);
    expect(parsed.dailySendingLimit).toBe(40);
  });

  it('validates PrepareSequenceParamsSchema and PrepareSequenceResultSchema', () => {
    const validPrep = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      leadIds: ['lead_1', 'lead_2'],
      sequenceConfig: {
        id: 'seq_1',
        name: 'Quick Sequence',
        steps: [
          {
            stepIndex: 1,
            dayOffset: 0,
            channel: 'email',
            name: 'First Email',
            condition: 'always',
          },
        ],
        dailySendingLimit: 25,
      },
      sdrPersonaId: 'lead_sdr',
    };
    const parsedPrep = PrepareSequenceParamsSchema.parse(validPrep);
    expect(parsedPrep.leadIds).toHaveLength(2);

    const validResult = {
      sequenceRunId: 'seq_1',
      totalRecipients: 2,
      totalDrafts: 2,
      drafts: [],
      payloadHash: 'a'.repeat(64),
      status: 'staged' as const,
    };
    const parsedResult = PrepareSequenceResultSchema.parse(validResult);
    expect(parsedResult.sequenceRunId).toBe('seq_1');
    expect(parsedResult.status).toBe('staged');
  });

  it('validates OutreachMetricsSchema', () => {
    const validMetrics = {
      totalDrafts: 14,
      pendingApprovals: 3,
      dispatched: 8,
      simulated: 4,
      channels: {
        whatsapp: 9,
        email: 4,
        phone: 1,
      },
    };
    const parsed = OutreachMetricsSchema.parse(validMetrics);
    expect(parsed.totalDrafts).toBe(14);
    expect(parsed.channels.whatsapp).toBe(9);
  });

  it('validates DispatchOutreachParamsSchema and DispatchOutreachResultSchema', () => {
    const validDispatch = {
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      draftId: 'draft_123',
      actionProposalId: 'prop_456',
      payloadHash: 'c'.repeat(64),
      dryRun: false,
    };
    const parsed = DispatchOutreachParamsSchema.parse(validDispatch);
    expect(parsed.dryRun).toBe(false);

    const validResult = {
      draftId: 'draft_123',
      status: 'dispatched',
      channel: 'whatsapp',
      recipientAddress: '+233201234567',
      whatsappUrl: 'https://wa.me/233201234567?text=Hi',
      dispatchedAt: new Date().toISOString(),
      simulated: false,
    };
    const parsedResult = DispatchOutreachResultSchema.parse(validResult);
    expect(parsedResult.status).toBe('dispatched');
  });

  it('validates OutreachApprovalBindingSchema', () => {
    const validBinding = {
      proposalId: 'prop_123',
      sequenceRunId: 'seq_run_999',
      channel: 'whatsapp',
      recipients: ['+233201234567', '+233249876543'],
      templateId: 'tpl_welcome',
      payloadHash: 'd'.repeat(64),
    };
    const parsed = OutreachApprovalBindingSchema.parse(validBinding);
    expect(parsed.recipients).toHaveLength(2);
  });

  it('provides structured error taxonomy and typed SdrOutboundError', () => {
    expect(SDR_OUTBOUND_ERROR_CODES.PAYLOAD_TAMPERED).toBe('PAYLOAD_TAMPERED');
    expect(SDR_OUTBOUND_ERROR_CODES.SALES_DEAD_MAN_PAUSED).toBe('SALES_DEAD_MAN_PAUSED');
    expect(SDR_OUTBOUND_ERROR_CODES.SELF_APPROVAL_FORBIDDEN).toBe('SELF_APPROVAL_FORBIDDEN');

    const error = new SdrOutboundError(
      'Hash does not match canonical payload.',
      'PAYLOAD_TAMPERED',
      400,
      { expected: 'hash1', actual: 'hash2' }
    );
    expect(error.code).toBe('PAYLOAD_TAMPERED');
    expect(error.statusCode).toBe(400);
    expect(error.metadata).toEqual({ expected: 'hash1', actual: 'hash2' });
  });
});
