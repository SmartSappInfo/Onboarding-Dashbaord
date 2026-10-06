/**
 * @fileOverview Scripted extraction model for the hermetic CI evaluation (Phase 11 M2 · T5.3; D18).
 *
 * Reads the line ids of the chunk out of the real prompt and answers with the case's gold items
 * whose lines are in that chunk, the way a correct model would (exact quotes, owner, due words,
 * amounts). It also emits the case's traps (invented quotes, unknown lines, too-short quotes) so CI
 * proves validation drops them. `mutate` lets tests make it worse on purpose (the gates must fail).
 *
 * This measures the pipeline and the scorer, not model quality; the real model is scored offline
 * by `scripts/eval-meeting-agent.ts` under a capped budget.
 */

import type { IntelligenceModel } from '../pipeline';
import type { EvalCase, GoldItem, TrapItem } from './eval-types';

type RawItem = {
  type: string;
  text: string;
  ownerName?: string;
  dueText?: string;
  amountValue?: number;
  amountCurrency?: string;
  confidence: number;
  evidence: Array<{ segmentIds: string[]; quote: string }>;
};

const fromGold = (g: GoldItem): RawItem => ({
  type: g.type,
  text: g.text,
  ...(g.ownerName ? { ownerName: g.ownerName } : {}),
  ...(g.dueText ? { dueText: g.dueText } : {}),
  ...(g.amountValue !== undefined ? { amountValue: g.amountValue } : {}),
  ...(g.amountCurrency ? { amountCurrency: g.amountCurrency } : {}),
  confidence: 0.9,
  evidence: [{ segmentIds: g.lines.map((n) => `s${n}`), quote: g.quote }],
});

const fromTrap = (t: TrapItem): RawItem => ({ type: t.type, text: t.text, confidence: 0.9, evidence: [{ segmentIds: t.segmentIds, quote: t.quote }] });

export function createScriptedModel(
  cases: readonly EvalCase[],
  options: { mutate?: (caseId: string, items: RawItem[]) => RawItem[] } = {}
): IntelligenceModel & { calls: number } {
  const byTitle = new Map(cases.map((c) => [c.title, c]));
  const trapsSent = new Set<string>();
  const model = {
    breakerKey: 'eval_scripted',
    calls: 0,
    async extract(request: { prompt: string }) {
      model.calls += 1;
      const title = /^Meeting: (.*) \(\d{4}-\d{2}-\d{2}\)/m.exec(request.prompt)?.[1] ?? '';
      const c = byTitle.get(title);
      if (!c) return { output: { items: [] }, modelId: 'scripted' };
      const inChunk = new Set([...request.prompt.matchAll(/^\[(s\d+)\]/gm)].map((m) => m[1]));
      let items = c.gold.filter((g) => g.lines.every((n) => inChunk.has(`s${n}`))).map(fromGold);
      // Traps go out once per case, with the chunk that holds their first cited line (or the first chunk).
      if (!trapsSent.has(c.id) && (c.traps ?? []).length > 0) {
        trapsSent.add(c.id);
        items = [...items, ...(c.traps ?? []).map(fromTrap)];
      }
      if (options.mutate) items = options.mutate(c.id, items);
      return { output: { items }, modelId: 'scripted', inputTokens: Math.ceil(request.prompt.length / 4), outputTokens: 50 * items.length };
    },
    async summarize() {
      return { output: null, modelId: 'scripted' };
    },
  };
  return model;
}
