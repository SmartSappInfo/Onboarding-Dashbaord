/**
 * @fileoverview Type contracts and domain interfaces for Phase 5: Conversation Intelligence & Coaching.
 *
 * ARCHITECTURAL POINTER:
 * Serves as the single source of truth for:
 * 1. Call Conversations, Transcripts, and Timestamp-Anchored Intelligence Signals.
 * 2. Speech Dynamics (Talk/Listen Ratios, Pacing Words/Min, Monologue Warnings).
 * 3. Gong-Style Structured Scorecards (Discovery, Demo, Closing) with dual AI + Manager Evaluation.
 * 4. Interactive AI Buyer Sales Practice Lab Scenarios & Multi-Pillar Roleplay Evaluations.
 * 5. Rep Coaching Profiles, Competency Radars, and Manager Team Heatmaps.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced: Zero 'any' or 'any[]'.
 * - Must strictly scope all entities to workspaceId and organizationId.
 * - Adheres to next-best-practices, vercel-react-best-practices, and emilkowal-animations.
 */

export type SignalCategory =
  | 'budget'
  | 'timeline'
  | 'authority'
  | 'need'
  | 'urgency'
  | 'competitor'
  | 'pricing'
  | 'pain_point'
  | 'next_step';

export type ObjectionType =
  | 'pricing'
  | 'timing'
  | 'competitor'
  | 'vendor'
  | 'authority'
  | 'procurement';

export type ScorecardCategory = 'discovery' | 'demo' | 'closing' | 'qualification';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type PacingVerdict = 'fast' | 'optimal' | 'slow';

export type TalkListenEvaluation = 'balanced' | 'rep_dominated' | 'buyer_dominated';

/**
 * Single speaker turn within a conversation transcript.
 */
export interface TranscriptLine {
  id: string;
  speaker: 'rep' | 'buyer' | 'other';
  speakerName: string;
  startMs: number;
  endMs: number;
  timestampLabel: string; // e.g. "01:24"
  text: string;
  tags?: SignalCategory[];
}

/**
 * Granular speech and conversation dynamics.
 */
export interface ConversationDynamics {
  talkToListenRatio: {
    repPercent: number;    // e.g. 45
    buyerPercent: number;  // e.g. 55
    evaluation: TalkListenEvaluation;
  };
  wordsPerMinute: number;
  pacingVerdict: PacingVerdict;
  longestMonologueSeconds: number; // Alert if > 120s
  hasMonologueAlert: boolean;
  discoveryQuestionsCount: number;
}

/**
 * Buying signal detected in conversation.
 */
export interface BuyingSignal {
  id: string;
  text: string;
  timestampMs: number;
  category: SignalCategory;
  quote: string;
  confidence: number; // 0.0 - 1.0
}

/**
 * Objection detected in conversation with evaluation of seller's response.
 */
export interface ExtractedObjection {
  id: string;
  objectionType: ObjectionType;
  timestampMs: number;
  severity: 'high' | 'medium' | 'low';
  repHandledScore: number; // 0 - 100
  repResponseQuote?: string;
  buyerReaction: 'neutral' | 'skeptical' | 'satisfied';
  aiFeedback: string;
}

/**
 * Synthesized interaction intelligence.
 */
export interface ExtractedIntelligence {
  buyingSignals: BuyingSignal[];
  objections: ExtractedObjection[];
  painPoints: string[];
  nextSteps: string[];
  sentimentScore: number; // -1.0 to 1.0
  competitorsMentioned: string[];
  keyStrengths: string[];
  coachingRecommendations: string[];
}

/**
 * Scorecard Evaluation Rubric Criterion.
 */
export interface ScorecardCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // e.g. 0.25 (25%)
  rubricGuidance: {
    1: string; // Poor (what does 1 look like?)
    3: string; // Adequate
    5: string; // Excellent
  };
}

/**
 * Scorecard Template definition (e.g. Discovery Mastery, Demo Value Linkage).
 */
export interface ScorecardTemplate {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  category: ScorecardCategory;
  description: string;
  criteria: ScorecardCriterion[];
  isDefault?: boolean;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/**
 * Rating given for an individual criterion in a scorecard evaluation.
 */
export interface CriterionRating {
  criteriaId: string;
  criterionName?: string;
  weight?: number;
  score: 1 | 2 | 3 | 4 | 5;
  aiEvidenceQuotes: Array<{
    timestampMs: number;
    quote: string;
  }>;
  comment?: string;
  notes?: string;
}

/**
 * Full scorecard review evaluation for a call.
 */
export interface CallScorecardReview {
  id: string;
  callId: string;
  workspaceId: string;
  templateId: string;
  templateName?: string;
  evaluatedBy: 'ai' | 'manager' | 'self' | 'peer';
  evaluatorId: string;
  evaluatorName: string;
  totalScorePercent: number; // 0 - 100
  ratings: CriterionRating[];
  keyStrengths: string[];
  growthAreas: string[];
  notes?: string;
  recommendedPracticeDrill?: {
    scenarioId: string;
    title: string;
    reason: string;
  };
  reviewedAt: string; // ISO 8601
}

/**
 * Complete Call Conversation Entity.
 */
export interface CallConversation {
  id: string;
  workspaceId: string;
  organizationId: string;
  repId: string;
  repName: string;
  repPhotoURL?: string;
  contactId: string;
  contactName: string;
  dealId?: string;
  dealName?: string;
  dealValue?: number;
  durationSeconds: number;
  audioUrl?: string;
  waveform?: number[]; // Normalized 0-100 amplitude bars for scrubber
  transcript: TranscriptLine[];
  dynamics: ConversationDynamics;
  intelligence: ExtractedIntelligence;
  scorecardReview?: CallScorecardReview;
  status: 'completed' | 'processing' | 'failed';
  recordedAt: string; // ISO 8601
  createdAt: string;
  updatedAt: string;
}

/**
 * Practice Lab Roleplay Scenario.
 */
export interface PracticeLabScenario {
  id: string;
  workspaceId: string;
  title: string;
  category: 'pricing' | 'competitors' | 'discovery' | 'closing' | 'timing' | 'procurement';
  difficulty: DifficultyLevel;
  description: string;
  buyerPersona: {
    name: string;
    title: string;
    companyType: string;
    tone: 'skeptical' | 'busy' | 'analytical' | 'friendly';
    avatarUrl?: string;
  };
  initialPrompt: string;
  expectedCompetencies: string[];
  isSystemDefault?: boolean;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/**
 * Dialogue message in an ongoing roleplay simulation.
 */
export interface RoleplayTurn {
  id: string;
  speaker: 'ai_buyer' | 'rep' | 'buyer';
  text?: string;
  message?: string;
  timestamp: string;
  coachingTip?: string;
  turnFeedback?: {
    listeningScore: number;
    questionQualityScore: number;
    objectionHandlingScore: number;
    quickTip?: string;
  };
}

/**
 * Final evaluation of a completed roleplay session.
 */
export interface RoleplayEvaluation {
  discoveryScore: number;
  questionQualityScore: number;
  objectionHandlingScore: number;
  listeningScore: number;
  closingScore: number;
  overallScore: number; // 0 - 100
  coachingFeedback: string;
  keyStrengths: string[];
  growthAreas: string[];
  nextRecommendedScenarioId?: string;
}

/**
 * Roleplay Session Record.
 */
export interface RoleplaySession {
  id: string;
  repId: string;
  repName: string;
  scenarioId: string;
  scenarioTitle: string;
  workspaceId: string;
  organizationId: string;
  status: 'in_progress' | 'completed';
  turnsCount?: number;
  maxTurns?: number; // default 6
  dialogue: RoleplayTurn[];
  evaluation?: RoleplayEvaluation;
  startedAt: string;
  completedAt?: string;
}

/**
 * Rep Development Competency Scores (0-100).
 */
export interface RepSkillScores {
  discovery: number;
  objectionHandling: number;
  closing: number;
  productKnowledge: number;
  callControl: number;
}

/**
 * Assigned Practice Drill.
 */
export interface AssignedDrillItem {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  title?: string;
  category: string;
  instructions?: string;
  scoreResult?: number;
  assignedBy: {
    userId: string;
    userName: string;
  };
  assignedAt: string;
  deadlineDate?: string;
  completedAt?: string;
  status: 'pending' | 'completed';
}

/**
 * Rep Coaching Profile.
 */
export interface RepCoachingProfile {
  id: string; // `${workspaceId}_${repId}`
  repId: string;
  repName: string;
  repEmail: string;
  photoURL?: string;
  workspaceId: string;
  organizationId: string;
  skillScores: RepSkillScores;
  activeGoal?: {
    id?: string;
    title: string;
    focusDimension: keyof RepSkillScores | string;
    currentScore: number;
    targetScore: number;
    deadlineDate: string;
    status: 'active' | 'completed';
  };
  assignedDrills: AssignedDrillItem[];
  recentCallsForReview: string[]; // call IDs
  updatedAt: string;
}

/**
 * Team Coaching Overview for Managers.
 */
export interface TeamCoachingOverview {
  workspaceId: string;
  teamAverageSkills: RepSkillScores;
  averageSkillScores?: RepSkillScores;
  repsCount?: number;
  totalCallsAnalyzed?: number;
  totalDrillsCompleted?: number;
  highPriorityOpportunities?: Array<{
    id: string;
    repId: string;
    repName: string;
    repPhotoURL?: string;
    riskType: 'critical_skill_gap' | 'performance_dip';
    description: string;
    suggestedScenarioId?: string;
    suggestedScenarioTitle?: string;
  }>;
  coachingOpportunities?: Array<{
    id: string;
    repId: string;
    repName: string;
    urgency: 'high' | 'medium' | 'low';
    area: string;
    headline: string;
    suggestedDrillId: string;
    suggestedDrillTitle: string;
    contextReason: string;
  }>;
  repHeatmap?: Array<{
    repId: string;
    repName: string;
    skills: RepSkillScores;
    compositeScore: number;
    callsReviewedCount: number;
    drillsCompletedCount: number;
  }>;
  repSkillMatrix?: Array<{
    repId: string;
    repName: string;
    repEmail: string;
    photoURL?: string;
    skillScores: RepSkillScores;
    completedDrillsCount: number;
    pendingDrillsCount: number;
    lowestSkillArea: string;
    lowestScore: number;
    recommendedDrill?: PracticeLabScenario;
  }>;
}

/**
 * Complete Workspace Coaching Payload.
 */
export interface CoachingWorkspacePayload {
  profile: RepCoachingProfile;
  recentCalls: CallConversation[];
  practiceScenarios: PracticeLabScenario[];
  activeSessions: RoleplaySession[];
  scorecardTemplates: ScorecardTemplate[];
  teamOverview?: TeamCoachingOverview;
}
