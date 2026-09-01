/**
 * @fileOverview Unit tests for Survey Intelligence 2.0 AI Refinement Server Action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refineSurveyQuestionAction } from '../survey-ai-refinement-actions';

vi.mock('@/ai/flows/refine-survey-question-flow', () => ({
  refineSurveyQuestionFlow: vi.fn().mockImplementation(async (input) => {
    return {
      improvedTitle: `Refined: ${input.questionTitle}`,
      improvedDescription: 'Clear, neutral measurement guidance.',
      improvedOptions: input.actionType === 'generate_options' ? ['Option 1', 'Option 2', 'Option 3', 'Option 4'] : undefined,
      suggestedFollowup: input.actionType === 'add_followup' ? { title: 'Why did you choose that rating?', type: 'long-text' } : undefined,
      rationale: 'Eliminated leading bias and improved grade-level clarity.',
    };
  }),
}));

describe('Survey AI Refinement Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject call when workspaceId or title is missing', async () => {
    const res = await refineSurveyQuestionAction('', 'org_1', {
      questionTitle: 'Is our school the best in town?',
      actionType: 'eliminate_bias',
      questionType: 'multiple-choice',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('should refine question to eliminate bias', async () => {
    const res = await refineSurveyQuestionAction('ws_1', 'org_1', {
      questionTitle: 'Don\'t you agree our STEM program is outstanding?',
      actionType: 'eliminate_bias',
      questionType: 'rating',
    });

    expect(res.success).toBe(true);
    expect(res.result?.improvedTitle).toContain('Refined:');
    expect(res.result?.rationale).toBeDefined();
  });

  it('should generate follow-up question when requested', async () => {
    const res = await refineSurveyQuestionAction('ws_1', 'org_1', {
      questionTitle: 'Overall parent satisfaction',
      actionType: 'add_followup',
      questionType: 'rating',
    });

    expect(res.success).toBe(true);
    expect(res.result?.suggestedFollowup?.title).toBe('Why did you choose that rating?');
  });
});