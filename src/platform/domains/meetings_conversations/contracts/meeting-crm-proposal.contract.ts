/**
 * @fileOverview Capability contract: meeting.propose_crm_update (Phase 11 M2 · T4.3; plan §4.2, §4.12, D17).
 *
 * Creates an approval request for ONE CRM change backed by ONE checked meeting outcome. It changes
 * no CRM record: approving and executing happen elsewhere (approval inbox → CRM proposal bridge),
 * and agents can never approve or execute (approval store + non-delegable decide permission).
 *
 * Risk L1 (plan deviation: the plan table said "L2 proposal"): the capability itself only writes an
 * approval request; the L2 change is gated by the approval. At L2 the Meeting Analyst (ceiling L1)
 * could not propose at all, which the plan requires.
 *
 * The proposer needs meetings edit here, and read access to the target (the bridge reads the
 * record's current state as the proposer). FLAGS (Rule 64): agents need an explicit flag until T8.
 *
 * Tests: src/platform/__tests__/domains/meetings-crm-proposal.test.ts
 */

import { z } from 'zod/v4';
import { adminDb } from '@/lib/firebase-admin';
import type { CapabilityDefinition, CapabilityExecutionContext } from '../../../capabilities/contracts/capability-definition';
import { CapabilityError } from '../../../capabilities/errors/capability-error';
import { assertMeetingInWorkspace, MeetingNotFoundError } from '@/lib/meetings/meeting-access';
import {
  MeetingCrmProposalError,
  MeetingCrmTargetSchema,
  proposeMeetingCrmUpdate,
  type MeetingCrmProposalDeps,
} from '@/lib/meetings/intelligence/crm-proposals';
import { getCrmProposalBridge } from '../../../agents/crm/actions/crm-proposal-bridge';
import { CrmActionError } from '../../../agents/crm/actions/crm-action-types';
import { getApproval } from '../../../policy/unified-approval-store';
import { MEETINGS_EDIT_PERMISSION } from './meeting-read.contracts';

const Id = z.string().trim().min(1).max(200).regex(/^[^/]+$/, 'Invalid id.');

function productionDeps(): MeetingCrmProposalDeps {
  return {
    nowMs: () => Date.now(),
    propose: (input) => getCrmProposalBridge().proposeAction(input),
    approvalState: async (approvalId, organizationId) => {
      const stored = await getApproval(adminDb, approvalId, organizationId);
      return stored?.kind === 'v2' ? { status: stored.record.status, executable: stored.record.executable } : null;
    },
  };
}

/** Test seam: replaces the bridge / approval reads. */
let depsOverride: (() => MeetingCrmProposalDeps) | null = null;
export function setMeetingCrmProposalDepsForTests(factory: (() => MeetingCrmProposalDeps) | null): void {
  depsOverride = factory;
}

async function resolveMeetingScope(input: { meetingId: string }, context: CapabilityExecutionContext) {
  try {
    const scope = await assertMeetingInWorkspace(input.meetingId, context.principal.workspaceId, adminDb);
    return { organizationId: context.principal.organizationId, workspaceId: scope.workspaceId, resourceId: scope.meetingId, resourceVersion: scope.resourceVersion };
  } catch (err) {
    if (err instanceof MeetingNotFoundError) return null;
    throw err;
  }
}

function toCapabilityError(err: unknown): unknown {
  if (err instanceof MeetingNotFoundError) {
    return new CapabilityError({ code: 'NOT_FOUND', message: 'Meeting not found.', stateChanged: 'no', httpStatus: 404, retryable: false });
  }
  if (err instanceof MeetingCrmProposalError) {
    switch (err.code) {
      case 'NOT_FOUND':
        return new CapabilityError({ code: 'NOT_FOUND', message: err.message, stateChanged: 'no', httpStatus: 404, retryable: false });
      case 'VERSION_CONFLICT':
        return new CapabilityError({ code: 'VERSION_CONFLICT', message: err.message, stateChanged: 'no', httpStatus: 409, retryable: false });
      case 'ITEM_NEEDS_REVIEW':
        return new CapabilityError({ code: 'VALIDATION', message: err.message, stateChanged: 'no', httpStatus: 400, retryable: false, details: { reason: 'item_needs_review' } });
      case 'IN_PROGRESS':
        return new CapabilityError({ code: 'DUPLICATE_IN_PROGRESS', message: err.message, stateChanged: 'no', httpStatus: 409, retryable: true });
    }
  }
  if (err instanceof CrmActionError) {
    if (err.code === 'TARGET_NOT_FOUND' || err.code === 'IDOR_VIOLATION') {
      return new CapabilityError({ code: 'NOT_FOUND', message: 'The record this change is for was not found.', stateChanged: 'no', httpStatus: 404, retryable: false });
    }
    if (err.code === 'CRM_DEAD_MAN_PAUSED') {
      return new CapabilityError({ code: 'FORBIDDEN', message: err.message.replace(/^\[[A-Z_]+\] /, ''), stateChanged: 'no', httpStatus: 403, retryable: false });
    }
  }
  return err;
}

export const MeetingProposeCrmUpdateInputSchema = z.object({
  workspaceId: Id,
  meetingId: Id,
  /** The checked meeting outcome this change is based on. */
  itemHash: Id,
  target: MeetingCrmTargetSchema,
  /** The analysis version the caller reviewed; a re-analysis since then refuses the call. */
  expectedVersion: z.number().int().min(0).optional(),
});
export const MeetingProposeCrmUpdateOutputSchema = z.object({
  proposalId: z.string(),
  replayed: z.boolean(),
  /** False = a recommendation: approvable as guidance, never applied automatically. */
  executable: z.boolean(),
});
export type MeetingProposeCrmUpdateInput = z.infer<typeof MeetingProposeCrmUpdateInputSchema>;
export type MeetingProposeCrmUpdateOutput = z.infer<typeof MeetingProposeCrmUpdateOutputSchema>;

export const meetingProposeCrmUpdateCapability: CapabilityDefinition<MeetingProposeCrmUpdateInput, MeetingProposeCrmUpdateOutput> = {
  id: 'meeting.propose_crm_update',
  version: '1.0.0',
  name: 'Propose a CRM update from a meeting',
  description: 'Asks for approval to change one CRM field (deal stage, tags or a note) based on one checked meeting outcome. Nothing changes until someone else approves it. Never amounts or owners.',
  domain: 'meetings_conversations',
  operation: 'create',
  inputSchema: MeetingProposeCrmUpdateInputSchema,
  outputSchema: MeetingProposeCrmUpdateOutputSchema,
  permissions: [MEETINGS_EDIT_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 15_000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 8 * 1024 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: true, automatedRequiresExplicitFlag: true },
  governance: { dataClassification: 'internal', breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/intelligence/crm-proposals.ts#proposeMeetingCrmUpdate' },
  resolveResourceScope: resolveMeetingScope,
  async handler(input, context) {
    const startMs = Date.now();
    const { principal } = context;
    try {
      const meeting = await assertMeetingInWorkspace(input.meetingId, principal.workspaceId, adminDb);
      const result = await proposeMeetingCrmUpdate(adminDb, depsOverride ? depsOverride() : productionDeps(), {
        workspaceId: principal.workspaceId,
        organizationId: principal.organizationId,
        meetingId: input.meetingId,
        ...(meeting.title ? { meetingTitle: meeting.title } : {}),
        itemHash: input.itemHash,
        target: input.target,
        // The proposer of record is the person (an agent proposes for its user); they can never approve it.
        actorUid: principal.userId,
        ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
      });
      return { success: true as const, data: result, executionId: context.correlationId, emittedEvents: [], durationMs: Math.max(0, Date.now() - startMs) };
    } catch (err) {
      throw toCapabilityError(err);
    }
  },
};
