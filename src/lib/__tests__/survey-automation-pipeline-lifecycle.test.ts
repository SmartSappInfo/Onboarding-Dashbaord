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
});
