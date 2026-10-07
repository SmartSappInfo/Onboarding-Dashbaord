/**
 * @fileOverview Test Suite: Human-in-the-Loop Review Queue & Non-Delegable Decider (Phase 11 M3 · T2)
 *
 * Enforces Rule 17 (Non-Delegable Human Decider),
 * Rule 18 (TOCTOU Version Token Freshness),
 * Rule 40 (Domain Event Publishing),
 * Rule 21 & 22 (Governed Decision Lifecycle).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  KnowledgeCandidateService,
} from '../../domains/knowledge_memory/services/knowledge-candidate-service';
import {
  knowledgeReviewQueueDecideCapability,
} from '../../domains/knowledge_memory/contracts/knowledge-capabilities.contract';
import { defaultEventBus } from '../../events/event-bus';

describe('Knowledge Review Queue & Non-Delegable Decider (Phase 11 M3 · T2)', () => {
  let service: KnowledgeCandidateService;

  beforeEach(() => {
    service = new KnowledgeCandidateService();
  });

  it('allows an authenticated human operator to accept a candidate', async () => {
    const publishSpy = vi.spyOn(defaultEventBus, 'publish');

    const candidate = await service.proposeCandidate({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      source: { type: 'meeting', id: 'm1' },
      type: 'fact',
      title: 'Valid School Fact',
      content: 'Academic year begins in September.',
    });

    const decided = await service.decideCandidate(
      {
        candidateId: candidate.id,
        workspaceId: 'ws_test_1',
        decision: 'accept',
        version: candidate.version,
      },
      {
        id: 'usr_human_admin_01',
        type: 'user',
        permissions: ['knowledge:review'],
      }
    );

    expect(decided.status).toBe('accepted');
    expect(decided.verificationState).toBe('verified');
    expect(decided.decidedBy).toBe('usr_human_admin_01');
    expect(decided.version).toBe(2);

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'knowledge.candidate.decided',
        payload: expect.objectContaining({
          candidateId: candidate.id,
          decision: 'accept',
          status: 'accepted',
          decidedBy: 'usr_human_admin_01',
        }),
      })
    );
  });

  it('allows an authenticated human to accept_with_edit and updates text in XML container', async () => {
    const candidate = await service.proposeCandidate({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      source: { type: 'meeting', id: 'm2' },
      type: 'fact',
      title: 'Draft Fact',
      content: 'Tuition is 5,000 USD.',
    });

    const decided = await service.decideCandidate(
      {
        candidateId: candidate.id,
        workspaceId: 'ws_test_1',
        decision: 'accept_with_edit',
        editedTitle: 'Tuition Fee 2026/2027',
        editedContent: 'Tuition is 5,500 USD per semester.',
        reason: 'Adjusted per latest bursar notes',
        version: candidate.version,
      },
      {
        id: 'usr_human_admin_01',
        type: 'user',
        permissions: ['knowledge:review'],
      }
    );

    expect(decided.status).toBe('accepted');
    expect(decided.title).toBe('Tuition Fee 2026/2027');
    expect(decided.content).toContain('Tuition is 5,500 USD per semester.');
    expect(decided.content).toContain('<untrusted_reference_data');
    expect(decided.decisionReason).toBe('Adjusted per latest bursar notes');
  });

  it('allows an authenticated human to reject a candidate', async () => {
    const candidate = await service.proposeCandidate({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      source: { type: 'note', id: 'n1' },
      type: 'fact',
      title: 'Dubious Fact',
      content: 'Campus closed indefinitely.',
    });

    const decided = await service.decideCandidate(
      {
        candidateId: candidate.id,
        workspaceId: 'ws_test_1',
        decision: 'reject',
        reason: 'False information / hallucination',
        version: candidate.version,
      },
      {
        id: 'usr_human_admin_01',
        type: 'user',
        permissions: ['knowledge:review'],
      }
    );

    expect(decided.status).toBe('rejected');
    expect(decided.verificationState).toBe('rejected');
    expect(decided.decisionReason).toBe('False information / hallucination');
  });

  it('strictly rejects AI agent or sub-agent callers with NON_DELEGABLE_ACTION (Rule 17 Non-Negotiable)', async () => {
    const candidate = await service.proposeCandidate({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      source: { type: 'meeting', id: 'm3' },
      type: 'fact',
      title: 'Autonomous Proposal',
      content: 'Agent proposing fact.',
    });

    await expect(
      service.decideCandidate(
        {
          candidateId: candidate.id,
          workspaceId: 'ws_test_1',
          decision: 'accept',
          version: candidate.version,
        },
        {
          id: 'agent_meeting_analyst_01',
          type: 'agent', // AI Agent caller
        }
      )
    ).rejects.toThrow(/NON_DELEGABLE_ACTION/);
  });

  it('rejects duplicate decisions on already decided candidates', async () => {
    const candidate = await service.proposeCandidate({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      source: { type: 'meeting', id: 'm4' },
      type: 'fact',
      title: 'Single Decision Only',
      content: 'Some statement.',
    });

    // First decision: accept
    await service.decideCandidate(
      {
        candidateId: candidate.id,
        workspaceId: 'ws_test_1',
        decision: 'accept',
        version: candidate.version,
      },
      { id: 'usr_1', type: 'user' }
    );

    // Second decision attempt: throws CANDIDATE_ALREADY_DECIDED
    await expect(
      service.decideCandidate(
        {
          candidateId: candidate.id,
          workspaceId: 'ws_test_1',
          decision: 'reject',
          version: candidate.version + 1,
        },
        { id: 'usr_1', type: 'user' }
      )
    ).rejects.toThrow(/CANDIDATE_ALREADY_DECIDED/);
  });

  it('enforces TOCTOU version token check (Rule 18)', async () => {
    const candidate = await service.proposeCandidate({
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      source: { type: 'meeting', id: 'm5' },
      type: 'fact',
      title: 'Versioned Candidate',
      content: 'Statement.',
    });

    await expect(
      service.decideCandidate(
        {
          candidateId: candidate.id,
          workspaceId: 'ws_test_1',
          decision: 'accept',
          version: 999, // Stale/mismatched version
        },
        { id: 'usr_1', type: 'user' }
      )
    ).rejects.toThrow(/VERSION_MISMATCH/);
  });

  it('enforces capability risk metadata and nonDelegable flag on knowledge.review_queue.decide', () => {
    expect(knowledgeReviewQueueDecideCapability.id).toBe('knowledge.review_queue.decide');
    expect(knowledgeReviewQueueDecideCapability.risk.level).toBe('L2_STATE_MUTATION');
    expect(knowledgeReviewQueueDecideCapability.risk.nonDelegable).toBe(true);
    expect(knowledgeReviewQueueDecideCapability.policies.requiresExpectedVersion).toBe(true);
  });
});
