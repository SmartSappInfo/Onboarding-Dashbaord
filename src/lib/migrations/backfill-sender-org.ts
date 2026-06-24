import { adminDb } from '../firebase-admin';
import type { SenderProfile } from '../types';
import type { Channel } from '../messaging/sender-resolution';

/**
 * Migration: backfill `organizationId` onto every `sender_profiles` document and
 * seed each organization's `defaultSenderProfileIds` per channel.
 *
 * Why this exists:
 * Sender profiles historically carried only `workspaceIds` and a channel-wide
 * `isDefault` boolean. The org-isolation work requires a hard tenant owner on
 * every profile, plus an explicit org-level default pointer (the only permitted
 * fallback). This migration derives both from existing data.
 *
 * Safety:
 * - **Dry-run by default.** Pass `mode: 'apply'` to write.
 * - **Never guesses.** Profiles whose workspaces resolve to >1 org (`ambiguous`)
 *   or to no org (`orphan`) are reported, not assigned.
 * - **Idempotent.** Skips profiles that already have `organizationId`; re-running
 *   only fills gaps.
 */

// ── Pure helpers (no I/O — unit-tested) ──────────────────────────────────────

export type WorkspaceOrgMap = Record<string, string>;

export type ProfileOrgResult =
  | { status: 'ok'; organizationId: string }
  | { status: 'ambiguous'; organizationIds: string[] }
  | { status: 'orphan'; organizationIds: [] };

/**
 * Determine which organization a sender profile belongs to from its workspaces.
 * Exactly one distinct org → `ok`; more than one → `ambiguous`; none → `orphan`.
 */
export function resolveProfileOrg(workspaceIds: string[], map: WorkspaceOrgMap): ProfileOrgResult {
  const orgs = Array.from(
    new Set(workspaceIds.map((w) => map[w]).filter((x): x is string => typeof x === 'string' && x.length > 0)),
  );
  if (orgs.length === 1) return { status: 'ok', organizationId: orgs[0] };
  if (orgs.length === 0) return { status: 'orphan', organizationIds: [] };
  return { status: 'ambiguous', organizationIds: orgs };
}

/** Minimal shape for choosing an org's default seed within a single channel. */
export interface SeedCandidate {
  id: string;
  isActive: boolean;
  isDefault: boolean;
}

/**
 * Choose the org-default seed for one channel from that org's profiles:
 * the active profile flagged `isDefault`, or the sole active profile. Returns
 * null when the choice is ambiguous (multiple active, none flagged) so the
 * migration does not guess.
 */
export function pickOrgDefaultSeed(candidates: SeedCandidate[]): string | null {
  const active = candidates.filter((c) => c.isActive);
  const flagged = active.find((c) => c.isDefault);
  if (flagged) return flagged.id;
  if (active.length === 1) return active[0].id;
  return null;
}

// ── Imperative shell (I/O) ───────────────────────────────────────────────────

export type BackfillMode = 'dry-run' | 'apply';

export interface AmbiguousProfileReport {
  profileId: string;
  workspaceIds: string[];
  organizationIds: string[];
}

export interface OrphanProfileReport {
  profileId: string;
  workspaceIds: string[];
}

export interface BackfillReport {
  mode: BackfillMode;
  scanned: number;
  /** Profiles that already had an organizationId (skipped). */
  alreadyTagged: number;
  /** Profiles assigned an organizationId (or that would be, in dry-run). */
  assigned: number;
  ambiguous: AmbiguousProfileReport[];
  orphan: OrphanProfileReport[];
  /** Per-org per-channel default seed pointers written (or planned). */
  orgDefaultsSeeded: Array<{ organizationId: string; channel: Channel; senderProfileId: string }>;
  /** Orgs with profiles for a channel but no resolvable default (need manual setup — R3). */
  orgsMissingDefault: Array<{ organizationId: string; channel: Channel; reason: 'none' | 'ambiguous' }>;
}

const CHANNELS: Channel[] = ['email', 'sms', 'whatsapp'];

/** Map a Firestore sender-profile snapshot to the typed fields this migration needs. */
function toProfile(id: string, data: FirebaseFirestore.DocumentData): SenderProfile {
  return {
    id,
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : '',
    name: typeof data.name === 'string' ? data.name : '',
    channel: data.channel as Channel,
    identifier: typeof data.identifier === 'string' ? data.identifier : '',
    isDefault: data.isDefault === true,
    isActive: data.isActive === true,
    workspaceIds: Array.isArray(data.workspaceIds)
      ? data.workspaceIds.filter((w: unknown): w is string => typeof w === 'string')
      : [],
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

/**
 * Run the backfill. Returns a structured report. In `dry-run` mode nothing is
 * written; in `apply` mode profiles are tagged and org defaults are seeded.
 */
export async function backfillSenderOrg(mode: BackfillMode = 'dry-run'): Promise<BackfillReport> {
  console.log(`[backfill-sender-org] starting (mode=${mode})`);

  // 1. Build workspace → org map.
  const workspacesSnap = await adminDb.collection('workspaces').get();
  const workspaceOrgMap: WorkspaceOrgMap = {};
  workspacesSnap.forEach((ws) => {
    const orgId = ws.data().organizationId;
    if (typeof orgId === 'string' && orgId.length > 0) workspaceOrgMap[ws.id] = orgId;
  });

  // 2. Load all sender profiles.
  const profilesSnap = await adminDb.collection('sender_profiles').get();
  const profiles = profilesSnap.docs.map((d) => toProfile(d.id, d.data()));

  const report: BackfillReport = {
    mode,
    scanned: profiles.length,
    alreadyTagged: 0,
    assigned: 0,
    ambiguous: [],
    orphan: [],
    orgDefaultsSeeded: [],
    orgsMissingDefault: [],
  };

  // Tracks the effective org for each profile (existing or newly resolved),
  // used afterward to seed org defaults.
  const profileOrg = new Map<string, string>();

  // 3. Tag organizationId.
  for (const p of profiles) {
    if (p.organizationId) {
      report.alreadyTagged += 1;
      profileOrg.set(p.id, p.organizationId);
      continue;
    }

    const resolved = resolveProfileOrg(p.workspaceIds, workspaceOrgMap);
    if (resolved.status === 'ambiguous') {
      report.ambiguous.push({ profileId: p.id, workspaceIds: p.workspaceIds, organizationIds: resolved.organizationIds });
      continue;
    }
    if (resolved.status === 'orphan') {
      report.orphan.push({ profileId: p.id, workspaceIds: p.workspaceIds });
      continue;
    }

    report.assigned += 1;
    profileOrg.set(p.id, resolved.organizationId);
    if (mode === 'apply') {
      await adminDb.collection('sender_profiles').doc(p.id).update({
        organizationId: resolved.organizationId,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // 4. Seed org defaults per channel from the (now) org-tagged profiles.
  const byOrgChannel = new Map<string, SeedCandidate[]>();
  for (const p of profiles) {
    const orgId = profileOrg.get(p.id);
    if (!orgId || !CHANNELS.includes(p.channel)) continue;
    const key = `${orgId}::${p.channel}`;
    const list = byOrgChannel.get(key) ?? [];
    list.push({ id: p.id, isActive: p.isActive, isDefault: p.isDefault });
    byOrgChannel.set(key, list);
  }

  // Read existing org default pointers so we never overwrite an explicit choice.
  const orgIds = Array.from(new Set(Array.from(profileOrg.values())));
  const orgDocs = await Promise.all(orgIds.map((id) => adminDb.collection('organizations').doc(id).get()));
  const existingDefaults = new Map<string, Partial<Record<Channel, string>>>();
  orgDocs.forEach((snap) => {
    const data = snap.data();
    const current = data?.defaultSenderProfileIds;
    existingDefaults.set(snap.id, (current && typeof current === 'object' ? current : {}) as Partial<Record<Channel, string>>);
  });

  // Accumulate per-org pointer patches so each org is written once.
  const pendingOrgPatch = new Map<string, Partial<Record<Channel, string>>>();

  for (const [key, candidates] of byOrgChannel.entries()) {
    const [orgId, channelRaw] = key.split('::');
    const channel = channelRaw as Channel;

    // Respect an already-configured default.
    if (existingDefaults.get(orgId)?.[channel]) continue;

    const seed = pickOrgDefaultSeed(candidates);
    if (!seed) {
      const reason: 'none' | 'ambiguous' = candidates.some((c) => c.isActive) ? 'ambiguous' : 'none';
      report.orgsMissingDefault.push({ organizationId: orgId, channel, reason });
      continue;
    }

    report.orgDefaultsSeeded.push({ organizationId: orgId, channel, senderProfileId: seed });
    const patch = pendingOrgPatch.get(orgId) ?? {};
    patch[channel] = seed;
    pendingOrgPatch.set(orgId, patch);
  }

  if (mode === 'apply') {
    for (const [orgId, patch] of pendingOrgPatch.entries()) {
      const merged = { ...(existingDefaults.get(orgId) ?? {}), ...patch };
      await adminDb.collection('organizations').doc(orgId).update({
        defaultSenderProfileIds: merged,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  console.log(
    `[backfill-sender-org] done: scanned=${report.scanned} assigned=${report.assigned} ` +
      `alreadyTagged=${report.alreadyTagged} ambiguous=${report.ambiguous.length} ` +
      `orphan=${report.orphan.length} defaultsSeeded=${report.orgDefaultsSeeded.length} ` +
      `orgsMissingDefault=${report.orgsMissingDefault.length}`,
  );

  return report;
}
