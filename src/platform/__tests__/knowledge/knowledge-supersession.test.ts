/**
 * @fileOverview Test Suite: Rule 29 Immutable Fact Supersession & Transactional Memory Updates (Phase 11 M3 · T4)
 *
 * Enforces Rule 29 (Immutable Temporal Fact Supersession: NEVER overwrite or delete history),
 * Rule 8 & 47 (Multi-Tenant Scoping & Anti-IDOR),
 * Rule 40 (Domain Event Publishing: memory.superseded & memory.created).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeMemoryBridge } from '../../domains/knowledge_memory/services/knowledge-memory-bridge';
import type { KnowledgeCandidate } from '../../domains/knowledge_memory/contracts/knowledge-schemas';
import { defaultEventBus } from '../../events/event-bus';

describe('Rule 29 Immutable Fact Supersession & Memory Bridge (Phase 11 M3 · T4)', () => {
  let bridge: KnowledgeMemoryBridge;

  beforeEach(() => {
    bridge = new KnowledgeMemoryBridge();
  });

  describe('supersedeMemory', () => {
    it('atomically supersedes an old memory record without deleting or overwriting history (Rule 29)', async () => {
      const publishSpy = vi.spyOn(defaultEventBus, 'publish');

      // 1. Seed initial active memory
      const initialRecord = await bridge.createMemoryRecord({
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        title: 'Initial Payment Policy',
        content: 'Payment terms are Net-30.',
        type: 'policy',
        version: 1,
      });

      expect(initialRecord.version).toBe(1);
      expect(initialRecord.lifecycle.status).toBe('active');
      expect(initialRecord.temporalValidity.validUntil).toBeUndefined();

      // 2. Perform supersession
      const { oldRecord, newRecord } = await bridge.supersedeMemory({
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        oldMemoryId: initialRecord.id,
        newMemoryDraft: {
          title: 'Revised Payment Policy',
          content: 'Payment terms are Net-45 for all high school campuses.',
          type: 'policy',
        },
        actorId: 'usr_operator_01',
      });

      // 3. Verify old record is archived with validUntil and supersededBy pointer
      expect(oldRecord.id).toBe(initialRecord.id);
      expect(oldRecord.lifecycle.status).toBe('archived');
      expect(oldRecord.temporalValidity.validUntil).toBeDefined();
      expect(oldRecord.temporalValidity.supersededBy).toBe(newRecord.id);

      // 4. Verify new record is active with incremented version and validFrom
      expect(newRecord.id).toMatch(/^mem_/);
      expect(newRecord.version).toBe(2);
      expect(newRecord.lifecycle.status).toBe('active');
      expect(newRecord.temporalValidity.validFrom).toBeDefined();
      expect(newRecord.temporalValidity.supersededBy).toBeUndefined();
      expect(newRecord.title).toBe('Revised Payment Policy');

      // 5. Verify domain event emitted (Rule 40)
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory.superseded',
          payload: expect.objectContaining({
            oldMemoryId: initialRecord.id,
            newMemoryId: newRecord.id,
            supersededVersion: 1,
            newVersion: 2,
          }),
        })
      );

      // 6. Verify historic point-in-time query still reads the old record (Zero data destruction)
      const historicOld = await bridge.getMemoryRecord(initialRecord.id, 'ws_test_1');
      expect(historicOld).not.toBeNull();
      expect(historicOld?.id).toBe(initialRecord.id);
      expect(historicOld?.content).toBe('Payment terms are Net-30.');
    });

    it('enforces multi-tenant boundary and rejects cross-workspace supersession attempts (Rule 8)', async () => {
      const initialRecord = await bridge.createMemoryRecord({
        organizationId: 'org_test_1',
        workspaceId: 'ws_tenant_Alpha',
        title: 'Alpha Secret Policy',
        content: 'Alpha terms.',
        type: 'policy',
        version: 1,
      });

      await expect(
        bridge.supersedeMemory({
          organizationId: 'org_test_1',
          workspaceId: 'ws_tenant_Beta', // IDOR probe
          oldMemoryId: initialRecord.id,
          newMemoryDraft: {
            title: 'Hacked Policy',
            content: 'Injected terms.',
            type: 'policy',
          },
          actorId: 'usr_malicious',
        })
      ).rejects.toThrow(/IDOR_VIOLATION/);
    });
  });

  describe('materializeCandidate', () => {
    it('materializes a candidate into a new active memory object', async () => {
      const candidate: KnowledgeCandidate = {
        id: 'cand_mat_01',
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        source: { type: 'meeting', id: 'm1' },
        type: 'fact',
        title: 'New Campus Announcement',
        content: '<untrusted_reference_data id="c1" source="meeting:m1">Campus reopening next Monday.</untrusted_reference_data>',
        subjectRefs: ['entity_campus_01'],
        suggestedRelationships: [],
        confidence: 0.9,
        verificationState: 'verified',
        sensitivity: 'internal',
        status: 'accepted',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await bridge.materializeCandidate(candidate, {
        actorId: 'usr_operator_01',
      });

      expect(result.memoryId).toMatch(/^mem_/);
      expect(result.version).toBe(1);

      const savedMemory = await bridge.getMemoryRecord(result.memoryId, 'ws_test_1');
      expect(savedMemory).not.toBeNull();
      expect(savedMemory?.title).toBe('New Campus Announcement');
      expect(savedMemory?.lifecycle.status).toBe('active');
    });

    it('materializes candidate and supersedes existing memory when supersededMemoryId is passed', async () => {
      const oldMem = await bridge.createMemoryRecord({
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        title: 'Old Fact',
        content: 'Old content.',
        type: 'fact',
        version: 1,
      });

      const candidate: KnowledgeCandidate = {
        id: 'cand_mat_02',
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        source: { type: 'meeting', id: 'm2' },
        type: 'fact',
        title: 'Updated Fact',
        content: '<untrusted_reference_data id="c2" source="meeting:m2">Updated content.</untrusted_reference_data>',
        subjectRefs: [],
        suggestedRelationships: [],
        confidence: 0.95,
        verificationState: 'verified',
        sensitivity: 'internal',
        status: 'accepted',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await bridge.materializeCandidate(candidate, {
        supersededMemoryId: oldMem.id,
        actorId: 'usr_operator_01',
      });

      expect(result.supersededMemoryId).toBe(oldMem.id);
      expect(result.version).toBe(2);

      const oldUpdated = await bridge.getMemoryRecord(oldMem.id, 'ws_test_1');
      expect(oldUpdated?.lifecycle.status).toBe('archived');
      expect(oldUpdated?.temporalValidity.supersededBy).toBe(result.memoryId);
    });
  });
});
