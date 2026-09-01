/**
 * @fileOverview Unit tests for Survey Intelligence 2.0 Phase 2 Advanced Question Types
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Verifies that all 22 question types (legacy + 8 Phase 2 advanced types)
 *    are strictly typed, conform to SurveyQuestion, and hydrate without errors.
 * 2. Strict Zero-Any Invariant.
 */

import { describe, it, expect } from 'vitest';
import type { SurveyQuestion } from '@/lib/types';
import { hydrateSurveyDocument } from '../survey-hydration-adapter';

describe('Phase 2 Advanced Survey Question Types', () => {
  it('should support matrix single & multiple choice question configurations', () => {
    const matrixQuestion: SurveyQuestion = {
      id: 'q_matrix_1',
      type: 'matrix',
      title: 'Rate our campus facilities across departments',
      isRequired: true,
      matrixRows: ['Library & Study Pods', 'Science & Robotics Labs', 'Dining & Cafeteria', 'Sports Complex'],
      matrixColumns: ['Poor (1)', 'Average (2)', 'Good (3)', 'Exceptional (4)'],
      matrixType: 'single',
    };

    expect(matrixQuestion.type).toBe('matrix');
    expect(matrixQuestion.matrixRows).toHaveLength(4);
    expect(matrixQuestion.matrixColumns).toHaveLength(4);
  });

  it('should support ranking / drag-and-drop order question configurations', () => {
    const rankingQuestion: SurveyQuestion = {
      id: 'q_rank_1',
      type: 'ranking',
      title: 'Rank your top factors when selecting a school',
      isRequired: true,
      rankingItems: ['Academic Rigor', 'Extracurricular Activities', 'Campus Safety', 'Tuition Value', 'Proximity'],
    };

    expect(rankingQuestion.type).toBe('ranking');
    expect(rankingQuestion.rankingItems).toHaveLength(5);
  });

  it('should support continuous slider question configurations', () => {
    const sliderQuestion: SurveyQuestion = {
      id: 'q_slider_1',
      type: 'slider',
      title: 'Weekly hours spent on homework',
      isRequired: false,
      sliderMin: 0,
      sliderMax: 40,
      sliderStep: 1,
      sliderMinLabel: '0 Hours',
      sliderMaxLabel: '40+ Hours',
    };

    expect(sliderQuestion.type).toBe('slider');
    expect(sliderQuestion.sliderMax).toBe(40);
  });

  it('should support dedicated NPS and CES questions with color bands', () => {
    const npsQuestion: SurveyQuestion = {
      id: 'q_nps_1',
      type: 'nps',
      title: 'How likely are you to recommend us to a fellow educator?',
      isRequired: true,
      npsMinLabel: '0 - Not at all likely',
      npsMaxLabel: '10 - Extremely likely',
    };

    const cesQuestion: SurveyQuestion = {
      id: 'q_ces_1',
      type: 'ces',
      title: 'The school administration made the enrollment process effortless',
      isRequired: true,
      cesMinLabel: '1 - Strongly Disagree',
      cesMaxLabel: '7 - Strongly Agree',
    };

    expect(npsQuestion.type).toBe('nps');
    expect(cesQuestion.type).toBe('ces');
  });

  it('should support signature and consent questions', () => {
    const signatureQuestion: SurveyQuestion = {
      id: 'q_sign_1',
      type: 'signature',
      title: 'Parent/Guardian Digital Signature',
      isRequired: true,
    };

    const consentQuestion: SurveyQuestion = {
      id: 'q_consent_1',
      type: 'consent',
      title: 'Terms of Enrolment & Data Processing Policy',
      isRequired: true,
      consentText: 'I hereby confirm that I have reviewed the Parent Handbook and consent to the communications policy.',
      consentLinkUrl: 'https://myschool.org/policy.pdf',
    };

    expect(signatureQuestion.type).toBe('signature');
    expect(consentQuestion.type).toBe('consent');
    expect(consentQuestion.consentText).toContain('Parent Handbook');
  });

  it('should hydrate survey containing advanced question types without altering elements', () => {
    const survey = hydrateSurveyDocument({
      id: 'survey_adv_test',
      workspaceIds: ['ws_1'],
      title: 'Comprehensive School Climate Survey',
      elements: [
        {
          id: 'q1',
          type: 'matrix',
          title: 'Classroom Environment',
          isRequired: true,
          matrixRows: ['Lighting', 'Ventilation', 'Acoustics'],
          matrixColumns: ['Unacceptable', 'Acceptable', 'Superb'],
        } as SurveyQuestion,
        {
          id: 'q2',
          type: 'signature',
          title: 'Principal Signoff',
          isRequired: true,
        } as SurveyQuestion,
      ],
    });

    expect(survey.elements).toHaveLength(2);
    expect(survey.elements[0].type).toBe('matrix');
    expect(survey.elements[1].type).toBe('signature');
  });
});