import { describe, it, expect } from 'vitest';
import {
  computeNpsMetrics,
  computeCesMetrics,
  computeMatrixMetrics,
  computeRankingMetrics,
  computeSliderMetrics,
  computeCrossTabulation,
  calculateChiSquareCriticalValue,
  computeResponseQualityMetrics,
} from '../survey-analytics-engine';
import type { SurveyQuestion, SurveyResponse } from '@/lib/types';

describe('Survey Mathematical Analytics Engine', () => {
  describe('NPS Calculus', () => {
    it('computes Net Promoter Score accurately (% Promoters - % Detractors)', () => {
      // 5 Promoters (10, 10, 9, 9, 9), 3 Passives (8, 7, 7), 2 Detractors (5, 2)
      const values = [10, 10, 9, 9, 9, 8, 7, 7, 5, 2];
      const res = computeNpsMetrics(values);

      expect(res.total).toBe(10);
      expect(res.promotersCount).toBe(5);
      expect(res.passivesCount).toBe(3);
      expect(res.detractorsCount).toBe(2);
      expect(res.promotersPct).toBe(50);
      expect(res.passivesPct).toBe(30);
      expect(res.detractorsPct).toBe(20);
      expect(res.score).toBe(30); // 50 - 20 = 30
      expect(res.average).toBe(7.6);
    });

    it('handles empty response arrays gracefully with zero division safety', () => {
      const res = computeNpsMetrics([]);
      expect(res.total).toBe(0);
      expect(res.score).toBe(0);
      expect(res.average).toBe(0);
    });
  });

  describe('CES Metrics', () => {
    it('computes Customer Effort Score average and friction level', () => {
      const values = [7, 6, 6, 5, 5, 4, 2]; // average ~ 5.0
      const res = computeCesMetrics(values);

      expect(res.total).toBe(7);
      expect(res.averageScore).toBeGreaterThan(4.5);
      expect(res.frictionRating).toBe('low');
    });

    it('identifies high friction environments when average score is low', () => {
      const values = [1, 2, 2, 1, 3];
      const res = computeCesMetrics(values);

      expect(res.frictionRating).toBe('high');
    });
  });

  describe('Matrix 2D Reducer', () => {
    const matrixQuestion: SurveyQuestion = {
      id: 'q_matrix',
      type: 'matrix',
      title: 'Rate campus facilities',
      isRequired: true,
      matrixRows: ['Library', 'Gymnasium'],
      matrixColumns: ['Poor', 'Good', 'Great'],
    };

    it('aggregates matrix row answers across column options', () => {
      const answers = [
        { Library: 'Great', Gymnasium: 'Good' },
        { Library: 'Great', Gymnasium: 'Poor' },
        { Library: 'Good', Gymnasium: 'Good' },
      ];

      const res = computeMatrixMetrics(matrixQuestion, answers);
      expect(res.rows.length).toBe(2);

      const libRow = res.rows.find((r) => r.rowId === 'Library');
      expect(libRow).toBeDefined();
      const greatCol = libRow?.columns.find((c) => c.colId === 'Great');
      expect(greatCol?.count).toBe(2);
      expect(greatCol?.percentage).toBe(67);
    });
  });

  describe('Ranking Borda Count', () => {
    const rankingQuestion: SurveyQuestion = {
      id: 'q_rank',
      type: 'ranking',
      title: 'Rank preferred extracurriculars',
      isRequired: true,
      options: ['Robotics', 'Music', 'Sports'],
    };

    it('calculates weighted Borda scores and ranks items correctly', () => {
      // 3 items: 1st place = 3 pts, 2nd place = 2 pts, 3rd place = 1 pt
      const answers = [
        ['Robotics', 'Music', 'Sports'], // Robotics: 3, Music: 2, Sports: 1
        ['Robotics', 'Sports', 'Music'], // Robotics: 3, Sports: 2, Music: 1
      ];

      const res = computeRankingMetrics(rankingQuestion, answers);
      expect(res.items.length).toBe(3);
      expect(res.items[0].itemId).toBe('Robotics');
      expect(res.items[0].bordaScore).toBe(6);
      expect(res.items[0].rank).toBe(1);
    });
  });

  describe('Slider Quartile Statistics', () => {
    it('computes Min, Q1, Median, Mean, Q3, and Max accurately', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const res = computeSliderMetrics(values, 0, 100);

      expect(res.total).toBe(10);
      expect(res.min).toBe(10);
      expect(res.max).toBe(100);
      expect(res.mean).toBe(55);
      expect(res.median).toBe(55);
      expect(res.q1).toBeLessThan(res.median);
      expect(res.q3).toBeGreaterThan(res.median);
    });
  });

  describe('2D Cross-Tabulation Matrix', () => {
    const rowQ: SurveyQuestion = {
      id: 'q_role',
      type: 'multiple-choice',
      title: 'Respondent Role',
      isRequired: true,
      options: ['Parent', 'Teacher'],
    };

    const colQ: SurveyQuestion = {
      id: 'q_sat',
      type: 'multiple-choice',
      title: 'Overall Satisfaction',
      isRequired: true,
      options: ['Satisfied', 'Dissatisfied'],
    };

    it('generates 2D contingency matrix and row/column percentages', () => {
      const responses: SurveyResponse[] = [
        {
          id: 'r1',
          surveyId: 's1',
          answers: [
            { questionId: 'q_role', value: 'Parent' },
            { questionId: 'q_sat', value: 'Satisfied' },
          ],
          submittedAt: new Date().toISOString(),
        },
        {
          id: 'r2',
          surveyId: 's1',
          answers: [
            { questionId: 'q_role', value: 'Parent' },
            { questionId: 'q_sat', value: 'Satisfied' },
          ],
          submittedAt: new Date().toISOString(),
        },
        {
          id: 'r3',
          surveyId: 's1',
          answers: [
            { questionId: 'q_role', value: 'Parent' },
            { questionId: 'q_sat', value: 'Dissatisfied' },
          ],
          submittedAt: new Date().toISOString(),
        },
        {
          id: 'r4',
          surveyId: 's1',
          answers: [
            { questionId: 'q_role', value: 'Teacher' },
            { questionId: 'q_sat', value: 'Dissatisfied' },
          ],
          submittedAt: new Date().toISOString(),
        },
      ];

      const res = computeCrossTabulation(responses, rowQ, colQ);
      expect(res.grandTotal).toBe(4);
      expect(res.rowTotals[0]).toBe(3); // 3 Parents
      expect(res.rowTotals[1]).toBe(1); // 1 Teacher
      expect(res.colTotals[0]).toBe(2); // 2 Satisfied
      expect(res.colTotals[1]).toBe(2); // 2 Dissatisfied
    });

    it('computes high-precision Wilson-Hilferty Chi-Square critical threshold for df > 30', () => {
      // df = 40: Critical value at alpha=0.05 is approximately 55.76
      const df40Critical = calculateChiSquareCriticalValue(40, 0.05);
      expect(df40Critical).toBeGreaterThanOrEqual(55.6);
      expect(df40Critical).toBeLessThanOrEqual(55.9);

      // df = 60: Critical value at alpha=0.05 is approximately 79.08
      const df60Critical = calculateChiSquareCriticalValue(60, 0.05);
      expect(df60Critical).toBeGreaterThanOrEqual(78.9);
      expect(df60Critical).toBeLessThanOrEqual(79.3);

      // df <= 30 lookup table verification
      expect(calculateChiSquareCriticalValue(1, 0.05)).toBe(3.841);
      expect(calculateChiSquareCriticalValue(10, 0.05)).toBe(18.307);
    });

    it('handles degrees of freedom edge cases, lookup table values, and non-default alpha levels', () => {
      // Non-positive degrees of freedom return 0
      expect(calculateChiSquareCriticalValue(0)).toBe(0);
      expect(calculateChiSquareCriticalValue(-5)).toBe(0);

      // Intermediate lookup value verification (df = 14)
      expect(calculateChiSquareCriticalValue(14, 0.05)).toBe(23.685);

      // Configurable alpha quantiles for df = 40
      const df40Alpha01 = calculateChiSquareCriticalValue(40, 0.01);
      expect(df40Alpha01).toBeGreaterThanOrEqual(63.5);
      expect(df40Alpha01).toBeLessThanOrEqual(64.0);

      const df40Alpha10 = calculateChiSquareCriticalValue(40, 0.10);
      expect(df40Alpha10).toBeGreaterThanOrEqual(51.6);
      expect(df40Alpha10).toBeLessThanOrEqual(52.0);

      // Fallback for unmapped alpha cleanly defaults to alpha = 0.05
      expect(calculateChiSquareCriticalValue(40, 0.99)).toBe(calculateChiSquareCriticalValue(40, 0.05));
    });
  });

  describe('Response Quality Heuristics', () => {
    it('detects speeders who complete the survey in under 15 seconds', () => {
      const now = Date.now();
      const responses: SurveyResponse[] = [
        {
          id: 'r1',
          surveyId: 's1',
          startedAt: new Date(now - 10000).toISOString(), // 10s -> speeder
          submittedAt: new Date(now).toISOString(),
          answers: [
            { questionId: 'q1', value: 'A' },
            { questionId: 'q2', value: 'B' },
            { questionId: 'q3', value: 'C' },
            { questionId: 'q4', value: 'D' },
            { questionId: 'q5', value: 'E' },
            { questionId: 'q6', value: 'F' },
          ],
        },
        {
          id: 'r2',
          surveyId: 's1',
          startedAt: new Date(now - 60000).toISOString(), // 60s -> normal
          submittedAt: new Date(now).toISOString(),
          answers: [
            { questionId: 'q1', value: 'A' },
            { questionId: 'q2', value: 'A' },
            { questionId: 'q3', value: 'A' },
            { questionId: 'q4', value: 'A' },
            { questionId: 'q5', value: 'A' },
            { questionId: 'q6', value: 'A' },
          ], // straight-liner (6 identical answers)
        },
      ];

      const res = computeResponseQualityMetrics(responses);
      expect(res.totalResponses).toBe(2);
      expect(res.speedersCount).toBe(1);
      expect(res.straightLinersCount).toBe(1);
      expect(res.reliabilityScore).toBeLessThan(100);
    });
  });
});
