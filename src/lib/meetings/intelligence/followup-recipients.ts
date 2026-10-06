import 'server-only';

/**
 * @fileOverview Who may receive a meeting follow-up (Phase 11 M2 · T4.2; plan §4.7; Rule 32).
 *
 * The allow-list is the meeting's participants that have an email address plus the contacts of
 * the record the meeting is linked to (canonical `entityContacts`, resolved in THIS workspace).
 * Nobody else: a follow-up drafted from one customer's meeting can't be addressed to another.
 *
 * Tests: src/platform/__tests__/domains/meetings-followup-drafts.test.ts (through the capability)
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { MEETING_PARTICIPANTS_MAX } from '../meeting-read-service';

const ParticipantEmailSchema = z.object({ email: z.string().catch(''), name: z.string().catch('') });
const MeetingLinkSchema = z.object({ entityId: z.string().min(1).optional().catch(undefined) });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RecipientCandidate {
  email: string;
  name?: string;
  source: 'participant' | 'record_contact';
}

export async function loadMeetingRecipients(
  db: Firestore,
  params: { workspaceId: string; meetingId: string },
  deps: { resolveContacts: (entityId: string, workspaceId: string) => Promise<Array<{ email?: string | null; name?: string | null }>> }
): Promise<RecipientCandidate[]> {
  const [meetingSnap, participantsSnap] = await Promise.all([
    db.collection('meetings').doc(params.meetingId).get(),
    db.collection('participants').where('meetingId', '==', params.meetingId).limit(MEETING_PARTICIPANTS_MAX).get(),
  ]);
  const out = new Map<string, RecipientCandidate>();
  const add = (email: string | null | undefined, name: string | null | undefined, source: RecipientCandidate['source']) => {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!EMAIL.test(normalized) || out.has(normalized)) return;
    out.set(normalized, { email: normalized, ...(name ? { name } : {}), source });
  };

  for (const doc of participantsSnap.docs) {
    const p = ParticipantEmailSchema.safeParse(doc.data());
    if (p.success) add(p.data.email, p.data.name, 'participant');
  }
  const link = MeetingLinkSchema.safeParse(meetingSnap.data() ?? {});
  if (link.success && link.data.entityId) {
    for (const contact of await deps.resolveContacts(link.data.entityId, params.workspaceId)) add(contact.email, contact.name, 'record_contact');
  }
  return [...out.values()];
}
