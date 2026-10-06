/**
 * @fileOverview Meeting Agent shadow runs and rollout ladder (Phase 11 M2 · T5.4; plan §9; Rules 42, 65).
 *
 * SHADOW RECORD: after a run completes, its validated items are compared with
 * - the old keyword heuristic (`extractActionItemsFromTranscript`, the baseline it replaces), and
 * - the tasks PEOPLE created for the meeting (what the team actually followed up on),
 * plus a blast-radius report (what one-click actions the items would enable). The record goes to
 * `meeting_agent_shadow_runs/{runId}` (server-only, never shown in the product, `expiresAt` 90 d for
 * the TTL policy). Ids, counts and ratios only; no transcript or item text is stored.
 * Recording is best-effort: it can never fail or slow down a run beyond one write.
 *
 * LADDER: shadow → internal_beta → canary → limited → delegated. `promotionCheck` says whether a
 * workspace may move to the next stage, from the latest offline evaluation and recent shadow
 * runs, using the canary rules (fabricated 0, span validity 100 %, failures ≤ 10 %, cost ≤ 120 % of
 * forecast). Operators promote in the Backoffice (T7); promotion is never automatic.
 *
 * Tests: src/lib/meetings/__tests__/meeting-agent-shadow.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { extractActionItemsFromTranscript } from '../action-items-service';
import { ACTIONABLE_ITEM_TYPES, type MeetingItem, type MeetingItemType } from './intelligence-schemas';
import { normalizeForMatch } from './text-normalize';

export const SHADOW_RUNS = 'meeting_agent_shadow_runs';
export const SHADOW_RETENTION_DAYS = 90;
const MATCH_OVERLAP = 0.5;

export const MEETING_AGENT_STAGES = ['shadow', 'internal_beta', 'canary', 'limited', 'delegated'] as const;
export type MeetingAgentStage = (typeof MEETING_AGENT_STAGES)[number];

export const STAGE_DESCRIPTIONS: Readonly<Record<MeetingAgentStage, string>> = {
  shadow: 'Runs and is measured; nothing is shown or acted on.',
  internal_beta: 'Shown to the internal team only.',
  canary: 'One customer workspace, watched closely.',
  limited: 'Selected workspaces; people act on every suggestion.',
  delegated: 'Agents may create tasks and drafts for people (never send or change CRM records without approval).',
};

const words = (text: string) => new Set(normalizeForMatch(text).split(' ').filter((w) => w.length > 2));
function similar(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared / Math.min(wa.size, wb.size) >= MATCH_OVERLAP;
}

export const ShadowComparisonSchema = z.object({
  agent: z.object({
    items: z.number().int(),
    actionable: z.number().int(),
    needsReview: z.number().int(),
    byType: z.record(z.string(), z.number().int()),
  }),
  heuristic: z.object({ items: z.number().int(), alsoFoundByAgent: z.number().int() }),
  humanTasks: z.object({ total: z.number().int(), coveredByAgent: z.number().int() }),
  /** Agent action items that neither people nor the heuristic produced (new signal, or noise). */
  agentOnlyActionable: z.number().int(),
  blastRadius: z.object({
    oneClickTasks: z.number().int(),
    reviewFirst: z.number().int(),
    crmProposalCandidates: z.number().int(),
  }),
});
export type ShadowComparison = z.infer<typeof ShadowComparisonSchema>;

/** Pure comparison (no I/O). */
export function compareWithBaselines(
  items: readonly Pick<MeetingItem, 'type' | 'text' | 'needsReview'>[],
  baselines: { heuristicTitles: readonly string[]; humanTaskTitles: readonly string[] }
): ShadowComparison {
  const actionable = items.filter((i) => ACTIONABLE_ITEM_TYPES.includes(i.type));
  const byType: Partial<Record<MeetingItemType, number>> = {};
  for (const i of items) byType[i.type] = (byType[i.type] ?? 0) + 1;

  const heuristicFound = baselines.heuristicTitles.filter((h) => actionable.some((a) => similar(a.text, h))).length;
  const humanCovered = baselines.humanTaskTitles.filter((t) => actionable.some((a) => similar(a.text, t))).length;
  const agentOnly = actionable.filter((a) =>
    !baselines.heuristicTitles.some((h) => similar(a.text, h)) && !baselines.humanTaskTitles.some((t) => similar(a.text, t))
  ).length;

  return {
    agent: {
      items: items.length,
      actionable: actionable.length,
      needsReview: items.filter((i) => i.needsReview).length,
      byType,
    },
    heuristic: { items: baselines.heuristicTitles.length, alsoFoundByAgent: heuristicFound },
    humanTasks: { total: baselines.humanTaskTitles.length, coveredByAgent: humanCovered },
    agentOnlyActionable: agentOnly,
    blastRadius: {
      oneClickTasks: actionable.filter((a) => !a.needsReview).length,
      reviewFirst: actionable.filter((a) => a.needsReview).length,
      crmProposalCandidates: items.filter((i) => i.type === 'decision' && !i.needsReview).length,
    },
  };
}

const HumanTaskSchema = z.object({ title: z.string().catch(''), source: z.string().optional().catch(undefined) }).loose();

/** Writes the shadow record for a completed run. Best-effort: logs and returns false on any error. */
export async function recordShadowRun(
  db: Firestore,
  params: {
    runId: string;
    workspaceId: string;
    meetingId: string;
    promptVersion: string;
    modelId?: string;
    transcriptLines: readonly string[];
    items: readonly Pick<MeetingItem, 'type' | 'text' | 'needsReview'>[];
    nowMs: number;
  }
): Promise<boolean> {
  try {
    const heuristic = extractActionItemsFromTranscript(params.transcriptLines.join('\n'), params.meetingId, params.workspaceId);
    const tasks = await db.collection('tasks')
      .where('workspaceId', '==', params.workspaceId)
      .where('relatedEntityId', '==', params.meetingId)
      .limit(200)
      .get();
    // People's tasks only: tasks created from meeting items are `source: 'system'`.
    const humanTaskTitles = tasks.docs
      .map((d) => HumanTaskSchema.safeParse(d.data()))
      .filter((t) => t.success && t.data.source !== 'system' && t.data.title)
      .map((t) => (t.success ? t.data.title : ''));
    const comparison = compareWithBaselines(params.items, { heuristicTitles: heuristic.map((h) => h.description), humanTaskTitles });
    await db.collection(SHADOW_RUNS).doc(params.runId).set({
      runId: params.runId,
      workspaceId: params.workspaceId,
      meetingId: params.meetingId,
      promptVersion: params.promptVersion,
      ...(params.modelId ? { modelId: params.modelId } : {}),
      comparison,
      createdAt: new Date(params.nowMs).toISOString(),
      expiresAt: new Date(params.nowMs + SHADOW_RETENTION_DAYS * 24 * 3600 * 1000),
    });
    return true;
  } catch (err) {
    console.warn('[meeting-shadow] could not record shadow run', { runId: params.runId, error: err instanceof Error ? err.name : 'error' });
    return false;
  }
}

export interface PromotionEvidence {
  /** Latest offline evaluation (scripts/eval-meeting-agent.ts) for the current prompt version. */
  evaluation: { passed: boolean; fabricated: number; spanValidity: number; promptVersion: string } | null;
  currentPromptVersion: string;
  shadowRuns: number;
  /** Runs failed or dead-lettered / runs started, over the observation window. */
  failureRate: number;
  /** Actual cost / forecast cost over the window (1 = on forecast). */
  costRatio: number;
}

export const PROMOTION_RULES = {
  minShadowRuns: 20,
  maxFailureRate: 0.1,
  maxCostRatio: 1.2,
} as const;

/** May this workspace move from `stage` to the next one? Lists every unmet condition. */
export function promotionCheck(stage: MeetingAgentStage, evidence: PromotionEvidence): { next: MeetingAgentStage | null; ok: boolean; reasons: string[] } {
  const index = MEETING_AGENT_STAGES.indexOf(stage);
  const next = index >= 0 && index < MEETING_AGENT_STAGES.length - 1 ? MEETING_AGENT_STAGES[index + 1] : null;
  if (!next) return { next: null, ok: false, reasons: ['Already at the last stage.'] };

  const reasons: string[] = [];
  const evaluation = evidence.evaluation;
  if (!evaluation) reasons.push('No offline evaluation recorded.');
  else {
    if (evaluation.promptVersion !== evidence.currentPromptVersion) reasons.push(`The evaluation is for prompt ${evaluation.promptVersion}, not ${evidence.currentPromptVersion}.`);
    if (!evaluation.passed) reasons.push('The latest evaluation failed its gates.');
    if (evaluation.fabricated > 0) reasons.push(`${evaluation.fabricated} fabricated item(s) in the evaluation.`);
    if (evaluation.spanValidity < 1) reasons.push('Span validity below 100%.');
  }
  if (evidence.shadowRuns < PROMOTION_RULES.minShadowRuns) reasons.push(`Only ${evidence.shadowRuns} shadow run(s); ${PROMOTION_RULES.minShadowRuns} needed.`);
  if (evidence.failureRate > PROMOTION_RULES.maxFailureRate) reasons.push(`Failure rate ${(evidence.failureRate * 100).toFixed(0)}% is above 10%.`);
  if (evidence.costRatio > PROMOTION_RULES.maxCostRatio) reasons.push(`Cost is ${(evidence.costRatio * 100).toFixed(0)}% of forecast (limit 120%).`);
  return { next, ok: reasons.length === 0, reasons };
}
