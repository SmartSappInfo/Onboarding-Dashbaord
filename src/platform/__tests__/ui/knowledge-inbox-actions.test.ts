/**
 * @fileOverview Unit Tests: Knowledge Inbox Server Actions (Phase 11 M3 · T7)
 *
 * Enforces Rule 4 (Strict Typing: zero any/any[]), Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock),
 * Rule 51 (Next.js 15 Server Actions Conventions), Rule 60 (Emergency Dead-Man Switch Evaluation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import {
  listKnowledgeCandidatesAction,
  decideKnowledgeCandidateAction,
  listKnowledgeConflictsAction,
  resolveKnowledgeConflictAction,
  getKnowledgeGraphNeighborsAction,
} from '@/app/actions/knowledge-inbox-actions';
import { getKnowledgeCandidateService } from '@/platform/domains/knowledge_memory/services/knowledge-candidate-service';
import { getKnowledgeConflictService } from '@/platform/domains/knowledge_memory/services/knowledge-conflict-service';
import { getKnowledgeGraphProjectionService } from '@/platform/domains/knowledge_memory/services/knowledge-graph-projection-service';

describe('Knowledge Inbox Server Actions (Phase 11 M3 · T7)', () => {
  const mockOrgId = 'org_enterprise_1';
  const mockWsId = 'ws_knowledge_alpha';
  const mockUserId = 'usr_operator_alice';

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default authenticated session
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
      uid: mockUserId,
      email: 'alice@smartsapp.com',
      isSystemAdmin: false,
      profile: {
        id: mockUserId,
        email: 'alice@smartsapp.com',
        displayName: 'Alice Operator',
        organizationId: mockOrgId,
        lastActiveWorkspaceId: mockWsId,
        role: 'admin',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    } as unknown as authModule.AuthContext);

    // Default dead man switch is active (not paused)
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockReturnValue({
      isPaused: false,
      emergencyLevel: 'NORMAL',
    } as unknown as deadManModule.DeadManStatus);
  });

  describe('listKnowledgeCandidatesAction', () => {
    it('returns candidate list for authorized workspace', async () => {
      const candidateService = getKnowledgeCandidateService();
      await candidateService.proposeCandidate({
        organizationId: mockOrgId,
        workspaceId: mockWsId,
        source: { type: 'note', id: 'n1' },
        type: 'fact',
        title: 'Campus Rule 101',
        content: 'No bicycles in hallways.',
      });

      const result = await listKnowledgeCandidatesAction(mockWsId, 'pending');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
      expect(result.data![0].title).toBe('Campus Rule 101');
    });

    it('rejects cross-tenant access with IDOR_VIOLATION (Rule 8)', async () => {
      const result = await listKnowledgeCandidatesAction('ws_unauthorized_other');

      expect(result.success).toBe(false);
      expect(result.error).toBe('IDOR_VIOLATION');
    });

    it('blocks execution when dead-man switch is triggered (Rule 60)', async () => {
      vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockImplementation(() => {
        throw new deadManModule.AgentGovernanceEmergencyPausedError('org_enterprise_1', 'Manual kill switch');
      });

      const result = await listKnowledgeCandidatesAction(mockWsId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('KNOWLEDGE_DEAD_MAN_PAUSED');
    });
  });

  describe('decideKnowledgeCandidateAction', () => {
    it('executes human decision on candidate', async () => {
      const candidateService = getKnowledgeCandidateService();
      const cand = await candidateService.proposeCandidate({
        organizationId: mockOrgId,
        workspaceId: mockWsId,
        source: { type: 'meeting', id: 'm1' },
        type: 'fact',
        title: 'Dress Code Policy',
        content: 'Uniform required on Monday.',
      });

      const result = await decideKnowledgeCandidateAction({
        candidateId: cand.id,
        workspaceId: mockWsId,
        decision: 'accept',
        version: cand.version,
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('accepted');
      expect(result.data?.decidedBy).toBe(mockUserId);
    });
  });

  describe('listKnowledgeConflictsAction & resolveKnowledgeConflictAction', () => {
    it('lists and resolves conflicts for authorized workspace', async () => {
      const conflictService = getKnowledgeConflictService();
      const conflict = await conflictService.createConflictRecord({
        organizationId: mockOrgId,
        workspaceId: mockWsId,
        candidateId: 'cand_c1',
        existingMemoryId: 'mem_c1',
        conflictType: 'contradiction',
      });

      const listResult = await listKnowledgeConflictsAction(mockWsId);
      expect(listResult.success).toBe(true);
      expect(listResult.data?.length).toBeGreaterThanOrEqual(1);

      const resolveResult = await resolveKnowledgeConflictAction({
        conflictId: conflict.id,
        workspaceId: mockWsId,
        resolution: 'keep_both_distinct',
        notes: 'Both variants apply to different faculties',
        version: conflict.version,
      });

      expect(resolveResult.success).toBe(true);
      expect(resolveResult.data?.status).toBe('resolved');
      expect(resolveResult.data?.resolution?.resolutionType).toBe('keep_both_distinct');
    });
  });

  describe('getKnowledgeGraphNeighborsAction', () => {
    it('retrieves graph neighbors adhering to Rule 55 ceilings', async () => {
      const graphService = getKnowledgeGraphProjectionService();
      await graphService.upsertNode({
        id: 'node_action_test',
        label: 'Test Node',
        type: 'entity',
        workspaceId: mockWsId,
      });

      const result = await getKnowledgeGraphNeighborsAction(mockWsId, 'node_action_test', 50, 1);

      expect(result.success).toBe(true);
      expect(result.data?.nodes).toBeDefined();
      expect(result.data?.edges).toBeDefined();
      expect(result.data!.nodes.length).toBeLessThanOrEqual(80);
    });
  });
});
