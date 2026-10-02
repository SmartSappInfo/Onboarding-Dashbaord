import { describe, it, expect } from 'vitest';
import {
  StratifiedContextBudgetManager,
  type BudgetableCandidate,
} from '@/platform/memory/retrieval/context-budget-manager';

describe('Stratified Context Budget Manager (Rule 28 & PRD §42)', () => {
  it('enforces total token ceiling strictly without overflow', () => {
    const candidates: BudgetableCandidate[] = [
      {
        id: 'crit-1',
        tier: 1, // Critical
        title: 'Active Deal Contract',
        content: 'Deal worth GHS 120,000 in closing stage.',
        importance: 0.95,
      },
      {
        id: 'rel-1',
        tier: 2, // Highly relevant
        title: 'Meeting Notes',
        content: 'Parents requested split billing across two semesters in Kumasi.',
        importance: 0.85,
      },
      {
        id: 'supp-1',
        tier: 3, // Supporting
        title: 'General Note',
        content: 'School was founded in 2004 with 650 students.',
        importance: 0.5,
      },
      {
        id: 'disc-1',
        tier: 4, // Discoverable
        title: 'Archived Reference',
        content: 'Previous vendor had payment sync issues.'.repeat(50),
        importance: 0.2,
      },
    ];

    const result = StratifiedContextBudgetManager.packContext(candidates, {
      maxTokens: 50,
    });

    expect(result.totalTokens).toBeLessThanOrEqual(50);
    expect(result.budgetedCandidates.some((c) => c.id === 'crit-1')).toBe(true);
    expect(result.truncatedCount).toBeGreaterThan(0);
    expect(result.tierBreakdown[1].itemCount).toBe(1);
  });

  it('estimates tokens accurately using ~4 chars/token heuristic', () => {
    const text = 'Hello world, this is a 40 character text.';
    const tokens = StratifiedContextBudgetManager.estimateTokens(text);
    expect(tokens).toBe(Math.ceil(text.length / 4.0));
  });
});
