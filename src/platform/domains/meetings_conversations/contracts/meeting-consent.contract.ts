/**
 * @fileOverview Capability Contract: meeting.record_consent (Phase 11 M1 · T5, finding G9).
 *
 * Records or withdraws one of the four meeting consents (PRD §98). L2 and NON-DELEGABLE (Rule 17):
 * consent is a statement by people about people, so only a signed-in human may record it; agents,
 * MCP clients and automations are refused by the gateway before the handler runs.
 *
 * TOCTOU (Rule 18): the caller sends the consent `version` it saw; a stale version is refused.
 * History is append-only (consent-store.ts). Events carry ids and the consent type only.
 *
 * Tests: src/platform/__tests__/domains/meetings-consent.test.ts
 */

import { z } from 'zod/v4';
import { adminDb } from '@/lib/firebase-admin';
import type { CapabilityDefinition } from '../../../capabilities/contracts/capability-definition';
import { CapabilityError } from '../../../capabilities/errors/capability-error';
import { createDomainEvent } from '../../../capabilities/events/domain-event';
import { assertMeetingInWorkspace, MeetingNotFoundError } from '@/lib/meetings/meeting-access';
import { CONSENT_METHODS, CONSENT_TYPES, ConsentConflictError, recordConsent } from '@/lib/meetings/consent-store';
import { MEETINGS_EDIT_PERMISSION } from './meeting-read.contracts';

const Id = z.string().trim().min(1).max(200).regex(/^[^/]+$/, 'Invalid id.');

export const MeetingRecordConsentInputSchema = z.object({
  workspaceId: Id,
  meetingId: Id,
  type: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
  method: z.enum(CONSENT_METHODS),
  expectedVersion: z.number().int().min(0),
});
export const MeetingRecordConsentOutputSchema = z.object({
  version: z.number().int(),
  restrictedTranscripts: z.number().int(),
});
export type MeetingRecordConsentInput = z.infer<typeof MeetingRecordConsentInputSchema>;
export type MeetingRecordConsentOutput = z.infer<typeof MeetingRecordConsentOutputSchema>;

export const meetingRecordConsentCapability: CapabilityDefinition<MeetingRecordConsentInput, MeetingRecordConsentOutput> = {
  id: 'meeting.record_consent',
  version: '1.0.0',
  name: 'Record meeting consent',
  description: 'Records or withdraws recording, transcription, AI processing or marketing consent for a meeting. People only; agents cannot record consent.',
  domain: 'meetings_conversations',
  operation: 'update',
  inputSchema: MeetingRecordConsentInputSchema,
  outputSchema: MeetingRecordConsentOutputSchema,
  permissions: [MEETINGS_EDIT_PERMISSION],
  workspaceScoped: true,
  tenantScoped: true,
  risk: { level: 'L2_STATE_MUTATION', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: true },
  execution: { synchronous: true, maxDurationMs: 10_000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 2 * 1024 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: true },
  governance: { dataClassification: 'confidential', emitsEvents: ['meeting.consent.recorded'], breakingChangePolicy: 'additive_only', implementationRef: 'src/lib/meetings/consent-store.ts#recordConsent' },
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
    let result;
    try {
      result = await recordConsent(adminDb, {
        workspaceId: principal.workspaceId,
        meetingId: input.meetingId,
        type: input.type,
        granted: input.granted,
        method: input.method,
        actorUid: principal.userId,
        expectedVersion: input.expectedVersion,
        nowIso: new Date(startMs).toISOString(),
      });
    } catch (err) {
      if (err instanceof ConsentConflictError) {
        throw new CapabilityError({ code: 'VERSION_CONFLICT', message: err.message, stateChanged: 'no', httpStatus: 409, retryable: false });
      }
      throw err;
    }
    return {
      success: true,
      data: result,
      executionId: context.correlationId,
      emittedEvents: [createDomainEvent({
        type: 'meeting.consent.recorded',
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        actor: { type: 'user', id: principal.userId },
        entity: { type: 'meeting', id: input.meetingId },
        payload: { consentType: input.type, granted: input.granted, method: input.method, version: result.version, restrictedTranscripts: result.restrictedTranscripts },
        correlationId: context.correlationId,
        source: 'meeting.record_consent',
      })],
      durationMs: Math.max(0, Date.now() - startMs),
    };
  },
};
