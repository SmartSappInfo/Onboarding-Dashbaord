/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 8: Research & Enterprise Types
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Longitudinal Multi-Wave Studies: Models waves, cohorts, time-series metrics, and delta comparisons.
 * 2. A/B Testing Experiments: Models variant splits, conversion metrics, and winning variant determination.
 * 3. Enterprise Data Retention & Governance: Models PII anonymization and audit policies.
 * 4. Strict Zero-Any Invariant.
 */

export type SurveyWaveStatus = 'scheduled' | 'active' | 'concluded' | 'archived';

export interface SurveyWave {
  id: string;
  projectId: string;
  waveNumber: number;
  title: string;
  surveyId: string;
  targetStartDate?: string;
  targetEndDate?: string;
  status: SurveyWaveStatus;
  respondentGoal?: number;
  completedResponsesCount?: number;
  averageScore?: number;
  npsScore?: number;
  sentimentPolarity?: string;
  concludedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LongitudinalWaveProgressPoint {
  waveId: string;
  waveNumber: number;
  title: string;
  averageScore: number;
  npsScore: number;
  responsesCount: number;
  date: string;
}

export interface LongitudinalProjectMetrics {
  totalWaves: number;
  activeWaveNumber: number;
  totalResponses: number;
  baselineWaveId?: string;
  latestWaveId?: string;
  compositeScoreProgression: LongitudinalWaveProgressPoint[];
  longitudinalRetentionRate: number; // % of respondents who participated in multiple waves
}

export interface WaveDeltaComparison {
  questionId: string;
  questionTitle: string;
  questionType: string;
  baselineScore: number;
  currentWaveScore: number;
  absoluteDelta: number;
  percentageDelta: number;
  baselineResponsesCount: number;
  currentResponsesCount: number;
  isStatisticallySignificant: boolean;
  pValue?: number;
}

export interface ThematicDriftItem {
  themeLabel: string;
  baselinePrevalence: number;
  currentPrevalence: number;
  driftDirection: 'growing' | 'declining' | 'stable';
  sentimentShift: number;
}

export interface SurveyExperimentVariant {
  id: string;
  label: string;
  description?: string;
  weight: number; // e.g. 50 for 50%
  titleOverride?: string;
  introProseOverride?: string;
  incentiveCopyOverride?: string;
  isControl: boolean;
  metrics: {
    impressions: number;
    starts: number;
    completions: number;
    completionRate: number;
    averageRating?: number;
    averageDurationSeconds?: number;
  };
}

export interface SurveyExperimentConfig {
  enabled: boolean;
  trafficAllocation: number; // 0-100%
  variants: SurveyExperimentVariant[];
  status: 'draft' | 'running' | 'concluded';
  winningVariantId?: string;
  concludedAt?: string;
}

export interface SurveyRetentionPolicy {
  enabled: boolean;
  anonymizePiiAfterDays: number; // e.g. 90
  hardDeleteAfterDays?: number; // e.g. 365
  autoArchiveEnabled: boolean;
  exemptTagIds?: string[];
  lastExecutedAt?: string;
}

export interface SystemResearchGovernanceConfig {
  minSampleSizeForSignificance: number;
  defaultAnonymizePiiDays: number;
  allowHardDelete: boolean;
  requireAuditLogging: boolean;
  maxActiveExperimentsPerWorkspace: number;
}
