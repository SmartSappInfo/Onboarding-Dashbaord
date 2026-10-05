/**
 * @fileOverview Canonical Tamper-Evident Audit Store (PR-7 / Workstream 1.4)
 *
 * Implements Rule 31 (Immutable Audit Trail), Rule 40 (Audit Immutability),
 * Rule 69 (SSOT Audit Log), and Master Roadmap Phase 1 Section 4.2.
 *
 * Persists capability invocation audit logs into Firestore collection `capability_audit/{id}`.
 * Enforces SHA-256 cryptographic hash chaining (`prevHash` -> `hash`) and monotonic sequence
 * numbers per (workspace, shard), enabling mathematical verification of audit integrity.
 *
 * SHARDING (Phase 11 M0 · T0.8, finding F14)
 * A single chain head per workspace serialized every audited execution in that workspace on one
 * document. Each workspace now has N independent chains (`capability_audit_heads/{ws}__s{shard}`);
 * an execution's shard is `sha256(executionId) mod N`. Verification walks each shard's chain page
 * by page. Production default N = 8 (`AUDIT_SHARD_COUNT` env to tune); changing N is safe because
 * heads record their shard and verification enumerates the heads that exist.
 *
 * NEVER DROPPED
 * If the chain transaction fails (contention, unavailability), the entry is written to
 * `capability_audit_pending/{recordId}` with a plain write and `AuditRecordPendingError` is thrown
 * (the gateway logs it; the caller's result is unaffected). `sealPending()` appends pending
 * entries later and is idempotent when the original write had in fact committed.
 *
 * CAUTION: `computeAuditEntryHash` includes `shard` only when present so hashes of records
 * written before sharding still verify. Never change hashed fields without a hash version.
 *
 * Provides:
 * - `computeAuditEntryHash`: Deterministic canonical SHA-256 hash computation.
 * - `createInMemoryAuditStore`: Isolated in-memory store for unit tests and local dev.
 * - `FirestoreAuditStore`: Production Firestore store using transactional chain updates.
 * - `verifyWorkspaceAuditChain`: Verifies the mathematical integrity of a workspace's audit log.
 * - `defaultAuditStore` & `defaultAuditSink`: Standardized plug-in sinks for execution gateway.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { sha256Hex } from '../contracts/canonical-json';
import type { StateChanged } from '../errors/capability-error';
import type { ExecutionAuditEntry } from '../execution/pipeline/15-audit-and-events';
import { selectPlatformStore } from '@/platform/storage/storage-mode';

export const CAPABILITY_AUDIT_COLLECTION = 'capability_audit';
export const CAPABILITY_AUDIT_HEADS_COLLECTION = 'capability_audit_heads';
export const CAPABILITY_AUDIT_PENDING_COLLECTION = 'capability_audit_pending';
export const DEFAULT_AUDIT_SHARD_COUNT = 8;
export const DEFAULT_AUDIT_VERIFY_PAGE_SIZE = 500;
export const GENESIS_PREV_HASH = '0'.repeat(64);

export interface CanonicalAuditRecord extends ExecutionAuditEntry {
  id: string;
  sequenceNumber: number;
  prevHash: string;
  hash: string;
  inputHash?: string;
  /** Chain shard within the workspace. Absent on records written before sharding. */
  shard?: number;
}

/**
 * Boundary schema for audit documents read back from Firestore (Rule 4: no unchecked casts).
 * Unknown extra fields are kept so hashes still verify; a malformed document fails parsing and is
 * reported as tampered rather than trusted.
 */
const CanonicalAuditRecordSchema = z.looseObject({
  id: z.string(),
  executionId: z.string(),
  capabilityId: z.string(),
  capabilityVersion: z.string(),
  userId: z.string(),
  agentId: z.string().optional(),
  organizationId: z.string(),
  workspaceId: z.string(),
  correlationId: z.string(),
  causationId: z.string().optional(),
  decision: z.enum(['allowed', 'denied']),
  outcome: z.enum(['succeeded', 'failed', 'denied']),
  code: z.string().optional(),
  durationMs: z.number(),
  stateChanged: z.enum(['no', 'yes', 'unknown']),
  timestamp: z.string(),
  inputHash: z.string().optional(),
  sequenceNumber: z.number().int().positive(),
  prevHash: z.string(),
  hash: z.string(),
  shard: z.number().int().nonnegative().optional(),
});

function parseAuditRecord(data: unknown): CanonicalAuditRecord | null {
  const parsed = CanonicalAuditRecordSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

const PendingAuditDocSchema = z.object({
  entry: CanonicalAuditRecordSchema.omit({ id: true, sequenceNumber: true, prevHash: true, hash: true, shard: true }),
  recordId: z.string().min(1),
  shard: z.number().int().nonnegative(),
  pendingSince: z.string(),
  lastError: z.string().optional(),
});

export interface AuditShardVerification {
  shard: number;
  valid: boolean;
  totalEntries: number;
  reason?: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  totalEntries: number;
  tamperedIndex?: number;
  tamperedRecordId?: string;
  reason?: string;
  /** Per-shard results (sharded stores only). */
  shards?: AuditShardVerification[];
}

/** Thrown when the chain write failed but the entry was saved for later sealing. */
export class AuditRecordPendingError extends Error {
  constructor(
    readonly recordId: string,
    cause: unknown
  ) {
    super(`Audit record ${recordId} is pending: chain write failed (${cause instanceof Error ? cause.message : String(cause)}).`);
    this.name = 'AuditRecordPendingError';
  }
}

/** Deterministic shard for an execution: `sha256(executionId) mod shardCount`. */
export function auditShardFor(executionId: string, shardCount: number): number {
  const count = Math.max(1, Math.floor(shardCount));
  const prefix = createHash('sha256').update(executionId).digest('hex').slice(0, 8);
  return Number.parseInt(prefix, 16) % count;
}

function resolveShardCount(explicit: number | undefined, envValue: string | undefined, fallback: number): number {
  const candidate = explicit ?? (envValue ? Number.parseInt(envValue, 10) : fallback);
  return Number.isFinite(candidate) && candidate >= 1 && candidate <= 64 ? Math.floor(candidate) : fallback;
}

export interface AuditStore {
  record(entry: ExecutionAuditEntry & { inputHash?: string }): Promise<CanonicalAuditRecord>;
  get(id: string): Promise<CanonicalAuditRecord | null>;
  listByWorkspace(workspaceId: string, limit?: number): Promise<CanonicalAuditRecord[]>;
  verifyWorkspaceChain(workspaceId: string): Promise<AuditVerificationResult>;
  /** Appends entries whose chain write failed earlier (Firestore store only). */
  sealPending?(limit?: number): Promise<{ sealed: number; failed: number }>;
}

/**
 * Computes deterministic SHA-256 hash across canonical representation of core audit fields.
 */
export function computeAuditEntryHash(params: {
  prevHash: string;
  sequenceNumber: number;
  executionId: string;
  workspaceId: string;
  organizationId: string;
  capabilityId: string;
  capabilityVersion: string;
  userId: string;
  agentId?: string;
  decision: 'allowed' | 'denied';
  outcome: 'succeeded' | 'failed' | 'denied';
  code?: string;
  durationMs: number;
  stateChanged: StateChanged;
  timestamp: string;
  inputHash?: string;
  shard?: number;
}): string {
  return sha256Hex({
    ...(params.shard !== undefined ? { shard: params.shard } : {}),
    prevHash: params.prevHash,
    sequenceNumber: params.sequenceNumber,
    executionId: params.executionId,
    workspaceId: params.workspaceId,
    organizationId: params.organizationId,
    capabilityId: params.capabilityId,
    capabilityVersion: params.capabilityVersion,
    userId: params.userId,
    agentId: params.agentId ?? null,
    decision: params.decision,
    outcome: params.outcome,
    code: params.code ?? null,
    durationMs: params.durationMs,
    stateChanged: params.stateChanged,
    timestamp: params.timestamp,
    inputHash: params.inputHash ?? null,
  });
}

/**
 * Verifies that a list of audit records forms an unbroken cryptographic chain.
 */
export function verifyAuditRecordChain(records: CanonicalAuditRecord[]): AuditVerificationResult {
  if (records.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  for (let i = 0; i < records.length; i++) {
    const current = records[i];
    const expectedSeq = i + 1;

    // 1. Verify monotonic sequence number
    if (current.sequenceNumber !== expectedSeq) {
      return {
        valid: false,
        totalEntries: records.length,
        tamperedIndex: i,
        tamperedRecordId: current.id,
        reason: `Broken sequence: expected ${expectedSeq}, got ${current.sequenceNumber}`,
      };
    }

    // 2. Verify prevHash link
    const expectedPrevHash = i === 0 ? GENESIS_PREV_HASH : records[i - 1].hash;
    if (current.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: records.length,
        tamperedIndex: i,
        tamperedRecordId: current.id,
        reason: `Broken chain link: prevHash does not match hash of preceding record`,
      };
    }

    // 3. Verify record's own computed hash
    const computedHash = computeAuditEntryHash(current);
    if (current.hash !== computedHash) {
      return {
        valid: false,
        totalEntries: records.length,
        tamperedIndex: i,
        tamperedRecordId: current.id,
        reason: `Tampered content: computed hash ${computedHash} does not match stored hash ${current.hash}`,
      };
    }
  }

  return {
    valid: true,
    totalEntries: records.length,
  };
}

/**
 * Incremental chain verifier: feed records in sequence order (any page size) and read the result.
 * Keeps only the previous record, so verifying a long chain needs constant memory (Rule 9).
 */
export class AuditChainVerifier {
  private count = 0;
  private prev: CanonicalAuditRecord | null = null;
  private failure: Omit<AuditVerificationResult, 'totalEntries' | 'valid'> | null = null;

  push(record: CanonicalAuditRecord): boolean {
    if (this.failure) return false;
    const index = this.count;
    const expectedSeq = index + 1;
    const expectedPrev = this.prev ? this.prev.hash : GENESIS_PREV_HASH;
    let reason: string | undefined;
    if (record.sequenceNumber !== expectedSeq) {
      reason = `Broken sequence: expected ${expectedSeq}, got ${record.sequenceNumber}`;
    } else if (record.prevHash !== expectedPrev) {
      reason = 'Broken chain link: prevHash does not match hash of preceding record';
    } else if (record.hash !== computeAuditEntryHash(record)) {
      reason = `Tampered content: computed hash ${computeAuditEntryHash(record)} does not match stored hash ${record.hash}`;
    }
    this.count += 1;
    if (reason) {
      this.failure = { tamperedIndex: index, tamperedRecordId: record.id, reason };
      return false;
    }
    this.prev = record;
    return true;
  }

  /** Records a document that could not be parsed as an audit record. */
  fail(recordId: string, reason: string): void {
    if (this.failure) return;
    this.failure = { tamperedIndex: this.count, tamperedRecordId: recordId, reason };
    this.count += 1;
  }

  result(): AuditVerificationResult {
    return this.failure
      ? { valid: false, totalEntries: this.count, ...this.failure }
      : { valid: true, totalEntries: this.count };
  }
}

function combineShardResults(results: Array<AuditVerificationResult & { shard: number }>): AuditVerificationResult {
  const totalEntries = results.reduce((n, r) => n + r.totalEntries, 0);
  const firstFailure = results.find((r) => !r.valid);
  const shards: AuditShardVerification[] = results.map((r) => ({
    shard: r.shard,
    valid: r.valid,
    totalEntries: r.totalEntries,
    reason: r.reason,
  }));
  return firstFailure
    ? {
        valid: false,
        totalEntries,
        tamperedIndex: firstFailure.tamperedIndex,
        tamperedRecordId: firstFailure.tamperedRecordId,
        reason: `Shard ${firstFailure.shard}: ${firstFailure.reason ?? 'invalid'}`,
        shards,
      }
    : { valid: true, totalEntries, shards };
}

function hashInputFor(
  entry: ExecutionAuditEntry & { inputHash?: string },
  chain: { prevHash: string; sequenceNumber: number; shard: number }
): Parameters<typeof computeAuditEntryHash>[0] {
  return {
    prevHash: chain.prevHash,
    sequenceNumber: chain.sequenceNumber,
    shard: chain.shard,
    executionId: entry.executionId,
    workspaceId: entry.workspaceId,
    organizationId: entry.organizationId,
    capabilityId: entry.capabilityId,
    capabilityVersion: entry.capabilityVersion,
    userId: entry.userId,
    agentId: entry.agentId,
    decision: entry.decision,
    outcome: entry.outcome,
    code: entry.code,
    durationMs: entry.durationMs,
    stateChanged: entry.stateChanged,
    timestamp: entry.timestamp,
    inputHash: entry.inputHash,
  };
}

/** Write payload without undefined values (Firestore rejects them). */
function toFirestoreData(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}

/**
 * In-memory audit store for tests and local opt-in. Default shardCount = 1 keeps a single
 * sequential chain per workspace (what the original audit tests pin); pass `shardCount` to mirror
 * production sharding. Records are kept by reference on purpose so tamper tests can mutate them.
 */
export function createInMemoryAuditStore(options?: { shardCount?: number }): AuditStore {
  const shardCount = resolveShardCount(options?.shardCount, undefined, 1);
  const chains = new Map<string, CanonicalAuditRecord[]>();
  const byId = new Map<string, CanonicalAuditRecord>();
  const chainKey = (workspaceKey: string, shard: number) => `${workspaceKey}__s${shard}`;

  return {
    async record(entry: ExecutionAuditEntry & { inputHash?: string }): Promise<CanonicalAuditRecord> {
      const workspaceKey = entry.workspaceId || 'global';
      const recordId = `audit_${entry.executionId || randomUUID()}`;
      const shard = auditShardFor(entry.executionId || recordId, shardCount);
      const key = chainKey(workspaceKey, shard);
      const chain = chains.get(key) ?? [];

      const sequenceNumber = chain.length + 1;
      const prevHash = chain.length === 0 ? GENESIS_PREV_HASH : chain[chain.length - 1].hash;
      const hash = computeAuditEntryHash(hashInputFor(entry, { prevHash, sequenceNumber, shard }));
      const record: CanonicalAuditRecord = { ...entry, id: recordId, sequenceNumber, prevHash, hash, shard };

      chain.push(record);
      chains.set(key, chain);
      byId.set(recordId, record);
      return record;
    },

    async get(id: string): Promise<CanonicalAuditRecord | null> {
      return byId.get(id) ?? null;
    },

    async listByWorkspace(workspaceId: string, limit: number = 50): Promise<CanonicalAuditRecord[]> {
      const workspaceKey = workspaceId || 'global';
      const all: CanonicalAuditRecord[] = [];
      for (let shard = 0; shard < shardCount; shard++) {
        all.push(...(chains.get(chainKey(workspaceKey, shard)) ?? []));
      }
      return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.sequenceNumber - a.sequenceNumber).slice(0, limit);
    },

    async verifyWorkspaceChain(workspaceId: string): Promise<AuditVerificationResult> {
      const workspaceKey = workspaceId || 'global';
      if (shardCount === 1) {
        return verifyAuditRecordChain(chains.get(chainKey(workspaceKey, 0)) ?? []);
      }
      const results: Array<AuditVerificationResult & { shard: number }> = [];
      for (let shard = 0; shard < shardCount; shard++) {
        const chain = chains.get(chainKey(workspaceKey, shard));
        if (chain && chain.length > 0) results.push({ shard, ...verifyAuditRecordChain(chain) });
      }
      return combineShardResults(results);
    },
  };
}

export interface FirestoreAuditStoreOptions {
  /** Firestore accessor (tests inject a fake). Defaults to the Admin SDK instance. */
  db?: () => Firestore | Promise<Firestore>;
  /** Chains per workspace. Default 8, or `AUDIT_SHARD_COUNT`. Range 1–64. */
  shardCount?: number;
  /** Records read per page during verification. Default 500. */
  verifyPageSize?: number;
}

interface PendingAuditDoc {
  entry: ExecutionAuditEntry & { inputHash?: string };
  recordId: string;
  shard: number;
  pendingSince: string;
  lastError?: string;
}

/**
 * Firestore-backed audit store: sharded hash chains appended in transactions.
 */
export class FirestoreAuditStore implements AuditStore {
  private readonly getDb: () => Promise<Firestore>;
  private readonly shardCount: number;
  private readonly verifyPageSize: number;

  constructor(options: FirestoreAuditStoreOptions = {}) {
    const injected = options.db;
    this.getDb = injected
      ? async () => injected()
      : async () => (await import('@/lib/firebase-admin')).adminDb;
    this.shardCount = resolveShardCount(options.shardCount, process.env.AUDIT_SHARD_COUNT, DEFAULT_AUDIT_SHARD_COUNT);
    this.verifyPageSize = Math.max(1, options.verifyPageSize ?? DEFAULT_AUDIT_VERIFY_PAGE_SIZE);
  }

  public async record(entry: ExecutionAuditEntry & { inputHash?: string }): Promise<CanonicalAuditRecord> {
    const db = await this.getDb();
    const recordId = `audit_${entry.executionId || randomUUID()}`;
    const shard = auditShardFor(entry.executionId || recordId, this.shardCount);
    try {
      return await this.appendToChain(db, entry, recordId, shard);
    } catch (chainError: unknown) {
      // CAUTION: never drop an audit entry. Save it un-chained; sealPending() appends it later.
      const pending: PendingAuditDoc = {
        entry,
        recordId,
        shard,
        pendingSince: new Date().toISOString(),
        lastError: chainError instanceof Error ? chainError.message : String(chainError),
      };
      await db
        .collection(CAPABILITY_AUDIT_PENDING_COLLECTION)
        .doc(recordId)
        .set({ ...toFirestoreData(pending), entry: toFirestoreData(entry) });
      throw new AuditRecordPendingError(recordId, chainError);
    }
  }

  /** Appends one entry to its shard chain. Idempotent: an existing record id is returned as-is. */
  private async appendToChain(
    db: Firestore,
    entry: ExecutionAuditEntry & { inputHash?: string },
    recordId: string,
    shard: number,
    pendingRef?: FirebaseFirestore.DocumentReference
  ): Promise<CanonicalAuditRecord> {
    const workspaceKey = entry.workspaceId || 'global';
    const headRef = db.collection(CAPABILITY_AUDIT_HEADS_COLLECTION).doc(`${workspaceKey}__s${shard}`);
    const recordRef = db.collection(CAPABILITY_AUDIT_COLLECTION).doc(recordId);

    return db.runTransaction(async (transaction) => {
      const existing = await transaction.get(recordRef);
      if (existing.exists) {
        if (pendingRef) transaction.delete(pendingRef);
        const stored = parseAuditRecord(existing.data());
        if (!stored) throw new Error(`Audit record ${recordId} exists but is malformed.`);
        return stored;
      }

      const headSnap = await transaction.get(headRef);
      const head = headSnap.exists ? headSnap.data() : undefined;
      const prevHash = typeof head?.headHash === 'string' ? head.headHash : GENESIS_PREV_HASH;
      const sequenceNumber = (typeof head?.sequenceNumber === 'number' ? head.sequenceNumber : 0) + 1;

      const hash = computeAuditEntryHash(hashInputFor(entry, { prevHash, sequenceNumber, shard }));
      const record: CanonicalAuditRecord = { ...entry, id: recordId, sequenceNumber, prevHash, hash, shard };

      transaction.set(recordRef, toFirestoreData(record));
      transaction.set(headRef, {
        workspaceId: entry.workspaceId,
        shard,
        headHash: hash,
        sequenceNumber,
        updatedAt: entry.timestamp,
      });
      if (pendingRef) transaction.delete(pendingRef);
      return record;
    });
  }

  /**
   * Appends pending entries to their chains (oldest first). Safe to run repeatedly or concurrently:
   * each append is a transaction keyed by record id.
   */
  public async sealPending(limit: number = 100): Promise<{ sealed: number; failed: number }> {
    const db = await this.getDb();
    const snapshot = await db
      .collection(CAPABILITY_AUDIT_PENDING_COLLECTION)
      .orderBy('pendingSince', 'asc')
      .limit(Math.max(1, Math.min(limit, 500)))
      .get();

    let sealed = 0;
    let failed = 0;
    for (const doc of snapshot.docs) {
      const parsedPending = PendingAuditDocSchema.safeParse(doc.data());
      if (!parsedPending.success) {
        failed += 1; // left in place for inspection; never silently deleted
        continue;
      }
      const pending = parsedPending.data;
      try {
        await this.appendToChain(db, pending.entry, pending.recordId, pending.shard, doc.ref);
        sealed += 1;
      } catch {
        failed += 1;
      }
    }
    return { sealed, failed };
  }

  public async get(id: string): Promise<CanonicalAuditRecord | null> {
    try {
      const db = await this.getDb();
      const snap = await db.collection(CAPABILITY_AUDIT_COLLECTION).doc(id).get();
      if (!snap.exists) return null;
      return parseAuditRecord(snap.data());
    } catch {
      return null;
    }
  }

  /** Newest first across shards. Requires the (workspaceId, timestamp desc) index. */
  public async listByWorkspace(workspaceId: string, limit: number = 50): Promise<CanonicalAuditRecord[]> {
    const db = await this.getDb();
    const snapshot = await db
      .collection(CAPABILITY_AUDIT_COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .orderBy('timestamp', 'desc')
      .limit(Math.max(1, Math.min(limit, 500)))
      .get();
    return snapshot.docs
      .map((doc) => parseAuditRecord(doc.data()))
      .filter((record): record is CanonicalAuditRecord => record !== null);
  }

  /**
   * Verifies every shard chain that has a head for this workspace, streaming each chain in pages
   * (constant memory). Requires the (workspaceId, shard, sequenceNumber) index.
   */
  public async verifyWorkspaceChain(workspaceId: string): Promise<AuditVerificationResult> {
    const db = await this.getDb();
    const heads = await db
      .collection(CAPABILITY_AUDIT_HEADS_COLLECTION)
      .where('workspaceId', '==', workspaceId)
      .get();

    const shardIds = heads.docs
      .map((doc) => (doc.data() as Record<string, unknown>).shard)
      .filter((shard): shard is number => typeof shard === 'number')
      .sort((a, b) => a - b);

    const results: Array<AuditVerificationResult & { shard: number }> = [];
    for (const shard of shardIds) {
      const verifier = new AuditChainVerifier();
      let cursor: number | undefined;
      for (;;) {
        let query = db
          .collection(CAPABILITY_AUDIT_COLLECTION)
          .where('workspaceId', '==', workspaceId)
          .where('shard', '==', shard)
          .orderBy('sequenceNumber', 'asc')
          .limit(this.verifyPageSize);
        if (cursor !== undefined) query = query.startAfter(cursor);
        const page = await query.get();
        let ok = true;
        for (const doc of page.docs) {
          const record = parseAuditRecord(doc.data());
          if (!record) {
            verifier.fail(doc.id, 'Malformed audit document');
            ok = false;
            break;
          }
          ok = verifier.push(record);
          cursor = record.sequenceNumber;
          if (!ok) break;
        }
        if (!ok || page.docs.length < this.verifyPageSize) break;
      }
      results.push({ shard, ...verifier.result() });
    }
    return combineShardResults(results);
  }
}

/**
 * Default process-wide audit store singleton.
 */
// CAUTION (Phase 11 M0 · F1): memory only under test or explicit non-production opt-in; never an
// implicit fallback. See src/platform/storage/storage-mode.ts.
export const defaultAuditStore: AuditStore =
  selectPlatformStore<AuditStore>(
    () => createInMemoryAuditStore(),
    () => new FirestoreAuditStore()
  );

/**
 * Creates a standard audit sink function suitable for `executeCapability` or `step15AuditAndEvents`.
 */
export function createFirestoreAuditSink(store: AuditStore = defaultAuditStore): (entry: ExecutionAuditEntry) => Promise<void> {
  return async (entry: ExecutionAuditEntry) => {
    await store.record(entry);
  };
}

/**
 * Default audit sink delegating directly to the canonical audit store.
 */
export const defaultAuditSink = createFirestoreAuditSink(defaultAuditStore);

/**
 * Helper to verify workspace audit chain on the default store.
 */
export async function verifyWorkspaceAuditChain(
  workspaceId: string,
  store: AuditStore = defaultAuditStore
): Promise<AuditVerificationResult> {
  return await store.verifyWorkspaceChain(workspaceId);
}
