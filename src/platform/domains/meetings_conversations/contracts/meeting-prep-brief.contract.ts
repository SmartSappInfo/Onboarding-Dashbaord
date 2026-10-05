/**
 * @fileOverview Capability Contract: meeting.generate_prep_brief (Phase 11 M2 · T2; plan §4.2, §4.5).
 *
 * A brief for an upcoming meeting where every item cites the workspace records it came from, or a
 * labelled facts-only brief when AI is unavailable or not allowed. L0: it changes no business
 * record (it only meters the per-user hourly quota).
 *
 * FLAGS (Rule 64, plan §4.2): on for people; agents and MCP need an explicit flag
 * (`automatedRequiresExplicitFlag`) until M2 · T8 verification.
 *
 * Tests: src/lib/meetings/__tests__/prep-brief-service.test.ts (service),
 *        src/platform/__tests__/domains/meetings-prep-brief.test.ts (contract through the gateway)
 */

import { z } from 'zod/v4';
import { adminDb } from '@/lib/firebase-admin';
import type { CapabilityDefinition } from '../../../capabilities/contracts/capability-definition';
import { CapabilityError } from '../../../capabilities/errors/capability-error';
import { assertMeetingInWorkspace, MeetingNotFoundError } from '@/lib/meetings/meeting-access';
import { generatePrepBrief, PrepBriefSchema, type PrepBrief, type PrepBriefDeps } from '@/lib/meetings/prep-brief-service';
import { createPrepBriefModel } from '@/lib/meetings/prep-brief-model';
import { getAccountContextAssembler } from '@/platform/agents/crm/context/account-context-assembler';
import { MEETINGS_VIEW_PERMISSION } from './meeting-read.contracts';

const Id = z.string().trim().min(1).max(200).regex(/^[^/]+$/, 'Invalid id.');

export const MeetingGeneratePrepBriefInputSchema = z.object({ workspaceId: Id, meetingId: Id });
export type MeetingGeneratePrepBriefInput = z.infer<typeof MeetingGeneratePrepBriefInputSchema>;
export const MeetingGeneratePrepBriefOutputSchema = PrepBriefSchema;
export type MeetingGeneratePrepBriefOutput = PrepBrief;

/** Test seam: the gateway test injects a fake model; production uses the real one. */
let depsOverride: ((db: typeof adminDb) => PrepBriefDeps) | null = null;
export function setPrepBriefDepsForTests(factory: ((db: typeof adminDb) => PrepBriefDeps) | null): void {
  depsOverride = factory;
}

function productionDeps(db: typeof adminDb): PrepBriefDeps {
  return {
    model: createPrepBriefModel(db),
    loadAccountContext: async ({ organizationId, workspaceId, entityId }) =>
      organizationId
        ? getAccountContextAssembler().assembleContext({ organizationId, workspaceId, entityId, includeMemory: false, includeFinancials: false })
        : null,
    nowMs: () => Date.now(),
  };
}

export const meetingGeneratePrepBriefCapability: CapabilityDefinition<MeetingGeneratePrepBriefInput, MeetingGeneratePrepBriefOutput> = {
  id: 'meeting.generate_prep_brief',
  version: '1.1.0', // 1.1.0: additive `factsOnlyReason: 'timeout'` (M2 review R3)
  name: 'Generate meeting prep brief',
  description:
    'Builds a brief for an upcoming meeting from this workspace\'s records (the meeting, linked record, open deals and tasks, earlier meetings). Every item cites its sources; when AI is unavailable the brief is facts only.',
  domain: 'meetings_conversations',
  operation: 'read',
  inputSchema: MeetingGeneratePrepBriefInputSchema,
  outputSchema: MeetingGeneratePrepBriefOutputSchema,
  permissions: [MEETINGS_VIEW_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L0_READ', destructive: false, idempotent: false, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 20_000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 2 * 1024 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: true, automatedRequiresExplicitFlag: true },
  governance: { dataClassification: 'confidential', breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/prep-brief-service.ts#generatePrepBrief' },
  async resolveResourceScope(input, context) {
    try {
      const scope = await assertMeetingInWorkspace(input.meetingId, context.principal.workspaceId, adminDb);
      return { organizationId: context.principal.organizationId, workspaceId: scope.workspaceId, resourceId: scope.meetingId, resourceVersion: scope.resourceVersion };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) return null;
      throw err;
    }
  },
  async handler(input, context) {
    const startMs = Date.now();
    const deps = (depsOverride ?? productionDeps)(adminDb);
    let brief: PrepBrief;
    try {
      brief = await generatePrepBrief(adminDb, deps, {
        workspaceId: context.principal.workspaceId,
        ...(context.principal.organizationId ? { organizationId: context.principal.organizationId } : {}),
        meetingId: input.meetingId,
        // Agents get their own hourly allowance per delegating user.
        actorId: context.principal.agentId ? `agent_${context.principal.agentId}_${context.principal.userId}` : context.principal.userId,
      });
    } catch (err) {
      if (err instanceof MeetingNotFoundError) {
        throw new CapabilityError({ code: 'NOT_FOUND', message: 'Meeting not found.', stateChanged: 'no', httpStatus: 404, retryable: false });
      }
      throw err;
    }
    return { success: true, data: brief, executionId: context.correlationId, emittedEvents: [], durationMs: Math.max(0, Date.now() - startMs) };
  },
};
