/**
 * @fileOverview Unit & Contract Tests: CRM Signature Inquiry & Multi-Turn Contracts (Phase 9 Milestone 5)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Risk Vocabulary),
 * Rule 29 (Memory & Session TTL Governance), and Rule 47 (Never Trust the Model).
 */

import { describe, it, expect } from 'vitest';
import {
  CrmSignatureQuerySchema,
  CrmSignatureCitationSchema,
  CrmSignatureTimelineHighlightSchema,
  CrmSignatureResultSchema,
  CrmSignatureSessionSchema,
  CrmFollowupMessageInputSchema,
  CrmFollowupMessageResultSchema,
  CRM_SIGNATURE_ERROR_CODES,
  CrmSignatureError,
  type CrmSignatureQuery,
  type CrmSignatureResult,
} from '@/platform/agents/crm/signature/crm-signature-types';

describe('CRM Signature Inquiry Contracts (Milestone 5)', () => {
  describe('CrmSignatureQuerySchema', () => {
    it('validates a natural language inquiry query', () => {
      const validQuery: CrmSignatureQuery = {
        query: "What's going on with Greenfield School?",
        organizationId: 'org_123',
        workspaceId: 'ws_456',
        callerId: 'user_789',
        options: {
          dryRun: false,
          maxTokens: 3500,
        },
      };

      const parsed = CrmSignatureQuerySchema.parse(validQuery);
      expect(parsed.query).toBe("What's going on with Greenfield School?");
      expect(parsed.organizationId).toBe('org_123');
      expect(parsed.options?.dryRun).toBe(false);
      expect(parsed.options?.maxTokens).toBe(3500);
    });

    it('validates query with explicit entityId without query string', () => {
      const parsed = CrmSignatureQuerySchema.parse({
        entityId: 'ent_greenfield',
        organizationId: 'org_123',
        workspaceId: 'ws_456',
        callerId: 'user_789',
      });
      expect(parsed.entityId).toBe('ent_greenfield');
      expect(parsed.options?.dryRun).toBe(false);
      expect(parsed.options?.maxTokens).toBe(4000);
    });

    it('rejects empty query when entityId is missing', () => {
      expect(() =>
        CrmSignatureQuerySchema.parse({
          organizationId: 'org_123',
          workspaceId: 'ws_456',
          callerId: 'user_789',
        })
      ).toThrow();
    });
  });

  describe('CrmSignatureCitationSchema', () => {
    it('validates structured citation objects', () => {
      const citation = CrmSignatureCitationSchema.parse({
        id: 'cite_1',
        sourceType: 'meeting',
        sourceId: 'meet_99',
        title: 'Executive Sync with Dr. Jane Doe',
        snippet: 'Discussed budget constraints and delay in renewal decision.',
        timestamp: '2026-10-01T10:00:00Z',
        deepLinkUrl: '/admin/crm/meetings/meet_99',
        confidence: 0.95,
      });

      expect(citation.sourceType).toBe('meeting');
      expect(citation.confidence).toBe(0.95);
    });

    it('rejects invalid source types', () => {
      expect(() =>
        CrmSignatureCitationSchema.parse({
          id: 'cite_1',
          sourceType: 'unknown_source',
          sourceId: 's_1',
          title: 'Title',
          snippet: 'Snippet',
          timestamp: '2026-10-01T10:00:00Z',
        })
      ).toThrow();
    });
  });

  describe('CrmSignatureTimelineHighlightSchema', () => {
    it('validates timeline highlight events', () => {
      const highlight = CrmSignatureTimelineHighlightSchema.parse({
        id: 'hl_1',
        category: 'DEAL',
        title: 'Annual Enterprise Expansion Stalled',
        summary: 'Deal stuck in Negotiation for 28 days without updates.',
        timestamp: '2026-09-28T14:30:00Z',
        significance: 'CRITICAL',
        citationIds: ['cite_deal_1'],
      });

      expect(highlight.category).toBe('DEAL');
      expect(highlight.significance).toBe('CRITICAL');
      expect(highlight.citationIds).toHaveLength(1);
    });
  });

  describe('CrmSignatureResultSchema', () => {
    it('validates complete 14-step signature inquiry result', () => {
      const result: CrmSignatureResult = {
        entityId: 'ent_greenfield',
        workspaceId: 'ws_456',
        entityName: 'Greenfield School',
        healthScore: 42,
        relationshipStatus: 'ATTENTION_NEEDED',
        executiveNarrative:
          '### Greenfield School Overview\nGreenfield School is currently at risk due to a stalled $45,000 expansion deal and 2 overdue onboarding tasks.',
        timelineHighlights: [
          {
            id: 'hl_1',
            category: 'DEAL',
            title: 'Expansion Deal Stalled',
            summary: 'Stuck in negotiation for 32 days.',
            timestamp: '2026-09-15T00:00:00Z',
            significance: 'CRITICAL',
            citationIds: ['cite_1'],
          },
        ],
        activeRisks: [
          {
            id: 'factor_stalled_deal',
            category: 'STALLED_DEAL',
            severity: 'HIGH',
            title: 'Expansion Deal Stalled',
            description: 'Deal has been stalled for > 30 days',
            scoreContribution: 25,
            citationIds: ['cite_1'],
          },
        ],
        commitments: [
          {
            commitmentId: 'task_101',
            title: 'Send Revised Pricing Model',
            dueDate: '2026-09-20T00:00:00Z',
            daysOverdue: 14,
            assignedTo: 'Sarah Jenkins',
          },
        ],
        proposedActions: [
          {
            id: 'act_reengage_greenfield',
            entityId: 'ent_greenfield',
            workspaceId: 'ws_456',
            actionType: 'DRAFT_OUTREACH',
            priority: 'URGENT',
            riskLevel: 'L1_INTERNAL_DRAFT',
            explainability: {
              what: 'Draft re-engagement email to Dr. Jane Doe',
              why: 'Address stalled expansion and overdue pricing model promise',
              impact: 'Unblocks decision-maker review',
              blastRadius: {
                affectedRecordsCount: 1,
                financialExposureUsd: 0,
                isReversible: true,
              },
            },
            idempotencyKey: 'crm_action_ent_greenfield_abc123',
            targetCapabilityId: 'crm.outreach.draft_email',
            payload: { subject: 'Greenfield School & SmartSapp Next Steps' },
            requiresApproval: false,
            createdAt: '2026-10-04T20:00:00Z',
          },
        ],
        citations: [
          {
            id: 'cite_1',
            sourceType: 'deal',
            sourceId: 'deal_99',
            title: 'Campus Expansion Deal',
            snippet: 'Status: Negotiation ($45,000)',
            timestamp: '2026-09-15T00:00:00Z',
          },
        ],
        contextMetrics: {
          totalRecordsAnalyzed: 48,
          tokensUsed: 2340,
          executionDurationMs: 820,
          modelTier: 'pro',
        },
        sessionId: 'sess_crm_123',
        generatedAt: '2026-10-04T20:00:00Z',
      };

      const parsed = CrmSignatureResultSchema.parse(result);
      expect(parsed.healthScore).toBe(42);
      expect(parsed.relationshipStatus).toBe('ATTENTION_NEEDED');
      expect(parsed.proposedActions).toHaveLength(1);
      expect(parsed.citations).toHaveLength(1);
    });
  });

  describe('CrmSignatureSessionSchema & Multi-Turn Types', () => {
    it('validates multi-turn session with messages and 30-min TTL', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

      const session = CrmSignatureSessionSchema.parse({
        sessionId: 'sess_123',
        entityId: 'ent_greenfield',
        workspaceId: 'ws_456',
        organizationId: 'org_789',
        messages: [
          {
            id: 'msg_1',
            role: 'user',
            content: "What's going on with Greenfield School?",
            timestamp: now.toISOString(),
          },
          {
            id: 'msg_2',
            role: 'assistant',
            content: 'Greenfield School has 1 stalled deal and 1 overdue task.',
            timestamp: now.toISOString(),
            citationIds: ['cite_1'],
          },
        ],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt,
        turnCount: 1,
      });

      expect(session.sessionId).toBe('sess_123');
      expect(session.messages).toHaveLength(2);
      expect(session.turnCount).toBe(1);
    });

    it('validates follow-up input and result schemas', () => {
      const input = CrmFollowupMessageInputSchema.parse({
        sessionId: 'sess_123',
        workspaceId: 'ws_456',
        message: 'Why did the deal stall?',
      });
      expect(input.message).toBe('Why did the deal stall?');

      const result = CrmFollowupMessageResultSchema.parse({
        sessionId: 'sess_123',
        answer: 'The deal stalled due to lack of stakeholder follow-up on pricing.',
        citations: [],
        proposedActions: [],
        turnIndex: 2,
        generatedAt: new Date().toISOString(),
      });
      expect(result.turnIndex).toBe(2);
    });
  });

  describe('CrmSignatureError & Taxonomy', () => {
    it('creates typed errors with canonical HTTP mappings', () => {
      const err = new CrmSignatureError(
        'CRM_DEAD_MAN_PAUSED',
        'Autonomous reasoning temporarily disabled by safety switch'
      );
      expect(err.code).toBe('CRM_DEAD_MAN_PAUSED');
      expect(err.httpStatus).toBe(503);
      expect(err.name).toBe('CrmSignatureError');
    });

    it('verifies all canonical error codes are mapped', () => {
      expect(CRM_SIGNATURE_ERROR_CODES).toContain('AUTHENTICATION_REQUIRED');
      expect(CRM_SIGNATURE_ERROR_CODES).toContain('IDOR_VIOLATION');
      expect(CRM_SIGNATURE_ERROR_CODES).toContain('SESSION_EXPIRED');
      expect(CRM_SIGNATURE_ERROR_CODES).toContain('PROMPT_INJECTION_DETECTED');
      expect(CRM_SIGNATURE_ERROR_CODES).toContain('CRM_DEAD_MAN_PAUSED');
    });
  });
});
