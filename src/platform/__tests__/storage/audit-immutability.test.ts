// @vitest-environment node
/**
 * @fileOverview Tamper-Evident Audit Immutability Tests (PR-7 / Workstream 1.4)
 *
 * Implements Rule 31 (Immutable Audit Trail) and Rule 40 (Audit Immutability).
 * Verifies SHA-256 hash chaining, multi-tenant workspace isolation, and mathematical tamper detection.
 */

import { describe, it, expect } from 'vitest';
import {
  createInMemoryAuditStore,
  computeAuditEntryHash,
  verifyAuditRecordChain,
  GENESIS_PREV_HASH,
  type CanonicalAuditRecord,
} from '../../capabilities/storage/audit-store';
import type { ExecutionAuditEntry } from '../../capabilities/execution/pipeline/15-audit-and-events';

function createMockAuditEntry(overrides?: Partial<ExecutionAuditEntry>): ExecutionAuditEntry {
  return {
    executionId: 'exec-1',
    capabilityId: 'crm.contact.create',
    capabilityVersion: '1.0.0',
    userId: 'user-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    correlationId: 'corr-1',
    decision: 'allowed',
    outcome: 'succeeded',
    durationMs: 12,
    stateChanged: 'yes',
    timestamp: '2026-10-02T01:00:00.000Z',
    ...overrides,
  };
}

describe('Audit Store: Tamper-Evident SHA-256 Hash Chaining (Rule 31 / 40)', () => {
  it('creates genesis record with GENESIS_PREV_HASH and monotonic sequence number 1', async () => {
    const store = createInMemoryAuditStore();
    const entry = createMockAuditEntry({ executionId: 'exec-genesis' });

    const record = await store.record(entry);

    expect(record.sequenceNumber).toBe(1);
    expect(record.prevHash).toBe(GENESIS_PREV_HASH);
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.hash).toBe(computeAuditEntryHash(record));

    const verification = await store.verifyWorkspaceChain('ws-1');
    expect(verification.valid).toBe(true);
    expect(verification.totalEntries).toBe(1);
  });

  it('chains subsequent records cryptographically by referencing previous hash', async () => {
    const store = createInMemoryAuditStore();

    const rec1 = await store.record(createMockAuditEntry({ executionId: 'exec-1' }));
    const rec2 = await store.record(createMockAuditEntry({ executionId: 'exec-2' }));
    const rec3 = await store.record(createMockAuditEntry({ executionId: 'exec-3' }));

    expect(rec1.sequenceNumber).toBe(1);
    expect(rec1.prevHash).toBe(GENESIS_PREV_HASH);

    expect(rec2.sequenceNumber).toBe(2);
    expect(rec2.prevHash).toBe(rec1.hash);

    expect(rec3.sequenceNumber).toBe(3);
    expect(rec3.prevHash).toBe(rec2.hash);

    const verification = await store.verifyWorkspaceChain('ws-1');
    expect(verification.valid).toBe(true);
    expect(verification.totalEntries).toBe(3);
  });

  it('isolates audit chains across distinct workspaces', async () => {
    const store = createInMemoryAuditStore();

    const recWs1A = await store.record(createMockAuditEntry({ workspaceId: 'ws-1', executionId: 'ws1-a' }));
    const recWs2A = await store.record(createMockAuditEntry({ workspaceId: 'ws-2', executionId: 'ws2-a' }));
    const recWs1B = await store.record(createMockAuditEntry({ workspaceId: 'ws-1', executionId: 'ws1-b' }));

    // ws-1 chain
    expect(recWs1A.sequenceNumber).toBe(1);
    expect(recWs1A.prevHash).toBe(GENESIS_PREV_HASH);
    expect(recWs1B.sequenceNumber).toBe(2);
    expect(recWs1B.prevHash).toBe(recWs1A.hash);

    // ws-2 chain has independent genesis
    expect(recWs2A.sequenceNumber).toBe(1);
    expect(recWs2A.prevHash).toBe(GENESIS_PREV_HASH);

    const v1 = await store.verifyWorkspaceChain('ws-1');
    expect(v1.valid).toBe(true);
    expect(v1.totalEntries).toBe(2);

    const v2 = await store.verifyWorkspaceChain('ws-2');
    expect(v2.valid).toBe(true);
    expect(v2.totalEntries).toBe(1);
  });

  it('detects tampering when any record content is modified post-recording', async () => {
    const store = createInMemoryAuditStore();

    await store.record(createMockAuditEntry({ executionId: 'exec-1' }));
    const rec2 = await store.record(createMockAuditEntry({ executionId: 'exec-2' }));
    await store.record(createMockAuditEntry({ executionId: 'exec-3' }));

    // Simulate an attacker tampering with record 2 outcome in memory/database
    (rec2 as { outcome: string }).outcome = 'failed';

    const verification = await store.verifyWorkspaceChain('ws-1');
    expect(verification.valid).toBe(false);
    expect(verification.tamperedIndex).toBe(1);
    expect(verification.reason).toContain('Tampered content');
  });

  it('detects tampering when a record is deleted or replaced, breaking the hash link', () => {
    const records: CanonicalAuditRecord[] = [];

    const rec1: CanonicalAuditRecord = {
      ...createMockAuditEntry({ executionId: 'e-1' }),
      id: 'audit_e-1',
      sequenceNumber: 1,
      prevHash: GENESIS_PREV_HASH,
      hash: '',
    };
    rec1.hash = computeAuditEntryHash(rec1);
    records.push(rec1);

    const rec2: CanonicalAuditRecord = {
      ...createMockAuditEntry({ executionId: 'e-2' }),
      id: 'audit_e-2',
      sequenceNumber: 2,
      prevHash: rec1.hash,
      hash: '',
    };
    rec2.hash = computeAuditEntryHash(rec2);
    records.push(rec2);

    const rec3: CanonicalAuditRecord = {
      ...createMockAuditEntry({ executionId: 'e-3' }),
      id: 'audit_e-3',
      sequenceNumber: 3,
      prevHash: rec2.hash,
      hash: '',
    };
    rec3.hash = computeAuditEntryHash(rec3);
    records.push(rec3);

    // Initial check is clean
    expect(verifyAuditRecordChain(records).valid).toBe(true);

    // Forge a replacement for rec2 with its own valid hash, but rec3.prevHash still points to original rec2.hash
    const forgedRec2: CanonicalAuditRecord = {
      ...rec2,
      decision: 'denied',
      hash: '',
    };
    forgedRec2.hash = computeAuditEntryHash(forgedRec2);
    records[1] = forgedRec2;

    const brokenChainResult = verifyAuditRecordChain(records);
    expect(brokenChainResult.valid).toBe(false);
    // It fails at index 2 because rec3.prevHash does not match forgedRec2.hash
    expect(brokenChainResult.tamperedIndex).toBe(2);
    expect(brokenChainResult.reason).toContain('Broken chain link');
  });

  it('detects sequence gaps or duplicates', () => {
    const records: CanonicalAuditRecord[] = [];

    const rec1: CanonicalAuditRecord = {
      ...createMockAuditEntry({ executionId: 'e-1' }),
      id: 'audit_e-1',
      sequenceNumber: 1,
      prevHash: GENESIS_PREV_HASH,
      hash: '',
    };
    rec1.hash = computeAuditEntryHash(rec1);
    records.push(rec1);

    // Skip sequence 2, insert sequence 3
    const recBrokenSeq: CanonicalAuditRecord = {
      ...createMockAuditEntry({ executionId: 'e-3' }),
      id: 'audit_e-3',
      sequenceNumber: 3,
      prevHash: rec1.hash,
      hash: '',
    };
    recBrokenSeq.hash = computeAuditEntryHash(recBrokenSeq);
    records.push(recBrokenSeq);

    const verification = verifyAuditRecordChain(records);
    expect(verification.valid).toBe(false);
    expect(verification.tamperedIndex).toBe(1);
    expect(verification.reason).toContain('Broken sequence');
  });
});
