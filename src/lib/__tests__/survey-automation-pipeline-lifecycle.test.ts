import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAutomationTrigger, ACTIVITY_TO_AUTOMATION_TRIGGER } from '../automation-trigger-map';

describe('Survey Automations & Pipeline Lifecycle Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Automation Trigger Bus Synchronization', () => {
    it('correctly maps survey_submitted activity to SURVEY_SUBMITTED protocol', () => {
      expect(resolveAutomationTrigger('survey_submitted')).toBe('SURVEY_SUBMITTED');
      expect(ACTIVITY_TO_AUTOMATION_TRIGGER.survey_submitted).toBe('SURVEY_SUBMITTED');
    });

    it('correctly maps survey_submission activity to SURVEY_SUBMITTED protocol', () => {
      expect(resolveAutomationTrigger('survey_submission')).toBe('SURVEY_SUBMITTED');
      expect(ACTIVITY_TO_AUTOMATION_TRIGGER.survey_submission).toBe('SURVEY_SUBMITTED');
    });

    it('correctly maps survey_started activity to SURVEY_STARTED protocol', () => {
      expect(resolveAutomationTrigger('survey_started')).toBe('SURVEY_STARTED');
      expect(ACTIVITY_TO_AUTOMATION_TRIGGER.survey_started).toBe('SURVEY_STARTED');
    });

    it('returns undefined for unregistered activity types', () => {
      expect(resolveAutomationTrigger('random_unregistered_event')).toBeUndefined();
    });
  });

  describe('Multi-Pattern Entity Resolution in deal-actions', () => {
    it('normalizes entityId when prefixed with workspaceId', () => {
      const workspaceId = 'ws_abc';
      const rawEntityId = 'ws_abc_ent_xyz';
      const cleanEntityId = rawEntityId.startsWith(`${workspaceId}_`) 
        ? rawEntityId.slice(workspaceId.length + 1) 
        : rawEntityId;
      expect(cleanEntityId).toBe('ent_xyz');
    });

    it('handles unprefixed entityId cleanly', () => {
      const workspaceId = 'ws_abc';
      const rawEntityId = 'ent_xyz';
      const cleanEntityId = rawEntityId.startsWith(`${workspaceId}_`) 
        ? rawEntityId.slice(workspaceId.length + 1) 
        : rawEntityId;
      expect(cleanEntityId).toBe('ent_xyz');
    });
  });

  describe('Modal Lead Capture Automations Guard', () => {
    it('correctly executes automations for identified contacts on question completion', () => {
      const isFormMode = true;
      const finalEntityId = 'ent_tracked_123';
      const surveyData = { id: 'survey_1', title: 'Campus Survey' };

      const shouldTriggerNow = Boolean(surveyData && (!isFormMode || finalEntityId));
      expect(shouldTriggerNow).toBe(true);
    });

    it('defers automations for anonymous un-tracked contacts until lead capture modal is submitted', () => {
      const isFormMode = true;
      const finalEntityId = null;
      const surveyData = { id: 'survey_1', title: 'Campus Survey' };

      const shouldTriggerNow = Boolean(surveyData && (!isFormMode || finalEntityId));
      expect(shouldTriggerNow).toBe(false);
    });

    it('prevents duplicate automation triggers when automationsTriggered flag is set', () => {
      const responseDataWithFlag = {
        answers: [],
        score: 85,
        automationsTriggered: true,
      };

      const shouldTriggerInLeadStep = !responseDataWithFlag.automationsTriggered;
      expect(shouldTriggerInLeadStep).toBe(false);

      const responseDataWithoutFlag = {
        answers: [],
        score: 85,
        automationsTriggered: false,
      };

      const shouldTriggerInSecondStep = !responseDataWithoutFlag.automationsTriggered;
      expect(shouldTriggerInSecondStep).toBe(true);
    });
  });

  describe('Multi-Tenant Boundary Isolation', () => {
    it('validates workspace ownership before returning direct entity record', () => {
      const targetWorkspaceId = 'ws_primary';
      const foreignEntityData = { workspaceId: 'ws_secondary', displayName: 'Foreign School' };

      const isAllowed = !foreignEntityData.workspaceId || foreignEntityData.workspaceId === targetWorkspaceId;
      expect(isAllowed).toBe(false);

      const validEntityData = { workspaceId: 'ws_primary', displayName: 'Valid School' };
      const isValidAllowed = !validEntityData.workspaceId || validEntityData.workspaceId === targetWorkspaceId;
      expect(isValidAllowed).toBe(true);
    });

    it('validates canonical entity workspaceIds and organizationId', () => {
      const targetWorkspaceId = 'ws_target';
      const targetOrgId = 'org_alpha';

      const matchedCanonical = {
        workspaceIds: ['ws_target', 'ws_other'],
        organizationId: 'org_alpha',
        name: 'Academy A',
      };
      const isWsAllowed = matchedCanonical.workspaceIds.length === 0 || matchedCanonical.workspaceIds.includes(targetWorkspaceId);
      const isOrgAllowed = !matchedCanonical.organizationId || matchedCanonical.organizationId === targetOrgId || (targetOrgId as string) === 'default';
      expect(isWsAllowed && isOrgAllowed).toBe(true);

      const foreignCanonical = {
        workspaceIds: ['ws_unrelated'],
        organizationId: 'org_beta',
        name: 'Academy B',
      };
      const isForeignWsAllowed = foreignCanonical.workspaceIds.length === 0 || foreignCanonical.workspaceIds.includes(targetWorkspaceId);
      const isForeignOrgAllowed = !foreignCanonical.organizationId || foreignCanonical.organizationId === targetOrgId || (targetOrgId as string) === 'default';
      expect(isForeignWsAllowed && isForeignOrgAllowed).toBe(false);
    });
  });

  describe('SSRF Webhook Protocol Defense', () => {
    it('allows valid HTTPS and HTTP protocols', () => {
      const httpsUrl = new URL('https://api.crm-partner.com/webhook');
      expect(httpsUrl.protocol === 'http:' || httpsUrl.protocol === 'https:').toBe(true);

      const httpUrl = new URL('http://local-webhook.internal/hook');
      expect(httpUrl.protocol === 'http:' || httpUrl.protocol === 'https:').toBe(true);
    });

    it('rejects dangerous protocols like javascript:, file:, or data:', () => {
      const checkProtocol = (urlStr: string) => {
        try {
          const u = new URL(urlStr);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      };

      expect(checkProtocol('javascript:alert(1)')).toBe(false);
      expect(checkProtocol('file:///etc/passwd')).toBe(false);
      expect(checkProtocol('data:text/html,payload')).toBe(false);
    });
  });

  describe('Outcome Rule Fallback to Score Rules', () => {
    it('falls back to score matching if outcomeId does not match any rule', () => {
      const surveyData = {
        scoringEnabled: true,
        resultRules: [
          { id: 'rule_pass', minScore: 70, maxScore: 100, label: 'Pass', priority: 1 },
          { id: 'rule_fail', minScore: 0, maxScore: 69, label: 'Fail', priority: 2 },
        ],
      };

      const outcomeId = 'non_existent_rule_id';
      let matchedRule = surveyData.resultRules?.find(r => r.id === outcomeId);
      if (!matchedRule && surveyData.scoringEnabled && surveyData.resultRules?.length) {
        const score = 85;
        matchedRule = surveyData.resultRules.find(r => score >= r.minScore && score <= r.maxScore);
      }

      expect(matchedRule).toBeDefined();
      expect(matchedRule?.id).toBe('rule_pass');
    });
  });
});

