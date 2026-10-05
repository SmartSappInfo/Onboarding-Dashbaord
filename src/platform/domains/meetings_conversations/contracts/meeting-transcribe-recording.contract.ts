/**
 * @fileOverview Capability Contract: meeting.transcribe_recording (Phase 11 M1 · T4, decision D1).
 *
 * Queues transcription of a recording the workspace uploaded. L1 internal (creates a transcript),
 * but `openWorld: true`: audio leaves SmartSapp to an allowed AI provider, so the capability is
 * OFF by default (`defaultEnabled: false`) and turned on per workspace/org in Backoffice (Rule 64).
 *
 * CHECKED HERE (fast, clear refusals) AND AGAIN IN THE WORKER (TOCTOU):
 *   recording in this meeting + uploaded file (never external links, Rule 34) + supported format +
 *   size ≤ inline limit + consent (recording & transcription) + data policy/audio egress (Rule 57)
 *   + daily audio quota (D11, Rule 23).
 *
 * IDEMPOTENCY (Rules 19/20): one transcript per (recording, recording version). Asking again while it
 * runs returns the same transcript; after a failure it can be retried; when complete it replays.
 * `dryRun` runs every check and writes nothing (Rule 42).
 *
 * Tests: src/lib/meetings/__tests__/transcription-service.test.ts
 */

import { z } from 'zod/v4';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import type { CapabilityDefinition } from '../../../capabilities/contracts/capability-definition';
import { CapabilityError } from '../../../capabilities/errors/capability-error';
import { assertMeetingInWorkspace, MeetingNotFoundError } from '@/lib/meetings/meeting-access';
import { MEETINGS_EDIT_PERMISSION } from './meeting-read.contracts';
import { requestRecordingTranscription, TranscriptionRequestError } from '@/lib/meetings/transcription-request';

const Id = z.string().trim().min(1).max(200).regex(/^[^/]+$/, 'Invalid id.');

export const MeetingTranscribeRecordingInputSchema = z.object({
  workspaceId: Id,
  meetingId: Id,
  recordingId: Id,
  dryRun: z.boolean().optional(),
});
export const MeetingTranscribeRecordingOutputSchema = z.object({
  transcriptId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'eligible']),
  replayed: z.boolean(),
  estimatedMinutes: z.number().int(),
});
export type MeetingTranscribeRecordingInput = z.infer<typeof MeetingTranscribeRecordingInputSchema>;
export type MeetingTranscribeRecordingOutput = z.infer<typeof MeetingTranscribeRecordingOutputSchema>;

export const meetingTranscribeRecordingCapability: CapabilityDefinition<MeetingTranscribeRecordingInput, MeetingTranscribeRecordingOutput> = {
  id: 'meeting.transcribe_recording',
  version: '1.0.0',
  name: 'Transcribe meeting recording',
  description: 'Queues transcription of an uploaded meeting recording (MP3, WAV, AAC, OGG, FLAC, AIFF). External links cannot be transcribed. Needs consent when the workspace requires it.',
  domain: 'meetings_conversations',
  operation: 'execute',
  inputSchema: MeetingTranscribeRecordingInputSchema,
  outputSchema: MeetingTranscribeRecordingOutputSchema,
  permissions: [MEETINGS_EDIT_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: true, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: false, maxDurationMs: 15_000, supportsDryRun: true, supportsCancellation: true, supportsCompensation: true, maxPayloadSizeBytes: 2 * 1024 },
  // Off by default; when a workspace enables it, agents/MCP still need explicit enablement (M1 review R6).
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: false, automatedRequiresExplicitFlag: true },
  governance: { dataClassification: 'restricted', emitsEvents: ['recording.processing_started'], breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/transcription-request.ts' },
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
    const { principal } = context;
    try {
      const result = await requestRecordingTranscription(adminDb, {
        storage: {
          size: async (path) => {
            const [exists] = await adminStorage.file(path).exists();
            if (!exists) return null;
            const [meta] = await adminStorage.file(path).getMetadata();
            return Number(meta.size ?? 0);
          },
        },
        nowMs: () => Date.now(),
      }, {
        workspaceId: principal.workspaceId,
        organizationId: principal.organizationId,
        meetingId: input.meetingId,
        recordingId: input.recordingId,
        dryRun: input.dryRun === true || context.dryRun === true,
        provenance: {
          createdBy: principal.userId,
          principalKind: principal.actorType === 'agent' ? 'agent' : 'user',
          ...(principal.agentId ? { agentId: principal.agentId } : {}),
          ...(principal.runId ? { runId: principal.runId } : {}),
        },
        correlationId: context.correlationId,
      });
      return {
        success: true,
        data: result,
        executionId: context.correlationId,
        emittedEvents: [],
        durationMs: Math.max(0, Date.now() - startMs),
      };
    } catch (err) {
      if (err instanceof TranscriptionRequestError) {
        throw new CapabilityError({
          code: err.code, message: err.message, stateChanged: 'no',
          httpStatus: err.code === 'FORBIDDEN' ? 403 : err.code === 'PROVIDER_ERROR' ? 503 : err.code === 'NOT_FOUND' ? 404 : 400,
          retryable: err.code === 'PROVIDER_ERROR',
        });
      }
      throw err;
    }
  },
};
