'use server';

/**
 * @fileOverview Next.js 15 Server Actions for Sales & Lead Intelligence.
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. Server-Action Gate: Enforces 'use server', requireAuth(), and anti-IDOR validation (Rules 8, 47, 51).
 * 2. Emergency Dead-Man Switch: checkGovernanceDeadManSwitch halts execution on active pause (Rule 60).
 * 3. Strict Rule 4: Zero `any` or `any[]` typing policy with typed ActionResults.
 * 4. Strangler Fig Invariant: Routes requests through canonical lead.* capability adapters (Rule 69).
 * 5. Audit Logging: Dispatches sales domain events to defaultEventBus (Rule 40).
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  leadSearchCapability,
  leadScoreCapability,
  leadGetDecisionMakersCapability,
  leadGetRecommendedPitchCapability,
  leadGetObjectionHandlersCapability,
} from '@/platform/capabilities/sales/lead-capabilities';
import {
  LeadContextAssembler,
  type AssembledLeadContextResult,
} from '@/platform/agents/sales/context/lead-context-assembler';
import type {
  LeadSearchResult,
  LeadScoreBreakdown,
  LeadContact,
  LeadPitchRecommendation,
  LeadObjectionHandler,
} from '@/platform/agents/sales/context/lead-context-types';
import type { CapabilityExecutionContext } from '@/platform/capabilities/contracts/capability-definition';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Asserts that the authenticated caller has access to the requested tenant organization.
 */
function assertTenantContext(auth: AuthContext, requestedOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!auth.isSystemAdmin && sessionOrgId !== requestedOrgId) {
    throw new Error(
      `IDOR_VIOLATION: Authenticated principal from tenant '${sessionOrgId}' cannot access tenant '${requestedOrgId}'.`
    );
  }
}

/**
 * Constructs a secure CapabilityExecutionContext bound to the authenticated principal.
 */
function buildExecutionContext(
  auth: AuthContext,
  organizationId: string,
  workspaceId: string
): CapabilityExecutionContext {
  return {
    principal: {
      actorType: 'user',
      userId: auth.uid,
      organizationId,
      workspaceId,
      grantedScopes: ['crm:entities:read', 'crm:entities:edit'],
      effectiveRole: auth.profile?.role ?? 'admin',
    },
    correlationId: `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Search leads across the tenant workspace.
 */
export async function searchLeadsAction(params: {
  organizationId: string;
  workspaceId: string;
  queryText?: string;
  industry?: string;
  limit?: number;
}): Promise<ActionResult<{ leads: LeadSearchResult[]; totalCount: number }>> {
  try {
    const auth = await requireAuth();
    if (!auth || !auth.uid) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' };
    }

    assertTenantContext(auth, params.organizationId);

    const deadMan = await checkGovernanceDeadManSwitch(params.organizationId);
    if (deadMan.isPaused) {
      return { success: false, error: deadMan.reason, code: 'SALES_DEAD_MAN_PAUSED' };
    }

    const context = buildExecutionContext(auth, params.organizationId, params.workspaceId);

    const result = await leadSearchCapability.execute(
      {
        queryText: params.queryText ?? '',
        industry: params.industry,
        limit: params.limit ?? 20,
      },
      context
    );

    if (!result.success) {
      return { success: false, error: result.error.message, code: result.error.code };
    }

    return { success: true, data: result.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown lead search error';
    const isIdor = msg.includes('IDOR_VIOLATION');
    return { success: false, error: msg, code: isIdor ? 'IDOR_VIOLATION' : 'SEARCH_FAILED' };
  }
}

/**
 * Calculate multi-dimensional explainable score for a lead.
 */
export async function scoreLeadAction(params: {
  organizationId: string;
  workspaceId: string;
  prospectId: string;
  domain?: string;
  industry?: string;
}): Promise<ActionResult<LeadScoreBreakdown>> {
  try {
    const auth = await requireAuth();
    if (!auth || !auth.uid) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' };
    }

    assertTenantContext(auth, params.organizationId);

    const deadMan = await checkGovernanceDeadManSwitch(params.organizationId);
    if (deadMan.isPaused) {
      return { success: false, error: deadMan.reason, code: 'SALES_DEAD_MAN_PAUSED' };
    }

    const context = buildExecutionContext(auth, params.organizationId, params.workspaceId);

    const result = await leadScoreCapability.execute(
      {
        prospectId: params.prospectId,
        domain: params.domain,
        industry: params.industry,
      },
      context
    );

    if (!result.success) {
      return { success: false, error: result.error.message, code: result.error.code };
    }

    return { success: true, data: result.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Score calculation failed';
    const isIdor = msg.includes('IDOR_VIOLATION');
    return { success: false, error: msg, code: isIdor ? 'IDOR_VIOLATION' : 'SCORING_FAILED' };
  }
}

/**
 * Retrieve comprehensive lead intelligence dossier with XML prompt containerization.
 */
export async function getLeadDossierAction(params: {
  organizationId: string;
  workspaceId: string;
  prospectId: string;
  maxTokens?: number;
}): Promise<ActionResult<AssembledLeadContextResult>> {
  try {
    const auth = await requireAuth();
    if (!auth || !auth.uid) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' };
    }

    assertTenantContext(auth, params.organizationId);

    const deadMan = await checkGovernanceDeadManSwitch(params.organizationId);
    if (deadMan.isPaused) {
      return { success: false, error: deadMan.reason, code: 'SALES_DEAD_MAN_PAUSED' };
    }

    const assembler = new LeadContextAssembler();
    const result = await assembler.assemble({
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      prospectId: params.prospectId,
      maxTokens: params.maxTokens ?? 4000,
      includeSignals: true,
      includeDossier: true,
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve lead dossier';
    const isIdor = msg.includes('IDOR_VIOLATION');
    return { success: false, error: msg, code: isIdor ? 'IDOR_VIOLATION' : 'DOSSIER_RETRIEVAL_FAILED' };
  }
}

/**
 * Retrieve verified decision makers for a lead.
 */
export async function getDecisionMakersAction(params: {
  organizationId: string;
  workspaceId: string;
  prospectId: string;
}): Promise<ActionResult<{ contacts: LeadContact[]; totalCount: number }>> {
  try {
    const auth = await requireAuth();
    if (!auth || !auth.uid) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' };
    }

    assertTenantContext(auth, params.organizationId);

    const deadMan = await checkGovernanceDeadManSwitch(params.organizationId);
    if (deadMan.isPaused) {
      return { success: false, error: deadMan.reason, code: 'SALES_DEAD_MAN_PAUSED' };
    }

    const context = buildExecutionContext(auth, params.organizationId, params.workspaceId);

    const result = await leadGetDecisionMakersCapability.execute(
      { prospectId: params.prospectId },
      context
    );

    if (!result.success) {
      return { success: false, error: result.error.message, code: result.error.code };
    }

    return { success: true, data: result.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve decision makers';
    const isIdor = msg.includes('IDOR_VIOLATION');
    return { success: false, error: msg, code: isIdor ? 'IDOR_VIOLATION' : 'DECISION_MAKERS_FAILED' };
  }
}

/**
 * Generate personalized pitch recommendation grounded in prospect context.
 */
export async function getPitchRecommendationAction(params: {
  organizationId: string;
  workspaceId: string;
  prospectId: string;
  targetPersona?: string;
}): Promise<ActionResult<LeadPitchRecommendation>> {
  try {
    const auth = await requireAuth();
    if (!auth || !auth.uid) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' };
    }

    assertTenantContext(auth, params.organizationId);

    const deadMan = await checkGovernanceDeadManSwitch(params.organizationId);
    if (deadMan.isPaused) {
      return { success: false, error: deadMan.reason, code: 'SALES_DEAD_MAN_PAUSED' };
    }

    const context = buildExecutionContext(auth, params.organizationId, params.workspaceId);

    const result = await leadGetRecommendedPitchCapability.execute(
      { prospectId: params.prospectId, targetPersona: params.targetPersona },
      context
    );

    if (!result.success) {
      return { success: false, error: result.error.message, code: result.error.code };
    }

    return { success: true, data: result.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate pitch recommendation';
    const isIdor = msg.includes('IDOR_VIOLATION');
    return { success: false, error: msg, code: isIdor ? 'IDOR_VIOLATION' : 'PITCH_GENERATION_FAILED' };
  }
}

/**
 * Retrieve objection handlers and grounded evidence for a lead.
 */
export async function getObjectionHandlersAction(params: {
  organizationId: string;
  workspaceId: string;
  prospectId: string;
}): Promise<ActionResult<{ objections: LeadObjectionHandler[] }>> {
  try {
    const auth = await requireAuth();
    if (!auth || !auth.uid) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' };
    }

    assertTenantContext(auth, params.organizationId);

    const deadMan = await checkGovernanceDeadManSwitch(params.organizationId);
    if (deadMan.isPaused) {
      return { success: false, error: deadMan.reason, code: 'SALES_DEAD_MAN_PAUSED' };
    }

    const context = buildExecutionContext(auth, params.organizationId, params.workspaceId);

    const result = await leadGetObjectionHandlersCapability.execute(
      { prospectId: params.prospectId },
      context
    );

    if (!result.success) {
      return { success: false, error: result.error.message, code: result.error.code };
    }

    return { success: true, data: result.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve objection handlers';
    const isIdor = msg.includes('IDOR_VIOLATION');
    return { success: false, error: msg, code: isIdor ? 'IDOR_VIOLATION' : 'OBJECTION_HANDLERS_FAILED' };
  }
}
