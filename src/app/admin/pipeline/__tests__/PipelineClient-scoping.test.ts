import { describe, it, expect } from 'vitest';
import type { Deal } from '@/lib/types';
import { applyDealFilters } from '../utils/filter-deals';
import { DEFAULT_FILTERS, type KanbanFilters } from '../pipeline-types';

describe('Pipeline Deals Visibility Scoping Logic', () => {
  const currentUserId = 'usr_alice';

  const mockDeals: Deal[] = [
    {
      id: 'd1',
      name: 'Deal 1',
      value: 1000,
      organizationId: 'org1',
      entityId: 'e1',
      assignedTo: { userId: 'usr_alice', name: 'Alice', email: null },
      createdBy: 'usr_bob',
      pipelineId: 'p1',
      stageId: 's1',
      status: 'open',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      workspaceId: 'ws1',
    },
    {
      id: 'd2',
      name: 'Deal 2',
      value: 2000,
      organizationId: 'org1',
      entityId: 'e2',
      assignedTo: { userId: 'usr_bob', name: 'Bob', email: null },
      createdBy: 'usr_alice',
      pipelineId: 'p1',
      stageId: 's1',
      status: 'open',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      workspaceId: 'ws1',
    },
    {
      id: 'd3',
      name: 'Deal 3',
      value: 3000,
      organizationId: 'org1',
      entityId: 'e3',
      assignedTo: { userId: 'usr_bob', name: 'Bob', email: null },
      createdBy: 'usr_charlie',
      pipelineId: 'p1',
      stageId: 's1',
      status: 'open',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      workspaceId: 'ws1',
    },
  ];

  it('restricts deals to assignedTo or createdBy when restricted', () => {
    const result = applyDealFilters(
      mockDeals,
      DEFAULT_FILTERS,
      null,
      () => [],
      { isRestricted: true, currentUserId }
    );

    expect(result.map(d => d.id)).toEqual(['d1', 'd2']);
  });

  it('allows all deals when unrestricted (admin or workspace setting)', () => {
    const result = applyDealFilters(
      mockDeals,
      DEFAULT_FILTERS,
      null,
      () => [],
      { isRestricted: false, currentUserId }
    );

    expect(result.map(d => d.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('filters deals to current user when assignedToId is set to current user ID', () => {
    const result = applyDealFilters(
      mockDeals,
      { ...DEFAULT_FILTERS, assignedToId: currentUserId },
      null,
      () => [],
      { isRestricted: false, currentUserId }
    );

    expect(result.map(d => d.id)).toEqual(['d1']);
  });

  it('falls back to globalAssigneeId when local filter is unset', () => {
    const filtersWithoutAssigned = { ...DEFAULT_FILTERS } as Partial<KanbanFilters>;
    delete filtersWithoutAssigned.assignedToId;

    const result = applyDealFilters(
      mockDeals,
      filtersWithoutAssigned as KanbanFilters,
      currentUserId,
      () => [],
      { isRestricted: false, currentUserId }
    );

    expect(result.map(d => d.id)).toEqual(['d1']);
  });

  it('overrides assignedToId when workspace is restricted fail-closed', () => {
    // Even if local filter was set to 'all' or another user, security scoping strictly enforces current user
    const result = applyDealFilters(
      mockDeals,
      { ...DEFAULT_FILTERS, assignedToId: 'all' },
      null,
      () => [],
      { isRestricted: true, currentUserId }
    );

    // Only deals assigned to or created by current user
    expect(result.map(d => d.id)).toEqual(['d1', 'd2']);
  });

  it('correctly filters for initial load "My Deals" preset (open deals assigned to current user)', () => {
    const myDealsInitialFilters = {
      ...DEFAULT_FILTERS,
      status: 'open' as const,
      assignedToId: currentUserId,
    };

    const result = applyDealFilters(
      mockDeals,
      myDealsInitialFilters,
      null,
      () => [],
      { isRestricted: false, currentUserId }
    );

    // Only open deal assigned to Alice
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('d1');
    expect(result[0].assignedTo?.userId).toBe(currentUserId);
  });

  it('correctly filters for "All Deals" preset when user switches or remembers all preference', () => {
    const allDealsFilters = {
      ...DEFAULT_FILTERS,
      status: 'open' as const,
      assignedToId: 'all',
    };

    const result = applyDealFilters(
      mockDeals,
      allDealsFilters,
      null,
      () => [],
      { isRestricted: false, currentUserId }
    );

    // All 3 open deals are returned regardless of assignee
    expect(result.map(d => d.id)).toEqual(['d1', 'd2', 'd3']);
  });
});

