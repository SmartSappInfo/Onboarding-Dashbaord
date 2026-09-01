/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 9: Predictive Survey Intelligence Types
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Cross-System Fusion: Surveys + CRM + Messaging + Meetings + Deals & Engagement.
 * 2. Predictive Models: Churn Risk (0-100%), Lead Conversion Propensity (0-100%), Account Health (0-100%).
 * 3. Next-Best-Action (NBA) Prescriptions: Autonomous recovery and growth action derivation.
 * 4. Strict Zero-Any Invariant.
 */

export type PredictiveRiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type PredictiveHealthStatus = 'healthy' | 'neutral' | 'at_risk' | 'critical';

export type NextBestActionType =
  | 'schedule_call'
  | 'assign_vip_task'
  | 'send_recovery_offer'
  | 'request_case_study'
  | 'escalate_support'
  | 'reengage_messaging';

export interface PredictiveDriver {
  category: 'survey' | 'crm' | 'messaging' | 'meetings' | 'billing';
  description: string;
  weight: number;
  polarity: 'positive' | 'negative';
}

export interface NextBestActionPrescription {
  type: NextBestActionType;
  title: string;
  rationale: string;
  recommendedChannel: 'whatsapp' | 'email' | 'call' | 'task';
  priority: 'high' | 'medium' | 'low';
}

export interface EntityPredictiveHealth {
  entityId: string;
  entityName: string;
  healthScore: number; // 0-100
  healthStatus: PredictiveHealthStatus;
  churnRiskPercent: number; // 0-100
  churnRiskLevel: PredictiveRiskLevel;
  conversionPropensityPercent: number; // 0-100
  promoterIndex: number; // 0-100
  riskFactors: PredictiveDriver[];
  positiveDrivers: PredictiveDriver[];
  nextBestAction: NextBestActionPrescription;
  surveySubmissionsCount: number;
  lastSurveyDate?: string;
  openDealsCount: number;
  calculatedAt: string;
}

export interface WorkspacePredictiveOverview {
  totalEvaluatedEntities: number;
  healthyAccountsCount: number;
  atRiskAccountsCount: number;
  criticalAccountsCount: number;
  highPropensityLeadsCount: number;
  averageHealthScore: number;
  atRiskEntities: EntityPredictiveHealth[];
  highPropensityLeads: EntityPredictiveHealth[];
}

export interface SystemPredictiveWeightsConfig {
  surveyWeight: number; // default 40
  crmWeight: number; // default 30
  messagingWeight: number; // default 20
  meetingsWeight: number; // default 10
  churnAlertThreshold: number; // default 70
  conversionHighThreshold: number; // default 80
  autoCreateDetractorTasks: boolean;
}
