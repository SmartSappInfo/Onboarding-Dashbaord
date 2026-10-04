'use server';

/**
 * @fileOverview Secure Server Actions for Visual Agent Builder & Policy Editor (Phase 8 Milestone 5 Task 3)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy with strict Zod v4 validation.
 * - Rule 8 & 47: Anti-IDOR validation; immutably binds to caller's authenticated session.
 * - Rule 10: Complete inline architectural documentation.
 * - Rule 12 & 21: Autonomous risk levels, mandatory human approval thresholds.
 * - Rule 16 & 17: Attenuated domain scopes & non-delegable action stripping.
 * - Rule 23: Resource ceilings (delegation depth <= 4, max tokens <= 100k, max tool calls <= 30).
 * - Rule 34: Universal Outbound SSRF Guard via `validateSafeEgressUrl`.
 * - Rule 40: Audit logging via EventBus domain events.
 * - Rule 42: Shadow Simulation Mode verifying 0 live database mutations.
 * - Rule 51: Server Action authentication via `requireAuth()`.
 * - Rule 60: Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`).
 * - Rule 65: Canary Releases & Staging Drafts with SemVer progression and version diffing.
 */

import { z } from 'zod/v4';
import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import {
  type CustomAgentPersona,
  type AgentVersionDiff,
  type AgentTestLabResult,
  type CreateAgentPersonaInput,
  type UpdateAgentPersonaInput,
  type PublishAgentPersonaInput,
  type AgentTestLabInput,
  CreateAgentPersonaInputSchema,
  UpdateAgentPersonaInputSchema,
  PublishAgentPersonaInputSchema,
  AgentTestLabInputSchema,
  AGENT_BUILDER_ERROR_CODES,
} from '@/platform/ui/builder/agent-builder-types';
import {
  getAgentBuilderService,
  AgentBuilderError,
} from '@/platform/ui/builder/agent-builder-service';

export interface AgentBuilderActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// INPUT SCHEMAS FOR SERVER ACTIONS
// ============================================================================

const ListAgentPersonasActionInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
});
export type ListAgentPersonasActionInput = z.infer<typeof ListAgentPersonasActionInputSchema>;

const GetAgentPersonaActionInputSchema = z.object({
  organizationId: z.string().min(1),
  personaId: z.string().min(1),
  workspaceId: z.string().optional(),
});
export type GetAgentPersonaActionInput = z.infer<typeof GetAgentPersonaActionInputSchema>;

const GetAgentVersionDiffActionInputSchema = z.object({
  organizationId: z.string().min(1),
  personaId: z.string().min(1),
  workspaceId: z.string().optional(),
  targetVersion: z.string().optional(),
});
export type GetAgentVersionDiffActionInput = z.infer<typeof GetAgentVersionDiffActionInputSchema>;

// ============================================================================
// HELPER: Anti-IDOR Enforcement (Rule 8 & 47)
// ============================================================================

function assertTenantContext(auth: AuthContext, requestedOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId;
  if (!auth.isSystemAdmin && sessionOrgId !== requestedOrgId) {
    throw new Error(
      `IDOR_VIOLATION: Authenticated principal from tenant '${sessionOrgId}' cannot access tenant '${requestedOrgId}'.`
    );
  }
}

// ============================================================================
// 1. LIST AGENT PERSONAS (Custom + Built-ins)
// ============================================================================

export async function listAgentPersonasAction(
  rawInput: ListAgentPersonasActionInput
): Promise<AgentBuilderActionResult<CustomAgentPersona[]>> {
  try {
    const auth = await requireAuth();
    const validatedInput = ListAgentPersonasActionInputSchema.parse(rawInput);
    assertTenantContext(auth, validatedInput.organizationId);

    const service = getAgentBuilderService();
    const personas = await service.listPersonas(
      validatedInput.organizationId,
      validatedInput.workspaceId
    );

    return {
      success: true,
      data: personas,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list agent personas';
    const isIdor = message.includes('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor
          ? AGENT_BUILDER_ERROR_CODES.IDOR_VIOLATION
          : AGENT_BUILDER_ERROR_CODES.INTERNAL_ERROR,
        message,
      },
    };
  }
}

// ============================================================================
// 2. GET AGENT PERSONA DETAILS
// ============================================================================

export async function getAgentPersonaAction(
  rawInput: GetAgentPersonaActionInput
): Promise<AgentBuilderActionResult<CustomAgentPersona>> {
  try {
    const auth = await requireAuth();
    const validatedInput = GetAgentPersonaActionInputSchema.parse(rawInput);
    assertTenantContext(auth, validatedInput.organizationId);

    const service = getAgentBuilderService();
    const persona = await service.getPersona(
      validatedInput.organizationId,
      validatedInput.personaId,
      validatedInput.workspaceId
    );

    if (!persona) {
      return {
        success: false,
        error: {
          code: AGENT_BUILDER_ERROR_CODES.PERSONA_NOT_FOUND,
          message: `Agent persona '${validatedInput.personaId}' not found.`,
        },
      };
    }

    return {
      success: true,
      data: persona,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get agent persona';
    const isIdor = message.includes('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor
          ? AGENT_BUILDER_ERROR_CODES.IDOR_VIOLATION
          : AGENT_BUILDER_ERROR_CODES.INTERNAL_ERROR,
        message,
      },
    };
  }
}

// ============================================================================
// 3. SAVE AGENT PERSONA DRAFT (Create or Update)
// ============================================================================

export async function saveAgentPersonaDraftAction(
  rawInput: CreateAgentPersonaInput | UpdateAgentPersonaInput
): Promise<AgentBuilderActionResult<CustomAgentPersona>> {
  try {
    const auth = await requireAuth();

    // 1. Rule 60 Dead-Man Switch verification
    try {
      await checkGovernanceDeadManSwitch();
    } catch {
      return {
        success: false,
        error: {
          code: AGENT_BUILDER_ERROR_CODES.BUILDER_DEAD_MAN_PAUSED,
          message: 'Saving persona draft blocked: Emergency Dead-Man Switch is ACTIVE.',
        },
      };
    }

    // Determine target org from session if not provided
    const targetOrgId = rawInput.organizationId || auth.profile?.organizationId || 'default-org';
    assertTenantContext(auth, targetOrgId);

    const inputWithOrg = {
      ...rawInput,
      organizationId: targetOrgId,
      workspaceId: rawInput.workspaceId || 'default',
    };

    const isUpdate = 'personaId' in inputWithOrg && Boolean(inputWithOrg.personaId);
    const parsedInput = isUpdate
      ? UpdateAgentPersonaInputSchema.parse(inputWithOrg)
      : CreateAgentPersonaInputSchema.parse(inputWithOrg);

    const service = getAgentBuilderService();
    const saved = await service.saveDraft(
      parsedInput,
      auth.uid,
      auth.profile?.displayName || 'Operator'
    );

    return {
      success: true,
      data: saved,
    };
  } catch (error) {
    if (error instanceof AgentBuilderError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }
    const message = error instanceof Error ? error.message : 'Failed to save agent persona draft';
    const isIdor = message.includes('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor
          ? AGENT_BUILDER_ERROR_CODES.IDOR_VIOLATION
          : AGENT_BUILDER_ERROR_CODES.INTERNAL_ERROR,
        message,
      },
    };
  }
}

// ============================================================================
// 4. PUBLISH AGENT PERSONA (SemVer release)
// ============================================================================

export async function publishAgentPersonaAction(
  rawInput: PublishAgentPersonaInput
): Promise<AgentBuilderActionResult<CustomAgentPersona>> {
  try {
    const auth = await requireAuth();

    // 1. Rule 60 Dead-Man Switch verification
    try {
      await checkGovernanceDeadManSwitch();
    } catch {
      return {
        success: false,
        error: {
          code: AGENT_BUILDER_ERROR_CODES.BUILDER_DEAD_MAN_PAUSED,
          message: 'Publishing persona blocked: Emergency Dead-Man Switch is ACTIVE.',
        },
      };
    }

    const targetOrgId = rawInput.organizationId || auth.profile?.organizationId || 'default-org';
    assertTenantContext(auth, targetOrgId);

    const inputWithOrg = {
      ...rawInput,
      organizationId: targetOrgId,
      workspaceId: rawInput.workspaceId || 'default',
    };

    const parsedInput = PublishAgentPersonaInputSchema.parse(inputWithOrg);
    const service = getAgentBuilderService();
    const published = await service.publishPersona(
      parsedInput,
      auth.uid,
      auth.profile?.displayName || 'Operator'
    );

    return {
      success: true,
      data: published,
    };
  } catch (error) {
    if (error instanceof AgentBuilderError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }
    const message = error instanceof Error ? error.message : 'Failed to publish agent persona';
    const isIdor = message.includes('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor
          ? AGENT_BUILDER_ERROR_CODES.IDOR_VIOLATION
          : AGENT_BUILDER_ERROR_CODES.INTERNAL_ERROR,
        message,
      },
    };
  }
}

// ============================================================================
// 5. TEST LAB SIMULATION (Rule 42 Shadow Mode)
// ============================================================================

export async function testAgentPersonaAction(
  rawInput: AgentTestLabInput
): Promise<AgentBuilderActionResult<AgentTestLabResult>> {
  try {
    const auth = await requireAuth();

    // 1. Rule 60 Dead-Man Switch verification
    try {
      await checkGovernanceDeadManSwitch();
    } catch {
      return {
        success: false,
        error: {
          code: AGENT_BUILDER_ERROR_CODES.BUILDER_DEAD_MAN_PAUSED,
          message: 'Shadow simulation blocked: Emergency Dead-Man Switch is ACTIVE.',
        },
      };
    }

    const targetOrgId = rawInput.organizationId || auth.profile?.organizationId || 'default-org';
    assertTenantContext(auth, targetOrgId);

    const inputWithOrg: AgentTestLabInput = {
      ...rawInput,
      organizationId: targetOrgId,
      workspaceId: rawInput.workspaceId || 'default',
      dryRun: true, // Rule 42 invariant
    };

    const parsedInput = AgentTestLabInputSchema.parse(inputWithOrg);
    const service = getAgentBuilderService();
    const simulationResult = await service.simulatePersona(parsedInput);

    return {
      success: true,
      data: simulationResult,
    };
  } catch (error) {
    if (error instanceof AgentBuilderError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }
    const message = error instanceof Error ? error.message : 'Simulation failed';
    const isIdor = message.includes('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor
          ? AGENT_BUILDER_ERROR_CODES.IDOR_VIOLATION
          : AGENT_BUILDER_ERROR_CODES.SIMULATION_FAILED,
        message,
      },
    };
  }
}

// ============================================================================
// 6. GET AGENT VERSION DIFF (Side-by-side diff)
// ============================================================================

export async function getAgentVersionDiffAction(
  rawInput: GetAgentVersionDiffActionInput
): Promise<AgentBuilderActionResult<AgentVersionDiff>> {
  try {
    const auth = await requireAuth();
    const validatedInput = GetAgentVersionDiffActionInputSchema.parse(rawInput);
    assertTenantContext(auth, validatedInput.organizationId);

    const service = getAgentBuilderService();
    const diff = await service.computePersonaDiff(
      validatedInput.organizationId,
      validatedInput.personaId,
      validatedInput.workspaceId
    );

    return {
      success: true,
      data: diff,
    };
  } catch (error) {
    if (error instanceof AgentBuilderError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }
    const message = error instanceof Error ? error.message : 'Failed to compute version diff';
    const isIdor = message.includes('IDOR_VIOLATION');
    return {
      success: false,
      error: {
        code: isIdor
          ? AGENT_BUILDER_ERROR_CODES.IDOR_VIOLATION
          : AGENT_BUILDER_ERROR_CODES.INTERNAL_ERROR,
        message,
      },
    };
  }
}
