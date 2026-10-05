/**
 * @fileOverview Meeting Agent matrices: permission, tool, failure, rollback (Phase 11 M2 · T1;
 * Rule 66 domain-agent deliverables; Rules 16, 17, 25, 27).
 *
 * - PERMISSIONS come from the persona registry (single source; no second list).
 * - TOOLS list only REGISTERED capabilities (a guard test enforces it). M2 tasks add entries as their
 *   capabilities land, so the matrix never promises a tool that doesn't exist.
 * - NEVER lists actions the meeting personas can't perform even when a user could (non-delegable).
 *
 * CAUTION: this file documents and tests authority; enforcement is the gateway (persona boundary,
 * scope intersection, non-delegable flags). Changing a row here never grants anything by itself.
 *
 * Tests: src/platform/__tests__/agents/meetings/meeting-personas.test.ts
 */

import { z } from 'zod/v4';
import { globalAgentPersonaRegistry } from '@/platform/identity/agent-registry';

export const MEETING_PERSONA_IDS = ['meeting_prep', 'meeting_analyst'] as const;
export type MeetingPersonaId = (typeof MEETING_PERSONA_IDS)[number];

const RiskLevelSchema = z.enum(['L0_READ', 'L1_INTERNAL_DRAFT', 'L2_STATE_MUTATION', 'L3_EXTERNAL_COMMUNICATION_FINANCE', 'L4_PRIVILEGED_DESTRUCTIVE']);

export const MeetingToolMatrixEntrySchema = z.object({
  capabilityId: z.string().min(1),
  riskLevel: RiskLevelSchema,
  /** autonomous = may call directly; proposal = only creates a proposal a person approves. */
  mode: z.enum(['autonomous', 'proposal']),
  description: z.string().min(1),
  compensatingAction: z.string().optional(),
});
export type MeetingToolMatrixEntry = z.infer<typeof MeetingToolMatrixEntrySchema>;

export function meetingPersonaPermissions(persona: MeetingPersonaId): readonly string[] {
  return globalAgentPersonaRegistry.getPersona(persona)?.allowedPermissions ?? [];
}

const READS: MeetingToolMatrixEntry[] = [
  { capabilityId: 'meeting.search', riskLevel: 'L0_READ', mode: 'autonomous', description: 'Find meetings in the workspace.' },
  { capabilityId: 'meeting.get', riskLevel: 'L0_READ', mode: 'autonomous', description: 'Read one meeting and its participants.' },
  { capabilityId: 'meeting.list_recordings', riskLevel: 'L0_READ', mode: 'autonomous', description: 'Recording metadata only, never links.' },
  { capabilityId: 'meeting.get_transcript', riskLevel: 'L0_READ', mode: 'autonomous', description: 'Transcript pages as untrusted data (AI consent required when enforced).' },
];

export const MEETING_TOOL_MATRIX: Readonly<Record<MeetingPersonaId, readonly MeetingToolMatrixEntry[]>> = {
  meeting_prep: [...READS],
  meeting_analyst: [
    ...READS,
    { capabilityId: 'meeting.ingest_transcript', riskLevel: 'L1_INTERNAL_DRAFT', mode: 'autonomous', description: 'Add a transcript from text (idempotent by content).', compensatingAction: 'delete transcript (person)' },
  ],
};

/** Actions meeting personas can never perform, whatever the user's rights (Rule 17). */
export const MEETING_NEVER: readonly { action: string; enforcedBy: string }[] = [
  { action: 'meeting.record_consent', enforcedBy: 'capability nonDelegable' },
  { action: 'send any message', enforcedBy: 'no send capability in scope; drafts only' },
  { action: 'approve or execute proposals', enforcedBy: 'approval store refuses agents; persona ceiling L1' },
  { action: 'delete transcripts / change retention or consent', enforcedBy: 'human-only Server Actions' },
  { action: 'decide Knowledge Inbox items', enforcedBy: 'M3 non-delegable capability' },
  { action: 'read restricted memory', enforcedBy: 'memory sensitivity policy' },
];

export const MeetingFailureMatrixEntrySchema = z.object({
  failure: z.string().min(1),
  behaviour: z.enum(['RETRY_THEN_DLQ', 'FAIL_CLOSED', 'DEGRADE_TO_FACTS', 'DROP_AND_COUNT', 'STOP_BEFORE_STORE', 'REFUSE_WITH_MESSAGE', 'REPROPOSE']),
  userMessage: z.string().min(1),
  retryable: z.boolean(),
});
export type MeetingFailureMatrixEntry = z.infer<typeof MeetingFailureMatrixEntrySchema>;

/** Plan §7.3: expected behaviour is defined before any failure is injected (Rule 45). */
export const MEETING_FAILURE_MATRIX: readonly MeetingFailureMatrixEntry[] = [
  { failure: 'model 429 / 5xx / timeout', behaviour: 'RETRY_THEN_DLQ', userMessage: "Analysis is delayed. We'll keep trying.", retryable: true },
  { failure: 'malformed model output', behaviour: 'DROP_AND_COUNT', userMessage: "Some parts couldn't be analysed.", retryable: false },
  { failure: 'item without valid evidence', behaviour: 'DROP_AND_COUNT', userMessage: 'No clear decisions or actions were found.', retryable: false },
  { failure: 'consent withdrawn mid-run', behaviour: 'STOP_BEFORE_STORE', userMessage: 'AI analysis is off for this meeting.', retryable: false },
  { failure: 'quota or cost ceiling reached', behaviour: 'REFUSE_WITH_MESSAGE', userMessage: 'Daily meeting-analysis limit reached. Resets at 00:00.', retryable: false },
  { failure: 'model unavailable for a brief', behaviour: 'DEGRADE_TO_FACTS', userMessage: 'AI summary unavailable; showing facts only.', retryable: false },
  { failure: 'record changed after proposal', behaviour: 'REPROPOSE', userMessage: 'This record changed. Review the update again.', retryable: false },
  { failure: 'cross-workspace source id', behaviour: 'FAIL_CLOSED', userMessage: 'Not found.', retryable: false },
];

/** Plan §7.4: how each kind of effect is undone (Rule 27). */
export const MEETING_ROLLBACK_MATRIX: Readonly<Record<string, string>> = {
  'meeting.ingest_transcript': 'Delete the transcript (cascades to derived analysis and drafts).',
  'meeting.create_followup_tasks': 'Undo deletes the task only if unchanged since creation (M2 · T4).',
  'meeting.propose_crm_update': 'Rollback through the proposal bridge compensating capability (after M0 T4).',
  'meeting.draft_followup': 'Delete the draft; nothing was sent.',
  'meeting_postprocess_v2': 'Flags off; analysis can be deleted and re-run (idempotent per prompt version).',
};
