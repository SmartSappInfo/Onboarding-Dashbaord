/**
 * SmartSapp Forms 2.0: Response Intelligence Domain Models
 * 
 * Defines canonical data types for submission classification,
 * sentiment analysis, thematic topic clustering, and recommended actions.
 */

export type SentimentLabel = 'positive' | 'neutral' | 'negative';
export type UrgencyLevel = 'low' | 'medium' | 'high';
export type IntelligenceActionType =
  | 'assign_lead_owner'
  | 'apply_crm_tag'
  | 'update_submission_status'
  | 'create_crm_task'
  | 'create_pipeline_deal'
  | 'send_email_followup'
  | 'mark_priority'
  | 'escalate_support';

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
}

export interface RecommendedAction {
  id: string;
  actionType: IntelligenceActionType;
  title: string;
  description: string;
  suggestedTag?: string;
  suggestedStatus?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface FormSubmissionAiClassification {
  sentiment: SentimentLabel;
  sentimentScore: number; // -1.0 to +1.0
  intent: string;
  urgency: UrgencyLevel;
  leadQualityScore: number; // 0 to 100
  topics: string[];
  entities?: ExtractedEntity[];
  summary: string;
  keyQuotes?: string[];
  recommendedActions: RecommendedAction[];
  confidence: number;
  needsHumanReview?: boolean;
  model: string;
  classifiedAt: string;
}

export interface TopicThemeCluster {
  id: string;
  topic: string;
  mentionCount: number;
  percentageShare: number;
  sentiment: SentimentLabel;
  sampleQuotes: string[];
  painPointSummary?: string;
}

export interface FormSentimentDistribution {
  positiveCount: number;
  positivePercentage: number;
  neutralCount: number;
  neutralPercentage: number;
  negativeCount: number;
  negativePercentage: number;
  averageSentimentScore: number;
}

export interface FormAiTopicClusterSummary {
  id: string;
  formId: string;
  workspaceId: string;
  totalSubmissionsAnalyzed: number;
  sentimentDistribution: FormSentimentDistribution;
  topThemes: TopicThemeCluster[];
  executiveSummary: string;
  keyPainPoints: string[];
  actionableRecommendations: string[];
  analyzedAt: string;
  model: string;
}

export interface ClassifySubmissionResult {
  success: boolean;
  submissionId: string;
  classification?: FormSubmissionAiClassification;
  error?: string;
}

export interface BatchClassifyResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  results: ClassifySubmissionResult[];
  error?: string;
}

export interface TopicClusterResult {
  success: boolean;
  clusters?: FormAiTopicClusterSummary;
  error?: string;
}
