/**
 * @fileOverview Unit Tests: Canonical CRM Action, Risk, Hygiene & Proposal Contracts (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 (Anti-IDOR Multi-Tenant Lock),
 * Rule 12 (Risk Vocabulary), Rule 19 (Deterministic Idempotency Keys),
 * Rule 21/22 (Two-Phase Action Model & SHA-256 Binding), Rule 27 (Saga Rollback Matrix),
 * Rule 41 (Explainability Grid), and Rule 48 (Sanitized Error Taxonomy).
 */

import { describe, it, expect } from 'vitest';
import {
  CrmRiskAssessmentSchema,
  CrmRiskLevelEnum,
  CrmProposedActionSchema,
  CrmActionTypeEnum,
  CrmActionPriorityEnum,
  CrmHygieneDefectSchema,
  CrmLeadEnrichmentRequestSchema,
  CrmLeadEnrichmentResultSchema,
  CrmEntityDeduplicationSchema,
  CRM_ROLLBACK_MATRIX,
  CRM_ACTION_ERROR_CODES,
  CrmActionError,
  computeCrmActionIdempotencyKey,
} from '@/platform/agents/crm/actions/crm-action-types';

describe('Canonical CRM Action Contracts', () => {
  it('validates a valid CrmRiskAssessmentSchema object', () => {
    const validAssessment = {
      entityId: 'ent_acme_123',
      workspaceId: 'ws_sales_456',
      overallScore: 68,
      riskLevel: CrmRiskLevelEnum.enum.ELEVATED,
      factors: [
        {
          id: 'factor_1',
          category: 'STALLED_DEAL',
          severity: 'HIGH',
          title: 'Deal stalled in Proposal stage',
          description: 'No activity for 21 days exceeding 14d stage SLA',
          scoreContribution: 25,
          citationIds: ['deal_999'],
        },
        {
          id: 'factor_2',
          category: 'DARK_ACCOUNT',
          severity: 'MEDIUM',
          title: 'Dormant communications',
          description: 'Last touchpoint was 48 days ago',
          scoreContribution: 20,
          citationIds: ['meet_101'],
        },
      ],
      stalledDeals: [
        {
          dealId: 'deal_999',
          title: 'Enterprise License Expansion',
          daysInStage: 21,
          thresholdDays: 14,
          stage: 'proposal',
          value: 75000,
        },
      ],
      darkAccount: {
        isDark: true,
        daysInactive: 48,
        thresholdDays: 45,
        lastInteractionAt: '2026-08-15T10:00:00Z',
      },
      overdueCommitments: [],
      agingReceivables: [
        {
          invoiceId: 'inv_402',
          invoiceNumber: 'INV-2026-402',
          dueDate: '2026-07-01T00:00:00Z',
          daysOverdue: 65,
          outstandingBalance: 12500,
        },
      ],
      hygieneDefects: [],
      evaluatedAt: '2026-10-04T12:00:00Z',
    };

    const parsed = CrmRiskAssessmentSchema.safeParse(validAssessment);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.overallScore).toBe(68);
      expect(parsed.data.riskLevel).toBe('ELEVATED');
      expect(parsed.data.factors).toHaveLength(2);
      expect(parsed.data.darkAccount.isDark).toBe(true);
    }
  });

  it('rejects invalid scores outside 0-100 in CrmRiskAssessmentSchema', () => {
    const invalidAssessment = {
      entityId: 'ent_acme_123',
      workspaceId: 'ws_sales_456',
      overallScore: 150, // Invalid
      riskLevel: 'CRITICAL',
      factors: [],
      stalledDeals: [],
      darkAccount: { isDark: false, daysInactive: 10, thresholdDays: 45 },
      overdueCommitments: [],
      agingReceivables: [],
      hygieneDefects: [],
      evaluatedAt: '2026-10-04T12:00:00Z',
    };

    const parsed = CrmRiskAssessmentSchema.safeParse(invalidAssessment);
    expect(parsed.success).toBe(false);
  });

  it('validates CrmProposedActionSchema with Rule 41 explainability and Rule 12 risk levels', () => {
    const validAction = {
      id: 'act_reengage_01',
      entityId: 'ent_acme_123',
      workspaceId: 'ws_sales_456',
      actionType: CrmActionTypeEnum.enum.UPDATE_STAGE,
      priority: CrmActionPriorityEnum.enum.HIGH,
      riskLevel: 'L2_STATE_MUTATION',
      explainability: {
        what: 'Transition Enterprise deal to Negotiation stage',
        why: 'Contract redlines received and legal approved on recent call',
        impact: 'Maintains deal momentum and prevents slip into Q4',
        blastRadius: {
          affectedRecordsCount: 1,
          financialExposureUsd: 75000,
          isReversible: true,
        },
      },
      idempotencyKey: 'crm_action_ent_acme_123_abc12345',
      targetCapabilityId: 'crm.deal.update_stage',
      compensatingCapabilityId: 'crm.deal.revert_stage',
      payload: {
        dealId: 'deal_999',
        previousStage: 'proposal',
        newStage: 'negotiation',
      },
      requiresApproval: true,
      createdAt: '2026-10-04T12:00:00Z',
    };

    const parsed = CrmProposedActionSchema.safeParse(validAction);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.actionType).toBe('UPDATE_STAGE');
      expect(parsed.data.riskLevel).toBe('L2_STATE_MUTATION');
      expect(parsed.data.explainability.blastRadius.isReversible).toBe(true);
    }
  });

  it('computes deterministic idempotency keys (Rule 19)', () => {
    const key1 = computeCrmActionIdempotencyKey('ent_123', 'UPDATE_STAGE', { dealId: 'deal_1', stage: 'negotiation' });
    const key2 = computeCrmActionIdempotencyKey('ent_123', 'UPDATE_STAGE', { dealId: 'deal_1', stage: 'negotiation' });
    const key3 = computeCrmActionIdempotencyKey('ent_123', 'UPDATE_STAGE', { dealId: 'deal_2', stage: 'negotiation' });

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toMatch(/^crm_action_ent_123_[a-f0-9]{16}$/);
  });

  it('validates CRM_ROLLBACK_MATRIX provides compensating capabilities for all mutating actions (Rule 27)', () => {
    expect(CRM_ROLLBACK_MATRIX.UPDATE_STAGE).toBeDefined();
    expect(CRM_ROLLBACK_MATRIX.UPDATE_STAGE.compensatingCapabilityId).toBe('crm.deal.revert_stage');

    expect(CRM_ROLLBACK_MATRIX.ASSIGN_OWNER).toBeDefined();
    expect(CRM_ROLLBACK_MATRIX.ASSIGN_OWNER.compensatingCapabilityId).toBe('crm.workspace_entity.revert_owner');

    expect(CRM_ROLLBACK_MATRIX.APPLY_TAGS).toBeDefined();
    expect(CRM_ROLLBACK_MATRIX.APPLY_TAGS.compensatingCapabilityId).toBe('crm.tag.remove');

    expect(CRM_ROLLBACK_MATRIX.CREATE_TASK).toBeDefined();
    expect(CRM_ROLLBACK_MATRIX.CREATE_TASK.compensatingCapabilityId).toBe('crm.task.delete');

    expect(CRM_ROLLBACK_MATRIX.ENRICH_LEAD).toBeDefined();
    expect(CRM_ROLLBACK_MATRIX.ENRICH_LEAD.compensatingCapabilityId).toBe('crm.workspace_entity.revert_enrichment');

    expect(CRM_ROLLBACK_MATRIX.RESOLVE_DUPLICATE).toBeDefined();
    expect(CRM_ROLLBACK_MATRIX.RESOLVE_DUPLICATE.compensatingCapabilityId).toBe('crm.entity.unmerge_preview');
  });

  it('validates CrmHygieneDefectSchema and Deduplication Schema', () => {
    const hygieneDefect = {
      id: 'hyg_01',
      type: 'MISSING_DECISION_MAKER',
      severity: 'HIGH',
      description: 'Account has no contact tagged as Economic Buyer or Decision Maker',
      suggestedRemediation: 'Review recent attendees of meeting #meet_101 to designate VP Engineering as decision maker',
    };
    const parsedHygiene = CrmHygieneDefectSchema.safeParse(hygieneDefect);
    expect(parsedHygiene.success).toBe(true);

    const dedupCandidate = {
      id: 'dedup_01',
      workspaceId: 'ws_sales_456',
      primaryEntityId: 'ent_acme_123',
      duplicateEntityId: 'ent_acme_corp_789',
      matchConfidence: 0.94,
      matchingFields: ['name', 'domain', 'tax_id'],
      status: 'pending_review',
      detectedAt: '2026-10-04T12:00:00Z',
    };
    const parsedDedup = CrmEntityDeduplicationSchema.safeParse(dedupCandidate);
    expect(parsedDedup.success).toBe(true);
  });

  it('validates CrmLeadEnrichment schemas', () => {
    const request = {
      entityId: 'ent_acme_123',
      workspaceId: 'ws_sales_456',
      domain: 'acme.com',
      companyName: 'Acme Corporation',
    };
    const parsedReq = CrmLeadEnrichmentRequestSchema.safeParse(request);
    expect(parsedReq.success).toBe(true);

    const result = {
      entityId: 'ent_acme_123',
      workspaceId: 'ws_sales_456',
      firmographics: {
        industry: 'Enterprise Software',
        employeeCount: 250,
        estimatedRevenueUsd: 45000000,
        headquartersLocation: 'San Francisco, CA',
        foundedYear: 2018,
      },
      technographics: ['Next.js', 'Google Cloud Platform', 'Tailwind CSS', 'Stripe'],
      enrichedAt: '2026-10-04T12:00:00Z',
      confidenceScore: 0.92,
      source: 'simulated_enrichment_provider',
    };
    const parsedRes = CrmLeadEnrichmentResultSchema.safeParse(result);
    expect(parsedRes.success).toBe(true);
  });

  it('verifies CrmActionError maps codes correctly (Rule 48)', () => {
    const error = new CrmActionError('CRM_DEAD_MAN_PAUSED', 'Autonomous CRM actions are paused by governance');
    expect(error.code).toBe(CRM_ACTION_ERROR_CODES.CRM_DEAD_MAN_PAUSED);
    expect(error.name).toBe('CrmActionError');
    expect(error.httpStatus).toBe(503);

    const idorError = new CrmActionError('IDOR_VIOLATION', 'Tenant IDOR violation detected');
    expect(idorError.httpStatus).toBe(403);

    const tamperedError = new CrmActionError('PAYLOAD_TAMPERED', 'Payload SHA-256 hash mismatch');
    expect(tamperedError.httpStatus).toBe(400);
  });
});
