import { describe, it, expect } from 'vitest';
import { evaluateTriggerConfig } from '../automation-trigger-config';
import type { Automation, AutomationTriggerDef } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal valid Automation factory.
 * Builds triggerTypes automatically from triggers so tests stay DRY.
 */
function makeAutomation(partial: {
  triggers?: AutomationTriggerDef[];
  nodes?: any[];
  [k: string]: unknown;
}): Automation {
  const triggers: AutomationTriggerDef[] = partial.triggers ?? [
    { id: 't_default', type: 'ENTITY_CREATED', config: {} },
  ];

  return {
    id: 'auto-test',
    name: 'Test Automation',
    workspaceIds: ['ws-1'],
    triggers,
    triggerTypes: triggers.map((t) => t.type),
    nodes: partial.nodes ?? [],
    edges: [],
    isActive: true,
    createdAt: '',
    updatedAt: '',
    createdBy: 'user-test',
    ...partial,
  } as Automation;
}

/**
 * Build a standard enriched payload (as the orchestrator would produce it).
 * The orchestrator always injects _firingTrigger before calling evaluateTriggerConfig.
 */
function payload(
  firingTrigger: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return { _firingTrigger: firingTrigger, workspaceId: 'ws-1', ...extra };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('evaluateTriggerConfig', () => {
  // ── Foundational behaviour ────────────────────────────────────────────────

  describe('foundational behaviour', () => {
    it('returns true when there is no trigger and no constraints', () => {
      const auto = makeAutomation({ triggers: [] });
      expect(evaluateTriggerConfig(auto, {})).toBe(true);
    });

    it('returns true for unconstrained trigger (empty config)', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
      });
      expect(evaluateTriggerConfig(auto, payload('ENTITY_CREATED'))).toBe(true);
    });

    it('returns true for a trigger type that has no dedicated config checks (e.g. ENTITY_UPDATED)', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'ENTITY_UPDATED', config: {} }],
      });
      expect(evaluateTriggerConfig(auto, payload('ENTITY_UPDATED'))).toBe(true);
    });
  });

  // ── Multi-trigger defensive guard ─────────────────────────────────────────

  describe('multi-trigger guard', () => {
    it('DENIES when _firingTrigger is absent and automation has > 1 trigger', () => {
      const auto = makeAutomation({
        triggers: [
          { id: 't1', type: 'TAG_ADDED', config: { tagIds: ['vip'] } },
          { id: 't2', type: 'FORM_SUBMITTED', config: { formId: 'form-1' } },
        ],
      });
      // No _firingTrigger in payload — cannot know which config to validate
      expect(evaluateTriggerConfig(auto, { workspaceId: 'ws-1' })).toBe(false);
    });

    it('allows when _firingTrigger is present on multi-trigger automation (trigger 1 matches)', () => {
      const auto = makeAutomation({
        triggers: [
          { id: 't1', type: 'TAG_ADDED', config: { tagIds: ['vip'] } },
          { id: 't2', type: 'FORM_SUBMITTED', config: { formId: 'form-1' } },
        ],
      });
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { tagId: 'vip' }))
      ).toBe(true);
    });

    it('allows when _firingTrigger is present on multi-trigger automation (trigger 2 matches)', () => {
      const auto = makeAutomation({
        triggers: [
          { id: 't1', type: 'TAG_ADDED', config: { tagIds: ['vip'] } },
          { id: 't2', type: 'FORM_SUBMITTED', config: { formId: 'form-1' } },
        ],
      });
      expect(
        evaluateTriggerConfig(auto, payload('FORM_SUBMITTED', { formId: 'form-1' }))
      ).toBe(true);
    });

    it('denies when _firingTrigger matches but its config does not (trigger 2 wrong formId)', () => {
      const auto = makeAutomation({
        triggers: [
          { id: 't1', type: 'TAG_ADDED', config: { tagIds: ['vip'] } },
          { id: 't2', type: 'FORM_SUBMITTED', config: { formId: 'form-1' } },
        ],
      });
      expect(
        evaluateTriggerConfig(auto, payload('FORM_SUBMITTED', { formId: 'form-WRONG' }))
      ).toBe(false);
    });

    it('each trigger uses its own isolated config, not trigger[0]\'s config', () => {
      // Trigger 0 requires tagId 'vip'. Trigger 1 requires formId 'form-1'.
      // If trigger[1] were evaluated against trigger[0]'s config it would pass
      // the tag check trivially (no tagId in payload) but that is the wrong config.
      const auto = makeAutomation({
        triggers: [
          { id: 't1', type: 'TAG_ADDED', config: { tagIds: ['vip'] } },
          { id: 't2', type: 'FORM_SUBMITTED', config: { formId: 'form-1' } },
        ],
      });
      // FORM_SUBMITTED with wrong formId must fail against trigger[1]'s config
      expect(
        evaluateTriggerConfig(auto, payload('FORM_SUBMITTED', { formId: 'wrong' }))
      ).toBe(false);
      // FORM_SUBMITTED with correct formId must pass
      expect(
        evaluateTriggerConfig(auto, payload('FORM_SUBMITTED', { formId: 'form-1' }))
      ).toBe(true);
    });
  });

  // ── TAG_ADDED / TAG_REMOVED ────────────────────────────────────────────────

  describe('TAG_ADDED', () => {
    function tagAuto(config: Record<string, unknown>) {
      return makeAutomation({
        triggers: [{ id: 't1', type: 'TAG_ADDED', config }],
      });
    }

    it('allows any tag when tagIds is empty', () => {
      const auto = tagAuto({});
      expect(evaluateTriggerConfig(auto, payload('TAG_ADDED', { tagId: 'any-tag' }))).toBe(true);
    });

    it('allows matching tagId', () => {
      const auto = tagAuto({ tagIds: ['tag_hot'] });
      expect(evaluateTriggerConfig(auto, payload('TAG_ADDED', { tagId: 'tag_hot' }))).toBe(true);
    });

    it('denies non-matching tagId', () => {
      const auto = tagAuto({ tagIds: ['tag_hot'] });
      expect(evaluateTriggerConfig(auto, payload('TAG_ADDED', { tagId: 'tag_cold' }))).toBe(false);
    });

    it('allows when one of multiple tagIds matches', () => {
      const auto = tagAuto({ tagIds: ['tag_a', 'tag_b', 'tag_c'] });
      expect(evaluateTriggerConfig(auto, payload('TAG_ADDED', { tagId: 'tag_b' }))).toBe(true);
    });

    it('filters by entityType when configured', () => {
      const auto = tagAuto({ entityType: 'institution' });
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { entityType: 'institution' }))
      ).toBe(true);
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { entityType: 'person' }))
      ).toBe(false);
    });

    it('appliedBy=manual: allows manual, denies automatic', () => {
      const auto = tagAuto({ appliedBy: 'manual' });
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { appliedBy: 'user-123' }))
      ).toBe(true);
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { appliedBy: 'automation' }))
      ).toBe(false);
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { appliedBy: 'system-import' }))
      ).toBe(false);
    });

    it('appliedBy=automatic: allows automation, denies manual userId', () => {
      const auto = tagAuto({ appliedBy: 'automatic' });
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { appliedBy: 'automation' }))
      ).toBe(true);
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { appliedBy: 'user-123' }))
      ).toBe(false);
    });
  });

  describe('TAG_REMOVED', () => {
    it('applies the same tagId filtering as TAG_ADDED', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'TAG_REMOVED', config: { tagIds: ['tag_vip'] } }],
      });
      expect(evaluateTriggerConfig(auto, payload('TAG_REMOVED', { tagId: 'tag_vip' }))).toBe(true);
      expect(evaluateTriggerConfig(auto, payload('TAG_REMOVED', { tagId: 'tag_other' }))).toBe(false);
    });
  });

  // ── Stage / Pipeline ───────────────────────────────────────────────────────

  describe('DEAL_STAGE_CHANGED', () => {
    it('allows any stage when config has no constraints', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'DEAL_STAGE_CHANGED', config: {} }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('DEAL_STAGE_CHANGED', { pipelineId: 'p1', stageId: 's1' }))
      ).toBe(true);
    });

    it('filters by pipelineId', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'DEAL_STAGE_CHANGED', config: { pipelineId: 'p1' } }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('DEAL_STAGE_CHANGED', { pipelineId: 'p1' }))
      ).toBe(true);
      expect(
        evaluateTriggerConfig(auto, payload('DEAL_STAGE_CHANGED', { pipelineId: 'p2' }))
      ).toBe(false);
    });

    it('filters by stageId', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'DEAL_STAGE_CHANGED', config: { stageId: 's-closed' } }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('DEAL_STAGE_CHANGED', { stageId: 's-closed' }))
      ).toBe(true);
      expect(
        evaluateTriggerConfig(auto, payload('DEAL_STAGE_CHANGED', { stageId: 's-open' }))
      ).toBe(false);
    });

    it('filters by both pipelineId AND stageId (AND logic)', () => {
      const auto = makeAutomation({
        triggers: [
          { id: 't1', type: 'DEAL_STAGE_CHANGED', config: { pipelineId: 'p1', stageId: 's-won' } },
        ],
      });
      expect(
        evaluateTriggerConfig(auto, payload('DEAL_STAGE_CHANGED', { pipelineId: 'p1', stageId: 's-won' }))
      ).toBe(true);
      // Right pipeline, wrong stage
      expect(
        evaluateTriggerConfig(auto, payload('DEAL_STAGE_CHANGED', { pipelineId: 'p1', stageId: 's-lost' }))
      ).toBe(false);
      // Right stage, wrong pipeline
      expect(
        evaluateTriggerConfig(auto, payload('DEAL_STAGE_CHANGED', { pipelineId: 'p2', stageId: 's-won' }))
      ).toBe(false);
    });
  });

  // ── Form / Survey ──────────────────────────────────────────────────────────

  describe('FORM_SUBMITTED', () => {
    it('allows any form when no formId configured', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'FORM_SUBMITTED', config: {} }],
      });
      expect(evaluateTriggerConfig(auto, payload('FORM_SUBMITTED', { formId: 'any' }))).toBe(true);
    });

    it('allows matching formId', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'FORM_SUBMITTED', config: { formId: 'form-abc' } }],
      });
      expect(evaluateTriggerConfig(auto, payload('FORM_SUBMITTED', { formId: 'form-abc' }))).toBe(true);
    });

    it('denies non-matching formId', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'FORM_SUBMITTED', config: { formId: 'form-abc' } }],
      });
      expect(evaluateTriggerConfig(auto, payload('FORM_SUBMITTED', { formId: 'form-xyz' }))).toBe(false);
    });
  });

  describe('SURVEY_SUBMITTED', () => {
    it('filters by surveyId', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'SURVEY_SUBMITTED', config: { surveyId: 'survey-1' } }],
      });
      expect(evaluateTriggerConfig(auto, payload('SURVEY_SUBMITTED', { surveyId: 'survey-1' }))).toBe(true);
      expect(evaluateTriggerConfig(auto, payload('SURVEY_SUBMITTED', { surveyId: 'survey-2' }))).toBe(false);
    });
  });

  // ── Meeting ────────────────────────────────────────────────────────────────

  describe('MEETING_REGISTRANT_ADDED', () => {
    it('allows any meeting when no meetingTypeId configured', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'MEETING_REGISTRANT_ADDED', config: {} }],
      });
      expect(evaluateTriggerConfig(auto, payload('MEETING_REGISTRANT_ADDED', { meetingTypeId: 'mt-1' }))).toBe(true);
    });

    it('filters by meetingTypeId', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'MEETING_REGISTRANT_ADDED', config: { meetingTypeId: 'mt-onboarding' } }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('MEETING_REGISTRANT_ADDED', { meetingTypeId: 'mt-onboarding' }))
      ).toBe(true);
      expect(
        evaluateTriggerConfig(auto, payload('MEETING_REGISTRANT_ADDED', { meetingTypeId: 'mt-sales' }))
      ).toBe(false);
    });

    it('applies meetingTypeId filter for all four meeting trigger types', () => {
      const meetingTriggers = [
        'MEETING_CREATED',
        'MEETING_REGISTRANT_ADDED',
        'MEETING_REGISTRANT_ATTENDED',
        'MEETING_REGISTRANT_NO_SHOW',
      ] as const;

      for (const triggerType of meetingTriggers) {
        const auto = makeAutomation({
          triggers: [{ id: 't1', type: triggerType, config: { meetingTypeId: 'mt-vip' } }],
        });
        expect(
          evaluateTriggerConfig(auto, payload(triggerType, { meetingTypeId: 'mt-vip' })),
          `${triggerType}: matching meetingTypeId should pass`
        ).toBe(true);
        expect(
          evaluateTriggerConfig(auto, payload(triggerType, { meetingTypeId: 'mt-other' })),
          `${triggerType}: mismatched meetingTypeId should fail`
        ).toBe(false);
      }
    });
  });

  // ── Campaign ───────────────────────────────────────────────────────────────

  describe('campaign triggers', () => {
    const campaignTriggers = [
      'CAMPAIGN_DELIVERED',
      'CAMPAIGN_FAILED',
      'CAMPAIGN_NOT_DELIVERED',
      'CAMPAIGN_OPENED',
      'CAMPAIGN_CLICKED',
    ] as const;

    it('allows any campaign when no campaignId configured', () => {
      for (const triggerType of campaignTriggers) {
        const auto = makeAutomation({
          triggers: [{ id: 't1', type: triggerType, config: {} }],
        });
        expect(
          evaluateTriggerConfig(auto, payload(triggerType, { campaignId: 'c-any' })),
          `${triggerType}: no config should pass`
        ).toBe(true);
      }
    });

    it('filters by campaignId for all campaign trigger types', () => {
      for (const triggerType of campaignTriggers) {
        const auto = makeAutomation({
          triggers: [{ id: 't1', type: triggerType, config: { campaignId: 'c-welcome' } }],
        });
        expect(
          evaluateTriggerConfig(auto, payload(triggerType, { campaignId: 'c-welcome' })),
          `${triggerType}: matching campaignId should pass`
        ).toBe(true);
        expect(
          evaluateTriggerConfig(auto, payload(triggerType, { campaignId: 'c-promo' })),
          `${triggerType}: mismatched campaignId should fail`
        ).toBe(false);
      }
    });
  });

  // ── Entity Field Changed ───────────────────────────────────────────────────

  describe('ENTITY_FIELD_CHANGED', () => {
    it('allows any field when fieldPath not configured', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'ENTITY_FIELD_CHANGED', config: {} }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('ENTITY_FIELD_CHANGED', { fieldPath: 'status' }))
      ).toBe(true);
    });

    it('filters by fieldPath', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'ENTITY_FIELD_CHANGED', config: { fieldPath: 'status' } }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('ENTITY_FIELD_CHANGED', { fieldPath: 'status' }))
      ).toBe(true);
      expect(
        evaluateTriggerConfig(auto, payload('ENTITY_FIELD_CHANGED', { fieldPath: 'name' }))
      ).toBe(false);
    });
  });

  // ── Score Changed ──────────────────────────────────────────────────────────

  describe('SCORE_CHANGED', () => {
    it('denies when score field is absent from payload', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'SCORE_CHANGED', config: {} }],
      });
      expect(evaluateTriggerConfig(auto, payload('SCORE_CHANGED', {}))).toBe(false);
    });

    it('allows any_change when overallScore is present', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'SCORE_CHANGED', config: { operator: 'any_change' } }],
      });
      expect(evaluateTriggerConfig(auto, payload('SCORE_CHANGED', { overallScore: 42 }))).toBe(true);
    });

    it('greater_than: allows when score exceeds threshold', () => {
      const auto = makeAutomation({
        triggers: [
          { id: 't1', type: 'SCORE_CHANGED', config: { operator: 'greater_than', threshold: 70 } },
        ],
      });
      expect(evaluateTriggerConfig(auto, payload('SCORE_CHANGED', { overallScore: 71 }))).toBe(true);
      expect(evaluateTriggerConfig(auto, payload('SCORE_CHANGED', { overallScore: 70 }))).toBe(false);
      expect(evaluateTriggerConfig(auto, payload('SCORE_CHANGED', { overallScore: 50 }))).toBe(false);
    });

    it('less_than: allows when score is below threshold', () => {
      const auto = makeAutomation({
        triggers: [
          { id: 't1', type: 'SCORE_CHANGED', config: { operator: 'less_than', threshold: 30 } },
        ],
      });
      expect(evaluateTriggerConfig(auto, payload('SCORE_CHANGED', { overallScore: 29 }))).toBe(true);
      expect(evaluateTriggerConfig(auto, payload('SCORE_CHANGED', { overallScore: 30 }))).toBe(false);
    });

    it('uses custom scoreType field from config', () => {
      const auto = makeAutomation({
        triggers: [
          {
            id: 't1',
            type: 'SCORE_CHANGED',
            config: { scoreType: 'engagementScore', operator: 'greater_than', threshold: 50 },
          },
        ],
      });
      expect(
        evaluateTriggerConfig(auto, payload('SCORE_CHANGED', { engagementScore: 55 }))
      ).toBe(true);
      expect(
        evaluateTriggerConfig(auto, payload('SCORE_CHANGED', { engagementScore: 45 }))
      ).toBe(false);
      // overallScore present but wrong field — should still fail
      expect(
        evaluateTriggerConfig(auto, payload('SCORE_CHANGED', { overallScore: 99 }))
      ).toBe(false);
    });
  });

  // ── Webpage Visited ────────────────────────────────────────────────────────

  describe('WEBPAGE_VISITED', () => {
    it('allows any URL when no urlPattern configured', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'WEBPAGE_VISITED', config: {} }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('WEBPAGE_VISITED', { url: 'https://example.com/pricing' }))
      ).toBe(true);
    });

    it('allows when URL contains the pattern', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'WEBPAGE_VISITED', config: { urlPattern: '/pricing' } }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('WEBPAGE_VISITED', { url: 'https://example.com/pricing' }))
      ).toBe(true);
    });

    it('denies when URL does not contain the pattern', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'WEBPAGE_VISITED', config: { urlPattern: '/pricing' } }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('WEBPAGE_VISITED', { url: 'https://example.com/home' }))
      ).toBe(false);
    });

    it('wildcard pattern * matches any URL', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'WEBPAGE_VISITED', config: { urlPattern: '*' } }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('WEBPAGE_VISITED', { url: 'https://example.com/anything' }))
      ).toBe(true);
    });
  });

  // ── Event Recorded ─────────────────────────────────────────────────────────

  describe('EVENT_RECORDED', () => {
    it('allows any event when no eventName configured', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'EVENT_RECORDED', config: {} }],
      });
      expect(evaluateTriggerConfig(auto, payload('EVENT_RECORDED', { eventName: 'clicked_cta' }))).toBe(true);
    });

    it('filters by eventName', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'EVENT_RECORDED', config: { eventName: 'clicked_cta' } }],
      });
      expect(evaluateTriggerConfig(auto, payload('EVENT_RECORDED', { eventName: 'clicked_cta' }))).toBe(true);
      expect(evaluateTriggerConfig(auto, payload('EVENT_RECORDED', { eventName: 'page_view' }))).toBe(false);
    });
  });

  // ── Webhook Received ──────────────────────────────────────────────────────

  describe('WEBHOOK_RECEIVED', () => {
    it('allows when ingressId is not in payload', () => {
      const auto = makeAutomation({
        id: 'auto-123',
        triggers: [{ id: 't1', type: 'WEBHOOK_RECEIVED', config: {} }],
      });
      expect(evaluateTriggerConfig(auto, payload('WEBHOOK_RECEIVED', {}))).toBe(true);
    });

    it('allows when ingressId matches automation.id', () => {
      const auto = makeAutomation({
        id: 'auto-123',
        triggers: [{ id: 't1', type: 'WEBHOOK_RECEIVED', config: {} }],
      });
      expect(evaluateTriggerConfig(auto, payload('WEBHOOK_RECEIVED', { ingressId: 'auto-123' }))).toBe(true);
    });

    it('denies when ingressId does not match automation.id', () => {
      const auto = makeAutomation({
        id: 'auto-123',
        triggers: [{ id: 't1', type: 'WEBHOOK_RECEIVED', config: {} }],
      });
      expect(evaluateTriggerConfig(auto, payload('WEBHOOK_RECEIVED', { ingressId: 'auto-other' }))).toBe(false);
    });
  });

  // ── Automation Chain Triggers ──────────────────────────────────────────────

  describe('AUTOMATION_ENTERED / AUTOMATION_COMPLETED', () => {
    it('allows when no watchAutomationId configured', () => {
      for (const triggerType of ['AUTOMATION_ENTERED', 'AUTOMATION_COMPLETED'] as const) {
        const auto = makeAutomation({
          triggers: [{ id: 't1', type: triggerType, config: {} }],
        });
        expect(
          evaluateTriggerConfig(auto, payload(triggerType, { automationId: 'any-auto' }))
        ).toBe(true);
      }
    });

    it('watchAutomationId=all matches any automation', () => {
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'AUTOMATION_COMPLETED', config: { watchAutomationId: 'all' } }],
      });
      expect(
        evaluateTriggerConfig(auto, payload('AUTOMATION_COMPLETED', { automationId: 'auto-xyz' }))
      ).toBe(true);
    });

    it('watchAutomationId filters to specific automation', () => {
      const auto = makeAutomation({
        triggers: [
          { id: 't1', type: 'AUTOMATION_COMPLETED', config: { watchAutomationId: 'auto-onboarding' } },
        ],
      });
      expect(
        evaluateTriggerConfig(auto, payload('AUTOMATION_COMPLETED', { automationId: 'auto-onboarding' }))
      ).toBe(true);
      expect(
        evaluateTriggerConfig(auto, payload('AUTOMATION_COMPLETED', { automationId: 'auto-other' }))
      ).toBe(false);
    });
  });

  // ── Config source isolation ────────────────────────────────────────────────

  describe('config source isolation', () => {
    it('uses trigger def config, not canvas triggerNode config, when _firingTrigger is set', () => {
      // The triggerNode has a DIFFERENT tagId than the triggers[] def.
      // evaluateTriggerConfig must read from triggers[], not the node.
      const auto = makeAutomation({
        triggers: [{ id: 't1', type: 'TAG_ADDED', config: { tagIds: ['from-triggers-array'] } }],
        nodes: [
          {
            id: 'n1',
            type: 'triggerNode',
            data: { config: { tagIds: ['from-canvas-node'] } },
          },
        ],
      });

      // Should pass only for 'from-triggers-array'
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { tagId: 'from-triggers-array' }))
      ).toBe(true);

      // Should NOT pass for the canvas node value
      expect(
        evaluateTriggerConfig(auto, payload('TAG_ADDED', { tagId: 'from-canvas-node' }))
      ).toBe(false);
    });
  });

  describe('unconstrained fallback triggers', () => {
    const fallbacks = [
      'ENTITY_CREATED',
      'ENTITY_UPDATED',
      'ENTITY_ASSIGNED',
      'ENTITY_LINKED',
      'ENTITY_UNLINKED',
      'WORKSPACE_ENTITY_UPDATED',
      'TASK_CREATED',
      'TASK_COMPLETED',
      'PDF_SIGNED',
      'CAMPAIGN_PAGE_SUBMITTED',
      'DEAL_CREATED',
      'DEAL_STATUS_CHANGED',
      'DEAL_VALUE_CHANGED',
      'DATE_REACHED',
      'TASK_OVERDUE',
      'EMAIL_BOUNCED',
      'DEAL_OWNER_CHANGED',
      'ENTITY_INACTIVE',
    ] as const;

    it('always evaluates to true as unconstrained fallbacks', () => {
      for (const triggerType of fallbacks) {
        const auto = makeAutomation({
          triggers: [{ id: 't1', type: triggerType, config: {} }],
        });
        expect(
          evaluateTriggerConfig(auto, payload(triggerType, {}))
        ).toBe(true);
      }
    });
  });
});
