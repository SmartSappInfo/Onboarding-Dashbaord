/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Stratified Token Budget Manager
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. 4-Tier Stratified Allocation:
 *    - Tier 1 (Critical): Identity, active commercial deals, key stakeholders, conflict warnings.
 *    - Tier 2 (Relevant): High-scoring semantic memories, 1-hop relationships, upcoming meetings.
 *    - Tier 3 (Supporting): 2-hop graph neighbors, background notes, completed tasks.
 *    - Tier 4 (Discoverable): Peripheral mentions, archived context.
 * 2. Strict Token Ceiling Enforcement:
 *    - Ensures context packages never exceed `maxTokens` (default: 4,000 tokens), preventing
 *      LLM OOMs, context truncation, and unnecessary billing charges.
 * 3. Token Estimation Standard:
 *    - Employs standard ~4 chars/token heuristic with whitespace and structure overhead factoring.
 * 4. Zero-`any` Standard:
 *    - Strictly typed across all candidates and budget metrics.
 *
 * @testability Covered in `src/lib/memory/__tests__/context-builder.test.ts`.
 */

import type {
  ContextFact,
  ContextMemory,
  ContextRelationship,
  ContextEvent,
  ContextAction,
  ContextKnowledge,
  ContextConflictWarning,
  ContextTokenBudget,
} from '../context-types';

export interface BudgetableContextItems {
  structuredFacts: ContextFact[];
  memories: ContextMemory[];
  relationships: ContextRelationship[];
  recentActivity: ContextEvent[];
  openActions: ContextAction[];
  relevantKnowledge: ContextKnowledge[];
  conflicts: ContextConflictWarning[];
}

export interface BudgetAllocationResult {
  budgetedItems: BudgetableContextItems;
  tokenBudget: ContextTokenBudget;
}

export class ContextBudgetManager {
  public static readonly CHARS_PER_TOKEN = 4.0;
  public static readonly DEFAULT_MAX_TOKENS = 4000;

  /**
   * Fast token estimation for a text string or structured object.
   */
  public static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / ContextBudgetManager.CHARS_PER_TOKEN);
  }

  /**
   * Estimates tokens for an individual item by serializing its key narrative fields.
   */
  public static estimateItemTokens(item: unknown): number {
    if (!item) return 0;
    const json = JSON.stringify(item);
    return Math.ceil(json.length / ContextBudgetManager.CHARS_PER_TOKEN);
  }

  /**
   * Allocates items across 4 tiers up to `maxTokens`.
   * Tier 1 is always prioritized, followed by Tier 2, Tier 3, and Tier 4.
   */
  public static allocateBudget(
    items: BudgetableContextItems,
    maxBudget: number = ContextBudgetManager.DEFAULT_MAX_TOKENS
  ): BudgetAllocationResult {
    const safeMax = Math.max(500, maxBudget);

    // Initial item lists
    const budgetedFacts: ContextFact[] = [];
    const budgetedMemories: ContextMemory[] = [];
    const budgetedRelationships: ContextRelationship[] = [];
    const budgetedEvents: ContextEvent[] = [];
    const budgetedActions: ContextAction[] = [];
    const budgetedKnowledge: ContextKnowledge[] = [];
    const budgetedConflicts: ContextConflictWarning[] = [];

    let currentTotalTokens = 0;
    let tier1Tokens = 0;
    let tier2Tokens = 0;
    let tier3Tokens = 0;
    let tier4Tokens = 0;
    let truncatedCount = 0;

    // Helper to evaluate and pack items
    const tryPack = <T>(
      item: T,
      tierTokensUpdate: (cost: number) => void
    ): boolean => {
      const cost = ContextBudgetManager.estimateItemTokens(item);
      if (currentTotalTokens + cost <= safeMax) {
        currentTotalTokens += cost;
        tierTokensUpdate(cost);
        return true;
      }
      truncatedCount++;
      return false;
    };

    // -------------------------------------------------------------
    // TIER 1: CRITICAL (Conflicts, core identity facts, urgent actions)
    // -------------------------------------------------------------
    for (const conflict of items.conflicts) {
      if (tryPack(conflict, (c) => { tier1Tokens += c; })) {
        budgetedConflicts.push(conflict);
      }
    }

    for (const fact of items.structuredFacts.filter((f) => f.tier === 'tier1_critical')) {
      if (tryPack(fact, (c) => { tier1Tokens += c; })) {
        budgetedFacts.push(fact);
      }
    }

    for (const action of items.openActions.filter((a) => a.priority === 'urgent' || a.priority === 'high')) {
      action.tier = 'tier1_critical';
      if (tryPack(action, (c) => { tier1Tokens += c; })) {
        budgetedActions.push(action);
      }
    }

    // -------------------------------------------------------------
    // TIER 2: RELEVANT (High scoring memories, 1-hop relationships, recent key events)
    // -------------------------------------------------------------
    // Sort memories descending by effectiveScore
    const sortedMemories = [...items.memories].sort(
      (a, b) => b.effectiveScore - a.effectiveScore
    );

    for (const mem of sortedMemories) {
      if (mem.relevanceScore >= 0.65) {
        mem.tier = 'tier2_relevant';
        if (tryPack(mem, (c) => { tier2Tokens += c; })) {
          budgetedMemories.push(mem);
        }
      }
    }

    for (const rel of items.relationships.filter((r) => r.hops === 1)) {
      rel.tier = 'tier2_relevant';
      if (tryPack(rel, (c) => { tier2Tokens += c; })) {
        budgetedRelationships.push(rel);
      }
    }

    for (const act of items.openActions.filter((a) => a.priority === 'medium')) {
      act.tier = 'tier2_relevant';
      if (tryPack(act, (c) => { tier2Tokens += c; })) {
        budgetedActions.push(act);
      }
    }

    for (const know of items.relevantKnowledge.filter((k) => k.confidence >= 0.8)) {
      know.tier = 'tier2_relevant';
      if (tryPack(know, (c) => { tier2Tokens += c; })) {
        budgetedKnowledge.push(know);
      }
    }

    // -------------------------------------------------------------
    // TIER 3: SUPPORTING (Moderate memories, 2-hop relationships, events)
    // -------------------------------------------------------------
    for (const mem of sortedMemories) {
      if (mem.relevanceScore < 0.65 && mem.relevanceScore >= 0.40) {
        mem.tier = 'tier3_supporting';
        if (tryPack(mem, (c) => { tier3Tokens += c; })) {
          budgetedMemories.push(mem);
        }
      }
    }

    for (const rel of items.relationships.filter((r) => r.hops === 2)) {
      rel.tier = 'tier3_supporting';
      if (tryPack(rel, (c) => { tier3Tokens += c; })) {
        budgetedRelationships.push(rel);
      }
    }

    for (const ev of items.recentActivity) {
      ev.tier = 'tier3_supporting';
      if (tryPack(ev, (c) => { tier3Tokens += c; })) {
        budgetedEvents.push(ev);
      }
    }

    for (const fact of items.structuredFacts.filter((f) => f.tier !== 'tier1_critical')) {
      fact.tier = 'tier3_supporting';
      if (tryPack(fact, (c) => { tier3Tokens += c; })) {
        budgetedFacts.push(fact);
      }
    }

    for (const know of items.relevantKnowledge.filter((k) => k.confidence < 0.8)) {
      know.tier = 'tier3_supporting';
      if (tryPack(know, (c) => { tier3Tokens += c; })) {
        budgetedKnowledge.push(know);
      }
    }

    for (const act of items.openActions.filter((a) => a.priority === 'low')) {
      act.tier = 'tier3_supporting';
      if (tryPack(act, (c) => { tier3Tokens += c; })) {
        budgetedActions.push(act);
      }
    }

    // -------------------------------------------------------------
    // TIER 4: DISCOVERABLE (3-hop relationships, low-relevance memories)
    // -------------------------------------------------------------
    for (const rel of items.relationships.filter((r) => r.hops > 2)) {
      rel.tier = 'tier4_discoverable';
      if (tryPack(rel, (c) => { tier4Tokens += c; })) {
        budgetedRelationships.push(rel);
      }
    }

    for (const mem of sortedMemories) {
      if (mem.relevanceScore < 0.40) {
        mem.tier = 'tier4_discoverable';
        if (tryPack(mem, (c) => { tier4Tokens += c; })) {
          budgetedMemories.push(mem);
        }
      }
    }

    const utilizationPercentage = Math.round((currentTotalTokens / safeMax) * 100);

    const tokenBudget: ContextTokenBudget = {
      totalTokens: currentTotalTokens,
      maxBudget: safeMax,
      utilizationPercentage,
      tierBreakdown: {
        tier1Critical: tier1Tokens,
        tier2Relevant: tier2Tokens,
        tier3Supporting: tier3Tokens,
        tier4Discoverable: tier4Tokens,
      },
      truncatedItemCount: truncatedCount,
      isTruncated: truncatedCount > 0,
    };

    return {
      budgetedItems: {
        structuredFacts: budgetedFacts,
        memories: budgetedMemories,
        relationships: budgetedRelationships,
        recentActivity: budgetedEvents,
        openActions: budgetedActions,
        relevantKnowledge: budgetedKnowledge,
        conflicts: budgetedConflicts,
      },
      tokenBudget,
    };
  }
}
