/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Core Domain Types
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Survey 2.0 Domain Entities:
 *    - SurveyProject: Research study / wave container.
 *    - SurveyVersion: Immutable version snapshot ensuring zero breaking changes to running surveys.
 *    - QuestionBankItem: Reusable question templates across system and workspace catalogs.
 *    - SurveyDeployment: Multi-channel distribution layer with quotas and schedules.
 * 2. Strict Zero-Any Invariant:
 *    - All props, interfaces, and callbacks must be strictly typed without any or any[].
 * 3. Testability:
 *    - Validated in src/lib/surveys/__tests__/survey-hydration-adapter.test.ts.
 */

import type { SurveyElement, SurveyResultRule, SurveyResultPage, SurveyQuestion } from '@/lib/types';

export const SURVEY_ARCHETYPES = [
  'feedback',
  'nps',
  'csat',
  'ces',
  'poll',
  'assessment',
  'quiz',
  'evaluation',
  'research',
  'audit',
  'inspection',
  'registration',
  'intake',
  'lead_qualification',
  'customer_health',
  'employee_engagement',
  'market_research',
  'custom',
] as const;
export type SurveyType = (typeof SURVEY_ARCHETYPES)[number];

export const SURVEY_LIFECYCLE_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'scheduled',
  'published',
  'paused',
  'closed',
  'archived',
] as const;
export type SurveyLifecycleStatus = (typeof SURVEY_LIFECYCLE_STATUSES)[number];

export const SURVEY_PRIVACY_MODES = [
  'anonymous',
  'confidential',
  'identified',
  'crm_linked',
] as const;
export type SurveyPrivacyMode = (typeof SURVEY_PRIVACY_MODES)[number];

export const DEPLOYMENT_CHANNELS = [
  'web',
  'embed',
  'qr',
  'email',
  'sms',
  'whatsapp',
  'kiosk',
  'field',
] as const;
export type DeploymentChannel = (typeof DEPLOYMENT_CHANNELS)[number];

export interface SurveyProject {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  description?: string;
  projectType: 'research' | 'experience' | 'assessment' | 'feedback' | 'engagement' | 'custom';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  ownerId: string;
  ownerName?: string;
  startDate?: string;
  endDate?: string;
  surveyIds: string[];
  tags: string[];
  metrics?: {
    totalSurveys: number;
    totalResponses: number;
    avgScore?: number;
    npsScore?: number;
    completionRate?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SurveyVersion {
  id: string;
  surveyId: string;
  workspaceId: string;
  organizationId?: string;
  versionNumber: number;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'superseded';
  elements: SurveyElement[];
  resultRules?: SurveyResultRule[];
  resultPages?: SurveyResultPage[];
  scoringEnabled?: boolean;
  maxScore?: number;
  scoreDisplayMode?: 'points' | 'percentage';
  themeId?: string;
  checksum: string;
  changeLog?: string;
  createdBy: string;
  createdByName?: string;
  publishedBy?: string;
  publishedByName?: string;
  createdAt: string;
  publishedAt?: string;
}

export interface QuestionBankItem {
  id: string;
  workspaceId?: string;
  organizationId?: string;
  visibility: 'private' | 'workspace' | 'system';
  category: 'nps' | 'csat' | 'parent_experience' | 'teacher_wellbeing' | 'student_feedback' | 'general' | string;
  industry?: string;
  metric?: string;
  title: string;
  description?: string;
  questionType: SurveyQuestion['type'];
  options?: Array<{
    id: string;
    text: string;
    value: string | number;
    score?: number;
  }>;
  tags: string[];
  scoringWeight?: number;
  usageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyDeployment {
  id: string;
  surveyId: string;
  workspaceId: string;
  organizationId?: string;
  name: string;
  channel: DeploymentChannel;
  status: 'active' | 'paused' | 'closed';
  slug: string;
  url: string;
  versionId?: string;
  quotaConfig?: {
    maxResponses?: number;
    redirectUrlOnQuota?: string;
    actionOnQuota?: 'close' | 'redirect';
  };
  scheduleConfig?: {
    startDate?: string;
    endDate?: string;
    redirectUrlOnExpiry?: string;
  };
  audienceConfig?: {
    targetType?: 'all' | 'segment' | 'contact_list';
    segmentId?: string;
  };
  attributionConfig?: {
    campaignId?: string;
    source?: string;
    medium?: string;
    agentId?: string;
  };
  stats?: {
    viewsCount: number;
    startsCount: number;
    completionsCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConsentConfig {
  enabled: boolean;
  noticeTitle?: string;
  noticeBody?: string;
  policyVersion?: string;
  policyUrl?: string;
  requireExplicitCheckbox?: boolean;
}
