/**
 * {{Org_name}} Experience Platform — Learning & Course Domain Types
 *
 * Strict TypeScript definitions for LMS: Programs, Courses, Modules, Lessons,
 * Enrollments, Progress, Drip Release Rules, Assessments, and Assignments.
 * Zero `any` or `any[]` typing.
 */

// ── Course & Content Status Types ────────────────────────────────────────────

export type CourseStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';

export type LessonContentType = 'video' | 'article' | 'quiz' | 'assignment' | 'interactive';

export type EnrollmentSource =
  | 'manual_admin'
  | 'membership_plan'
  | 'invitation'
  | 'purchase'
  | 'automation';

export type EnrollmentStatus = 'active' | 'completed' | 'paused' | 'expired';

export type ReleaseScheduleType =
  | 'immediate'
  | 'specific_date'
  | 'days_after_enrollment'
  | 'days_after_join'
  | 'sequential_prerequisite';

export type CompletionRuleType =
  | 'manual_button'
  | 'video_percentage'
  | 'assessment_pass'
  | 'assignment_approved';

export type AssessmentQuestionType =
  | 'multiple_choice'
  | 'multiple_answer'
  | 'true_false'
  | 'short_answer';

export type AssignmentSubmissionStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'revision_required';

// ── Rules & Sub-Entities ─────────────────────────────────────────────────────

export interface ReleaseRule {
  type: ReleaseScheduleType;
  daysDelay?: number; // Days after enrollment or join
  releaseDate?: string; // ISO date string for specific_date
  requiredLessonId?: string; // Must complete this lesson first
  requiredModuleId?: string; // Must complete this entire module first
}

export interface CompletionRule {
  type: CompletionRuleType;
  minVideoPercentage?: number; // e.g. 80
  minAssessmentScore?: number; // e.g. 75
}

export interface LessonAttachment {
  id: string;
  name: string;
  url: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface AssessmentOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface AssessmentQuestion {
  id: string;
  questionText: string;
  type: AssessmentQuestionType;
  options: AssessmentOption[];
  explanation?: string;
  points: number;
}

// ── Core Aggregates ──────────────────────────────────────────────────────────

/**
 * Course Entity
 * Top-level educational track containing structured modules.
 */
export interface Course {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];

  title: string;
  slug: string;
  description?: string;
  summary?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;

  instructorName?: string;
  instructorTitle?: string;
  instructorAvatarUrl?: string;
  instructorBio?: string;

  level: CourseLevel;
  category?: string;
  tags?: string[];
  estimatedDurationMinutes?: number;

  status: CourseStatus;
  defaultReleaseType: ReleaseScheduleType;
  prerequisiteCourseIds?: string[];
  learningObjectives?: string[];

  certificateEnabled: boolean;
  certificateTemplateId?: string;

  order: number;
  featured?: boolean;

  totalModuleCount?: number;
  totalLessonCount?: number;
  totalDurationSeconds?: number;

  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  createdBy?: string;
}

/**
 * Course Module Entity
 * Section grouping related lessons within a course.
 */
export interface CourseModule {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;

  title: string;
  description?: string;
  order: number;

  releaseRule?: ReleaseRule;

  lessonCount?: number;
  durationSeconds?: number;

  createdAt: string;
  updatedAt: string;
}

/**
 * Course Lesson Entity
 * Individual learning unit with multimedia content, quiz, or assignment.
 */
export interface CourseLesson {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;
  moduleId: string;

  title: string;
  slug: string;
  summary?: string;

  contentType: LessonContentType;
  content?: string; // Rich Markdown / HTML body
  videoUrl?: string; // YouTube, Vimeo, Mux, or Direct MP4/HLS
  videoDurationSeconds?: number;
  thumbnailUrl?: string;

  attachments?: LessonAttachment[];
  completionRule: CompletionRule;
  releaseRule?: ReleaseRule;

  order: number;
  isPreview?: boolean; // If true, can be viewed without enrollment

  assessmentId?: string;
  assignmentId?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Course Enrollment Entity
 * Active record associating a user/membership with a course.
 */
export interface CourseEnrollment {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];

  courseId: string;
  userId: string;
  membershipId?: string;

  source: EnrollmentSource;
  status: EnrollmentStatus;

  progressPercentage: number; // 0 - 100
  completedLessonCount: number;
  totalLessonCount: number;

  currentLessonId?: string; // Last active lesson for 1-click resume

  enrolledAt: string;
  lastAccessedAt: string;
  completedAt?: string;
}

/**
 * Learning Progress Entity
 * Granular progress tracking per lesson for an individual learner.
 */
export interface LearningProgress {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  userId: string;

  isCompleted: boolean;
  watchSeconds: number;
  watchPercentage: number; // 0 - 100

  assessmentScore?: number; // 0 - 100
  assessmentPassed?: boolean;
  assessmentAttempts?: number;

  completedAt?: string;
  lastInteractedAt: string;
}

/**
 * Course Assessment / Quiz Entity
 */
export interface CourseAssessment {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;
  lessonId: string;

  title: string;
  instructions?: string;
  passingScore: number; // e.g. 70 (%)
  maxAttempts?: number; // 0 or undefined for unlimited

  questions: AssessmentQuestion[];

  createdAt: string;
  updatedAt: string;
}

/**
 * Course Assignment Entity
 */
export interface CourseAssignment {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;
  lessonId: string;

  title: string;
  instructions: string;
  rubric?: string;
  allowedFileTypes?: string[]; // e.g. ['.pdf', '.docx', '.xlsx']
  maxFileSizeMb?: number; // e.g. 25

  createdAt: string;
  updatedAt: string;
}

/**
 * Student Assignment Submission Entity
 */
export interface AssignmentSubmission {
  id: string;
  organizationId: string;
  portalId: string;
  courseId: string;
  lessonId: string;
  assignmentId: string;
  userId: string;
  membershipId?: string;

  textContent?: string;
  fileUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;

  status: AssignmentSubmissionStatus;
  gradeScore?: number; // 0 - 100
  feedback?: string;
  reviewedBy?: string;
  reviewedAt?: string;

  submittedAt: string;
  updatedAt: string;
}

// ── Curriculum Aggregated Tree View ──────────────────────────────────────────

export interface AggregatedLesson extends CourseLesson {
  progress?: LearningProgress;
  isUnlocked?: boolean;
  unlockReason?: string;
}

export interface AggregatedModule extends CourseModule {
  lessons: AggregatedLesson[];
  isUnlocked?: boolean;
  unlockReason?: string;
}

export interface CourseCurriculumTree {
  course: Course;
  modules: AggregatedModule[];
  enrollment?: CourseEnrollment;
}

// ── Input DTOs ───────────────────────────────────────────────────────────────

export interface CreateCourseInput {
  organizationId: string;
  portalId: string;
  workspaceIds?: string[];
  title: string;
  slug?: string;
  description?: string;
  summary?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  instructorName?: string;
  instructorTitle?: string;
  instructorAvatarUrl?: string;
  instructorBio?: string;
  level?: CourseLevel;
  category?: string;
  tags?: string[];
  estimatedDurationMinutes?: number;
  status?: CourseStatus;
  defaultReleaseType?: ReleaseScheduleType;
  learningObjectives?: string[];
  certificateEnabled?: boolean;
  order?: number;
  featured?: boolean;
}

export interface UpdateCourseInput {
  title?: string;
  slug?: string;
  description?: string;
  summary?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  instructorName?: string;
  instructorTitle?: string;
  instructorAvatarUrl?: string;
  instructorBio?: string;
  level?: CourseLevel;
  category?: string;
  tags?: string[];
  estimatedDurationMinutes?: number;
  status?: CourseStatus;
  defaultReleaseType?: ReleaseScheduleType;
  learningObjectives?: string[];
  certificateEnabled?: boolean;
  order?: number;
  featured?: boolean;
}

export interface CreateModuleInput {
  organizationId: string;
  portalId: string;
  courseId: string;
  title: string;
  description?: string;
  order?: number;
  releaseRule?: ReleaseRule;
}

export interface UpdateModuleInput {
  title?: string;
  description?: string;
  order?: number;
  releaseRule?: ReleaseRule;
}

export interface CreateLessonInput {
  organizationId: string;
  portalId: string;
  courseId: string;
  moduleId: string;
  title: string;
  slug?: string;
  summary?: string;
  contentType?: LessonContentType;
  content?: string;
  videoUrl?: string;
  videoDurationSeconds?: number;
  thumbnailUrl?: string;
  attachments?: LessonAttachment[];
  completionRule?: CompletionRule;
  releaseRule?: ReleaseRule;
  order?: number;
  isPreview?: boolean;
}

export interface UpdateLessonInput {
  title?: string;
  slug?: string;
  summary?: string;
  contentType?: LessonContentType;
  content?: string;
  videoUrl?: string;
  videoDurationSeconds?: number;
  thumbnailUrl?: string;
  attachments?: LessonAttachment[];
  completionRule?: CompletionRule;
  releaseRule?: ReleaseRule;
  order?: number;
  isPreview?: boolean;
  assessmentId?: string;
  assignmentId?: string;
}

export interface SubmitAssessmentInput {
  assessmentId: string;
  courseId: string;
  lessonId: string;
  portalId: string;
  userId: string;
  answers: { questionId: string; selectedOptionIds: string[]; textAnswer?: string }[];
}

export interface AssessmentResult {
  passed: boolean;
  score: number; // 0 - 100
  totalPointsEarned: number;
  totalPointsPossible: number;
  correctAnswersCount: number;
  totalQuestionsCount: number;
  questionResults: {
    questionId: string;
    isCorrect: boolean;
    explanation?: string;
    pointsEarned: number;
  }[];
}

export interface SubmitAssignmentInput {
  assignmentId: string;
  courseId: string;
  lessonId: string;
  portalId: string;
  userId: string;
  membershipId?: string;
  textContent?: string;
  fileUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
}
