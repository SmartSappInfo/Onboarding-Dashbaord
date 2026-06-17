'use server';

/**
 * @fileOverview Server-side query layer over the `workspace_contacts` projection
 * (Phase 6.2). The SEND-TIME counterpart of the client `useContactSearch` hook:
 * the messaging pipeline never receives an enumerated recipient list from the
 * browser — it stores an `AudienceSegment` and re-resolves recipients here,
 * paginated, at send time. Same `contactSegmentToQuerySpec` plan as the client,
 * so the two never diverge.
 *
 * Replaces the unbounded full-scan bodies in `contact-adapter.ts` (those are
 * retired in Phase 6.7 once their callers move over).
 *
 * See docs/superpowers/specs/2026-06-16-entity-cache-scale-design.md §9.
 */

import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';
import {
  contactSegmentToQuerySpec,
  matchesInvitationFilter,
  pickPrimaryPerEntity,
  type AudienceSegment,
  type ContactChannel,
  type ContactDoc,
  type ContactQuerySpec,
  type InvitationFilterCore,
} from './contact-projection-domain';

const COLLECTION = 'workspace_contacts';
const PREFIX_HIGH = '';
const SEND_PAGE = 500;
/** Safety ceiling so a pathological segment can't spin forever. */
const RESOLVE_CAP = 200_000;

export interface RecipientRef {
  entityId: string;
  contactId: string;
  name: string;
  entityName: string;
  email: string | null;
  phone: string | null;
  /** The address for the segment's channel (email for `email`, phone otherwise). */
  value: string;
  channel: ContactChannel;
}

export interface SegmentCursor {
  value: string;
  id: string;
}

function applySpec(
  col: FirebaseFirestore.Query,
  spec: ContactQuerySpec,
): FirebaseFirestore.Query {
  let q = col;
  for (const e of spec.equalities) q = q.where(e.field, '==', e.value);
  if (spec.arrayContains) {
    q = q.where(spec.arrayContains.field, 'array-contains', spec.arrayContains.value);
  }
  if (spec.range) {
    q = q.where(spec.range.field, '>=', spec.range.prefix).where(spec.range.field, '<=', spec.range.prefix + PREFIX_HIGH);
  }
  return q;
}

function toRecipient(d: ContactDoc, channel: ContactChannel): RecipientRef {
  const value = channel === 'email' ? d.email ?? '' : d.phone ?? '';
  return {
    entityId: d.entityId,
    contactId: d.contactId,
    name: d.name,
    entityName: d.entityName,
    email: d.email ?? null,
    phone: d.phone ?? null,
    value,
    channel,
  };
}

/** Total recipients a segment matches — the number "Select All Match" selects. */
export async function countSegment(workspaceId: string, segment: AudienceSegment): Promise<number> {
  if (!workspaceId) return 0;
  const spec = contactSegmentToQuerySpec(workspaceId, segment);
  const q = applySpec(adminDb.collection(COLLECTION), spec);
  const snap = await q.count().get();
  return snap.data().count;
}

/**
 * One page of resolved recipients for a segment. Stable cursor (order field +
 * doc id) so pages don't skip/repeat across duplicate names.
 */
export async function pageSegmentRecipients(
  workspaceId: string,
  segment: AudienceSegment,
  cursor?: SegmentCursor,
  pageSize: number = SEND_PAGE,
): Promise<{ recipients: RecipientRef[]; nextCursor: SegmentCursor | null }> {
  if (!workspaceId) return { recipients: [], nextCursor: null };
  const spec = contactSegmentToQuerySpec(workspaceId, segment);

  let q = applySpec(adminDb.collection(COLLECTION), spec)
    .orderBy(spec.orderBy)
    .orderBy(FieldPath.documentId())
    .limit(pageSize);
  if (cursor) q = q.startAfter(cursor.value, cursor.id);

  const snap = await q.get();
  const recipients = snap.docs
    .map((d) => toRecipient(d.data() as ContactDoc, segment.channel))
    .filter((r) => r.value);

  const last = snap.docs[snap.docs.length - 1];
  const nextCursor =
    snap.size === pageSize && last
      ? { value: String((last.data() as Record<string, unknown>)[spec.orderBy] ?? ''), id: last.id }
      : null;

  return { recipients, nextCursor };
}

/**
 * Resolve ALL recipients of a segment (server-side, internally paginated). Used
 * by the send pipeline. Bounded by `RESOLVE_CAP`; callers that may exceed it
 * should consume `pageSegmentRecipients` in a stream instead.
 */
export async function resolveSegmentRecipients(
  workspaceId: string,
  segment: AudienceSegment,
  opts?: { cap?: number },
): Promise<{ recipients: RecipientRef[]; truncated: boolean }> {
  const cap = opts?.cap ?? RESOLVE_CAP;
  const all: RecipientRef[] = [];
  let cursor: SegmentCursor | undefined;
  do {
    const { recipients, nextCursor } = await pageSegmentRecipients(workspaceId, segment, cursor);
    all.push(...recipients);
    cursor = nextCursor ?? undefined;
  } while (cursor && all.length < cap);
  return { recipients: all, truncated: !!cursor };
}

// ── Meeting-invitation audience (richer filter than a plain segment) ──────────
// Multi-tag AND/OR + exclude + contactScope/roles + multi-channel + assignee
// can't be expressed in one indexed query, so we narrow by the indexable parts
// (workspaceId + status, plus the first tag when logic is AND) and post-filter
// the rest in memory, paginated server-side. Never streams to the browser.

export type InvitationRecipientFilter = InvitationFilterCore;

export interface InvitationRecipient {
  entityId: string;
  entityName: string;
  name: string;
  email: string;
  phone: string;
}

export async function resolveInvitationRecipients(
  workspaceId: string,
  filter: InvitationRecipientFilter,
  opts?: { cap?: number },
): Promise<{ recipients: InvitationRecipient[]; truncated: boolean }> {
  if (!workspaceId) return { recipients: [], truncated: false };
  const cap = opts?.cap ?? RESOLVE_CAP;

  let base = adminDb
    .collection(COLLECTION)
    .where('workspaceId', '==', workspaceId)
    .where('status', '==', 'active') as FirebaseFirestore.Query;
  // Safe to narrow by one required tag only under AND logic.
  if (filter.includeLogic === 'AND' && filter.includeTagIds.length > 0) {
    base = base.where('workspaceTags', 'array-contains', filter.includeTagIds[0]);
  }
  base = base.orderBy('nameLower').orderBy(FieldPath.documentId());

  const matches: ContactDoc[] = [];
  let cursor: { value: string; id: string } | null = null;
  let truncated = false;

  while (true) {
    let q = base.limit(SEND_PAGE);
    if (cursor) q = q.startAfter(cursor.value, cursor.id);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const d = doc.data() as ContactDoc;
      if (matchesInvitationFilter(d, filter)) matches.push(d);
    }

    const last = snap.docs[snap.docs.length - 1];
    cursor = { value: String((last.data() as Record<string, unknown>).nameLower ?? ''), id: last.id };
    if (snap.size < SEND_PAGE) break;
    if (matches.length >= cap) {
      truncated = true;
      break;
    }
  }

  // 'primary' scope = one contact per entity (the flagged primary, else the first seen).
  const chosen = filter.contactScope === 'primary' ? pickPrimaryPerEntity(matches) : matches;

  const recipients = chosen.map<InvitationRecipient>((d) => ({
    entityId: d.entityId,
    entityName: d.entityName,
    name: d.name,
    email: d.email ?? '',
    phone: d.phone ?? '',
  }));
  return { recipients, truncated };
}
