// @vitest-environment node
/**
 * @fileOverview Meeting Agent shadow runs and rollout ladder (Phase 11 M2 · T5.4; Rules 42, 65).
 * Comparison with the heuristic and people's tasks; the record holds counts only (no text) and
 * expires after 90 days; recording failures never throw; promotion needs a passing evaluation for
 * the current prompt, 20 shadow runs, ≤ 10 % failures and ≤ 120 % cost.
 */
import { describe, it, expect } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import type { Firestore } from 'firebase-admin/firestore';
import {
  MEETING_AGENT_STAGES,
  SHADOW_RUNS,
  compareWithBaselines,
  promotionCheck,
  recordShadowRun,
  type PromotionEvidence,
} from '../intelligence/shadow';

const NOW = Date.parse('2026-10-06T12:00:00.000Z');
const items = [
  { type: 'commitment' as const, text: 'Kofi will send the revised quote by Friday', needsReview: false },
  { type: 'action_item' as const, text: 'Upload the student list by Wednesday', needsReview: true },
  { type: 'action_item' as const, text: 'Book the training room', needsReview: false },
  { type: 'decision' as const, text: 'Move to the annual plan', needsReview: false },
  { type: 'question' as const, text: 'Is the board meeting on the 20th?', needsReview: false },
];

describe('compareWithBaselines', () => {
  it('measures overlap with the heuristic and with what people followed up on, plus the blast radius', () => {
    const c = compareWithBaselines(items, {
      heuristicTitles: ['Kofi: I will send the revised quote by Friday.', 'We need to check the budget'],
      humanTaskTitles: ['Upload student list', 'Call the bursar'],
    });
    expect(c.agent).toEqual({ items: 5, actionable: 3, needsReview: 1, byType: { commitment: 1, action_item: 2, decision: 1, question: 1 } });
    expect(c.heuristic).toEqual({ items: 2, alsoFoundByAgent: 1 });
    expect(c.humanTasks).toEqual({ total: 2, coveredByAgent: 1 });
    expect(c.agentOnlyActionable).toBe(1);
    expect(c.blastRadius).toEqual({ oneClickTasks: 2, reviewFirst: 1, crmProposalCandidates: 1 });
  });
});

describe('recordShadowRun', () => {
  it('stores counts only (no transcript or item text), compares with people’s tasks only, expires after 90 days', async () => {
    const db = new FakeFirestore();
    db.write('tasks/t1', { workspaceId: 'ws-a', relatedEntityId: 'm-1', title: 'Upload student list', source: 'manual' });
    db.write('tasks/t2', { workspaceId: 'ws-a', relatedEntityId: 'm-1', title: 'Book the training room', source: 'system' });
    db.write('tasks/t3', { workspaceId: 'ws-b', relatedEntityId: 'm-1', title: 'Book the training room', source: 'manual' });

    const ok = await recordShadowRun(db.asFirestore(), {
      runId: 'mir_1', workspaceId: 'ws-a', meetingId: 'm-1', promptVersion: 'mi_extract_v1', modelId: 'flash',
      transcriptLines: ['Kofi: I will send the revised quote by Friday.', 'Ama: Thanks.'], items, nowMs: NOW,
    });

    expect(ok).toBe(true);
    const record = db.read(`${SHADOW_RUNS}/mir_1`);
    expect(record).toMatchObject({ workspaceId: 'ws-a', meetingId: 'm-1', promptVersion: 'mi_extract_v1', modelId: 'flash' });
    expect(record?.comparison).toMatchObject({ humanTasks: { total: 1, coveredByAgent: 1 }, heuristic: { items: 1, alsoFoundByAgent: 1 } });
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('revised quote');
    expect(serialized).not.toContain('Upload student list');
    expect((record?.expiresAt as Date).getTime() - NOW).toBe(90 * 24 * 3600 * 1000);
  });

  it('never throws: a failing database just means no record', async () => {
    const broken = { collection: () => { throw new Error('firestore down'); } } as unknown as Firestore;
    await expect(recordShadowRun(broken, {
      runId: 'mir_x', workspaceId: 'ws-a', meetingId: 'm-1', promptVersion: 'v', transcriptLines: [], items: [], nowMs: NOW,
    })).resolves.toBe(false);
  });
});

describe('promotionCheck (ladder)', () => {
  const good: PromotionEvidence = {
    evaluation: { passed: true, fabricated: 0, spanValidity: 1, promptVersion: 'mi_extract_v1' },
    currentPromptVersion: 'mi_extract_v1',
    shadowRuns: 25,
    failureRate: 0.02,
    costRatio: 0.9,
  };

  it('the ladder is shadow → internal beta → canary → limited → delegated', () => {
    expect(MEETING_AGENT_STAGES).toEqual(['shadow', 'internal_beta', 'canary', 'limited', 'delegated']);
  });

  it('promotes one step when every rule holds', () => {
    expect(promotionCheck('shadow', good)).toEqual({ next: 'internal_beta', ok: true, reasons: [] });
    expect(promotionCheck('delegated', good)).toMatchObject({ next: null, ok: false });
  });

  it('lists every unmet rule', () => {
    const res = promotionCheck('canary', {
      evaluation: { passed: false, fabricated: 2, spanValidity: 0.95, promptVersion: 'mi_extract_v0' },
      currentPromptVersion: 'mi_extract_v1',
      shadowRuns: 3,
      failureRate: 0.25,
      costRatio: 1.5,
    });
    expect(res.ok).toBe(false);
    expect(res.reasons).toHaveLength(7);
    expect(promotionCheck('shadow', { ...good, evaluation: null }).reasons).toEqual(['No offline evaluation recorded.']);
  });
});
