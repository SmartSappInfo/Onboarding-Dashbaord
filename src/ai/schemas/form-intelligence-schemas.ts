/**
 * SmartSapp Forms 2.0: AI Response Intelligence & Qualitative Research Schemas
 * 
 * Shared Zod schemas for submission classification, sentiment extraction,
 * thematic topic clustering, and qualitative response synthesis.
 * 
 * Aligned 1:1 with PRD Sections 42, 43, 44, 49, and 133.
 */

import { z } from 'genkit';

// ──────────────────────────────────────────────────────────
// Canonical Enums
// ──────────────────────────────────────────────────────────

export const SENTIMENT_LABELS = ['positive', 'neutral', 'negative'] as const;
export const URGENCY_LEVELS = ['low', 'medium', 'high'] as const;
export const ACTION_TYPES = [
  'assign_lead_owner',
  'apply_crm_tag',
  'update_submission_status',
  'create_crm_task',
  'create_pipeline_deal',
  'send_email_followup',
  'mark_priority',
  'escalate_support'
] as const;

// ──────────────────────────────────────────────────────────
// 1. Single Submission Classification Schemas
// ──────────────────────────────────────────────────────────

export const FormAnswerInputSchema = z.object({
  fieldId: z.string(),
  label: z.string(),
  value: z.unknown(),
  type: z.string().optional(),
});

export const ClassifySubmissionInputSchema = z.object({
  formTitle: z.string(),
  formPurpose: z.string().optional().default('lead_capture'),
  answers: z.array(FormAnswerInputSchema),
  organizationId: z.string().optional(),
});
export type ClassifySubmissionInput = z.infer<typeof ClassifySubmissionInputSchema>;

export const ExtractedEntitySchema = z.object({
  type: z.string().describe('Type of entity e.g. organization, role, amount, pain_point, timeline'),
  value: z.string().describe('Extracted text value'),
  confidence: z.number().min(0).max(1).default(0.9),
});

export const RecommendedActionSchema = z.object({
  id: z.string(),
  actionType: z.enum(ACTION_TYPES),
  title: z.string().describe('Short label e.g. "Assign to Admissions Team"'),
  description: z.string().describe('Concrete guidance for staff'),
  suggestedTag: z.string().optional(),
  suggestedStatus: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const ClassifySubmissionOutputSchema = z.object({
  sentiment: z.enum(SENTIMENT_LABELS).describe('Overall respondent sentiment'),
  sentimentScore: z.number().min(-1).max(1).describe('Continuous score: -1.0 (very negative) to +1.0 (very positive)'),
  intent: z.string().describe('Primary classified intent, e.g. High Purchase Intent, Admission Inquiry, Technical Support, Pricing Feedback'),
  urgency: z.enum(URGENCY_LEVELS).describe('Urgency level based on respondent situation'),
  leadQualityScore: z.number().min(0).max(100).describe('Qualification/quality score (0-100) based on answer depth, intent, and role'),
  topics: z.array(z.string()).describe('List of 2-5 key topics/tags mentioned in the response'),
  entities: z.array(ExtractedEntitySchema).optional().default([]).describe('Extracted structured entities'),
  summary: z.string().describe('Concise 1-2 sentence executive summary of the submission'),
  keyQuotes: z.array(z.string()).optional().default([]).describe('Direct impactful quotes from open-ended responses'),
  recommendedActions: z.array(RecommendedActionSchema).describe('List of 1-3 recommended staff next steps'),
  confidence: z.number().min(0).max(1).describe('Model confidence score (0.0 - 1.0)'),
  needsHumanReview: z.boolean().default(false).describe('Whether confidence is below threshold (<0.70) requiring manual staff verification'),
});
export type ClassifySubmissionOutput = z.infer<typeof ClassifySubmissionOutputSchema>;

// ──────────────────────────────────────────────────────────
// 2. Form-Level Aggregate Topic Clustering Schemas
// ──────────────────────────────────────────────────────────

export const SubmissionSummaryItemSchema = z.object({
  submissionId: z.string(),
  createdAt: z.string().optional(),
  sentiment: z.enum(SENTIMENT_LABELS).optional(),
  intent: z.string().optional(),
  qualitativeText: z.string().describe('Aggregated qualitative responses from respondent'),
});

export const ClusterFormTopicsInputSchema = z.object({
  formTitle: z.string(),
  formPurpose: z.string().optional(),
  submissions: z.array(SubmissionSummaryItemSchema),
  organizationId: z.string().optional(),
});
export type ClusterFormTopicsInput = z.infer<typeof ClusterFormTopicsInputSchema>;

export const ThematicTopicClusterSchema = z.object({
  id: z.string(),
  topic: z.string().describe('Topic / Theme title e.g. "Fee Collection & Invoicing"'),
  mentionCount: z.number().describe('Number of respondents who mentioned this topic'),
  percentageShare: z.number().describe('Percentage of respondents (0-100) discussing this theme'),
  sentiment: z.enum(SENTIMENT_LABELS).describe('Dominant sentiment regarding this topic'),
  sampleQuotes: z.array(z.string()).describe('2-3 representative direct respondent quotes'),
  painPointSummary: z.string().optional().describe('Summary of the core issue or opportunity in this cluster'),
});

export const ClusterFormTopicsOutputSchema = z.object({
  totalSubmissionsAnalyzed: z.number(),
  sentimentDistribution: z.object({
    positiveCount: z.number(),
    positivePercentage: z.number(),
    neutralCount: z.number(),
    neutralPercentage: z.number(),
    negativeCount: z.number(),
    negativePercentage: z.number(),
    averageSentimentScore: z.number().describe('Overall mean sentiment score (-1.0 to +1.0)'),
  }),
  topThemes: z.array(ThematicTopicClusterSchema).describe('Top 3-6 thematic topic clusters'),
  executiveSummary: z.string().describe('High-level cross-submission executive narrative for stakeholders'),
  keyPainPoints: z.array(z.string()).describe('Top customer/respondent pain points identified'),
  actionableRecommendations: z.array(z.string()).describe('Top 3-5 strategic recommendations for the team'),
});
export type ClusterFormTopicsOutput = z.infer<typeof ClusterFormTopicsOutputSchema>;
