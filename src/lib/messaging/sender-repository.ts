/**
 * @fileOverview Imperative shell around the pure sender resolver.
 *
 * Loads the candidate sender-profile documents (explicit, workspace default,
 * org default) and feeds them to {@link pickSenderProfileId}. Firestore access
 * is injected via {@link CandidateLoader} so this module is unit-testable
 * without Firebase; the default loader is created lazily so `firebase-admin`
 * stays out of pure-test and client bundles (matching the engine's style).
 */

import type { SenderProfile } from '../types';
import {
  pickSenderProfileId,
  type Channel,
  type SenderCandidate,
  type SenderResolution,
} from './sender-resolution';

/** Sentinels callers pass when they mean "no explicit choice — use a default". */
const EXPLICIT_SENTINELS = new Set(['', 'default', 'none']);

/** Normalize a possibly-sentinel explicit sender id to a real id or null. */
export function normalizeExplicitSenderId(id: string | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  return EXPLICIT_SENTINELS.has(id) ? null : id;
}

/** Resolve the org id from the available sources, in precedence order. */
export function resolveOrgId(
  explicit: string | undefined | null,
  templateOrgId: string | undefined | null,
  workspaceOrgId: string | undefined | null,
): string | null {
  return explicit || templateOrgId || workspaceOrgId || null;
}

/** Loads a sender candidate by id, or null if it does not exist. */
export type CandidateLoader = (id: string) => Promise<SenderCandidate | null>;

export interface ResolveSenderInput {
  orgId: string;
  channel: Channel;
  explicitId: string | null | undefined;
  workspaceDefaultId: string | null | undefined;
  orgDefaultId: string | null | undefined;
  /** Defaults to a Firestore-backed loader. Injected in tests. */
  loadCandidate?: CandidateLoader;
}

/** Map a Firestore sender-profile snapshot to a fully-typed {@link SenderProfile}. */
export function toSenderProfile(
  id: string,
  data: FirebaseFirestore.DocumentData,
): SenderProfile {
  return {
    id,
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : '',
    name: typeof data.name === 'string' ? data.name : '',
    channel: data.channel as SenderProfile['channel'],
    identifier: typeof data.identifier === 'string' ? data.identifier : '',
    whatsappPhoneNumberId:
      typeof data.whatsappPhoneNumberId === 'string' ? data.whatsappPhoneNumberId : undefined,
    isDefault: data.isDefault === true,
    isActive: data.isActive === true,
    workspaceIds: Array.isArray(data.workspaceIds)
      ? data.workspaceIds.filter((w: unknown): w is string => typeof w === 'string')
      : [],
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

/** The default Firestore-backed candidate loader. */
async function defaultLoadCandidate(id: string): Promise<SenderCandidate | null> {
  const { adminDb } = await import('@/lib/firebase-admin');
  const snap = await adminDb.collection('sender_profiles').doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;
  return {
    id: snap.id,
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : '',
    isActive: data.isActive === true,
  };
}

/**
 * Resolve which sender profile id to use for a send, scoped strictly to `orgId`.
 * Loads each distinct candidate id at most once (parallel), then defers the
 * decision to the pure resolver. Returns a {@link SenderResolution} describing
 * the outcome — the caller decides how to handle `no_sender` /
 * `cross_org_explicit` (fail + notify).
 */
export async function resolveSenderProfileId(input: ResolveSenderInput): Promise<SenderResolution> {
  const load = input.loadCandidate ?? defaultLoadCandidate;

  const explicitId = normalizeExplicitSenderId(input.explicitId);
  const workspaceDefaultId = input.workspaceDefaultId || null;
  const orgDefaultId = input.orgDefaultId || null;

  // Load each distinct id once.
  const distinctIds = Array.from(
    new Set([explicitId, workspaceDefaultId, orgDefaultId].filter((id): id is string => !!id)),
  );
  const loaded = await Promise.all(distinctIds.map(async (id) => [id, await load(id)] as const));
  const byId = new Map<string, SenderCandidate | null>(loaded);

  const candidateFor = (id: string | null): SenderCandidate | null => (id ? byId.get(id) ?? null : null);

  return pickSenderProfileId({
    orgId: input.orgId,
    explicit: candidateFor(explicitId),
    workspaceDefault: candidateFor(workspaceDefaultId),
    orgDefault: candidateFor(orgDefaultId),
  });
}
