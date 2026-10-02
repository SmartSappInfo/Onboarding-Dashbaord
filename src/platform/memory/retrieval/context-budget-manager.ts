/**
 * @fileOverview Stratified 4-Tier Context Budget Manager (Phase 4 Milestone 2)
 *
 * ARCHITECTURAL INVARIANTS (Rules 4, 9, 28, 56):
 * 1. Strict Token Ceiling Enforcement: Context packs never exceed maxTokens (default 4000).
 * 2. 4-Tier Priority Stratification: Tier 1 (Critical) -> Tier 2 (Relevant) -> Tier 3 (Supporting) -> Tier 4 (Discoverable).
 * 3. Greedy Knapsack Allocation: Packs high-importance items first while respecting token ceilings.
 * 4. Zero-`any` typing with strict contracts and interfaces.
 *
 * @testability Covered in `src/platform/__tests__/memory/context-budget-manager.test.ts`.
 */

export interface BudgetableCandidate {
  id: string;
  tier: 1 | 2 | 3 | 4; // 1: Critical, 2: Relevant, 3: Supporting, 4: Discoverable
  title?: string;
  content: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface BudgetPackOptions {
  maxTokens?: number;
  charsPerToken?: number;
}

export interface TierAllocationSummary {
  tier: 1 | 2 | 3 | 4;
  tokensUsed: number;
  itemCount: number;
}

export interface ContextBudgetResult {
  budgetedCandidates: BudgetableCandidate[];
  totalTokens: number;
  maxTokens: number;
  truncatedCount: number;
  tierBreakdown: Record<1 | 2 | 3 | 4, TierAllocationSummary>;
}

export class StratifiedContextBudgetManager {
  public static readonly DEFAULT_MAX_TOKENS = 4000;
  public static readonly DEFAULT_CHARS_PER_TOKEN = 4.0;

  public static estimateTokens(text: string, charsPerToken: number = StratifiedContextBudgetManager.DEFAULT_CHARS_PER_TOKEN): number {
    if (!text) return 0;
    return Math.ceil(text.length / charsPerToken);
  }

  public static estimateCandidateTokens(candidate: BudgetableCandidate, charsPerToken: number = StratifiedContextBudgetManager.DEFAULT_CHARS_PER_TOKEN): number {
    const combined = `${candidate.title ?? ''} ${candidate.content}`;
    return this.estimateTokens(combined, charsPerToken);
  }

  public static packContext(
    candidates: BudgetableCandidate[],
    options: BudgetPackOptions = {}
  ): ContextBudgetResult {
    const maxTokens = Math.max(50, options.maxTokens ?? this.DEFAULT_MAX_TOKENS);
    const charsPerToken = options.charsPerToken ?? this.DEFAULT_CHARS_PER_TOKEN;

    // Group candidates by tier (1 to 4)
    const tierGroups: Record<1 | 2 | 3 | 4, BudgetableCandidate[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
    };

    for (const c of candidates) {
      tierGroups[c.tier].push(c);
    }

    // Sort within each tier by importance descending with deterministic ID tie-breaking
    for (const tier of [1, 2, 3, 4] as const) {
      tierGroups[tier].sort(
        (a, b) => (b.importance ?? 0.5) - (a.importance ?? 0.5) || a.id.localeCompare(b.id)
      );
    }

    const budgeted: BudgetableCandidate[] = [];
    let currentTokens = 0;
    let truncatedCount = 0;

    const breakdown: Record<1 | 2 | 3 | 4, TierAllocationSummary> = {
      1: { tier: 1, tokensUsed: 0, itemCount: 0 },
      2: { tier: 2, tokensUsed: 0, itemCount: 0 },
      3: { tier: 3, tokensUsed: 0, itemCount: 0 },
      4: { tier: 4, tokensUsed: 0, itemCount: 0 },
    };

    // Greedy knapsack packing prioritizing tier 1 -> tier 2 -> tier 3 -> tier 4
    for (const tier of [1, 2, 3, 4] as const) {
      for (const item of tierGroups[tier]) {
        const cost = this.estimateCandidateTokens(item, charsPerToken);
        if (currentTokens + cost <= maxTokens) {
          budgeted.push(item);
          currentTokens += cost;
          breakdown[tier].tokensUsed += cost;
          breakdown[tier].itemCount += 1;
        } else {
          truncatedCount++;
        }
      }
    }

    return {
      budgetedCandidates: budgeted,
      totalTokens: currentTokens,
      maxTokens,
      truncatedCount,
      tierBreakdown: breakdown,
    };
  }
}
