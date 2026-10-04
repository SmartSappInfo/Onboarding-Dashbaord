'use server';

/**
 * @fileOverview Secure Server Actions: CRM In-Context Intelligence (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock),
 * Rule 40 (Domain Event Publishing), Rule 51 (Next.js 15 Server Actions Conventions),
 * Rule 60 (Emergency dead-man switch), and Rule 69 (Dual-Tier CRM Data Model Preservation).
 *
 * Provides operator action endpoints for:
 * 1. `getAccountAiOverviewAction`: 360° health score, status, momentum, and executive narrative.
 * 2. `getAccountKnowledgeAction`: Grounded institutional facts, meeting takeaways, and citations.
 * 3. `getAccountRecommendationsAction`: Next-Best-Action chips with Rule 41 explainability grids.
 * 4. `getDealIntelligenceAction`: Stage velocity, win probability, competitor analysis, and playbooks.
 * 5. `getMeetingBriefAction`: Pre-meeting briefing dossier with attendees, open commitments, and questions.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { getAccountContextAssembler } from '@/platform/agents/crm/context/account-context-assembler';
import { getCrmIntelligenceService } from '@/platform/agents/crm/intelligence/crm-intelligence-service';
import {
  GetAccountIntelligenceInputSchema,
  GetDealIntelligenceInputSchema,
  GetMeetingBriefInputSchema,
  type GetAccountIntelligenceInput,
  type GetDealIntelligenceInput,
  type GetMeetingBriefInput,
  type AccountAiOverview,
  type AccountKnowledge,
  type AccountRecommendations,
  type DealIntelligence,
  type MeetingBrief,
  CrmIntelligenceError,
} from '@/platform/agents/crm/intelligence/crm-intelligence-types';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

export interface CrmActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validates tenant boundaries and enforces Anti-IDOR security (Rule 8 & 47).
 */
function assertTenantAccess(auth: AuthContext, requestedWorkspaceId: string): string {
  const sessionOrgId = auth.organizationId || auth.user?.organizationId || auth.profile?.organizationId;
  if (!sessionOrgId) {
    throw new CrmIntelligenceError('Missing authenticated organization context.', 'IDOR_VIOLATION', 403);
  }

  const sessionWsId = auth.workspaceId || auth.user?.activeWorkspaceId || auth.profile?.activeWorkspaceId;
  if (!auth.isSystemAdmin && sessionWsId && sessionWsId !== requestedWorkspaceId) {
    throw new CrmIntelligenceError(
      `IDOR_VIOLATION: Authenticated principal in workspace '${sessionWsId}' cannot access requested workspace '${requestedWorkspaceId}'.`,
      'IDOR_VIOLATION',
      403
    );
  }

  return sessionOrgId;
}

/**
 * Sanitizes errors and returns standard CrmActionResult.
 */
function handleActionError<T>(err: unknown): CrmActionResult<T> {
  if (err instanceof CrmIntelligenceError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };
  }

  const message = err instanceof Error ? err.message : 'Internal CRM action failure';
  if (message.includes('authenticated') || message.includes('requireAuth')) {
    return {
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'User must be authenticated to perform this operation.',
      },
    };
  }

  if (message.includes('Emergency') || message.includes('paused') || message.includes('dead-man')) {
    return {
      success: false,
      error: {
        code: 'CRM_DEAD_MAN_PAUSED',
        message,
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'SYNTHESIS_FAILED',
      message,
    },
  };
}

/**
 * Retrieves the 360° Account AI Overview with health score, status, and executive narrative.
 */
export async function getAccountAiOverviewAction(
  rawInput: GetAccountIntelligenceInput
): Promise<CrmActionResult<AccountAiOverview>> {
  try {
    const input = GetAccountIntelligenceInputSchema.parse(rawInput);
    const auth = await requireAuth();
    const orgId = assertTenantAccess(auth, input.workspaceId);

    // Rule 60: Emergency Dead-Man Switch Evaluation
    await checkGovernanceDeadManSwitch(orgId);

    // Assemble 360° Account Context (Milestone 1)
    const context = await getAccountContextAssembler().assembleContext({
      organizationId: orgId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
    });

    // Synthesize AI Overview (Milestone 3)
    const overview = await getCrmIntelligenceService().synthesizeAccountAiOverview(context);

    // Rule 40: Emit Tamper-Evident Domain Event
    await defaultEventBus.publish(
      createDomainEvent({
        type: 'crm.intelligence.overview_viewed',
        organizationId: orgId,
        workspaceId: input.workspaceId,
        actor: {
          type: 'user',
          id: auth.user?.uid || 'system',
        },
        entity: {
          type: 'entity',
          id: input.entityId,
        },
        source: 'crm_agent_actions',
        payload: {
          healthScore: overview.healthScore,
          healthStatus: overview.healthStatus,
          activeMomentum: overview.activeMomentum,
        },
        correlationId: context.metadata.correlationId,
      })
    );

    return {
      success: true,
      data: overview,
    };
  } catch (err) {
    return handleActionError<AccountAiOverview>(err);
  }
}

/**
 * Retrieves grounded institutional facts, meeting takeaways, and XML-isolated citations.
 */
export async function getAccountKnowledgeAction(
  rawInput: GetAccountIntelligenceInput
): Promise<CrmActionResult<AccountKnowledge>> {
  try {
    const input = GetAccountIntelligenceInputSchema.parse(rawInput);
    const auth = await requireAuth();
    const orgId = assertTenantAccess(auth, input.workspaceId);

    await checkGovernanceDeadManSwitch(orgId);

    const context = await getAccountContextAssembler().assembleContext({
      organizationId: orgId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
    });

    const knowledge = await getCrmIntelligenceService().synthesizeAccountKnowledge(context);

    return {
      success: true,
      data: knowledge,
    };
  } catch (err) {
    return handleActionError<AccountKnowledge>(err);
  }
}

/**
 * Retrieves prioritized Next-Best-Action recommendations with Rule 41 explainability grids.
 */
export async function getAccountRecommendationsAction(
  rawInput: GetAccountIntelligenceInput
): Promise<CrmActionResult<AccountRecommendations>> {
  try {
    const input = GetAccountIntelligenceInputSchema.parse(rawInput);
    const auth = await requireAuth();
    const orgId = assertTenantAccess(auth, input.workspaceId);

    await checkGovernanceDeadManSwitch(orgId);

    const context = await getAccountContextAssembler().assembleContext({
      organizationId: orgId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
    });

    const recommendations = await getCrmIntelligenceService().synthesizeAccountRecommendations(context);

    return {
      success: true,
      data: recommendations,
    };
  } catch (err) {
    return handleActionError<AccountRecommendations>(err);
  }
}

/**
 * Retrieves deal stage velocity, win probability, competitor analysis, and playbooks.
 */
export async function getDealIntelligenceAction(
  rawInput: GetDealIntelligenceInput
): Promise<CrmActionResult<DealIntelligence>> {
  try {
    const input = GetDealIntelligenceInputSchema.parse(rawInput);
    const auth = await requireAuth();
    const orgId = assertTenantAccess(auth, input.workspaceId);

    await checkGovernanceDeadManSwitch(orgId);

    const context = await getAccountContextAssembler().assembleContext({
      organizationId: orgId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
    });

    const targetDeal = context.deals.find((d) => d.id === input.dealId);
    if (!targetDeal) {
      return {
        success: false,
        error: {
          code: 'DEAL_NOT_FOUND',
          message: `Deal '${input.dealId}' was not found in account context.`,
        },
      };
    }

    const dealIntel = await getCrmIntelligenceService().synthesizeDealIntelligence(targetDeal, context);

    await defaultEventBus.publish(
      createDomainEvent({
        type: 'crm.intelligence.deal_analyzed',
        organizationId: orgId,
        workspaceId: input.workspaceId,
        actor: {
          type: 'user',
          id: auth.user?.uid || 'system',
        },
        entity: {
          type: 'deal',
          id: input.dealId,
        },
        source: 'crm_agent_actions',
        payload: {
          dealId: input.dealId,
          winProbability: dealIntel.winProbability,
          healthScore: dealIntel.healthScore,
          stageVelocity: dealIntel.stageVelocity.velocityStatus,
        },
        correlationId: context.metadata.correlationId,
      })
    );

    return {
      success: true,
      data: dealIntel,
    };
  } catch (err) {
    return handleActionError<DealIntelligence>(err);
  }
}

/**
 * Retrieves pre-meeting briefing dossier with attendees, open commitments, and suggested questions.
 */
export async function getMeetingBriefAction(
  rawInput: GetMeetingBriefInput
): Promise<CrmActionResult<MeetingBrief>> {
  try {
    const input = GetMeetingBriefInputSchema.parse(rawInput);
    const auth = await requireAuth();
    const orgId = assertTenantAccess(auth, input.workspaceId);

    await checkGovernanceDeadManSwitch(orgId);

    const context = await getAccountContextAssembler().assembleContext({
      organizationId: orgId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
    });

    const targetMeeting = context.meetings.find((m) => m.id === input.meetingId);
    if (!targetMeeting) {
      return {
        success: false,
        error: {
          code: 'MEETING_NOT_FOUND',
          message: `Meeting '${input.meetingId}' was not found in account context.`,
        },
      };
    }

    const brief = await getCrmIntelligenceService().synthesizeMeetingBrief(targetMeeting, context);

    await defaultEventBus.publish(
      createDomainEvent({
        type: 'crm.intelligence.meeting_briefed',
        organizationId: orgId,
        workspaceId: input.workspaceId,
        actor: {
          type: 'user',
          id: auth.user?.uid || 'system',
        },
        entity: {
          type: 'meeting',
          id: input.meetingId,
        },
        source: 'crm_agent_actions',
        payload: {
          meetingId: input.meetingId,
          attendeesCount: brief.attendees.length,
          openCommitmentsCount: brief.openCommitments.length,
        },
        correlationId: context.metadata.correlationId,
      })
    );

    return {
      success: true,
      data: brief,
    };
  } catch (err) {
    return handleActionError<MeetingBrief>(err);
  }
}
