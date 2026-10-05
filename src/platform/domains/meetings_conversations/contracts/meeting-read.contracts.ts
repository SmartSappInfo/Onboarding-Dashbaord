/**
 * @fileOverview Capability Contracts: meeting.search, meeting.get, meeting.list_recordings
 * (Phase 11 M1 · T1, findings G11/G12).
 *
 * Read-only (L0) capabilities for agents, MCP clients and any other governed surface. They reuse the
 * same workspace-scoped read service as the human UI (`src/lib/meetings/meeting-read-service.ts`),
 * so there is ONE read implementation (Rule 7) and every surface gets identical tenant scoping.
 *
 * RULES
 * - Rule 12: risk is enforced by the gateway; the annotations derived from `risk` are hints only.
 * - Rule 16/47: workspace comes from the principal (step 06); ownership is proven in
 *   `resolveResourceScope` (step 07) so a foreign meeting is NOT_FOUND, never FORBIDDEN.
 * - Rule 32: `meeting.list_recordings` returns metadata only; signed or external media URLs never
 *   reach agents or MCP clients.
 * - Rule 4/31/48: inputs and outputs are Zod-validated; stored data is parsed in the read service.
 *
 * PERMISSIONS: `rbac:operations.meetings.view`. Legacy `meetings_manage` holders and MCP "meeting"
 * keys are mapped to it (session-principal-resolver / mcp-principal-resolver).
 *
 * Tests: src/platform/__tests__/domains/meetings-conversations.test.ts
 */

import { z } from 'zod/v4';
import { adminDb } from '@/lib/firebase-admin';
import type {
  CapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionResult,
} from '../../../capabilities/contracts/capability-definition';
import type { RiskMetadata } from '../../../capabilities/contracts/risk-levels';
import {
  AgentRecordingSchema,
  MEETING_SEARCH_MAX,
  MeetingDetailSchema,
  MeetingSummarySchema,
  getMeetingDetail,
  listRecordingsForAgent,
  searchMeetings,
} from '@/lib/meetings/meeting-read-service';
import { assertMeetingInWorkspace, MeetingNotFoundError } from '@/lib/meetings/meeting-access';

export const MEETINGS_VIEW_PERMISSION = 'rbac:operations.meetings.view';
export const MEETINGS_EDIT_PERMISSION = 'rbac:operations.meetings.edit';

const READ_RISK: RiskMetadata = {
  level: 'L0_READ',
  destructive: false,
  idempotent: true,
  openWorld: false,
  requiresHumanApproval: false,
  nonDelegable: false,
};

const READ_EXECUTION = {
  synchronous: true,
  maxDurationMs: 8_000,
  supportsDryRun: false,
  supportsCancellation: false,
  supportsCompensation: false,
  maxPayloadSizeBytes: 16 * 1024,
};

const READ_POLICIES = {
  requiresIdempotencyKey: false,
  requiresExpectedVersion: false,
  auditRequired: true,
  defaultEnabled: true,
};

const Id = z.string().trim().min(1).max(200).regex(/^[^/]+$/, 'Invalid id.');
const IsoDateTime = z.iso.datetime({ offset: true });

/** Same Admin SDK instance as every other contract (static import, like task/crm contracts). */
async function db() {
  return adminDb;
}

/** Shared step-07 resolver: the meeting must exist in the principal's workspace. */
async function resolveMeetingScope(input: { meetingId: string }, context: CapabilityExecutionContext) {
  try {
    const scope = await assertMeetingInWorkspace(input.meetingId, context.principal.workspaceId, await db());
    return {
      organizationId: context.principal.organizationId,
      workspaceId: scope.workspaceId,
      resourceId: scope.meetingId,
      resourceVersion: scope.resourceVersion,
    };
  } catch (err) {
    if (err instanceof MeetingNotFoundError) return null;
    throw err;
  }
}

function ok<T>(data: T, context: CapabilityExecutionContext, startMs: number): CapabilityExecutionResult<T> {
  return { success: true, data, executionId: context.correlationId, emittedEvents: [], durationMs: Math.max(0, Date.now() - startMs) };
}

// ── meeting.search ─────────────────────────────────────────────────────────────

export const MeetingSearchInputSchema = z.object({
  workspaceId: Id,
  query: z.string().trim().max(200).optional(),
  from: IsoDateTime.optional(),
  to: IsoDateTime.optional(),
  entityId: Id.optional(),
  limit: z.number().int().min(1).max(MEETING_SEARCH_MAX).optional(),
});
export const MeetingSearchOutputSchema = z.object({
  meetings: z.array(MeetingSummarySchema).max(MEETING_SEARCH_MAX),
  truncated: z.boolean(),
});
export type MeetingSearchInput = z.infer<typeof MeetingSearchInputSchema>;
export type MeetingSearchOutput = z.infer<typeof MeetingSearchOutputSchema>;

export const meetingSearchCapability: CapabilityDefinition<MeetingSearchInput, MeetingSearchOutput> = {
  id: 'meeting.search',
  version: '1.0.0',
  name: 'Search meetings',
  description: 'Lists meetings in the current workspace, newest first. Optional text, date range and record filters. Returns at most 50.',
  domain: 'meetings_conversations',
  operation: 'search',
  inputSchema: MeetingSearchInputSchema,
  outputSchema: MeetingSearchOutputSchema,
  permissions: [MEETINGS_VIEW_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: READ_RISK,
  execution: READ_EXECUTION,
  policies: READ_POLICIES,
  governance: { dataClassification: 'confidential', breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/meeting-read-service.ts#searchMeetings' },
  async handler(input, context) {
    const startMs = Date.now();
    const result = await searchMeetings(await db(), { ...input, workspaceId: context.principal.workspaceId });
    return ok(result, context, startMs);
  },
};

// ── meeting.get ────────────────────────────────────────────────────────────────

export const MeetingGetInputSchema = z.object({ workspaceId: Id, meetingId: Id });
export const MeetingGetOutputSchema = z.object({ meeting: MeetingDetailSchema });
export type MeetingGetInput = z.infer<typeof MeetingGetInputSchema>;
export type MeetingGetOutput = z.infer<typeof MeetingGetOutputSchema>;

export const meetingGetCapability: CapabilityDefinition<MeetingGetInput, MeetingGetOutput> = {
  id: 'meeting.get',
  version: '1.0.0',
  name: 'Get meeting',
  description: 'Fetches one meeting in the current workspace with its participants (name, email, role, RSVP, attendance).',
  domain: 'meetings_conversations',
  operation: 'read',
  inputSchema: MeetingGetInputSchema,
  outputSchema: MeetingGetOutputSchema,
  permissions: [MEETINGS_VIEW_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: READ_RISK,
  execution: READ_EXECUTION,
  policies: READ_POLICIES,
  governance: { dataClassification: 'confidential', breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/meeting-read-service.ts#getMeetingDetail' },
  resolveResourceScope: resolveMeetingScope,
  async handler(input, context) {
    const startMs = Date.now();
    const meeting = await getMeetingDetail(await db(), input.meetingId, context.principal.workspaceId);
    return ok({ meeting }, context, startMs);
  },
};

// ── meeting.list_recordings ────────────────────────────────────────────────────

export const MeetingListRecordingsInputSchema = z.object({ workspaceId: Id, meetingId: Id });
export const MeetingListRecordingsOutputSchema = z.object({ recordings: z.array(AgentRecordingSchema) });
export type MeetingListRecordingsInput = z.infer<typeof MeetingListRecordingsInputSchema>;
export type MeetingListRecordingsOutput = z.infer<typeof MeetingListRecordingsOutputSchema>;

export const meetingListRecordingsCapability: CapabilityDefinition<MeetingListRecordingsInput, MeetingListRecordingsOutput> = {
  id: 'meeting.list_recordings',
  version: '1.0.0',
  name: 'List meeting recordings',
  description: 'Lists recording metadata (kind, provider, duration, status) for one meeting. Never returns media links.',
  domain: 'meetings_conversations',
  operation: 'read',
  inputSchema: MeetingListRecordingsInputSchema,
  outputSchema: MeetingListRecordingsOutputSchema,
  permissions: [MEETINGS_VIEW_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: READ_RISK,
  execution: READ_EXECUTION,
  policies: READ_POLICIES,
  governance: { dataClassification: 'internal', breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/meeting-read-service.ts#listRecordingsForAgent' },
  resolveResourceScope: resolveMeetingScope,
  async handler(input, context) {
    const startMs = Date.now();
    const recordings = await listRecordingsForAgent(await db(), input.meetingId, context.principal.workspaceId);
    return ok({ recordings }, context, startMs);
  },
};
