/**
 * @fileOverview Unit & Contract Tests: Standup & Blocker Capabilities (Phase 4)
 *
 * Validates Rule 4 (Strict Typing), Rule 12 (Server-side validation),
 * Rule 18 (TOCTOU expectedUpdatedAt), and Rule 19/20 (Idempotency).
 */

import { describe, it, expect } from 'vitest';
import { 
  StandupSubmitInputSchema, 
  standupSubmitCapability 
} from '../standup-submit.contract';
import { 
  BlockerMutateInputSchema, 
  blockerMutateCapability 
} from '../blocker-mutate.contract';

describe('Standup Submission Contract (Roadmap §49-60, PRD STN-01..04)', () => {
  it('validates a correct standup submission payload', () => {
    const validPayload = {
      workspaceId: 'ws-123',
      userId: 'usr-1',
      date: '2026-10-09',
      status: 'submitted' as const,
      completedWork: [
        {
          id: 'item-1',
          type: 'task' as const,
          title: 'Finalized onboarding doc',
          taskId: 'task-10',
          isCarryover: false,
        },
      ],
      plannedWork: [
        {
          id: 'item-2',
          type: 'commitment' as const,
          title: 'Review pricing matrix with finance',
          isCarryover: true,
          originalCommitmentDate: '2026-10-08',
          carryoverReason: 'Meeting rescheduled',
        },
      ],
      blockers: [
        {
          id: 'blk-1',
          summary: 'Waiting on client approval',
          category: 'client_approval' as const,
          severity: 'medium' as const,
          affectedTaskId: 'task-10',
        },
      ],
      helpNeeded: 'Need sign-off on pricing tier B',
      privateManagerNote: 'Discuss career pathing in next 1:1',
      idempotencyKey: 'idem-stn-999',
    };

    const parsed = StandupSubmitInputSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.workspaceId).toBe('ws-123');
      expect(parsed.data.completedWork.length).toBe(1);
      expect(parsed.data.plannedWork[0].isCarryover).toBe(true);
      expect(parsed.data.idempotencyKey).toBe('idem-stn-999');
    }
  });

  it('rejects standup submission with missing required workspaceId or date', () => {
    const invalidPayload = {
      userId: 'usr-1',
      completedWork: [],
      plannedWork: [],
      blockers: [],
    };

    const parsed = StandupSubmitInputSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it('declares capability metadata correctly', () => {
    expect(standupSubmitCapability.id).toBe('standup.submit');
    expect(standupSubmitCapability.risk.level).toBe('L2_STATE_MUTATION');
    expect(standupSubmitCapability.workspaceScoped).toBe(true);
  });
});

describe('Blocker Mutation Contract (Roadmap §54-55, PRD BLK-01)', () => {
  it('validates an acknowledge mutation with owner assignment', () => {
    const validMutation = {
      workspaceId: 'ws-123',
      blockerId: 'blk-101',
      action: 'acknowledge' as const,
      ownerId: 'lead-user-5',
      expectedUpdatedAt: '2026-10-09T08:00:00.000Z',
      idempotencyKey: 'idem-blk-888',
    };

    const parsed = BlockerMutateInputSchema.safeParse(validMutation);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.action).toBe('acknowledge');
      expect(parsed.data.ownerId).toBe('lead-user-5');
      expect(parsed.data.expectedUpdatedAt).toBe('2026-10-09T08:00:00.000Z');
    }
  });

  it('validates a resolve mutation requiring a resolution note', () => {
    const validResolve = {
      workspaceId: 'ws-123',
      blockerId: 'blk-101',
      action: 'resolve' as const,
      resolutionNote: 'Client signed the addendum via DocSigning.',
      idempotencyKey: 'idem-blk-889',
    };

    const parsed = BlockerMutateInputSchema.safeParse(validResolve);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.resolutionNote).toBe('Client signed the addendum via DocSigning.');
    }
  });

  it('declares blocker capability metadata correctly', () => {
    expect(blockerMutateCapability.id).toBe('blocker.mutate');
    expect(blockerMutateCapability.risk.level).toBe('L2_STATE_MUTATION');
  });
});
