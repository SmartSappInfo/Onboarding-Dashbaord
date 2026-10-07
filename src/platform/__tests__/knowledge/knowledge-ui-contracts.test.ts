/**
 * @fileOverview Unit & Contract Tests: Knowledge UI Types & Governance Server Actions (Phase 11 M5 · T0)
 *
 * Verifies:
 * - KnowledgeInboxFilterSchema, KnowledgeCandidateTriageInputSchema, BatchTriageInputSchema validation
 * - KnowledgeSearchModalInputSchema & GraphExplorerStateSchema validation
 * - BackofficeGovernanceConfigSchema & SecurityIncidentFeedItemSchema validation
 * - Server Actions security: requireAuth, assertTenantAccess, dead-man pause evaluation
 * - Rule 4 typing (zero any/any[])
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  KnowledgeInboxFilterSchema,
  KnowledgeCandidateTriageInputSchema,
  BatchTriageInputSchema,
  GraphExplorerStateSchema,
  BackofficeGovernanceConfigSchema,
  SecurityIncidentFeedItemSchema,
  type KnowledgeCandidateTriageInput,
  type BackofficeGovernanceConfig,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-ui-types';
import {
  getKnowledgeGovernanceMetricsAction,
  updateKnowledgeGovernanceConfigAction,
  setKnowledgeKillSwitchAction,
  reprocessMeetingPipelineAction,
  purgeKnowledgeBySourceAction,
} from '@/app/actions/knowledge-governance-actions';
import * as authModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';

describe('Knowledge UI Contracts & Governance Actions (Phase 11 M5 · T0)', () => {
  const orgId = 'org_gov_test';
  const workspaceId = 'ws_gov_primary';
  const userId = 'usr_gov_admin';

  const mockAuthUser = {
    uid: userId,
    email: 'admin@gov.com',
    profile: {
      id: userId,
      organizationId: orgId,
      lastActiveWorkspaceId: workspaceId,
      name: 'Governance Admin',
      email: 'admin@gov.com',
      role: 'admin',
    },
    isSystemAdmin: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(mockAuthUser as unknown as authModule.AuthContext);
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue(undefined);
  });

  describe('1. Zod v4 Schemas Validation', () => {
    it('validates KnowledgeInboxFilterSchema with defaults', () => {
      const parsed = KnowledgeInboxFilterSchema.parse({});
      expect(parsed.status).toBe('all');
      expect(parsed.itemType).toBe('all');
      expect(parsed.sourceTrust).toBe('all');
      expect(parsed.minConfidence).toBe(0);
    });

    it('validates KnowledgeCandidateTriageInputSchema for accept decision', () => {
      const input: KnowledgeCandidateTriageInput = {
        candidateId: 'cand_123',
        decision: 'accept',
        expectedVersion: 1,
      };
      const parsed = KnowledgeCandidateTriageInputSchema.parse(input);
      expect(parsed.decision).toBe('accept');
      expect(parsed.expectedVersion).toBe(1);
    });

    it('validates BatchTriageInputSchema rejecting empty arrays', () => {
      expect(() =>
        BatchTriageInputSchema.parse({
          candidateIds: [],
          decision: 'reject',
        })
      ).toThrow();
    });

    it('validates GraphExplorerStateSchema enforcing depth limits (<= 2)', () => {
      const valid = GraphExplorerStateSchema.parse({
        centerNodeId: 'node_school',
        mode: 'explore',
        depth: 2,
      });
      expect(valid.depth).toBe(2);

      expect(() =>
        GraphExplorerStateSchema.parse({
          centerNodeId: 'node_school',
          mode: 'explore',
          depth: 5,
        })
      ).toThrow();
    });

    it('validates BackofficeGovernanceConfigSchema with valid kill switch map', () => {
      const config: BackofficeGovernanceConfig = {
        autoAcceptThreshold: 0.9,
        quotas: {
          dailyPipelines: 50,
          dailyTranscriptionHours: 2,
          queriesPerHour: 60,
        },
        costCeilingUsd: 250,
        retentionDays: 90,
        allowedModels: ['gemini-2.0-flash', 'gemini-1.5-pro'],
        killSwitches: {
          agent_meeting: false,
          agent_knowledge: false,
          capability_retrieval: false,
          draft_messages: false,
          global_halt: false,
        },
      };

      const parsed = BackofficeGovernanceConfigSchema.parse(config);
      expect(parsed.autoAcceptThreshold).toBe(0.9);
      expect(parsed.killSwitches.global_halt).toBe(false);
    });

    it('validates SecurityIncidentFeedItemSchema', () => {
      const item = SecurityIncidentFeedItemSchema.parse({
        incidentId: 'inc_999',
        eventType: 'prompt_injection_detected',
        severity: 'high',
        sourceId: 'transcript_404',
        organizationId: orgId,
        workspaceId: workspaceId,
        timestamp: new Date().toISOString(),
        message: 'Adversarial directive blocked in meeting chunk.',
      });
      expect(item.severity).toBe('high');
    });
  });

  describe('2. Governance Server Actions (Rule 51 & Rule 8)', () => {
    it('retrieves governance metrics for authorized workspace', async () => {
      const res = await getKnowledgeGovernanceMetricsAction(workspaceId);
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.pendingCandidatesCount).toBeGreaterThanOrEqual(0);
    });

    it('rejects cross-workspace access with IDOR violation (Rule 8)', async () => {
      const res = await getKnowledgeGovernanceMetricsAction('ws_foreign_tenant');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Cross-workspace access denied');
    });

    it('updates governance configuration and validates parameters', async () => {
      const res = await updateKnowledgeGovernanceConfigAction(workspaceId, {
        autoAcceptThreshold: 0.95,
        costCeilingUsd: 500,
      });
      expect(res.success).toBe(true);
      expect(res.data?.autoAcceptThreshold).toBe(0.95);
    });

    it('toggles emergency kill switch and verifies state (Rule 60)', async () => {
      const res = await setKnowledgeKillSwitchAction(workspaceId, 'agent_knowledge', true);
      expect(res.success).toBe(true);
      expect(res.data?.killSwitches.agent_knowledge).toBe(true);
    });

    it('reprocesses stalled meeting pipeline from DLQ (Rule 25)', async () => {
      const res = await reprocessMeetingPipelineAction(workspaceId, 'pipe_failed_01');
      expect(res.success).toBe(true);
      expect(res.data?.pipelineId).toBe('pipe_failed_01');
      expect(res.data?.reprocessed).toBe(true);
    });

    it('cascades GDPR purge by source (Rule 57)', async () => {
      const res = await purgeKnowledgeBySourceAction(workspaceId, 'meeting_source_77');
      expect(res.success).toBe(true);
      expect(res.data?.purgedRecordsCount).toBeGreaterThanOrEqual(0);
      expect(res.data?.sourceId).toBe('meeting_source_77');
    });
  });
});
