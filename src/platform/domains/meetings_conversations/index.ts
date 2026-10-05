/**
 * @fileOverview Domain: meetings_conversations (Phase 11 M1 · T1).
 *
 * Registers the governed `meeting.*` capabilities. Later M1 tasks add transcript ingestion,
 * transcription, consent, deletion and retention capabilities here.
 *
 * CAUTION: registration is idempotent (`allowOverride`) because both the registrar list and
 * module import may run it.
 */

import { registerCapability } from '../../capabilities/registry/capability-registry';
import type { AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import {
  meetingGetCapability,
  meetingListRecordingsCapability,
  meetingSearchCapability,
} from './contracts/meeting-read.contracts';

export * from './contracts/meeting-read.contracts';

export const MEETINGS_CONVERSATIONS_CAPABILITIES: AnyCapabilityDefinition[] = [
  meetingSearchCapability as AnyCapabilityDefinition,
  meetingGetCapability as AnyCapabilityDefinition,
  meetingListRecordingsCapability as AnyCapabilityDefinition,
];

export function registerMeetingsConversationsCapabilities(): void {
  for (const capability of MEETINGS_CONVERSATIONS_CAPABILITIES) {
    registerCapability(capability, { allowOverride: true });
  }
}
