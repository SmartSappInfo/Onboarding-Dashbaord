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
  | 'action_task'
  | 'book_meeting'
  | 'custom_url';

export type AutoVerificationType =
  | 'auto_watch'
  | 'has_profile'
  | 'has_started_lesson'
  | 'has_community_post'
  | 'has_task_submission'
  | 'manual_confirm';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type SubmissionReviewStatus = 'pending_review' | 'approved' | 'rejected';

export type EngagementTier = 'cold' | 'warm' | 'active' | 'champion';

export type EngagementAutomationTrigger =
  | 'portal.member_joined'
  | 'portal.onboarding_step_completed'
  | 'portal.onboarding_completed'
  | 'portal.task_submitted'
  | 'portal.task_approved'
  | 'portal.course_completed'
  | 'portal.member_inactive';

// ── Sub-Entities ─────────────────────────────────────────────────────────────

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  type: StepType;
  /** Custom button text configured in Backoffice Studio (e.g. "Watch Video", "Set Up Profile", "Start Lesson →") */
  actionLabel?: string;
  /** Direct video asset URL (YouTube, Vimeo, Loom, MP4) for welcome_video */
  videoUrl?: string;
  /** Automated verification mode for zero-code backoffice configuration */
  autoVerificationType?: AutoVerificationType;
  targetUrl?: string;
  targetEntityId?: string; // e.g. Course ID or Space ID or Task ID
  order: number;
  isRequired: boolean;
  pointsReward?: number;
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
  completionPoints: number; // e.g. +50 pts on completion

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
  relativeDueDays?: number; // e.g. Due 3 days after joining
  pointsReward: number; // e.g. +15 pts
  targetPlanId?: string; // optional gating to plan
  actionUrl?: string;
  requireFileUpload?: boolean;
  downloadTemplateUrl?: string;
  completionTagIds?: string[];

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
  userName?: string;
  userAvatarUrl?: string;

  status: TaskStatus;
  reviewStatus?: SubmissionReviewStatus;
  notes?: string;
  submittedFileUrl?: string;
  submittedFileName?: string;
  submittedFileSizeBytes?: number;
  instructorFeedback?: string;
  reviewedBy?: string;
  reviewedAt?: string;

  completedAt?: string;
  submittedAt: string;
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
  relativeDueDays?: number;
  pointsReward?: number;
  targetPlanId?: string;
  actionUrl?: string;
  requireFileUpload?: boolean;
  downloadTemplateUrl?: string;
  completionTagIds?: string[];
  order?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  relativeDueDays?: number;
  pointsReward?: number;
  targetPlanId?: string;
  actionUrl?: string;
  requireFileUpload?: boolean;
  downloadTemplateUrl?: string;
  completionTagIds?: string[];
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

export interface SubmitTaskInput {
  organizationId: string;
  portalId: string;
  taskId: string;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  notes?: string;
  submittedFileUrl?: string;
  submittedFileName?: string;
  submittedFileSizeBytes?: number;
}

export interface ReviewTaskSubmissionInput {
  submissionId: string;
  portalId: string;
  taskId: string;
  userId: string;
  reviewStatus: 'approved' | 'rejected';
  feedback?: string;
  reviewerUserId: string;
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

export interface UpdateMemberProfileInput {
  portalId: string;
  userId: string;
  displayName: string;
  schoolName?: string;
  jobTitle?: string;
  whatsappNumber?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface ReconcileOnboardingResult {
  updatedStepIds: string[];
  totalCompleted: number;
  isFullyCompleted: boolean;
  pointsAwarded: number;
}

