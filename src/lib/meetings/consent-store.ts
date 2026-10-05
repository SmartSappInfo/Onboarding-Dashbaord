import 'server-only';

/**
 * @fileOverview Per-meeting consent: append-only records + gate (Phase 11 M1 · T5, finding G9).
 *
 * MODEL (meetings PRD §98: four independently configurable consents)
 *   meeting_consents/{workspaceId}__{meetingId}              { workspaceId, meetingId, version, current, updatedAt }
 *   meeting_consents/{workspaceId}__{meetingId}/records/{id} append-only history, never updated or deleted (Rule 40)
 *
 * Keyed by workspace AND meeting (M1 review R4): meetings can be shared across workspaces, and each
 * workspace records its own consent. Keying by meeting alone blocked the second workspace forever.
 *
 * GATE (only when the workspace policy `enforceHostConsentForAI` is ON; when OFF the behaviour is
 * exactly as before M1, so turning this feature on is a deliberate workspace decision):
 *   ingest_transcript     → transcription
 *   transcribe_recording  → recording + transcription
 *   ai_read               → aiProcessing   (agents/MCP/AI features reading transcript content)
 * Humans viewing a transcript in the UI need workspace permission only (consent governs processing).
 *
 * WITHDRAWAL: withdrawing `transcription` or `aiProcessing` marks the meeting's transcripts
 * `aiUse: 'restricted'` (bounded, ≤ 50 per meeting) so agents can no longer read them, and deletes
 * the AI output already derived from them (intelligence, items, drafts; M1 review R7).
 *
 * CAUTION: recording consent is a NON-DELEGABLE human action (Rule 17); the capability enforces that.
 * This module assumes the caller already authorized the actor.
 *
 * Tests: src/lib/meetings/__tests__/consent-store.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { readCompliancePolicy } from './compliance-policy-store';
import { TRANSCRIPTS } from './transcript-store';
import { deleteDerivedMeetingData } from './retention-service';

export const CONSENT_TYPES = ['recording', 'transcription', 'aiProcessing', 'marketing'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
export const CONSENT_METHODS = ['verbal', 'written', 'form', 'policy'] as const;

export const ConsentStateSchema = z.object({
  granted: z.boolean(),
  method: z.enum(CONSENT_METHODS),
  recordedBy: z.string(),
  at: z.string(),
});
export type ConsentState = z.infer<typeof ConsentStateSchema>;

const ConsentDocSchema = z.object({
  workspaceId: z.string(),
  meetingId: z.string(),
  version: z.number().int().min(0),
  current: z.partialRecord(z.enum(CONSENT_TYPES), ConsentStateSchema).default({}),
  updatedAt: z.string(),
});
export type MeetingConsents = z.infer<typeof ConsentDocSchema>;

export type ConsentOperation = 'ingest_transcript' | 'transcribe_recording' | 'ai_read';

const REQUIRED: Readonly<Record<ConsentOperation, readonly ConsentType[]>> = {
  ingest_transcript: ['transcription'],
  transcribe_recording: ['recording', 'transcription'],
  ai_read: ['aiProcessing'],
};

const LABEL: Readonly<Record<ConsentType, string>> = {
  recording: 'recording',
  transcription: 'transcription',
  aiProcessing: 'AI processing',
  marketing: 'marketing',
};

export class ConsentRequiredError extends Error {
  readonly code = 'FORBIDDEN';
  constructor(readonly missing: readonly ConsentType[]) {
    super(`Record ${missing.map((m) => LABEL[m]).join(' and ')} consent for this meeting first.`);
    this.name = 'ConsentRequiredError';
  }
}

export class ConsentConflictError extends Error {
  readonly code = 'VERSION_CONFLICT';
  constructor() {
    super('Consent was changed by someone else. Reload and try again.');
    this.name = 'ConsentConflictError';
  }
}

export const consentDocId = (workspaceId: string, meetingId: string): string => `${workspaceId}__${meetingId}`;
const consentRef = (db: Firestore, workspaceId: string, meetingId: string) =>
  db.collection('meeting_consents').doc(consentDocId(workspaceId, meetingId));

export async function readMeetingConsents(db: Firestore, meetingId: string, workspaceId: string): Promise<MeetingConsents> {
  const snap = await consentRef(db, workspaceId, meetingId).get();
  const parsed = snap.exists ? ConsentDocSchema.safeParse(snap.data()) : null;
  // CAUTION: a consent doc from another workspace (shared meeting) is NOT this workspace's consent.
  if (!parsed?.success || parsed.data.workspaceId !== workspaceId) {
    return { workspaceId, meetingId, version: 0, current: {}, updatedAt: '' };
  }
  return parsed.data;
}

/** True when consent enforcement is on for the workspace. */
export async function isConsentEnforced(db: Firestore, workspaceId: string): Promise<boolean> {
  const policy = await readCompliancePolicy(db, workspaceId, new Date().toISOString());
  return policy.enforceHostConsentForAI === true;
}

/**
 * Throws `ConsentRequiredError` when enforcement is on and a required consent is missing or
 * withdrawn. Returns the consents that were checked (for audit evidence).
 */
export async function assertConsent(
  db: Firestore,
  params: { workspaceId: string; meetingId: string; operation: ConsentOperation }
): Promise<{ enforced: boolean; version: number }> {
  if (!(await isConsentEnforced(db, params.workspaceId))) return { enforced: false, version: 0 };
  const consents = await readMeetingConsents(db, params.meetingId, params.workspaceId);
  const missing = REQUIRED[params.operation].filter((type) => consents.current[type]?.granted !== true);
  if (missing.length > 0) throw new ConsentRequiredError(missing);
  return { enforced: true, version: consents.version };
}

export interface RecordConsentInput {
  workspaceId: string;
  meetingId: string;
  type: ConsentType;
  granted: boolean;
  method: (typeof CONSENT_METHODS)[number];
  actorUid: string;
  /** The `version` the user saw; refused when it moved on (Rule 18). */
  expectedVersion: number;
  nowIso: string;
}

/** Appends a consent record and updates the current state atomically. */
export async function recordConsent(db: Firestore, input: RecordConsentInput): Promise<{ version: number; restrictedTranscripts: number }> {
  const ref = consentRef(db, input.workspaceId, input.meetingId);
  const recordRef = ref.collection('records').doc();

  const version = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const parsed = snap.exists ? ConsentDocSchema.safeParse(snap.data()) : null;
    const existing = parsed?.success && parsed.data.workspaceId === input.workspaceId ? parsed.data : null;
    if (snap.exists && !existing) throw new ConsentConflictError();
    const currentVersion = existing?.version ?? 0;
    if (currentVersion !== input.expectedVersion) throw new ConsentConflictError();

    const state: ConsentState = { granted: input.granted, method: input.method, recordedBy: input.actorUid, at: input.nowIso };
    const next: MeetingConsents = {
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      version: currentVersion + 1,
      current: { ...(existing?.current ?? {}), [input.type]: state },
      updatedAt: input.nowIso,
    };
    tx.set(ref, next);
    tx.set(recordRef, { workspaceId: input.workspaceId, meetingId: input.meetingId, type: input.type, ...state, version: next.version });
    return next.version;
  });

  let restrictedTranscripts = 0;
  if (!input.granted && (input.type === 'transcription' || input.type === 'aiProcessing')) {
    restrictedTranscripts = await restrictTranscriptsForMeeting(db, input.workspaceId, input.meetingId, input.nowIso);
    // M1 review R7: AI output already produced for this meeting is removed with the consent.
    await deleteDerivedMeetingData(db, { workspaceId: input.workspaceId, meetingId: input.meetingId });
  }
  return { version, restrictedTranscripts };
}

/** Marks up to 50 of the meeting's transcripts `aiUse: 'restricted'`. Idempotent. */
export async function restrictTranscriptsForMeeting(db: Firestore, workspaceId: string, meetingId: string, nowIso: string): Promise<number> {
  const snap = await db.collection(TRANSCRIPTS).where('workspaceId', '==', workspaceId).where('meetingId', '==', meetingId).limit(50).get();
  const targets = snap.docs.filter((d) => d.data()?.aiUse !== 'restricted');
  if (targets.length === 0) return 0;
  const batch = db.batch();
  for (const d of targets) {
    const data = d.data() ?? {};
    const version = typeof data.version === 'number' ? data.version + 1 : 1;
    batch.update(d.ref, { aiUse: 'restricted', version, updatedAt: nowIso });
  }
  await batch.commit();
  return targets.length;
}
