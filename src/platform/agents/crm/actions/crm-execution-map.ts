/**
 * @fileOverview Which CRM action types can really execute, and how (Phase 11 M0 · T4.2, F6/F7).
 *
 * Before: the CRM agent targeted capability ids that don't exist (`crm.deal.update_stage`, …) and
 * "execute" changed nothing. Now each executable action type maps to a REGISTERED capability with:
 * - `toInput`: the agent's payload → the capability's input (null when the payload can't be mapped:
 *   the proposal is then a recommendation only);
 * - `executingPersona`: the persona that acts, authorised for exactly this mutation; the executing
 *   principal is the live requester ∩ this persona (never more than either);
 * - `before`: how to read the current state (for the conflict check and rollback);
 * - `changed(before, current)`: true when the record moved since the proposal → VERSION_CONFLICT;
 * - `confirmed(input, after)`: the postcondition that proves the write landed;
 * - `inverse`: the compensating call from the captured before-state, or why there is none.
 *
 * Every other action type is a RECOMMENDATION (approvable as guidance, never executed). In
 * particular ASSIGN_OWNER payloads name no assignee and target a record, not a deal.
 *
 * Tests: src/platform/__tests__/agents/crm/crm-proposal-execution.test.ts
 */

import { z } from 'zod/v4';
import type { AgentPersonaId } from '@/platform/identity/agent-persona-types';
import { CrmActionTypeEnum, type CrmActionType } from './crm-action-types';

type Json = Record<string, unknown>;

export interface CrmReadSpec {
  capabilityId: string;
  input: (payload: Json) => Json;
  /** Extracts the fields that matter for conflict checks and rollback. */
  pick: (output: unknown) => Json | null;
}

export interface CrmExecutableAction {
  capabilityId: string;
  executingPersona: AgentPersonaId;
  toInput: (payload: Json, workspaceId: string) => Json | null;
  before: CrmReadSpec | null;
  changed: (before: Json, current: Json) => boolean;
  confirmed: (input: Json, after: Json | null, output: unknown) => boolean;
  inverse:
    | { kind: 'capability'; capabilityId: string; input: (before: Json, executedInput: Json) => Json }
    | { kind: 'none'; reason: string };
}

const DealStateSchema = z.object({ stageId: z.string() }).loose();
const TaskCreatedSchema = z.object({ taskId: z.string().min(1) }).loose();

const dealRead: CrmReadSpec = {
  capabilityId: 'deal.get',
  input: (p) => ({ workspaceId: p.workspaceId, dealId: p.dealId }),
  pick: (output) => {
    const parsed = DealStateSchema.safeParse(output);
    return parsed.success ? { stageId: parsed.data.stageId } : null;
  },
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const CRM_EXECUTION_MAP: Partial<Record<CrmActionType, CrmExecutableAction>> = {
  UPDATE_STAGE: {
    capabilityId: 'deal.advance_stage',
    executingPersona: 'deal_coach',
    toInput: (p, workspaceId) => {
      const dealId = str(p.dealId);
      const stageId = str(p.targetStage) ?? str(p.stageId);
      return dealId && stageId ? { workspaceId, dealId, stageId } : null;
    },
    before: dealRead,
    changed: (before, current) => before.stageId !== current.stageId,
    confirmed: (input, after) => after !== null && after.stageId === input.stageId,
    inverse: {
      kind: 'capability',
      capabilityId: 'deal.advance_stage',
      input: (before, executed) => ({ workspaceId: executed.workspaceId, dealId: executed.dealId, stageId: before.stageId, reason: 'Reverted an approved agent change' }),
    },
  },
  CREATE_TASK: {
    capabilityId: 'task.create',
    executingPersona: 'task_coordinator',
    toInput: (p, workspaceId) => {
      const title = str(p.title);
      if (!title) return null;
      const priority = z.enum(['low', 'medium', 'high', 'urgent']).safeParse(p.priority);
      return {
        workspaceId,
        title,
        ...(str(p.description) ? { description: str(p.description) } : {}),
        ...(str(p.dueDate) ? { dueDate: str(p.dueDate) } : {}),
        ...(priority.success ? { priority: priority.data } : {}),
        ...(str(p.entityId) ? { entityId: str(p.entityId) } : {}),
      };
    },
    before: null,
    changed: () => false,
    confirmed: (_input, _after, output) => TaskCreatedSchema.safeParse(output).success,
    // No governed task cancel/delete capability is registered yet (M2 · T4 adds one for meeting
    // follow-ups); until then a created task is removed by a person, never silently.
    inverse: { kind: 'none', reason: 'This task was created by an approved action. Remove it from Tasks if needed.' },
  },
};

export function executableFor(actionType: string): CrmExecutableAction | null {
  const parsed = CrmActionTypeEnum.safeParse(actionType);
  return parsed.success ? CRM_EXECUTION_MAP[parsed.data] ?? null : null;
}
