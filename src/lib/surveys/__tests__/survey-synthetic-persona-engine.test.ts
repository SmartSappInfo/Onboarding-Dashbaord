/**
 * @fileOverview Unit tests for AI Synthetic Persona Engine & Pre-Flight Friction Cockpit
 */

import { describe, it, expect } from 'vitest';
import type { SurveyQuestion, SurveyElement } from '@/lib/types';
import {
  simulateSurveyRun,
  simulateAudienceCohort,
  SYNTHETIC_PERSONAS,
  extractSurveyQuestions,
  getBaseDwellTimeSeconds,
  type SyntheticPersonaType,
} from '../survey-synthetic-persona-engine';

describe('AI Synthetic Persona & Pre-Flight Friction Cockpit Engine', () => {
  const standardQuestions: SurveyQuestion[] = [
    { id: 'q1', type: 'multiple-choice', title: 'Product Satisfaction', isRequired: true, options: ['Great', 'OK', 'Poor'] },
    { id: 'q2', type: 'rating', title: 'Overall Rating (1-5)', isRequired: true },
    { id: 'q3', type: 'nps', title: 'How likely are you to recommend us?', isRequired: true },
    { id: 'q4', type: 'text', title: 'What did you like most?', isRequired: false },
    { id: 'q5', type: 'long-text', title: 'Detailed Feedback', isRequired: false },
  ];

  describe('Registry & Helper Functions', () => {
    it('defines all 5 cognitive personas with traits and multipliers', () => {
      const personaKeys: SyntheticPersonaType[] = ['speeder', 'thorough', 'fatigued', 'skeptic', 'promoter'];
      for (const key of personaKeys) {
        const config = SYNTHETIC_PERSONAS[key];
        expect(config).toBeDefined();
        expect(config.id).toBe(key);
        expect(config.name).toBeTruthy();
        expect(config.avatar).toBeTruthy();
        expect(config.behaviorTraits.length).toBeGreaterThan(0);
        expect(config.speedMultiplier).toBeGreaterThan(0);
      }
    });

    it('extracts survey questions while filtering non-question elements', () => {
      const elements: SurveyElement[] = [
        { id: 's1', type: 'section', title: 'Page 1' },
        { id: 'q1', type: 'text', title: 'Your Name' },
        { id: 'h1', type: 'heading', title: 'Instructions' },
        { id: 'q2', type: 'email', title: 'Email Address' },
        { id: 'd1', type: 'divider' },
      ];
      const extracted = extractSurveyQuestions(elements);
      expect(extracted).toHaveLength(2);
      expect(extracted.map((q) => q.id)).toEqual(['q1', 'q2']);
    });

    it('computes distinct base dwell times according to question complexity', () => {
      expect(getBaseDwellTimeSeconds('yes-no', false)).toBeLessThan(getBaseDwellTimeSeconds('matrix', false));
      expect(getBaseDwellTimeSeconds('long-text', true)).toBeGreaterThan(getBaseDwellTimeSeconds('long-text', false));
    });
  });

  describe('Individual Persona Simulation (`simulateSurveyRun`)', () => {
    it('simulates each persona successfully on a standard survey', () => {
      const personas: SyntheticPersonaType[] = ['speeder', 'thorough', 'fatigued', 'skeptic', 'promoter'];
      for (const persona of personas) {
        const result = simulateSurveyRun({ elements: standardQuestions }, persona, 42);
        expect(result.persona).toBe(persona);
        expect(result.totalQuestions).toBe(5);
        expect(result.durationSeconds).toBeGreaterThan(0);
        expect(['positive', 'neutral', 'negative']).toContain(result.sentiment);
      }
    });

    it('confirms speeder has significantly shorter dwell time than thorough', () => {
      const speederResult = simulateSurveyRun({ elements: standardQuestions }, 'speeder', 1234);
      const thoroughResult = simulateSurveyRun({ elements: standardQuestions }, 'thorough', 1234);

      expect(speederResult.durationSeconds).toBeLessThan(thoroughResult.durationSeconds);
      // Thorough dwell time should be at least 2.5x speeder dwell time given multipliers
      expect(thoroughResult.durationSeconds).toBeGreaterThan(speederResult.durationSeconds * 2.5);
    });

    it('confirms skeptic produces detractor NPS and low CSAT, while promoter produces top scores', () => {
      const skepticResult = simulateSurveyRun({ elements: standardQuestions }, 'skeptic', 888);
      const promoterResult = simulateSurveyRun({ elements: standardQuestions }, 'promoter', 888);

      expect(skepticResult.simulatedNps).toBeLessThanOrEqual(6);
      expect(skepticResult.simulatedCsat).toBeLessThanOrEqual(2.5);
      expect(skepticResult.sentiment).toBe('negative');

      expect(promoterResult.simulatedNps).toBeGreaterThanOrEqual(9);
      expect(promoterResult.simulatedCsat).toBeGreaterThanOrEqual(4);
      expect(promoterResult.sentiment).toBe('positive');
    });

    it('confirms fatigued persona drops off on long surveys (>10 questions)', () => {
      const longQuestions: SurveyQuestion[] = Array.from({ length: 14 }, (_, idx) => ({
        id: `q_${idx + 1}`,
        type: idx % 3 === 0 ? 'matrix' : idx % 2 === 0 ? 'long-text' : 'multiple-choice',
        title: `Question ${idx + 1}`,
        isRequired: true,
      }));

      const fatiguedResult = simulateSurveyRun({ elements: longQuestions }, 'fatigued', 42);

      expect(fatiguedResult.completed).toBe(false);
      expect(fatiguedResult.dropOffQuestionId).toBeDefined();
      expect(fatiguedResult.dropOffStepIndex).toBeDefined();
      expect(fatiguedResult.dropOffStepIndex!).toBeLessThan(14);
      expect(fatiguedResult.dropOffReason).toContain('fatigue');
    });

    it('handles empty surveys gracefully without errors', () => {
      const emptyResult = simulateSurveyRun({ elements: [] }, 'promoter');
      expect(emptyResult.completed).toBe(true);
      expect(emptyResult.totalQuestions).toBe(0);
      expect(emptyResult.durationSeconds).toBe(0);
      expect(emptyResult.questionsAnswered).toBe(0);
    });

    it('handles single-question surveys without division-by-zero errors', () => {
      const singleQ: SurveyQuestion[] = [
        { id: 'single_1', type: 'yes-no', title: 'Are you satisfied?', isRequired: true },
      ];
      const result = simulateSurveyRun({ elements: singleQ }, 'thorough', 99);
      expect(result.completed).toBe(true);
      expect(result.totalQuestions).toBe(1);
      expect(result.questionsAnswered).toBe(1);
      expect(result.durationSeconds).toBeGreaterThan(0);
    });
  });

  describe('Audience Cohort Simulation (`simulateAudienceCohort`)', () => {
    it('produces cohort statistics, friction analysis, friction scores, and actionable recommendations', () => {
      const surveyQuestionsWithFriction: SurveyQuestion[] = [
        { id: 'step1', type: 'multiple-choice', title: 'Role', isRequired: true, options: ['Dev', 'Designer', 'PM'] },
        { id: 'step2', type: 'matrix', title: 'Rate Feature Matrix', isRequired: true },
        { id: 'step3', type: 'long-text', title: 'Provide essay feedback', isRequired: true },
        { id: 'step4', type: 'phone', title: 'Enter private phone number', isRequired: true },
        { id: 'step5', type: 'nps', title: 'NPS Rating', isRequired: true },
      ];

      const cohortResult = simulateAudienceCohort({ elements: surveyQuestionsWithFriction }, 50);

      // Verify Cohort High-Level Metrics
      expect(cohortResult.totalSimulated).toBe(50);
      expect(cohortResult.completedCount).toBeGreaterThan(0);
      expect(cohortResult.completionRate).toBeGreaterThan(0);
      expect(cohortResult.completionRate).toBeLessThanOrEqual(100);
      expect(cohortResult.averageDurationSeconds).toBeGreaterThan(0);
      expect(cohortResult.medianDurationSeconds).toBeGreaterThan(0);

      // Verify Persona Breakdown
      const breakdown = cohortResult.personaBreakdown;
      expect(breakdown.speeder).toBeDefined();
      expect(breakdown.thorough).toBeDefined();
      expect(breakdown.fatigued).toBeDefined();
      expect(breakdown.skeptic).toBeDefined();
      expect(breakdown.promoter).toBeDefined();
      expect(breakdown.speeder.simulated).toBeGreaterThan(0);

      // Verify Question Friction Analysis
      expect(cohortResult.questionFrictionAnalysis).toHaveLength(5);
      for (const metric of cohortResult.questionFrictionAnalysis) {
        expect(metric.questionId).toBeTruthy();
        expect(metric.questionTitle).toBeTruthy();
        expect(metric.questionType).toBeTruthy();
        expect(metric.frictionScore).toBeGreaterThanOrEqual(0);
        expect(metric.frictionScore).toBeLessThanOrEqual(100);
        expect(['low', 'medium', 'high', 'critical']).toContain(metric.riskLevel);
        expect(metric.actionableRecommendation).toBeTruthy();
      }

      // Check that actionable advice is populated
      const highFrictionQ = cohortResult.questionFrictionAnalysis.find((q) => q.questionType === 'long-text' || q.questionType === 'matrix');
      expect(highFrictionQ).toBeDefined();
      expect(highFrictionQ?.actionableRecommendation.length).toBeGreaterThan(10);

      // Verify overall health and alerts
      expect(cohortResult.overallHealthScore).toBeGreaterThanOrEqual(0);
      expect(cohortResult.overallHealthScore).toBeLessThanOrEqual(100);
      expect(cohortResult.criticalAlerts).toBeInstanceOf(Array);
    });

    it('safely handles empty survey (0 questions) without throwing', () => {
      const cohortResult = simulateAudienceCohort({ elements: [] }, 50);

      expect(cohortResult.totalSimulated).toBe(50);
      expect(cohortResult.completedCount).toBe(50);
      expect(cohortResult.completionRate).toBe(100);
      expect(cohortResult.averageDurationSeconds).toBe(0);
      expect(cohortResult.questionFrictionAnalysis).toHaveLength(0);
      expect(cohortResult.frictionPointsCount).toBe(0);
      expect(cohortResult.overallHealthScore).toBe(100);
      expect(cohortResult.criticalAlerts.length).toBeGreaterThan(0);
    });

    it('safely handles custom cohort sizes and single-question surveys', () => {
      const singleQ: SurveyQuestion[] = [
        { id: 'q_rate', type: 'rating', title: 'Overall Experience', isRequired: true },
      ];
      const cohortResult = simulateAudienceCohort({ elements: singleQ }, 10);

      expect(cohortResult.totalSimulated).toBe(10);
      expect(cohortResult.questionFrictionAnalysis).toHaveLength(1);
      expect(cohortResult.questionFrictionAnalysis[0].dropOffRate).toBeGreaterThanOrEqual(0);
      expect(cohortResult.questionFrictionAnalysis[0].avgDwellTimeSeconds).toBeGreaterThan(0);
    });
  });
});
