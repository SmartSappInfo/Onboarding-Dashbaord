import { describe, it, expect } from 'vitest';
import { sanitizeAndDeduplicateQuestions, type RawSurveyElement } from '../utils/sanitize-survey-questions';
import { phase2ElementSchema } from '../schemas/survey-schemas';

describe('Phase 2 Schema & Question Sanitization Engine', () => {
  describe('phase2ElementSchema Zod validation', () => {
    it('successfully parses a standard question with title and type', () => {
      const input = {
        id: 'q_ease_rating',
        title: 'On a scale of 1 to 5, how easy was it to onboard?',
        type: 'rating',
      };
      const parsed = phase2ElementSchema.parse(input);
      expect(parsed.id).toBe('q_ease_rating');
      expect(parsed.type).toBe('rating');
      expect((parsed as { title?: string }).title).toBe('On a scale of 1 to 5, how easy was it to onboard?');
      expect((parsed as { isRequired?: boolean }).isRequired).toBe(false);
    });

    it('gracefully handles missing title by defaulting to empty string (resilient against crash)', () => {
      const headlessInput = {
        id: 'q_ease_rating',
        type: 'rating',
        rules: [{ sourceQuestionId: 'q_ease_rating', operator: 'isEqualTo', action: { type: 'jump' } }],
      };
      // Should not throw schema validation error!
      const parsed = phase2ElementSchema.parse(headlessInput);
      expect(parsed.id).toBe('q_ease_rating');
      expect((parsed as { title?: string }).title).toBe('');
      // rules should be stripped by Zod
      expect('rules' in parsed).toBe(false);
    });

    it('successfully parses layout blocks (section, heading, description)', () => {
      const sectionInput = {
        id: 'sec_onboarding',
        type: 'section',
        title: 'Onboarding Evaluation',
        stepperTitle: 'Evaluation',
      };
      const parsed = phase2ElementSchema.parse(sectionInput);
      expect(parsed.id).toBe('sec_onboarding');
      expect(parsed.type).toBe('section');
    });
  });

  describe('sanitizeAndDeduplicateQuestions', () => {
    it('discards headless questions missing titles or having empty string titles', () => {
      const rawElements: RawSurveyElement[] = [
        { id: 'q_ease_rating', type: 'rating', rules: [{ type: 'jump' }] },
        { id: 'q_ease_rating_detail', type: 'rating', title: '   ' },
        { id: 'q_ease_rating_valid', type: 'rating', title: 'How easy was setup?' },
      ];

      const sanitized = sanitizeAndDeduplicateQuestions(rawElements);
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].id).toBe('q_ease_rating_valid');
      expect(sanitized[0].title).toBe('How easy was setup?');
    });

    it('strips logic blocks and accidental rules/scoring arrays from questions', () => {
      const rawElements: RawSurveyElement[] = [
        {
          id: 'q_question',
          type: 'multiple-choice',
          title: 'Which department are you in?',
          options: ['Engineering', 'Marketing'],
          rules: [{ action: { type: 'jump' } }],
          enableScoring: true,
          optionScores: [5, 10],
        },
        {
          id: 'logic_block_accidental',
          type: 'logic',
          rules: [{ action: { type: 'jump' } }],
        },
      ];

      const sanitized = sanitizeAndDeduplicateQuestions(rawElements);
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].id).toBe('q_question');
      expect(sanitized[0].rules).toBeUndefined();
      expect(sanitized[0].enableScoring).toBeUndefined();
      expect(sanitized[0].optionScores).toBeUndefined();
    });

    it('resolves duplicate attention loops by keeping the complete question that has options', () => {
      const rawElements: RawSurveyElement[] = [
        {
          id: 'q_difficult_steps_checkboxes',
          type: 'checkboxes',
          title: 'During onboarding, which steps did you find difficult? (Select all that apply)',
        },
        {
          id: 'q_difficult_steps_v2',
          type: 'checkboxes',
          title: 'During onboarding, which steps did you find difficult? (Select all that apply)',
        },
        {
          id: 'q_difficult_steps_v30',
          type: 'checkboxes',
          title: 'During onboarding, which steps did you find difficult? (Select all that apply)',
          options: ['Adding students', 'Adding teachers', 'Setting up fees'],
        },
      ];

      const sanitized = sanitizeAndDeduplicateQuestions(rawElements);
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].options).toEqual(['Adding students', 'Adding teachers', 'Setting up fees']);
    });

    it('ensures choice questions have at least 2 options if none were provided', () => {
      const rawElements: RawSurveyElement[] = [
        {
          id: 'q_choice_no_options',
          type: 'multiple-choice',
          title: 'Do you agree with the new onboarding process?',
        },
      ];

      const sanitized = sanitizeAndDeduplicateQuestions(rawElements);
      expect(sanitized).toHaveLength(1);
      expect(sanitized[0].options).toBeDefined();
      expect(sanitized[0].options!.length).toBeGreaterThanOrEqual(2);
    });

    it('guarantees unique element IDs', () => {
      const rawElements: RawSurveyElement[] = [
        { id: 'sec_profile', type: 'section', title: 'Profile' },
        { id: 'sec_profile', type: 'section', title: 'Profile Part 2' },
      ];

      const sanitized = sanitizeAndDeduplicateQuestions(rawElements);
      expect(sanitized).toHaveLength(2);
      expect(sanitized[0].id).toBe('sec_profile');
      expect(sanitized[1].id).toBe('sec_profile_2');
    });

    it('faithfully processes the real-world failing payload into 12 clean elements', () => {
      const realWorldPayload: RawSurveyElement[] = [
        { id: 'sec_onboarding_evaluation', type: 'section', title: 'Onboarding Experience Evaluation' },
        { id: 'head_title', type: 'heading', text: 'Evaluation' },
        { id: 'desc_survey_purpose', type: 'description', text: 'Identify onboarding difficulties...' },
        // Headless stub elements generated by AI
        { id: 'q_ease_rating', type: 'rating', rules: [{ type: 'jump' }] },
        { id: 'q_ease_rating_detail', type: 'rating', rules: [{ type: 'jump' }] },
        { id: 'q_ease_rating_question', type: 'rating', title: 'On a scale of 1 to 5, how easy was onboarding?' },
        { id: 'desc_rating_labels', type: 'description', text: '1 = Very difficult | 5 = Very easy' },
        { id: 'q_difficult_steps', type: 'checkboxes', rules: [{ type: 'jump' }] },
        { id: 'q_difficult_steps_checkboxes', type: 'checkboxes', title: 'Which steps were difficult?' },
        { id: 'q_difficult_steps_v2', type: 'checkboxes', title: 'Which steps were difficult?' },
        {
          id: 'q_difficult_steps_final',
          type: 'checkboxes',
          title: 'Which steps were difficult?',
          options: ['Step A', 'Step B', 'Step C'],
        },
        { id: 'q_describe_difficult_step', type: 'long-text', rules: [{ type: 'jump' }] },
        { id: 'q_specific_difficulty_desc', type: 'long-text', title: 'Please describe one step that was difficult' },
      ];

      const sanitized = sanitizeAndDeduplicateQuestions(realWorldPayload);
      // All headless and duplicate questions are filtered out, leaving clean items
      expect(sanitized.every((el) => el.type === 'section' || el.type === 'heading' || el.type === 'description' || Boolean(el.title && el.title.length > 2))).toBe(true);
      expect(sanitized.filter((el) => el.type === 'rating')).toHaveLength(1);
      expect(sanitized.filter((el) => el.type === 'checkboxes')).toHaveLength(1);
      expect(sanitized.find((el) => el.type === 'checkboxes')?.options).toEqual(['Step A', 'Step B', 'Step C']);
      expect(sanitized.filter((el) => el.type === 'long-text')).toHaveLength(1);
    });
  });
});
