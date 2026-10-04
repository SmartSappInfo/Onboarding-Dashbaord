/**
 * @fileOverview Unit & Boundary Test Suite for Account Context Contracts (Phase 9 Milestone 1)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Zod v4 schema validation), and Rule 69 (Dual-Tier CRM Data Model Preservation).
 */

import { describe, it, expect } from 'vitest';
import {
  Account360ContextSchema,
  AccountTimelineItemSchema,
  AccountEntitySummarySchema,
  AccountWorkspaceEntitySummarySchema,
  AccountContactSummarySchema,
  AccountDealSummarySchema,
  AccountMeetingSummarySchema,
  AccountNoteSummarySchema,
  AccountTaskSummarySchema,
  AccountFinancialSummarySchema,
  AccountMemoryFactSchema,
  AssembleAccountContextOptionsSchema,
  ACCOUNT_CONTEXT_ERROR_CODES,
  AccountContextError,
} from '../../../agents/crm/context/account-context-types';

describe('Account Context Contracts (Milestone 1)', () => {
  it('validates a valid Account360Context object with Zod v4', () => {
    const validContext = {
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      entityId: 'ent_789',
      entity: {
        id: 'ent_789',
        name: 'Greenfield International School',
        type: 'school',
        status: 'active',
        industry: 'education',
        email: 'info@greenfield.edu',
        phone: '+233201234567',
        city: 'Accra',
        address: '12 Independence Ave',
        createdAt: '2026-01-15T08:00:00.000Z',
      },
      workspaceEntity: {
        id: 'ws_456_ent_789',
        entityId: 'ent_789',
        workspaceId: 'ws_456',
        pipelineId: 'pipe_sales',
        stageId: 'stage_negotiation',
        stageName: 'Negotiation',
        assignedTo: {
          userId: 'user_1',
          name: 'Sarah Connor',
          email: 'sarah@smartsapp.com',
        },
        workspaceTags: ['high-value', 'q4-target'],
        leadStatus: 'qualified',
        updatedAt: '2026-10-01T12:00:00.000Z',
      },
      contacts: [
        {
          id: 'con_1',
          name: 'Dr. Arthur Greenfield',
          role: 'Headmaster',
          email: 'arthur@greenfield.edu',
          phone: '+233209876543',
          isPrimary: true,
          channelPreferences: ['email', 'whatsapp'],
        },
      ],
      deals: [
        {
          id: 'deal_1',
          title: 'Campus Management Suite Enterprise',
          pipelineId: 'pipe_sales',
          stageId: 'stage_negotiation',
          stageName: 'Negotiation',
          value: 45000,
          currency: 'USD',
          probability: 80,
          ageInDays: 32,
          expectedCloseDate: '2026-11-15',
          isStalled: false,
        },
      ],
      meetings: [
        {
          id: 'meet_1',
          title: 'Executive Demo & Pricing Review',
          startTime: '2026-10-02T14:00:00.000Z',
          attendees: ['arthur@greenfield.edu', 'sarah@smartsapp.com'],
          summary: 'Reviewed custom onboarding milestones. Client requested net-60 payment terms.',
          transcriptSnippet: 'We need confirmation on the SLA before board approval on Tuesday.',
          sentiment: 'positive',
        },
      ],
      notes: [
        {
          id: 'note_1',
          content: 'Follow-up call with bursar confirmed budget is allocated.',
          authorName: 'Sarah Connor',
          createdAt: '2026-10-03T09:30:00.000Z',
          category: 'commercial',
        },
      ],
      tasks: [
        {
          id: 'task_1',
          title: 'Send amended SLA agreement',
          status: 'pending',
          priority: 'high',
          dueDate: '2026-10-06T17:00:00.000Z',
          assignedToName: 'Sarah Connor',
          isOverdue: false,
        },
      ],
      finances: {
        openBalance: 0,
        overdueBalance: 0,
        currency: 'USD',
        invoiceCount: 0,
        agingCategory: 'CURRENT',
      },
      memories: [
        {
          id: 'mem_1',
          content: 'Greenfield School prefers WhatsApp for operational notifications and email for invoicing.',
          sourceType: 'note',
          confidence: 0.95,
          citationId: 'cite_123',
        },
      ],
      timeline: [
        {
          id: 'tl_1',
          timestamp: '2026-10-03T09:30:00.000Z',
          category: 'COMMERCIAL',
          title: 'Note Added',
          summary: 'Follow-up call with bursar confirmed budget is allocated.',
          actor: 'Sarah Connor',
          sourceRef: { type: 'note', id: 'note_1' },
        },
      ],
      metadata: {
        assembledAt: '2026-10-04T18:00:00.000Z',
        durationMs: 240,
        estimatedTokens: 1450,
        correlationId: 'corr_test_1',
        isKnapsackCompressed: false,
      },
    };

    const parsed = Account360ContextSchema.safeParse(validContext);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.entity.name).toBe('Greenfield International School');
      expect(parsed.data.workspaceEntity?.stageName).toBe('Negotiation');
      expect(parsed.data.deals[0].value).toBe(45000);
      expect(parsed.data.timeline[0].category).toBe('COMMERCIAL');
    }
  });

  it('validates partial and empty collections gracefully with defaults', () => {
    const minimalContext = {
      organizationId: 'org_min',
      workspaceId: 'ws_min',
      entityId: 'ent_min',
      entity: {
        id: 'ent_min',
        name: 'Minimal Account',
        type: 'client',
        status: 'prospect',
        industry: 'retail',
        createdAt: '2026-10-01T00:00:00.000Z',
      },
      finances: {
        openBalance: 0,
        overdueBalance: 0,
        currency: 'USD',
        invoiceCount: 0,
        agingCategory: 'CLEAR',
      },
      metadata: {
        assembledAt: '2026-10-04T18:00:00.000Z',
        durationMs: 50,
        estimatedTokens: 200,
        correlationId: 'corr_min',
        isKnapsackCompressed: false,
      },
    };

    const parsed = Account360ContextSchema.safeParse(minimalContext);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contacts).toEqual([]);
      expect(parsed.data.deals).toEqual([]);
      expect(parsed.data.meetings).toEqual([]);
      expect(parsed.data.notes).toEqual([]);
      expect(parsed.data.tasks).toEqual([]);
      expect(parsed.data.memories).toEqual([]);
      expect(parsed.data.timeline).toEqual([]);
    }
  });

  it('rejects invalid or missing tenant fields in AssembleAccountContextOptions', () => {
    const invalid = {
      entityId: 'ent_789',
      // missing organizationId & workspaceId
    };
    const parsed = AssembleAccountContextOptionsSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates AssembleAccountContextOptions defaults', () => {
    const valid = {
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      entityId: 'ent_789',
    };
    const parsed = AssembleAccountContextOptionsSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.maxTokens).toBe(4000);
      expect(parsed.data.includeMemory).toBe(true);
      expect(parsed.data.includeFinancials).toBe(true);
    }
  });

  it('throws typed AccountContextError with structured error codes and status codes', () => {
    const err = new AccountContextError(
      'Account entity not found',
      ACCOUNT_CONTEXT_ERROR_CODES.ENTITY_NOT_FOUND,
      404,
      { entityId: 'ent_missing' }
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AccountContextError');
    expect(err.code).toBe('ENTITY_NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.details).toEqual({ entityId: 'ent_missing' });
  });
});
