/**
 * {{Org_name}} Experience Platform — AI Experience & Intelligence Types
 *
 * Strict TypeScript definitions for AI Portal Scaffolding, Curriculum Generation,
 * AI Tutor RAG Sessions, Assessment Question Generation, and Pedagogy Diagnostics.
 * Zero `any` or `any[]` typing.
 */

import type { AssessmentQuestion } from './learning';

// ── Status & Enum Types ──────────────────────────────────────────────────────

export type AiTaskType =
  | 'portal_scaffold'
  | 'course_curriculum'
  | 'lesson_content'
  | 'quiz_questions'
  | 'discussion_prompts'
  | 'rag_ingestion'
  | 'pedagogy_diagnostic';

export type AiTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type AiSenderType = 'user' | 'ai' | 'system';

// ── Core Aggregates ──────────────────────────────────────────────────────────

/**
 * AI Generation Background Task Record
 */
export interface AiGenerationTask {
  id: string;
  organizationId: string;
  portalId: string;
  userId: string;
  taskType: AiTaskType;
  status: AiTaskStatus;
  prompt: string;
  resultJson?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * AI Tutor Chat Message
 */
export interface AiTutorMessage {
  id: string;
  sender: AiSenderType;
  text: string;
  suggestedActions?: string[];
  timestamp: string;
}

/**
 * AI Tutor Session Aggregate
 * Scoped to a specific student and lesson.
 */
export interface AiTutorSession {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;
  lessonId: string;
  userId: string;

  messages: AiTutorMessage[];
  summary?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Chunked Knowledge Base Item for Vector/RAG Retrieval
 */
export interface AiKnowledgeChunk {
  id: string;
  organizationId: string;
  portalId: string;
  resourceType: 'course' | 'lesson' | 'resource' | 'space';
  resourceId: string;

  title: string;
  contentChunk: string;
  allowedPlanIds?: string[];

  createdAt: string;
}

/**
 * AI Learning Diagnostic & Drop-off Report
 */
export interface AiPedagogyDiagnostic {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;
  courseTitle: string;

  dropOffLessonId?: string;
  dropOffLessonTitle?: string;
  dropOffRatePercent: number;
  assessmentFailureRatePercent?: number;

  diagnosis: string;
  actionableRecommendations: string[];

  createdAt: string;
}

// ── Input & Output DTOs ──────────────────────────────────────────────────────

export interface GeneratePortalScaffoldInput {
  organizationId: string;
  portalName: string;
  audienceDescription: string;
  industry: string;
  primaryGoal: string;
}

export interface GeneratedPortalScaffold {
  portalName: string;
  tagline: string;
  primaryColor: string;
  suggestedCourses: Array<{
    title: string;
    description: string;
    modulesCount: number;
  }>;
  suggestedSpaces: Array<{
    name: string;
    description: string;
  }>;
  suggestedOnboardingSteps: Array<{
    title: string;
    description: string;
  }>;
}

export interface GenerateCurriculumInput {
  organizationId: string;
  portalId: string;
  topicPrompt: string;
  targetAudience?: string;
  durationDays?: number;
}

export interface GeneratedCurriculumModule {
  title: string;
  description: string;
  lessons: Array<{
    title: string;
    contentType: 'video' | 'article' | 'quiz' | 'interactive';
    description: string;
    objectives: string[];
  }>;
}

export interface GeneratedCurriculum {
  courseTitle: string;
  description: string;
  estimatedHours: number;
  modules: GeneratedCurriculumModule[];
}

export interface AskAiTutorInput {
  organizationId: string;
  portalId: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  lessonContentSummary?: string;
  userId: string;
  userMessage: string;
}

export interface GenerateQuizInput {
  organizationId: string;
  portalId: string;
  lessonId: string;
  lessonTitle: string;
  lessonContentText?: string;
  questionCount?: number;
}
