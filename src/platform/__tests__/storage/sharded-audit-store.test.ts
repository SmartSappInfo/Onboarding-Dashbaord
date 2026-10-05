/**
 * @fileOverview Sharded, tamper-evident audit chain (Phase 11 M0 · T0.8, finding F14).
 *
 * The audit chain used one head document per workspace, so every audited execution in a workspace
 * serialized on it. Now each workspace has N shard chains; an execution's shard is derived from
 * its executionId. A failed chain write is never dropped: it lands in `capability_audit_pending`
 * and the sealer appends it later (idempotently).
 */
import { describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { FakeFirestore } from '../helpers/fake-firestore';
import {
  FirestoreAuditStore,
  auditShardFor,
  CAPABILITY_AUDIT_COLLECTION,
  CAPABILITY_AUDIT_PENDING_COLLECTION,
  AuditRecordPendingError,
  createInMemoryAuditStore,
} from '../../capabilities/storage/audit-store';
import type { ExecutionAuditEntry } from '../../capabilities/execution/pipeline/15-audit-and-events';

const entry = (i: number, workspaceId = 'ws-1'): ExecutionAuditEntry => ({
  executionId: `exec-${i}`,
  capabilityId: 'task.create',
  capabilityVersion: '1.0.0',
  userId: 'user-1',
  organizationId: 'org-1',
  workspaceId,
  correlationId: `corr-${i}`,
  decision: 'allowed',
  outcome: 'succeeded',
  durationMs: 12,
  stateChanged: 'yes',
  timestamp: new Date(Date.UTC(2026, 9, 5, 10, 0, i)).toISOString(),
});

describe('auditShardFor', () => {
  it('is deterministic and within range', () => {
    for (let i = 0; i < 200; i++) {
      const shard = auditShardFor(`exec-${i}`, 8);
      expect(shard).toBe(auditShardFor(`exec-${i}`, 8));
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(8);
    }
  });

  it('spreads executions across shards', () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => auditShardFor(`exec-${i}`, 8)));
    expect(used.size).toBe(8);
  });
});

describe('FirestoreAuditStore (sharded)', () => {
  it('records 50 parallel executions in one workspace across shards, every chain intact', async () => {
    const db = new FakeFirestore();
    const store = new FirestoreAuditStore({ db: () => db.asFirestore(), shardCount: 8 });

    await Promise.all(Array.from({ length: 50 }, (_, i) => store.record(entry(i))));

    const heads = await db.collection('capability_audit_heads').where('workspaceId', '==', 'ws-1').get();
    expect(heads.size).toBeGreaterThan(1); // no single hot document

    const result = await store.verifyWorkspaceChain('ws-1');
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(50);
    expect(result.shards?.reduce((n, s) => n + s.totalEntries, 0)).toBe(50);
  });

  it('detects tampering inside a shard chain', async () => {
    const db = new FakeFirestore();
    const store = new FirestoreAuditStore({ db: () => db.asFirestore(), shardCount: 2 });
    for (let i = 0; i < 6; i++) await store.record(entry(i));

    const victim = await store.record(entry(99));
    db.write(`${CAPABILITY_AUDIT_COLLECTION}/${victim.id}`, { ...victim, durationMs: 9999 });

    const result = await store.verifyWorkspaceChain('ws-1');
    expect(result.valid).toBe(false);
    expect(result.tamperedRecordId).toBe(victim.id);
  });

  it('verifies long chains page by page (no whole-workspace load)', async () => {
    const db = new FakeFirestore();
    const store = new FirestoreAuditStore({ db: () => db.asFirestore(), shardCount: 1, verifyPageSize: 7 });
    for (let i = 0; i < 30; i++) await store.record(entry(i));
    const result = await store.verifyWorkspaceChain('ws-1');
    expect(result).toMatchObject({ valid: true, totalEntries: 30 });
  });

  it('keeps workspaces isolated', async () => {
    const db = new FakeFirestore();
    const store = new FirestoreAuditStore({ db: () => db.asFirestore(), shardCount: 4 });
    for (let i = 0; i < 5; i++) await store.record(entry(i, 'ws-a'));
    for (let i = 5; i < 8; i++) await store.record(entry(i, 'ws-b'));
    expect((await store.verifyWorkspaceChain('ws-a')).totalEntries).toBe(5);
    expect((await store.verifyWorkspaceChain('ws-b')).totalEntries).toBe(3);
  });

  it('lists newest first by timestamp across shards', async () => {
    const db = new FakeFirestore();
    const store = new FirestoreAuditStore({ db: () => db.asFirestore(), shardCount: 4 });
    for (let i = 0; i < 10; i++) await store.record(entry(i));
    const listed = await store.listByWorkspace('ws-1', 3);
    expect(listed.map((r) => r.executionId)).toEqual(['exec-9', 'exec-8', 'exec-7']);
  });
});

describe('pending audit records (never dropped)', () => {
  /** A Firestore whose transactions fail (contention / unavailable) but plain writes work. */
  const failingTransactions = (db: FakeFirestore): Firestore => {
    const failing = Object.create(db) as FakeFirestore;
    failing.runTransaction = () => Promise.reject(new Error('ABORTED: too much contention'));
    return failing.asFirestore();
  };

  it('writes a pending record when the chain transaction fails, then the sealer appends it', async () => {
    const db = new FakeFirestore();
    const broken = new FirestoreAuditStore({ db: () => failingTransactions(db), shardCount: 4 });

    await expect(broken.record(entry(1))).rejects.toBeInstanceOf(AuditRecordPendingError);
    const pending = await db.collection(CAPABILITY_AUDIT_PENDING_COLLECTION).get();
    expect(pending.size).toBe(1);

    const healthy = new FirestoreAuditStore({ db: () => db.asFirestore(), shardCount: 4 });
    const sealed = await healthy.sealPending(10);
    expect(sealed).toEqual({ sealed: 1, failed: 0 });
    expect((await db.collection(CAPABILITY_AUDIT_PENDING_COLLECTION).get()).size).toBe(0);
    expect(await healthy.verifyWorkspaceChain('ws-1')).toMatchObject({ valid: true, totalEntries: 1 });
  });

  it('sealing is idempotent when the original write actually committed', async () => {
    const db = new FakeFirestore();
    const store = new FirestoreAuditStore({ db: () => db.asFirestore(), shardCount: 2 });
    const record = await store.record(entry(7));
    // Simulate "response lost": a pending copy exists for an already-chained record.
    db.write(`${CAPABILITY_AUDIT_PENDING_COLLECTION}/${record.id}`, {
      entry: entry(7),
      recordId: record.id,
      shard: record.shard,
      pendingSince: entry(7).timestamp,
    });
    expect(await store.sealPending(10)).toEqual({ sealed: 1, failed: 0 });
    expect(await store.verifyWorkspaceChain('ws-1')).toMatchObject({ valid: true, totalEntries: 1 });
  });
});

describe('in-memory audit store parity', () => {
  it('shards and verifies like the Firestore store', async () => {
    const store = createInMemoryAuditStore({ shardCount: 4 });
    await Promise.all(Array.from({ length: 20 }, (_, i) => store.record(entry(i))));
    const result = await store.verifyWorkspaceChain('ws-1');
    expect(result).toMatchObject({ valid: true, totalEntries: 20 });
  });
});
