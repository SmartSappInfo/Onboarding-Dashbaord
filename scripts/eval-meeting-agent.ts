/**
 * Offline Meeting Agent evaluation with the REAL model, under a capped budget (Phase 11 M2 · T5.3; D18).
 *
 * Runs the gold meetings in `src/lib/meetings/intelligence/eval/eval-dataset.ts` through the
 * production extraction path (chunking, versioned prompt, injection scan, validation) and the
 * policy-checked model caller, then scores them. Required before a prompt or model canary
 * (Rule 65): decision/commitment F1 ≥ 0.8, span validity 100 %, fabricated = 0.
 *
 * Costs money: every case is one or more model calls. The run stops at `--max-tokens` (input +
 * output, default 200 000) and at `--max-cases`. The data policy of `--workspace` decides which
 * provider may be used; content is synthetic (no customer data).
 *
 *   pnpm eval:meeting-agent --workspace <workspaceId> [--org <organizationId>] [--max-cases 22] \
 *     [--max-tokens 200000] [--cases id1,id2] [--out reports/meeting-eval.json]
 *   pnpm eval:meeting-agent --scripted          # no model calls: checks the harness only
 *
 * Exit code 1 when a gate fails or the budget cut the run short.
 */
import * as dotenv from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MEETING_EVAL_CASES } from '../src/lib/meetings/intelligence/eval/eval-dataset';
import { runEvaluation } from '../src/lib/meetings/intelligence/eval/eval-runner';
import { createScriptedModel } from '../src/lib/meetings/intelligence/eval/scripted-model';
import type { IntelligenceModel } from '../src/lib/meetings/intelligence/pipeline';

dotenv.config({ path: '.env.local' });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function positiveInt(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a positive integer`);
  return n;
}

async function realModel(workspaceId: string): Promise<IntelligenceModel> {
  const { adminDb } = await import('../src/lib/firebase-admin');
  const { createMeetingModelCaller, EXTRACT_MAX_OUTPUT_TOKENS, EXTRACT_TIER, ExtractOutputSchema } = await import('../src/lib/meetings/intelligence/model-caller');
  const call = createMeetingModelCaller(adminDb);
  console.log(`Real model, data policy of workspace ${workspaceId}.`);
  return {
    breakerKey: 'meeting_eval',
    extract: (request) => call(request, EXTRACT_TIER, ExtractOutputSchema, EXTRACT_MAX_OUTPUT_TOKENS),
    summarize: async () => {
      throw new Error('The evaluation scores extraction only.');
    },
  };
}

async function main(): Promise<void> {
  const scripted = flag('scripted');
  const workspaceId = arg('workspace');
  if (!scripted && !workspaceId) throw new Error('--workspace is required (its AI data policy decides the provider). Use --scripted for a free harness check.');

  const only = arg('cases')?.split(',').map((s) => s.trim()).filter(Boolean);
  const cases = only ? MEETING_EVAL_CASES.filter((c) => only.includes(c.id)) : MEETING_EVAL_CASES;
  if (cases.length === 0) throw new Error('No matching cases.');
  const maxCases = positiveInt('max-cases', cases.length);
  const maxTokens = positiveInt('max-tokens', 200_000);

  const model = scripted ? createScriptedModel(cases) : await realModel(workspaceId ?? '');
  const report = await runEvaluation(cases, model, {
    nowIso: new Date().toISOString(),
    ...(workspaceId ? { workspaceId } : {}),
    ...(arg('org') ? { organizationId: arg('org') } : {}),
    maxCases,
    maxTokens,
  });

  console.log(`\nModel ${report.modelId} · prompt ${report.promptVersion} · ${report.cases.length}/${cases.length} cases · tokens ${report.inputTokens} in / ${report.outputTokens} out`);
  console.table(Object.fromEntries(Object.entries(report.perType).map(([type, s]) => [type, {
    tp: s.tp, fp: s.fp, fn: s.fn, precision: s.precision.toFixed(2), recall: s.recall.toFixed(2), f1: s.f1.toFixed(2),
  }])));
  console.log(`Span validity ${(report.spanValidity * 100).toFixed(1)}% · fabricated ${report.fabricated} · hidden-instruction echoes ${report.forbiddenEchoes} · injection not in review ${report.injectionUnreviewed} · extra model calls ${report.unnecessaryModelCalls}`);
  for (const c of report.cases) {
    if (c.missed.length || c.fabricated.length) {
      console.log(`- ${c.caseId}: missed ${c.missed.map((m) => `${m.type} "${m.text}"`).join('; ') || 'none'} | fabricated ${c.fabricated.map((f) => `${f.type} "${f.text}"`).join('; ') || 'none'}`);
    }
  }

  const out = arg('out');
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ ranAt: new Date().toISOString(), scripted, ...report }, null, 2));
    console.log(`Report written to ${out}`);
  }

  if (report.stoppedForBudget) console.log(`Stopped at the token budget (${maxTokens}). Results cover the cases run so far.`);
  console.log(report.gates.passed && !report.stoppedForBudget ? '\nGATES PASSED' : `\nGATES FAILED: ${[...report.gates.failures, ...(report.stoppedForBudget ? ['budget reached before all cases ran'] : [])].join(' · ')}`);
  process.exit(report.gates.passed && !report.stoppedForBudget ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
