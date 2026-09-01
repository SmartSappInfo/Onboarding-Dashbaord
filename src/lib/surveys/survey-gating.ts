/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Quota & Schedule Gating Engine
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Survey Availability & Quota Enforcement.
 * 2. Deterministic Verification:
 *    - Evaluates survey lifecycle status (published/active).
 *    - Validates deployment schedule window (startDate -> endDate).
 *    - Enforces submission response caps (quotaConfig.maxResponses).
 * 3. Strict Zero-Any Invariant.
 */

import type { Survey } from '@/lib/types';
import type { SurveyDeployment } from './survey-v2-types';

export type GatingFailureReason = 
  | 'CLOSED' 
  | 'PAUSED' 
  | 'SCHEDULED_FUTURE' 
  | 'EXPIRED_PAST' 
  | 'QUOTA_EXCEEDED' 
  | 'PASSWORD_REQUIRED';

export interface GatingEvaluationResult {
  allowed: boolean;
  reason?: GatingFailureReason;
  message: string;
  redirectUrl?: string;
  startDate?: string;
  endDate?: string;
  maxResponses?: number;
  currentResponses?: number;
}

/**
 * Evaluates whether a survey and deployment instance is currently accepting respondent submissions.
 */
export function isSurveyAcceptingSubmissions(
  survey: Partial<Survey>,
  deployment?: Partial<SurveyDeployment> | null,
  currentResponseCount: number = 0,
  now: Date = new Date()
): GatingEvaluationResult {
  // 1. Survey Global Status Check
  if (survey.status && survey.status !== 'published' && (survey.status as string) !== 'active') {
    return {
      allowed: false,
      reason: 'CLOSED',
      message: 'This survey is not currently accepting responses.',
    };
  }

  // 2. Deployment Status Check
  if (deployment) {
    if (deployment.status === 'paused') {
      return {
        allowed: false,
        reason: 'PAUSED',
        message: 'This survey distribution link is temporarily paused by the administrator.',
      };
    }
    if (deployment.status === 'closed') {
      return {
        allowed: false,
        reason: 'CLOSED',
        message: 'This survey deployment has been permanently closed.',
        redirectUrl: deployment.quotaConfig?.redirectUrlOnQuota,
      };
    }

    // 3. Schedule Gating
    if (deployment.scheduleConfig) {
      const { startDate, endDate, redirectUrlOnExpiry } = deployment.scheduleConfig;

      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime()) && now < start) {
          return {
            allowed: false,
            reason: 'SCHEDULED_FUTURE',
            message: `This survey is scheduled to open on ${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            startDate,
          };
        }
      }

      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime()) && now > end) {
          return {
            allowed: false,
            reason: 'EXPIRED_PAST',
            message: `This survey closed on ${end.toLocaleDateString()} at ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            redirectUrl: redirectUrlOnExpiry,
            endDate,
          };
        }
      }
    }

    // 4. Quota Gating
    if (deployment.quotaConfig && deployment.quotaConfig.maxResponses !== undefined && deployment.quotaConfig.maxResponses > 0) {
      const max = deployment.quotaConfig.maxResponses;
      if (currentResponseCount >= max) {
        return {
          allowed: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'This survey has reached its maximum response capacity and is no longer accepting new submissions.',
          redirectUrl: deployment.quotaConfig.redirectUrlOnQuota,
          maxResponses: max,
          currentResponses: currentResponseCount,
        };
      }
    }
  }

  return {
    allowed: true,
    message: 'Survey is active and accepting responses.',
  };
}
