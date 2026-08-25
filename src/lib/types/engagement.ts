/**
 * {{Org_name}} Experience Platform — Onboarding, Engagement & Automation Types
 *
 * Strict TypeScript definitions for Onboarding Flows, Member Tasks,
 * Activity Events, Engagement Scoring Profiles, and Automation Triggers.
 * Zero `any` or `any[]` typing.
 */

// ── Status & Enum Types ──────────────────────────────────────────────────────

export type StepType =
  | 'welcome_video'
  | 'complete_profile'
  | 'start_course'
  | 'community_post'
  | 'book_meeting'
  | 'custom_url';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type EngagementTier = 'cold' | 'warm' | 'active' | 'champion';

// ── Sub-Entities ─────────────────────────────────────────────────────────────

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  type: StepType;
  targetUrl?: string;
  targetEntityId?: string; // e.g. Course ID or Space ID
  order: number;
  isRequired: boolean;
}

// ── Core Aggregates ──────────────────────────────────────────────────────────

/**
 * Onboarding Flow Entity
 * Admin-configured sequence of steps for new members.
 */
export interface OnboardingFlow {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];

  title: string;
  description?: string;
  steps: OnboardingStep[];

  isEnabled: boolean;
  completionPoints: number; // e.g. +20 pts on completion

  createdAt: string;
  updatedAt: string;
}

/**
 * Member Onboarding Progress Entity
 */
export interface MemberOnboardingProgress {
  id: string;
  organizationId: string;
  portalId: string;
  userId: string;
  membershipId?: string;

  completedStepIds: string[];
  progressPercentage: number;
  isCompleted: boolean;

  startedAt: string;
  completedAt?: string;
  updatedAt: string;
}

/**
 * Member Daily Task Entity
 * Actionable task for students/bursars with deadlines and rewards.
 */
export interface MemberTask {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];

  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
  pointsReward: number; // e.g. +15 pts
  targetPlanId?: string; // optional gating to plan
  actionUrl?: string;

  isArchived: boolean;
  order: number;

  createdAt: string;
  updatedAt: string;
}

/**
 * Task Submission Entity
 */
export interface TaskSubmission {
  id: string;
  organizationId: string;
  portalId: string;
  taskId: string;
  userId: string;

  status: TaskStatus;
  notes?: string;
  submittedFileUrl?: string;

  completedAt?: string;
  updatedAt: string;
}

/**
 * Member Activity Timeline Event Entity
 * Enters unified member history and synchronizes to CRM timeline.
 */
export interface MemberActivityEvent {
  id: string;
  organizationId: string;
  portalId: string;
  userId: string;

  eventType: string; // e.g. "member.joined", "lesson.completed", "post.created", "task.completed"
  title: string;
  description: string;
  metadata?: Record<string, string | number | boolean>;

  createdAt: string;
}

/**
 * Member Engagement Profile Entity
 */
export interface MemberEngagementProfile {
  id: string;
  organizationId: string;
  portalId: string;
  userId: string;

  tier: EngagementTier;
  engagementScore: number;
  loginStreakDays: number;
  lastActiveAt: string;
  totalActivitiesCount: number;

  updatedAt: string;
}

// ── Input DTOs ───────────────────────────────────────────────────────────────

export interface SaveOnboardingFlowInput {
  organizationId: string;
  portalId: string;
  workspaceIds?: string[];
  title: string;
  description?: string;
  steps: OnboardingStep[];
  isEnabled?: boolean;
  completionPoints?: number;
}

export interface AdvanceOnboardingInput {
  portalId: string;
  userId: string;
  stepId: string;
}

export interface CreateTaskInput {
  organizationId: string;
  portalId: string;
  workspaceIds?: string[];
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  pointsReward?: number;
  targetPlanId?: string;
  actionUrl?: string;
  order?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  pointsReward?: number;
  targetPlanId?: string;
  actionUrl?: string;
  isArchived?: boolean;
  order?: number;
}

export interface CompleteTaskInput {
  organizationId: string;
  portalId: string;
  taskId: string;
  userId: string;
  notes?: string;
  submittedFileUrl?: string;
}

export interface LogMemberActivityInput {
  organizationId: string;
  portalId: string;
  userId: string;
  eventType: string;
  title: string;
  description: string;
  metadata?: Record<string, string | number | boolean>;
}
