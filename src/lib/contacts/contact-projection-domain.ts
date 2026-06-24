/**
 * @fileOverview Pure domain for the `workspace_contacts` projection (Phase 6, no I/O).
 *
 * Contacts live EMBEDDED as `entityContacts[]` on each `workspace_entity`, so a
 * contact-level query ("every contact with an email + tag X") is impossible
 * without scanning every entity. This module flattens a workspace_entity into
 * one row per contact — the shape the projection collection stores — so that
 * search / count() / segment paging become ordinary Firestore queries.
 *
 * Everything here is pure and deterministic (no Firestore, no Date.now) so it
 * can be unit-tested and reused by BOTH the write-path sync and the backfill.
 * The flatten logic was previously duplicated inside ManualContactSelector and
 * ComposerWizard — this is its single home.
 *
 * See docs/superpowers/specs/2026-06-16-entity-cache-scale-design.md §9.
 */

import type { WorkspaceEntity, EntityContact } from '@/lib/types';
import { toSearchKey } from '@/lib/entities/entity-cache-domain';
import { UNASSIGNED_ZONE } from '@/lib/zone-constants';

export type ContactChannel = 'email' | 'sms' | 'call';

/**
 * One projected contact row. Doc id is deterministic (see `contactDocId`).
 *
 * Channel reachability is stored as BOOLEAN flags (not an array) on purpose:
 * Firestore permits only one array field per composite index, and we reserve
 * that slot for `workspaceTags` (array-contains tag filtering). Booleans are
 * equality-filterable, so "email audience with tag X" stays indexable. Map a
 * segment channel to its flag with `reachField()`.
 */
export interface ContactDoc {
  id: string;
  workspaceId: string;
  entityId: string;
  contactId: string;
  name: string;
  /** Lowercased/trimmed name for case-insensitive prefix search. */
  nameLower: string;
  email: string | null;
  /** Lowercased email for case-insensitive prefix search. */
  emailLower: string | null;
  phone: string | null;
  /** Reachable by email (has a non-empty email). */
  hasEmail: boolean;
  /** Reachable by phone — serves both `sms` and `call` channels. */
  hasPhone: boolean;
  typeKey: string;
  typeLabel: string | null;
  isPrimary: boolean;
  isSignatory: boolean;
  /** Workspace-scoped tags, denormalized from the entity (sorted). */
  workspaceTags: string[];
  entityName: string;
  /** Always set — defaults to the "Unassigned" sentinel id when no zone. */
  zoneId: string;
  assignedUserId: string | null;
  status: 'active' | 'archived';
  entityType: string;
}

/** The boolean ContactDoc field a segment channel filters on. */
export function reachField(channel: ContactChannel): 'hasEmail' | 'hasPhone' {
  return channel === 'email' ? 'hasEmail' : 'hasPhone';
}

/** Display helper: channels a contact doc is reachable on (UI convenience). */
export function channelsOf(doc: Pick<ContactDoc, 'hasEmail' | 'hasPhone'>): ContactChannel[] {
  const out: ContactChannel[] = [];
  if (doc.hasEmail) out.push('email');
  if (doc.hasPhone) out.push('sms', 'call');
  return out;
}

/**
 * A saved audience filter — the representation of "Select All Match". We store
 * the FILTER, never an enumerated ID list, so the browser never holds 150k ids
 * and the send pipeline re-resolves recipients server-side, paginated.
 */
export interface AudienceSegment {
  channel: ContactChannel;
  search?: string;
  tags?: string[];
  types?: string[];
  zoneId?: string | null;
  assignedUserId?: string | null;
  status?: 'active' | 'archived';
}

/**
 * A query plan for the `workspace_contacts` collection, translated identically
 * by the client hook (web SDK) and the server send-pipeline (Admin SDK), so the
 * two never diverge. Field choices below are pinned to the deployed composite
 * indexes (see firestore.indexes.json).
 */
export interface ContactQuerySpec {
  /** Equality `where`s, in index order: workspaceId, hasEmail|hasPhone, status. */
  equalities: Array<{ field: string; value: unknown }>;
  /** Single-tag `array-contains` (the one array slot the indexes allow). */
  arrayContains?: { field: 'workspaceTags'; value: string };
  /** Prefix range on the order field (case-insensitive search). */
  range?: { field: string; prefix: string };
  /** Order/cursor field — `nameLower` or `emailLower`. */
  orderBy: 'nameLower' | 'emailLower';
}

/**
 * Build the query plan for an audience segment. Pure + deterministic so the
 * field/op/order decisions live in ONE tested place.
 *
 * Index-alignment rules:
 * - channel → equality on `hasEmail`/`hasPhone` (booleans, not an array, so the
 *   one array index slot is free for tags).
 * - search that looks like an email sorts/ranges on `emailLower`, else
 *   `nameLower`. A **tag filter forces name search**, because only the
 *   `…+workspaceTags+nameLower` index exists (no emailLower+tags index).
 * - only the FIRST tag is applied server-side (array-contains is single-value);
 *   any extra tags are an explicit future refinement.
 */
export function contactSegmentToQuerySpec(
  workspaceId: string,
  segment: AudienceSegment,
): ContactQuerySpec {
  const status = segment.status ?? 'active';
  const hasTag = !!segment.tags?.length;
  const searchRaw = (segment.search ?? '').trim();
  const searchIsEmail = searchRaw.includes('@');
  const orderBy: ContactQuerySpec['orderBy'] = searchIsEmail && !hasTag ? 'emailLower' : 'nameLower';

  const equalities: ContactQuerySpec['equalities'] = [
    { field: 'workspaceId', value: workspaceId },
    { field: reachField(segment.channel), value: true },
    { field: 'status', value: status },
  ];

  const spec: ContactQuerySpec = { equalities, orderBy };
  if (hasTag) spec.arrayContains = { field: 'workspaceTags', value: segment.tags![0] };
  if (searchRaw) spec.range = { field: orderBy, prefix: toSearchKey(searchRaw) };
  return spec;
}

const SEP = '__';

/** Deterministic, idempotent doc id — re-runs overwrite rather than duplicate. */
export function contactDocId(workspaceId: string, entityId: string, contactId: string): string {
  // Firestore doc ids may not contain '/'. Ids in this app are slug/uuid-like,
  // so a '/'→'_' guard is sufficient to keep the key path-safe.
  const safe = (s: string) => (s || '').replace(/\//g, '_');
  return [safe(workspaceId), safe(entityId), safe(contactId)].join(SEP);
}

/** Channels a contact is reachable on: email if present, sms+call if a phone exists. */
export function deriveChannels(email?: string | null, phone?: string | null): ContactChannel[] {
  const out: ContactChannel[] = [];
  if (email && email.trim()) out.push('email');
  if (phone && phone.trim()) out.push('sms', 'call');
  return out;
}

function zoneIdOf(we: WorkspaceEntity): string {
  return we.zone?.id ?? we.location?.zone?.id ?? UNASSIGNED_ZONE.id;
}

/**
 * Collapse rows that share a doc id (i.e. duplicate `entityContacts[].id` within
 * one entity) — keep the LAST, matching Firestore `batch.set` last-write-wins.
 * Without this, the projection would silently store only one of the colliding
 * contacts while flatten reported both, breaking the drift invariant.
 */
function dedupeByDocId(rows: ContactDoc[]): ContactDoc[] {
  const byId = new Map<string, ContactDoc>();
  for (const r of rows) byId.set(r.id, r);
  return [...byId.values()];
}

/**
 * Flatten one workspace_entity into its projected contact rows.
 *
 * Mirrors the legacy ManualContactSelector logic: each `entityContacts` member
 * with at least one reachable channel becomes a row; if there are NO contacts
 * but the entity has a denormalized primary email/phone, we synthesize a single
 * "primary-fallback" row so those entities remain messageable.
 *
 * Pure: produces no timestamp — the writer stamps `updatedAt` at commit.
 */
export function flattenEntityContacts(we: WorkspaceEntity): ContactDoc[] {
  const workspaceId = we.workspaceId;
  const entityId = we.entityId || we.id;
  const entityName = we.displayName || we.entityName || '';
  const workspaceTags = [...(we.workspaceTags || [])].sort();
  const zoneId = zoneIdOf(we);
  const assignedUserId = we.assignedTo?.userId ?? null;
  const status = we.status || 'active';
  const entityType = we.entityType;

  const base = (
    contactId: string,
    name: string,
    email: string | null,
    phone: string | null,
    typeKey: string,
    typeLabel: string | null,
    isPrimary: boolean,
    isSignatory: boolean,
  ): ContactDoc => ({
    id: contactDocId(workspaceId, entityId, contactId),
    workspaceId,
    entityId,
    contactId,
    name,
    nameLower: toSearchKey(name),
    email: email || null,
    emailLower: email ? toSearchKey(email) : null,
    phone: phone || null,
    hasEmail: !!(email && email.trim()),
    hasPhone: !!(phone && phone.trim()),
    typeKey,
    typeLabel: typeLabel || null,
    isPrimary,
    isSignatory,
    workspaceTags,
    entityName,
    zoneId,
    assignedUserId,
    status,
    entityType,
  });

  const sourceContacts: EntityContact[] = we.entityContacts || [];

  if (sourceContacts.length > 0) {
    const rows = sourceContacts
      .map((c) =>
        base(
          c.id,
          c.name || entityName,
          c.email ?? null,
          c.phone ?? null,
          c.typeKey || 'custom',
          c.typeLabel ?? null,
          !!c.isPrimary,
          !!c.isSignatory,
        ),
      )
      // Drop contacts with no reachable channel — they can't be messaged.
      .filter((d) => d.hasEmail || d.hasPhone);
    return dedupeByDocId(rows);
  }

  // Primary-fallback: no entityContacts, but a denormalized primary exists.
  const email = we.primaryEmail ?? null;
  const phone = we.primaryPhone ?? null;
  if (email || phone) {
    const fallback = base(
      `primary-fallback`,
      we.primaryContactName || we.displayName || '',
      email,
      phone,
      'primary',
      'Primary',
      true,
      false,
    );
    return fallback.hasEmail || fallback.hasPhone ? [fallback] : [];
  }

  return [];
}

/** Stable string form for change detection (id excluded — it's the key). */
function fingerprint(d: ContactDoc): string {
  const { id: _id, ...rest } = d;
  return JSON.stringify(rest);
}

/**
 * Diff the desired projection against what currently exists, so the writer only
 * touches changed rows and deletes contacts that were removed.
 */
export function diffContactDocs(
  prev: ContactDoc[],
  next: ContactDoc[],
): { upserts: ContactDoc[]; deleteIds: string[] } {
  const prevById = new Map(prev.map((d) => [d.id, d]));
  const nextById = new Map(next.map((d) => [d.id, d]));

  const upserts = next.filter((d) => {
    const before = prevById.get(d.id);
    return !before || fingerprint(before) !== fingerprint(d);
  });

  const deleteIds = prev.filter((d) => !nextById.has(d.id)).map((d) => d.id);

  return { upserts, deleteIds };
}

// ── Meeting-invitation audience predicate (pure) ─────────────────────────────
// Richer than a plain segment: multi-tag AND/OR + exclude + scope/roles +
// multi-channel + assignee. Kept pure so the (index-unfriendly) matching logic
// is unit-tested independently of Firestore; the server resolver just paginates
// the candidate set and applies these.

export interface InvitationFilterCore {
  channels: Array<'email' | 'sms'>;
  /** When set, only contacts whose entity is assigned to this user. */
  assignedUserId?: string | null;
  includeTagIds: string[];
  excludeTagIds: string[];
  includeLogic: 'AND' | 'OR';
  contactScope: 'primary' | 'signatories' | 'roles' | 'all';
  roles: string[];
}

type MatchableContact = Pick<
  ContactDoc,
  'hasEmail' | 'hasPhone' | 'assignedUserId' | 'workspaceTags' | 'isSignatory' | 'typeKey'
>;

/**
 * Per-contact predicate. Note: `primary` scope is NOT decided here — it requires
 * grouping by entity (see `pickPrimaryPerEntity`), so `primary` passes the
 * per-doc check and is narrowed afterwards.
 */
export function matchesInvitationFilter(d: MatchableContact, f: InvitationFilterCore): boolean {
  const wantEmail = f.channels.includes('email');
  const wantSms = f.channels.includes('sms');
  if (!((wantEmail && d.hasEmail) || (wantSms && d.hasPhone))) return false;

  if (f.assignedUserId && d.assignedUserId !== f.assignedUserId) return false;

  if (f.includeTagIds.length > 0) {
    const ok =
      f.includeLogic === 'AND'
        ? f.includeTagIds.every((t) => d.workspaceTags.includes(t))
        : f.includeTagIds.some((t) => d.workspaceTags.includes(t));
    if (!ok) return false;
  }
  if (f.excludeTagIds.length > 0 && f.excludeTagIds.some((t) => d.workspaceTags.includes(t))) return false;

  if (f.contactScope === 'signatories' && !d.isSignatory) return false;
  if (f.contactScope === 'roles' && !f.roles.includes(d.typeKey)) return false;
  return true;
}

/** One contact per entity for `primary` scope: the flagged primary, else the first seen. */
export function pickPrimaryPerEntity<T extends Pick<ContactDoc, 'entityId' | 'isPrimary'>>(docs: T[]): T[] {
  const byEntity = new Map<string, T>();
  for (const d of docs) {
    const cur = byEntity.get(d.entityId);
    if (!cur || (!cur.isPrimary && d.isPrimary)) byEntity.set(d.entityId, d);
  }
  return [...byEntity.values()];
}
