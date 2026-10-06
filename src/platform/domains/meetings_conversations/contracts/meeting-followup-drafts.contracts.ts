/**
 * @fileOverview Capability contracts: meeting follow-up drafts (Phase 11 M2 · T4.2; plan §4.2, §4.7, §7.2).
 *
 * - `meeting.draft_followup` (L1, meetings edit): writes and STORES a follow-up email draft from the
 *   meeting's checked outcomes. Nothing is sent: there is no send path here (openWorld false); a
 *   person opens the draft in the messaging composer and sends it from there (D16). Recipients are
 *   restricted to participants and linked-record contacts; the egress scan blocks sensitive drafts;
 *   AI use / consent / data-policy stops apply to people and agents alike (the draft is model output).
 * - `meeting.delete_followup_draft` (L1, meetings edit): soft delete, kept for audit.
 *
 * Output is model-generated from customer speech and is labelled as untrusted data.
 * FLAGS (Rule 64): on for people; agents and MCP need an explicit flag until M2 · T8.
 *
 * Tests: src/platform/__tests__/domains/meetings-followup-drafts.test.ts
 */

import { z } from 'zod/v4';
import { adminDb } from '@/lib/firebase-admin';
import type { CapabilityDefinition, CapabilityExecutionContext } from '../../../capabilities/contracts/capability-definition';
import { CapabilityError } from '../../../capabilities/errors/capability-error';
import { assertMeetingInWorkspace, MeetingNotFoundError } from '@/lib/meetings/meeting-access';
import { IntelligencePolicyError, IntelligenceRequestError } from '@/lib/meetings/intelligence/pipeline';
import {
  FollowupDraftError,
  MAX_DRAFT_RECIPIENTS,
  deleteFollowupDraft,
  generateFollowupDraft,
  type FollowupDraftDeps,
} from '@/lib/meetings/intelligence/followup-drafts';
import { loadMeetingRecipients } from '@/lib/meetings/intelligence/followup-recipients';
import { createFollowupDraftModel } from '@/lib/meetings/intelligence/intelligence-model';
import { resolveContact } from '@/lib/contact-adapter';
import { globalEgressDataPolicyEngine } from '../../../mcp/security/egress-data-policy';
import { MEETINGS_EDIT_PERMISSION } from './meeting-read.contracts';

const Id = z.string().trim().min(1).max(300).regex(/^[^/]+$/, 'Invalid id.');

function productionDeps(): FollowupDraftDeps {
  return {
    model: createFollowupDraftModel(adminDb),
    loadAllowedRecipients: (params) => loadMeetingRecipients(adminDb, params, {
      resolveContacts: async (entityId, workspaceId) => (await resolveContact(entityId, workspaceId))?.entityContacts ?? [],
    }),
    egress: (payload, tenant) => globalEgressDataPolicyEngine.evaluateEgress(payload, 'external_email', tenant, { allowedSensitivityCeiling: 'confidential' }),
    nowMs: () => Date.now(),
  };
}

/** Test seam: replaces the model / recipient / egress dependencies. */
let depsOverride: (() => FollowupDraftDeps) | null = null;
export function setFollowupDraftDepsForTests(factory: (() => FollowupDraftDeps) | null): void {
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
  if (err instanceof IntelligencePolicyError) {
    return new CapabilityError({ code: 'FORBIDDEN', message: err.message, stateChanged: 'no', httpStatus: 403, retryable: false });
  }
  if (err instanceof IntelligenceRequestError) {
    if (err.code === 'NOT_FOUND') return new CapabilityError({ code: 'NOT_FOUND', message: err.message, stateChanged: 'no', httpStatus: 404, retryable: false });
    if (err.code === 'PROVIDER_ERROR') return new CapabilityError({ code: 'PROVIDER_ERROR', message: err.message, stateChanged: 'no', httpStatus: 503, retryable: true });
    return new CapabilityError({ code: 'FORBIDDEN', message: err.message, stateChanged: 'no', httpStatus: 403, retryable: false });
  }
  if (!(err instanceof FollowupDraftError)) return err;
  switch (err.code) {
    case 'NOT_FOUND':
      return new CapabilityError({ code: 'NOT_FOUND', message: err.message, stateChanged: 'no', httpStatus: 404, retryable: false });
    case 'VERSION_CONFLICT':
      return new CapabilityError({ code: 'VERSION_CONFLICT', message: err.message, stateChanged: 'no', httpStatus: 409, retryable: false });
    case 'RECIPIENT_NOT_ALLOWED':
    case 'EGRESS_BLOCKED':
      return new CapabilityError({ code: 'FORBIDDEN', message: err.message, stateChanged: 'no', httpStatus: 403, retryable: false, details: { reason: err.code.toLowerCase() } });
    case 'NOTHING_TO_DRAFT':
    case 'TOO_MANY':
      return new CapabilityError({ code: 'VALIDATION', message: err.message, stateChanged: 'no', httpStatus: 400, retryable: false, details: { reason: err.code.toLowerCase() } });
  }
}

const ok = <T>(data: T, context: CapabilityExecutionContext, startMs: number) =>
  ({ success: true as const, data, executionId: context.correlationId, emittedEvents: [], durationMs: Math.max(0, Date.now() - startMs) });

// ── meeting.draft_followup ────────────────────────────────────────────────────────

export const MeetingDraftFollowupInputSchema = z.object({
  workspaceId: Id,
  meetingId: Id,
  recipients: z.array(z.string().trim().email().max(320)).min(1).max(MAX_DRAFT_RECIPIENTS),
  /** The analysis version the caller reviewed; a re-analysis since then refuses the call. */
  expectedVersion: z.number().int().min(0).optional(),
});
export const MeetingDraftFollowupOutputSchema = z.object({
  trust: z.literal('model_generated_from_customer_content'),
  draftId: z.string(),
  replayed: z.boolean(),
  intelligenceVersion: z.number().int(),
  recipients: z.array(z.string()),
  subject: z.string(),
  body: z.string(),
  sentences: z.array(z.object({ text: z.string(), itemHashes: z.array(z.string()) })),
  droppedSentences: z.number().int(),
  promptVersion: z.string(),
});
export type MeetingDraftFollowupInput = z.infer<typeof MeetingDraftFollowupInputSchema>;
export type MeetingDraftFollowupOutput = z.infer<typeof MeetingDraftFollowupOutputSchema>;

export const meetingDraftFollowupCapability: CapabilityDefinition<MeetingDraftFollowupInput, MeetingDraftFollowupOutput> = {
  id: 'meeting.draft_followup',
  version: '1.0.0',
  name: 'Draft a meeting follow-up',
  description: 'Writes a follow-up email draft from the meeting\'s checked outcomes, for participants or contacts of the linked record only. The draft is saved, never sent: a person reviews and sends it from the composer.',
  domain: 'meetings_conversations',
  operation: 'create',
  inputSchema: MeetingDraftFollowupInputSchema,
  outputSchema: MeetingDraftFollowupOutputSchema,
  permissions: [MEETINGS_EDIT_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 75_000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: true, maxPayloadSizeBytes: 16 * 1024 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: true, automatedRequiresExplicitFlag: true },
  governance: { dataClassification: 'restricted', breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/intelligence/followup-drafts.ts#generateFollowupDraft' },
  resolveResourceScope: resolveMeetingScope,
  async handler(input, context) {
    const startMs = Date.now();
    const { principal } = context;
    try {
      const meeting = await assertMeetingInWorkspace(input.meetingId, principal.workspaceId, adminDb);
      const { draftId, replayed, draft } = await generateFollowupDraft(adminDb, depsOverride ? depsOverride() : productionDeps(), {
        workspaceId: principal.workspaceId,
        organizationId: principal.organizationId,
        meetingId: input.meetingId,
        ...(meeting.title ? { meetingTitle: meeting.title } : {}),
        actorUid: principal.userId,
        recipients: input.recipients,
        ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
      });
      return ok({
        trust: 'model_generated_from_customer_content' as const,
        draftId,
        replayed,
        intelligenceVersion: draft.intelligenceVersion,
        recipients: draft.recipients,
        subject: draft.subject,
        body: draft.body,
        sentences: draft.sentences,
        droppedSentences: draft.droppedSentences,
        promptVersion: draft.provider.promptVersion,
      }, context, startMs);
    } catch (err) {
      throw toCapabilityError(err);
    }
  },
};

// ── meeting.delete_followup_draft ─────────────────────────────────────────────────

export const MeetingDeleteFollowupDraftInputSchema = z.object({ workspaceId: Id, meetingId: Id, draftId: Id });
export const MeetingDeleteFollowupDraftOutputSchema = z.object({ deleted: z.boolean() });
export type MeetingDeleteFollowupDraftInput = z.infer<typeof MeetingDeleteFollowupDraftInputSchema>;
export type MeetingDeleteFollowupDraftOutput = z.infer<typeof MeetingDeleteFollowupDraftOutputSchema>;

export const meetingDeleteFollowupDraftCapability: CapabilityDefinition<MeetingDeleteFollowupDraftInput, MeetingDeleteFollowupDraftOutput> = {
  id: 'meeting.delete_followup_draft',
  version: '1.0.0',
  name: 'Delete a follow-up draft',
  description: 'Deletes a saved follow-up draft (kept in the audit history). Nothing was sent.',
  domain: 'meetings_conversations',
  operation: 'delete',
  inputSchema: MeetingDeleteFollowupDraftInputSchema,
  outputSchema: MeetingDeleteFollowupDraftOutputSchema,
  permissions: [MEETINGS_EDIT_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 10_000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 2 * 1024 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: true, automatedRequiresExplicitFlag: true },
  governance: { dataClassification: 'internal', breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/intelligence/followup-drafts.ts#deleteFollowupDraft' },
  resolveResourceScope: resolveMeetingScope,
  async handler(input, context) {
    const startMs = Date.now();
    try {
      const result = await deleteFollowupDraft(adminDb, { workspaceId: context.principal.workspaceId, draftId: input.draftId, actorUid: context.principal.userId, nowMs: Date.now() });
      return ok(result, context, startMs);
    } catch (err) {
      throw toCapabilityError(err);
    }
  },
};
