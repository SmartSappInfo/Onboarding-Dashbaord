/**
 * @fileOverview Capability Contract: meeting.ingest_transcript (Phase 11 M1 · T3, finding G6/B4).
 *
 * Adds a transcript to a meeting from text (pasted, or extracted from an uploaded VTT/SRT/TXT/DOCX
 * file by the upload action). L1: it creates internal data only, no external side effects.
 *
 * GOVERNANCE
 * - Permission `rbac:operations.meetings.edit`; ownership proven in step 07 (NOT_FOUND otherwise).
 * - Consent gate inside the pipeline (`transcription` when the workspace enforces consent).
 * - Idempotent by content: the same transcript text for the same meeting returns the same
 *   transcript (`replayed: true`) and emits no second event (Rules 19/20).
 * - Events carry ids and counts only, never transcript text (Rules 32/40).
 * - Transcript text is untrusted customer data; it is scanned and flagged, never interpreted (Rule 30).
 *
 * Tests: src/platform/__tests__/domains/meetings-ingest.test.ts
 */

import { z } from 'zod/v4';
import { adminDb } from '@/lib/firebase-admin';
import type { CapabilityDefinition } from '../../../capabilities/contracts/capability-definition';
import { CapabilityError } from '../../../capabilities/errors/capability-error';
import { createDomainEvent } from '../../../capabilities/events/domain-event';
import { assertMeetingInWorkspace, MeetingNotFoundError } from '@/lib/meetings/meeting-access';
import { ConsentRequiredError } from '@/lib/meetings/consent-store';
import {
  ingestTranscript,
  IngestionInProgressError,
  IngestionRejectedError,
  MAX_TRANSCRIPT_TEXT_BYTES,
} from '@/lib/meetings/transcript-ingestion';
import { MEETINGS_EDIT_PERMISSION } from './meeting-read.contracts';

const Id = z.string().trim().min(1).max(200).regex(/^[^/]+$/, 'Invalid id.');

export const MeetingIngestTranscriptInputSchema = z.object({
  workspaceId: Id,
  meetingId: Id,
  source: z.enum(['upload', 'paste']),
  text: z.string().min(1).max(MAX_TRANSCRIPT_TEXT_BYTES),
  fileName: z.string().trim().max(200).optional(),
});

export const MeetingIngestTranscriptOutputSchema = z.object({
  transcriptId: z.string(),
  replayed: z.boolean(),
  segmentCount: z.number().int(),
  speakerCount: z.number().int(),
  wordCount: z.number().int(),
  injectionFlagged: z.boolean(),
  timed: z.boolean(),
  warnings: z.array(z.string()).max(20),
});
export type MeetingIngestTranscriptInput = z.infer<typeof MeetingIngestTranscriptInputSchema>;
export type MeetingIngestTranscriptOutput = z.infer<typeof MeetingIngestTranscriptOutputSchema>;

/** Same Admin SDK instance as every other contract (static import, like task/crm contracts). */
async function db() {
  return adminDb;
}

function refusal(code: 'VALIDATION' | 'FORBIDDEN' | 'DUPLICATE_IN_PROGRESS', message: string, status: number): CapabilityError {
  return new CapabilityError({ code, message, stateChanged: 'no', httpStatus: status, retryable: code === 'DUPLICATE_IN_PROGRESS' });
}

export const meetingIngestTranscriptCapability: CapabilityDefinition<MeetingIngestTranscriptInput, MeetingIngestTranscriptOutput> = {
  id: 'meeting.ingest_transcript',
  version: '1.0.0',
  name: 'Add meeting transcript',
  description: 'Adds a transcript to a meeting from VTT, SRT or plain text. The same text twice returns the same transcript. Needs transcription consent when the workspace requires it.',
  domain: 'meetings_conversations',
  operation: 'create',
  inputSchema: MeetingIngestTranscriptInputSchema,
  outputSchema: MeetingIngestTranscriptOutputSchema,
  permissions: [MEETINGS_EDIT_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: {
    synchronous: true,
    maxDurationMs: 30_000,
    supportsDryRun: false,
    supportsCancellation: false,
    supportsCompensation: true,
    maxPayloadSizeBytes: MAX_TRANSCRIPT_TEXT_BYTES + 64 * 1024,
  },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: true },
  governance: {
    dataClassification: 'restricted',
    emitsEvents: ['transcript.completed'],
    breakingChangePolicy: 'additive_only',
    implementationRef: 'src/lib/meetings/transcript-ingestion.ts#ingestTranscript',
  },
  async resolveResourceScope(input, context) {
    try {
      const scope = await assertMeetingInWorkspace(input.meetingId, context.principal.workspaceId, await db());
      return { organizationId: context.principal.organizationId, workspaceId: scope.workspaceId, resourceId: scope.meetingId, resourceVersion: scope.resourceVersion };
    } catch (err) {
      if (err instanceof MeetingNotFoundError) return null;
      throw err;
    }
  },
  async handler(input, context) {
    const startMs = Date.now();
    const { principal } = context;
    let result;
    try {
      result = await ingestTranscript(await db(), {
        workspaceId: principal.workspaceId,
        organizationId: principal.organizationId,
        meetingId: input.meetingId,
        source: input.source,
        text: input.text,
        fileName: input.fileName,
        provenance: {
          createdBy: principal.userId,
          principalKind: principal.actorType === 'agent' ? 'agent' : 'user',
          ...(principal.agentId ? { agentId: principal.agentId } : {}),
          ...(principal.runId ? { runId: principal.runId } : {}),
        },
        nowIso: new Date(startMs).toISOString(),
      });
    } catch (err) {
      if (err instanceof IngestionRejectedError) throw refusal('VALIDATION', err.message, 400);
      if (err instanceof ConsentRequiredError) throw refusal('FORBIDDEN', err.message, 403);
      if (err instanceof IngestionInProgressError) throw refusal('DUPLICATE_IN_PROGRESS', err.message, 409);
      throw err;
    }

    const emittedEvents = result.replayed
      ? []
      : [createDomainEvent({
          type: 'transcript.completed',
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          actor: { type: principal.actorType === 'agent' ? 'agent' : 'user', id: principal.userId },
          entity: { type: 'meeting_transcript', id: result.transcriptId },
          payload: {
            meetingId: input.meetingId,
            source: input.source,
            segmentCount: result.segmentCount,
            wordCount: result.wordCount,
            injectionFlagged: result.injectionFlagged,
          },
          correlationId: context.correlationId,
          ...(context.causationId ? { causationId: context.causationId } : {}),
          source: 'meeting.ingest_transcript',
        })];

    return {
      success: true,
      data: result,
      executionId: context.correlationId,
      emittedEvents,
      durationMs: Math.max(0, Date.now() - startMs),
    };
  },
};
