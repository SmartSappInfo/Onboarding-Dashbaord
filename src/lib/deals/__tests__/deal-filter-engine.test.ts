/**
 * @fileoverview Unit Tests for Pure Deal Filter Engine
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateDealFilterRule,
  evaluateDealFilterTree,
  countMatchingDeals,
} from '../deal-filter-engine';
import type { Deal, OnboardingStage } from '../../types';
import type { DealFilterTree } from '../deal-saved-views';

const mockDeal: Deal = {
  id: 'deal-1',
  name: 'Acme Enterprise License',
  workspaceId: 'ws-1',
  organizationId: 'org-1',
  entityId: 'ent-1',
  pipelineId: 'pipe-1',
  stageId: 'stage-1',
  status: 'open',
  value: 50000,
  mrr: 4000,
  arr: 48000,
  probability: 70,
  forecastCategory: 'commit',
  stageEnteredAt: '2026-08-20T00:00:00.000Z',
  expectedCloseDate: '2026-08-31T00:00:00.000Z',
  assignedTo: {
    userId: 'user-1',
    name: 'User 1',
    email: 'user1@example.com',
  },
  tags: ['tag-vip', 'tag-q3'],
  nextStep: {
    type: 'follow_up',
    title: 'Send executive contract proposal',
    dueDate: '2026-08-31T00:00:00.000Z',
  },
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
};

const mockStage: OnboardingStage = {
  id: 'stage-1',
  name: 'Proposal',
  pipelineId: 'pipe-1',
  order: 3,
  slaDays: 5,
  probability: 70,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const stagesMap = new Map<string, OnboardingStage>([['stage-1', mockStage]]);

describe('Pure Deal Filter Engine', () => {
  const fixedNow = new Date('2026-08-29T12:00:00.000Z');
  const context = {
    currentUserId: 'user-1',
    now: fixedNow,
    stagesMap,
  };

  it('evaluates numeric comparisons (greater_than, is_between)', () => {
    // Value > 20000 -> true
    expect(
      evaluateDealFilterRule(
        mockDeal,
        { id: '1', field: 'value', operator: 'greater_than', value: 20000 },
        context
      )
    ).toBe(true);

    // Value > 60000 -> false
    expect(
      evaluateDealFilterRule(
        mockDeal,
        { id: '2', field: 'value', operator: 'greater_than', value: 60000 },
        context
      )
    ).toBe(false);

    // MRR between 3000 and 5000 -> true
    expect(
      evaluateDealFilterRule(
        mockDeal,
        { id: '3', field: 'mrr', operator: 'is_between', value: 3000, valueTo: 5000 },
        context
      )
    ).toBe(true);
  });

  it('evaluates string and array contains and in operators', () => {
    // Name contains "Enterprise" -> true
    expect(
      evaluateDealFilterRule(
        mockDeal,
        { id: '1', field: 'name', operator: 'contains', value: 'Enterprise' },
        context
      )
    ).toBe(true);

    // Tag in ['tag-vip'] -> true
    expect(
      evaluateDealFilterRule(
        mockDeal,
        { id: '2', field: 'tagIds', operator: 'in', value: ['tag-vip'] },
        context
      )
    ).toBe(true);

    // Tag in ['tag-random'] -> false
    expect(
      evaluateDealFilterRule(
        mockDeal,
        { id: '3', field: 'tagIds', operator: 'in', value: ['tag-random'] },
        context
      )
    ).toBe(false);
  });

  it('evaluates dynamic tokens (current_user, current_month)', () => {
    // Owner is current_user -> true (user-1)
    expect(
      evaluateDealFilterRule(
        mockDeal,
        { id: '1', field: 'ownerId', operator: 'equals', value: 'current_user' },
        context
      )
    ).toBe(true);

    // Expected close is current_month (August 2026) -> true
    expect(
      evaluateDealFilterRule(
        mockDeal,
        { id: '2', field: 'expectedCloseDate', operator: 'equals', value: 'current_month' },
        context
      )
    ).toBe(true);
  });

  it('evaluates complex nested filter trees with AND/OR conjunctions', () => {
    const filterTree: DealFilterTree = {
      conjunction: 'AND',
      groups: [
        {
          id: 'grp-1',
          conjunction: 'OR',
          rules: [
            { id: 'r1', field: 'probability', operator: 'greater_than_or_equal', value: 80 },
            { id: 'r2', field: 'value', operator: 'greater_than', value: 40000 },
          ],
        },
        {
          id: 'grp-2',
          conjunction: 'AND',
          rules: [
            { id: 'r3', field: 'status', operator: 'equals', value: 'open' },
          ],
        },
      ],
    };

    expect(evaluateDealFilterTree(mockDeal, filterTree, context)).toBe(true);
    expect(countMatchingDeals([mockDeal], filterTree, context)).toBe(1);
  });
});
