/**
 * SmartSapp Forms 2.0: Optimization Engine Domain Models
 * 
 * Defines schemas for A/B testing multi-variant experiments, Bayesian/Z-score
 * statistical significance, 7-dimensional Form Health Scorecards, and proactive anomaly alerts.
 */

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'concluded';

export interface FormVariant {
  id: string;
  name: string;
  isControl: boolean;
  trafficWeight: number; // 0-100 percentage
  headlineOverride?: string;
  subheadOverride?: string;
  ctaLabelOverride?: string;
  themePresetOverride?: 'minimal' | 'professional' | 'card' | 'embedded';
  hiddenFieldIds?: string[];
  visitors: number;
  submissions: number;
  conversionRate: number; // 0-100%
  pipelineValueAttributed: number;
}

export interface StatisticalSignificanceResult {
  zScore: number;
  pValue: number;
  confidence: number; // 0 to 100%
  liftPercentage: number; // relative lift e.g. +22.5%
  isSignificant: boolean;
  hasSufficientSampleSize: boolean;
  recommendedAction: 'continue_testing' | 'declare_winner' | 'inconclusive';
}

export interface FormExperiment {
  id: string;
  formId: string;
  workspaceId: string;
  name: string;
  hypothesis?: string;
  status: ExperimentStatus;
  variants: FormVariant[];
  winnerVariantId?: string;
  statisticalConfidence: number;
  pVal: number;
  liftPercentage: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type FormHealthGrade = 'excellent' | 'good' | 'needs_optimization' | 'critical';

export interface FormHealthCategories {
  conversion: number; // 0-100
  ux: number;
  accessibility: number;
  logic: number;
  crm: number;
  analytics: number;
  security: number;
}

export interface HealthDiagnosticFinding {
  id: string;
  category: keyof FormHealthCategories;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  type: 'pass' | 'warning' | 'suggestion';
  fixActionId?: string;
}

export interface FormHealthScore {
  overallScore: number; // 0-100
  grade: FormHealthGrade;
  categories: FormHealthCategories;
  diagnostics: HealthDiagnosticFinding[];
  calculatedAt: string;
}

export type AnomalySeverity = 'info' | 'warning' | 'critical';
export type AnomalyType =
  | 'conversion_drop'
  | 'mobile_bounce'
  | 'validation_error_spike'
  | 'source_degradation'
  | 'starvation';

export interface FormAnomalyAlert {
  id: string;
  formId: string;
  workspaceId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  metric: string;
  baselineValue: number;
  detectedValue: number;
  percentageDelta: number;
  detectedAt: string;
  resolved: boolean;
}

export interface FormOptimizationRecommendation {
  id: string;
  formId: string;
  category: 'field_reduction' | 'copy_enhancement' | 'stepper_reorder' | 'crm_binding' | 'a11y_fix';
  title: string;
  description: string;
  estimatedLiftPercent: number;
  actionPayload?: Record<string, string | number | boolean>;
}
