/**
 * @fileOverview Unit tests for SurveyHydrationAdapter
 */

import { describe, it, expect } from 'vitest';
import {
  hydrateSurveyDocument,
  computeSurveyChecksum,
  synthesizeVersionSnapshot,
  isSurveyAcceptingSubmissions,
} from '../survey-hydration-adapter';
import type { Survey, SurveyQuestion } from '@/lib/types';
import type { SurveyDeployment } from '../survey-v2-types';

describe('SurveyHydrationAdapter', () => {
  it('should hydrate legacy survey document with default 2.0 properties', () => {
    const legacySurvey: Partial<Survey> = {
      id: 'survey_legacy_1',
      workspaceIds: ['ws_123'],
      title: 'Legacy School Feedback',
      status: 'published',
      elements: [
        {
          id: 'q1',
          type: 'text',
          title: 'Your Name',
          isRequired: false,
        } as SurveyQuestion,
      ],
    };

    const hydrated = hydrateSurveyDocument(legacySurvey);
    expect(hydrated.id).toBe('survey_legacy_1');
    expect(hydrated.surveyType).toBe('feedback');
    expect(hydrated.lifecycleStatus).toBe('published');
    expect(hydrated.currentVersionNumber).toBe(1);
    expect(hydrated.privacyMode).toBe('identified');
    expect(hydrated.elements).toHaveLength(1);
  });

  it('should auto-detect NPS archetype when NPS question exists', () => {
    const npsSurvey: Partial<Survey> = {
      id: 'survey_nps',
      workspaceIds: ['ws_123'],
      title: 'Parent Recommendation',
      status: 'published',
      elements: [
        {
          id: 'q_nps',
          type: 'rating',
          title: 'How likely are you to recommend us?',
          isRequired: true,
        } as SurveyQuestion,
      ],
    };

    const hydrated = hydrateSurveyDocument(npsSurvey);
    expect(hydrated.surveyType).toBe('nps');
  });

  it('should auto-detect Assessment archetype when scoring is enabled', () => {
    const assessmentSurvey: Partial<Survey> = {
      id: 'survey_assessment',
      workspaceIds: ['ws_123'],
      title: 'Student Math Quiz',
      status: 'published',
      scoringEnabled: true,
      elements: [],
    };

    const hydrated = hydrateSurveyDocument(assessmentSurvey);
    expect(hydrated.surveyType).toBe('assessment');
  });

  it('should compute deterministic checksum across elements', () => {
    const elements = [{ id: 'q1', title: 'Hello', type: 'text', isRequired: true } as SurveyQuestion];
    const chk1 = computeSurveyChecksum(elements, [], false);
    const chk2 = computeSurveyChecksum(elements, [], false);
    expect(chk1).toBe(chk2);
    expect(chk1).toMatch(/^v_/);
  });

  it('should synthesize an immutable version snapshot', () => {
    const survey = hydrateSurveyDocument({
      id: 'survey_100',
      workspaceIds: ['ws_abc'],
      title: 'Term 1 Parent Survey',
      status: 'published',
      elements: [{ id: 'q1', type: 'text', title: 'Feedback', isRequired: false } as SurveyQuestion],
    });

    const snapshot = synthesizeVersionSnapshot(survey, 2, 'user_456', 'Principal');
    expect(snapshot.id).toBe('v_survey_100_2');
    expect(snapshot.versionNumber).toBe(2);
    expect(snapshot.createdBy).toBe('user_456');
    expect(snapshot.createdByName).toBe('Principal');
    expect(snapshot.status).toBe('published');
  });

  it('should evaluate submission accessibility gates correctly', () => {
    const activeSurvey = hydrateSurveyDocument({
      id: 'survey_live',
      workspaceIds: ['ws_1'],
      status: 'published',
      lifecycleStatus: 'published',
    });

    // 1. Published survey with no deployment restrictions should be allowed
    expect(isSurveyAcceptingSubmissions(activeSurvey)).toEqual({ allowed: true });

    // 2. Paused survey should be rejected
    const pausedSurvey = hydrateSurveyDocument({
      id: 'survey_paused',
      workspaceIds: ['ws_1'],
      status: 'published',
      lifecycleStatus: 'paused',
    });
    expect(isSurveyAcceptingSubmissions(pausedSurvey)).toEqual({ allowed: false, reason: 'paused' });

    // 3. Deployment with exceeded quota should be rejected
    const deploymentWithQuota: Partial<SurveyDeployment> = {
      id: 'dep_1',
      status: 'active',
      quotaConfig: { maxResponses: 10 },
      stats: { viewsCount: 50, startsCount: 20, completionsCount: 10 },
    };
    expect(isSurveyAcceptingSubmissions(activeSurvey, deploymentWithQuota)).toEqual({
      allowed: false,
      reason: 'quota_reached',
    });

    // 4. Deployment with active quota remaining should be allowed
    const deploymentWithRemaining: Partial<SurveyDeployment> = {
      id: 'dep_2',
      status: 'active',
      quotaConfig: { maxResponses: 100 },
      stats: { viewsCount: 50, startsCount: 20, completionsCount: 10 },
    };
    expect(isSurveyAcceptingSubmissions(activeSurvey, deploymentWithRemaining)).toEqual({ allowed: true });
  });
});
