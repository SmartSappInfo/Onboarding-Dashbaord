'use server';

/**
 * @fileOverview Secure Server Actions for AI Workforce Intelligence & Role Advisor (Phase 8)
 *
 * Provides cryptographically verified server endpoints for multi-factor workforce risk scoring,
 * AI recommendation generation, and deterministic recommendation execution.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - All actions perform `adminAuth.verifyIdToken()`.
 * - Multi-tenant scoping enforced on every query and mutation.
 * - Zero `any` or `any[]` typing.
 */

import { adminAuth } from '@/lib/firebase-admin';
import { AiWorkforceRiskEngine } from '@/lib/services/ai/ai-workforce-risk-engine';
import { AiRoleAdvisorService } from '@/lib/services/ai/ai-role-advisor-service';
import type {
  MemberRiskScore,
  OrganizationRiskOverview,
  AiWorkforceRecommendation,
  AiRecommendationStatus,
} from '@/lib/types';

// Helper to verify caller token
async function verifyCaller(idToken: string) {
  if (!idToken) throw new Error('Missing authentication token');
  return await adminAuth.verifyIdToken(idToken);
}

// ----------------------------------------------------
// 1. RISK ENGINE ACTIONS
// ----------------------------------------------------

export async function getPersonRiskScoreAction(params: {
  idToken: string;
  organizationId: string;
  personId: string;
}): Promise<{ success: boolean; riskScore?: MemberRiskScore; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const riskScore = await AiWorkforceRiskEngine.evaluateMemberRiskScore(
      params.organizationId,
      params.personId
    );
    return { success: true, riskScore };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to evaluate member risk';
    return { success: false, error: msg };
  }
}

export async function getOrganizationRiskOverviewAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{ success: boolean; overview?: OrganizationRiskOverview; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const overview = await AiWorkforceRiskEngine.getOrganizationRiskOverview(params.organizationId);
    return { success: true, overview };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get organization risk overview';
    return { success: false, error: msg };
  }
}

// ----------------------------------------------------
// 2. AI ROLE & ACCESS ADVISOR ACTIONS
// ----------------------------------------------------

export async function listAiRecommendationsAction(params: {
  idToken: string;
  organizationId: string;
  status?: AiRecommendationStatus;
}): Promise<{ success: boolean; recommendations: AiWorkforceRecommendation[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const recommendations = await AiRoleAdvisorService.listRecommendations(
      params.organizationId,
      params.status || 'active'
    );
    return { success: true, recommendations };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list recommendations';
    return { success: false, recommendations: [], error: msg };
  }
}

export async function generateAiRecommendationsAction(params: {
  idToken: string;
  organizationId: string;
}): Promise<{ success: boolean; recommendations: AiWorkforceRecommendation[]; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    const recommendations = await AiRoleAdvisorService.generateRecommendations(
      params.organizationId
    );
    return { success: true, recommendations };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate recommendations';
    return { success: false, recommendations: [], error: msg };
  }
}

export async function applyAiRecommendationAction(params: {
  idToken: string;
  organizationId: string;
  recommendationId: string;
}): Promise<{ success: boolean; recommendation?: AiWorkforceRecommendation; error?: string }> {
  try {
    const decoded = await verifyCaller(params.idToken);
    const recommendation = await AiRoleAdvisorService.applyRecommendation(
      params.organizationId,
      params.recommendationId,
      decoded.uid
    );
    return { success: true, recommendation };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to apply recommendation';
    return { success: false, error: msg };
  }
}

export async function dismissAiRecommendationAction(params: {
  idToken: string;
  organizationId: string;
  recommendationId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await verifyCaller(params.idToken);
    await AiRoleAdvisorService.dismissRecommendation(
      params.organizationId,
      params.recommendationId
    );
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to dismiss recommendation';
    return { success: false, error: msg };
  }
}
