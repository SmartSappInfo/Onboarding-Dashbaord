/**
 * @fileOverview Meeting Agent evaluation: case and report types (Phase 11 M2 · T5; Rules 42, 44, 59).
 *
 * A case is a short transcript (one line = one segment, ids `s1`, `s2`, …) with the items a careful
 * person would record ("gold"), each tied to the lines that support it. Cases also carry:
 * - `forbidden`: phrases that must never appear in an item (instructions hidden in the transcript);
 * - `traps`: extra raw items the scripted CI model emits that validation MUST drop (invented
 *   quotes, unknown lines, quotes too short). The real model never sees them.
 *
 * Tests: src/lib/meetings/__tests__/meeting-agent-eval.test.ts
 */

import type { MeetingItemType } from '../intelligence-schemas';

export const EVAL_TAGS = [
  'sales', 'onboarding', 'support', 'renewal',
  'english', 'french', 'twi_mixed',
  'no_decision', 'injection', 'contradiction', 'relative_dates', 'ambiguous_currency', 'long',
] as const;
export type EvalTag = (typeof EVAL_TAGS)[number];

export interface GoldItem {
  type: MeetingItemType;
  text: string;
  /** 1-based line numbers that support the item. */
  lines: number[];
  /** Exact words from one of those lines (≥ 3 words): what a correct model would quote. */
  quote: string;
  ownerName?: string;
  dueText?: string;
  amountValue?: number;
  amountCurrency?: string;
}

export interface TrapItem {
  type: MeetingItemType;
  text: string;
  segmentIds: string[];
  quote: string;
  /** The drop reason validation must give it. */
  expectedDrop: 'quote_not_found' | 'unknown_segment' | 'quote_too_short';
}

export interface EvalCase {
  id: string;
  title: string;
  tags: EvalTag[];
  meetingIso: string;
  timeZone: string;
  /** [speaker, text] per line. */
  lines: Array<[string, string]>;
  gold: GoldItem[];
  forbidden?: string[];
  traps?: TrapItem[];
}

/** Types whose items lead to actions; fabricated items of these types fail the gate. */
export const ACTION_DRIVING_TYPES: readonly MeetingItemType[] = ['decision', 'commitment', 'action_item'];

export interface TypeScore {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface CaseResult {
  caseId: string;
  tags: EvalTag[];
  kept: number;
  matched: number;
  missed: Array<{ type: MeetingItemType; text: string }>;
  fabricated: Array<{ type: MeetingItemType; text: string }>;
  extras: number;
  invalidSpans: number;
  forbiddenEchoes: number;
  /** An injection case whose kept items were not all routed to review. */
  injectionUnreviewed: number;
  droppedUnsupported: number;
  trapsNotDropped: number;
  unnecessaryModelCalls: number;
  modelCalls: number;
  chunks: number;
  inputTokens: number;
  outputTokens: number;
}

export interface EvalGates {
  minF1: Partial<Record<MeetingItemType, number>>;
  spanValidity: number;
  maxFabricated: number;
}

export const DEFAULT_GATES: EvalGates = {
  minF1: { decision: 0.8, commitment: 0.8 },
  spanValidity: 1,
  maxFabricated: 0,
};

export interface EvalReport {
  promptVersion: string;
  modelId: string;
  cases: CaseResult[];
  perType: Partial<Record<MeetingItemType, TypeScore>>;
  spanValidity: number;
  fabricated: number;
  forbiddenEchoes: number;
  injectionUnreviewed: number;
  trapsNotDropped: number;
  unnecessaryModelCalls: number;
  inputTokens: number;
  outputTokens: number;
  gates: { passed: boolean; failures: string[] };
}
