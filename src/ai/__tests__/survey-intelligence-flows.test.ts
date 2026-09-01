import { describe, it, expect } from 'vitest';
import {
  SurveyQualityAuditOutputSchema,
  SurveySentimentThemeOutputSchema,
  SurveyAnomalyDetectionOutputSchema,
  SurveyResearchAssistantOutputSchema,
} from '../schemas/survey-intelligence-schemas';

describe('Survey Intelligence Schemas & Parsing', () => {
  it('validates SurveyQualityAuditOutputSchema correctly', () => {
    const validAudit = {
      overallScore: 92,
      grade: 'A',
      clarityScore: 95,
      neutralityScore: 90,
      fatigueRiskScore: 94,
      flowCoherenceScore: 90,
      estimatedCompletionMinutes: 5,
      executiveSummary: 'High-quality survey with balanced scales and low fatigue.',
      strengths: ['Clear terminology', 'Smooth section pagination'],
      suggestions: [
        {
          questionId: 'q_rate',
          currentTitle: 'How amazing was your experience?',
          issueType: 'leading_bias',
          issueDescription: 'Uses leading positive phrasing.',
          improvedTitle: 'How would you rate your overall experience?',
          improvedOptions: ['Excellent', 'Good', 'Average', 'Poor'],
        },
      ],
    };

    const parsed = SurveyQualityAuditOutputSchema.parse(validAudit);
    expect(parsed.overallScore).toBe(92);
    expect(parsed.suggestions[0].issueType).toBe('leading_bias');
  });

  it('validates SurveySentimentThemeOutputSchema with verbatim citations', () => {
    const validSentiment = {
      overallSentiment: {
        positivePercentage: 70,
        neutralPercentage: 15,
        negativePercentage: 15,
        mixedPercentage: 0,
        netSentimentScore: 55,
      },
      themes: [
        {
          themeId: 'facilities',
          title: 'Campus Facility Cleanliness',
          description: 'Respondents commended recent renovations.',
          sentimentPolarity: 'mostly_positive',
          prevalencePercentage: 35,
          sentimentScore: 0.8,
          keywords: ['clean', 'modern', 'renovated'],
          supportingCitations: [
            {
              responseId: 'res_123',
              quote: 'The newly renovated science lab is world-class.',
              sentiment: 'positive',
              respondentContext: 'Parent (Grade 11)',
            },
          ],
        },
      ],
      topPositiveHighlights: ['Science lab upgrades'],
      topUrgentPainPoints: ['Parking congestion during dismissal'],
      executiveNarrative: 'Parents are overwhelmingly pleased with campus infrastructure.',
    };

    const parsed = SurveySentimentThemeOutputSchema.parse(validSentiment);
    expect(parsed.overallSentiment.netSentimentScore).toBe(55);
    expect(parsed.themes[0].supportingCitations[0].responseId).toBe('res_123');
  });

  it('validates SurveyResearchAssistantOutputSchema with evidence citations', () => {
    const validResearch = {
      answerHtml: '<p>Parent satisfaction is highest in STEM subjects.</p>',
      confidenceScore: 94,
      sampleSizeAnalyzed: 85,
      keyMetrics: [
        { label: 'STEM Satisfaction', value: '92%', comparison: 'vs 78% overall average' },
      ],
      evidenceCitations: [
        {
          responseId: 'r_99',
          questionTitle: 'Academic Satisfaction',
          evidenceText: 'Robotics and physics teaching have been outstanding.',
          context: 'Grade 10 Parent',
        },
      ],
      suggestedFollowUpQuestions: [
        'How does satisfaction compare between middle and high school?',
      ],
    };

    const parsed = SurveyResearchAssistantOutputSchema.parse(validResearch);
    expect(parsed.confidenceScore).toBe(94);
    expect(parsed.evidenceCitations[0].responseId).toBe('r_99');
    expect(parsed.keyMetrics[0].value).toBe('92%');
  });
});
