/**
 * @fileOverview Re-summarize stored analysis (Phase 11 M2 · T3.2; `meeting.summarize`; Rules 18, 31).
 *
 * Builds a new summary from the meeting's VALIDATED items only (never the transcript), keeps only
 * sentences that cite real items, and saves it with a version check so a concurrent change is
 * refused instead of overwritten. Same consent / AI-use / data-policy checks as the pipeline.
 *
 * Tests: src/lib/meetings/__tests__/intelligence-summary.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { CircuitBreaker } from '@/platform/events/resilience/circuit-breaker';
import { INTELLIGENCE, IntelligenceHeaderV2Schema, readIntelligenceV2, type IntelligenceHeaderV2 } from './intelligence-store';
import { SUMMARY_PROMPT_VERSION, buildSummaryPrompt } from './prompts';
import { assertAnalysable, IntelligenceRequestError, SUMMARY_DEADLINE_MS, withDeadline, type IntelligenceModel } from './pipeline';
import { validateSummary } from './validate-items';

export class SummaryVersionConflictError extends Error {
  constructor() {
    super('The analysis changed since you opened it. Reload and try again.');
    this.name = 'SummaryVersionConflictError';
  }
}

const defaultBreaker = new CircuitBreaker();

export interface ResummarizeParams {
  workspaceId: string;
  organizationId?: string;
  meetingId: string;
  /** The header version the caller saw (Rule 18). */
  expectedVersion?: number;
}

export async function resummarizeIntelligence(
  db: Firestore,
  deps: { model: IntelligenceModel; nowMs: () => number; breaker?: CircuitBreaker; deadlineMs?: number },
  params: ResummarizeParams
): Promise<{ summary: IntelligenceHeaderV2['summary']; version: number }> {
  const current = await readIntelligenceV2(db, params.meetingId, params.workspaceId);
  if (!current) throw new IntelligenceRequestError('NOT_FOUND', 'No analysis found for this meeting. Analyse it first.');
  if (params.expectedVersion !== undefined && params.expectedVersion !== current.header.version) throw new SummaryVersionConflictError();
  await assertAnalysable(db, { ...params, transcriptId: current.header.transcriptId });
  if (current.items.length === 0) throw new IntelligenceRequestError('VALIDATION', 'There are no outcomes to summarize.');

  const res = await (deps.breaker ?? defaultBreaker).execute('meeting_intelligence:summary', () =>
    withDeadline((signal) => deps.model.summarize({
      prompt: buildSummaryPrompt(current.items),
      workspaceId: params.workspaceId,
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      signal,
    }), deps.deadlineMs ?? SUMMARY_DEADLINE_MS)
  );
  const validated = validateSummary(res.output, current.items);
  const summary = validated ? { sentences: validated.sentences, promptVersion: SUMMARY_PROMPT_VERSION } : null;

  const ref = db.collection(INTELLIGENCE).doc(params.meetingId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const header = snap.exists ? IntelligenceHeaderV2Schema.safeParse(snap.data()) : null;
    if (!header?.success || header.data.workspaceId !== params.workspaceId || header.data.version !== current.header.version) {
      throw new SummaryVersionConflictError();
    }
    const nowIso = new Date(deps.nowMs()).toISOString();
    const next: IntelligenceHeaderV2 = { ...header.data, summary, version: header.data.version + 1, updatedAt: nowIso };
    tx.set(ref, next);
    return { summary, version: next.version };
  });
}
