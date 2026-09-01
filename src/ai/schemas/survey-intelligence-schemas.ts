/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — AI Schemas
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Strict Zod schemas for all Survey AI flows.
 * 2. Evidence-Backed Attribution:
 *    - Research Assistant schemas enforce explicit response IDs and verbatim citations.
 * 3. Pre-Publish Quality Audit:
 *    - Structured scoring across clarity, neutrality, fatigue, and flow.
 * 4. Strict Zero-Any Invariant.
 */

import { z } from 'genkit';

// ─── 1. SURVEY QUALITY AUDITOR SCHEMAS ──────────────────────────────────────

export const QuestionAuditSuggestionSchema = z.object({
  questionId: z.string().describe('The ID of the target question being evaluated'),
  currentTitle: z.string().describe('Original question prompt'),
  issueType: z.enum([
    'leading_bias',
    'double_barreled',
    'ambiguous_wording',
    'unbalanced_options',
    'high_cognitive_load',
    'missing_opt_out',
    'mobile_scroll_fatigue',
  ]).describe('Classified psychometric or UX defect'),
  issueDescription: z.string().describe('Concise rationale explaining the measurement hazard'),
  improvedTitle: z.string().describe('Recommended rephrased question prompt'),
  improvedDescription: z.string().optional().describe('Optional clarifying guidance or helper text'),
  improvedOptions: z.array(z.string()).optional().describe('Recommended balanced choice options if applicable'),
});

export type QuestionAuditSuggestion = z.infer<typeof QuestionAuditSuggestionSchema>;

export const SurveyQualityAuditInputSchema = z.object({
  surveyTitle: z.string().describe('Title of the survey'),
  surveyDescription: z.string().optional().describe('Introductory or guidance description'),
  elements: z.array(z.record(z.string(), z.unknown())).describe('Survey structure elements and questions'),
  targetAudience: z.string().optional().describe('Intended respondent demographic or persona'),
  organizationId: z.string().optional(),
  provider: z.string().optional().default('anthropic'),
  modelId: z.string().optional(),
});

export type SurveyQualityAuditInput = z.infer<typeof SurveyQualityAuditInputSchema>;

export const SurveyQualityAuditOutputSchema = z.object({
  overallScore: z.number().min(0).max(100).describe('Overall survey quality index (0-100)'),
  grade: z.enum(['A+', 'A', 'B', 'C', 'Needs Improvement']).describe('Overall readiness grade'),
  clarityScore: z.number().min(0).max(100).describe('Readability and clarity sub-score'),
  neutralityScore: z.number().min(0).max(100).describe('Unbiased, non-leading wording sub-score'),
  fatigueRiskScore: z.number().min(0).max(100).describe('Length, brevity, and mobile completion risk (100 = lowest fatigue)'),
  flowCoherenceScore: z.number().min(0).max(100).describe('Logic branching and section structure sub-score'),
  estimatedCompletionMinutes: z.number().describe('Estimated time required for a respondent to complete'),
  executiveSummary: z.string().describe('High-level executive assessment of survey readiness'),
  strengths: z.array(z.string()).describe('Noteworthy architectural and phrasing strengths'),
  suggestions: z.array(QuestionAuditSuggestionSchema).describe('Actionable question-level improvements'),
});

export type SurveyQualityAuditOutput = z.infer<typeof SurveyQualityAuditOutputSchema>;

// ─── 2. SENTIMENT & THEMATIC CLUSTERING SCHEMAS ─────────────────────────────

export const VerbatimExcerptCitationSchema = z.object({
  responseId: z.string().describe('ID of the source response document'),
  quote: z.string().describe('Exact verbatim excerpt from respondent text answer'),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).describe('Sentiment polarity of this excerpt'),
  respondentContext: z.string().optional().describe('Optional context e.g. "Parent (Grade 10)" or "Kiosk submission"'),
});

export type VerbatimExcerptCitation = z.infer<typeof VerbatimExcerptCitationSchema>;

export const ThematicClusterSchema = z.object({
  themeId: z.string().describe('Unique slug identifier for the theme'),
  title: z.string().describe('Clear thematic category title (e.g. "Cafeteria Nutrition & Variety")'),
  description: z.string().describe('Summary of what respondents expressed regarding this topic'),
  sentimentPolarity: z.enum(['mostly_positive', 'neutral', 'mostly_negative', 'mixed']).describe('Dominant sentiment polarity'),
  prevalencePercentage: z.number().min(0).max(100).describe('Percentage of qualitative responses referencing this theme'),
  sentimentScore: z.number().min(-1).max(1).describe('Normalized sentiment index from -1.0 (very negative) to +1.0 (very positive)'),
  keywords: z.array(z.string()).describe('Top representative keywords'),
  supportingCitations: z.array(VerbatimExcerptCitationSchema).describe('Representative verbatim quotes with response IDs'),
});

export type ThematicCluster = z.infer<typeof ThematicClusterSchema>;

export const SurveySentimentThemeInputSchema = z.object({
  surveyTitle: z.string().describe('Title of the survey'),
  elements: z.array(z.record(z.string(), z.unknown())).describe('Survey structure elements'),
  textResponses: z.array(
    z.object({
      responseId: z.string(),
      questionId: z.string(),
      questionTitle: z.string(),
      textAnswer: z.string(),
      submittedAt: z.string().optional(),
      channel: z.string().optional(),
      score: z.number().optional(),
    })
  ).describe('Extracted open-ended text answers'),
  organizationId: z.string().optional(),
  provider: z.string().optional().default('anthropic'),
  modelId: z.string().optional(),
});

export type SurveySentimentThemeInput = z.infer<typeof SurveySentimentThemeInputSchema>;

export const SurveySentimentThemeOutputSchema = z.object({
  overallSentiment: z.object({
    positivePercentage: z.number().min(0).max(100),
    neutralPercentage: z.number().min(0).max(100),
    negativePercentage: z.number().min(0).max(100),
    mixedPercentage: z.number().min(0).max(100),
    netSentimentScore: z.number().min(-100).max(100).describe('Net Sentiment Score (% Positive - % Negative)'),
  }),
  themes: z.array(ThematicClusterSchema).describe('Discovered thematic clusters sorted by prevalence'),
  topPositiveHighlights: z.array(z.string()).describe('Key organizational wins and praised aspects'),
  topUrgentPainPoints: z.array(z.string()).describe('Critical areas of friction or dissatisfaction requiring action'),
  executiveNarrative: z.string().describe('Executive narrative summarizing the qualitative feedback'),
});

export type SurveySentimentThemeOutput = z.infer<typeof SurveySentimentThemeOutputSchema>;

// ─── 3. ANOMALY & OUTLIER DETECTION SCHEMAS ─────────────────────────────────

export const DetectedAnomalySchema = z.object({
  anomalyId: z.string().describe('Unique identifier for the anomaly'),
  type: z.enum([
    'contradictory_feedback',
    'facility_rating_collapse',
    'temporal_spike',
    'straight_lining_cluster',
    'bimodal_polarization',
    'channel_discrepancy',
  ]).describe('Category of statistical or psychometric anomaly'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Severity rating'),
  title: z.string().describe('Clear summary title of the anomaly'),
  description: z.string().describe('Detailed explanation of why this pattern is anomalous'),
  affectedQuestionIds: z.array(z.string()).describe('Questions involved in this anomaly'),
  affectedResponseIds: z.array(z.string()).optional().describe('Specific responses flagged'),
  recommendedAction: z.string().describe('Investigative or operational action to resolve or verify'),
});

export type DetectedAnomaly = z.infer<typeof DetectedAnomalySchema>;

export const SurveyAnomalyDetectionInputSchema = z.object({
  surveyTitle: z.string(),
  elements: z.array(z.record(z.string(), z.unknown())),
  metricsOverview: z.record(z.string(), z.unknown()).describe('Aggregate metric distributions from Phase 4 engine'),
  responsesSample: z.array(z.record(z.string(), z.unknown())).describe('Sample responses with scores, durations, and channels'),
  organizationId: z.string().optional(),
  provider: z.string().optional().default('anthropic'),
  modelId: z.string().optional(),
});

export type SurveyAnomalyDetectionInput = z.infer<typeof SurveyAnomalyDetectionInputSchema>;

export const SurveyAnomalyDetectionOutputSchema = z.object({
  anomaliesDetectedCount: z.number(),
  healthStatus: z.enum(['healthy', 'minor_anomalies', 'action_required', 'critical_investigation']),
  anomalies: z.array(DetectedAnomalySchema).describe('List of detected statistical anomalies'),
  dataIntegrityAssessment: z.string().describe('Summary of overall data reliability and sampling soundness'),
});

export type SurveyAnomalyDetectionOutput = z.infer<typeof SurveyAnomalyDetectionOutputSchema>;

// ─── 4. EVIDENCE-BACKED RESEARCH ASSISTANT SCHEMAS ──────────────────────────

export const EvidenceCitationSchema = z.object({
  responseId: z.string().describe('Source response document ID'),
  questionTitle: z.string().describe('Related question title'),
  evidenceText: z.string().describe('Exact verbatim excerpt or quantitative data point'),
  context: z.string().optional().describe('Respondent metadata or channel info'),
});

export type EvidenceCitation = z.infer<typeof EvidenceCitationSchema>;

export const MetricDataPointSchema = z.object({
  label: z.string().describe('Metric name (e.g. "Detractor Rate" or "Grade 9 Satisfaction")'),
  value: z.string().describe('Formatted value (e.g. "34%" or "2.4 / 5.0")'),
  comparison: z.string().optional().describe('Comparative context (e.g. "vs 12% campus average")'),
});

export type MetricDataPoint = z.infer<typeof MetricDataPointSchema>;

export const SurveyResearchAssistantInputSchema = z.object({
  surveyTitle: z.string(),
  elementsJson: z.string(),
  responsesJson: z.string(),
  userQuery: z.string().min(3, 'Query must be at least 3 characters'),
  organizationId: z.string().optional(),
  provider: z.string().optional().default('anthropic'),
  modelId: z.string().optional(),
});

export type SurveyResearchAssistantInput = z.infer<typeof SurveyResearchAssistantInputSchema>;

export const SurveyResearchAssistantOutputSchema = z.object({
  answerHtml: z.string().describe('Comprehensive, structured HTML answer answering the user question'),
  confidenceScore: z.number().min(0).max(100).describe('Confidence level in this answer based on sample size and clarity'),
  sampleSizeAnalyzed: z.number().describe('Number of responses supporting this analysis'),
  keyMetrics: z.array(MetricDataPointSchema).describe('Key supporting statistical data points'),
  evidenceCitations: z.array(EvidenceCitationSchema).describe('Direct citations and verbatim quotes backing each assertion'),
  suggestedFollowUpQuestions: z.array(z.string()).describe('Smart follow-up research questions to explore next'),
});

export type SurveyResearchAssistantOutput = z.infer<typeof SurveyResearchAssistantOutputSchema>;
