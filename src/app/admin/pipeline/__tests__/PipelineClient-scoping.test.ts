import { describe, it, expect } from 'vitest';
import type { Deal } from '@/lib/types';
import { applyDealFilters } from '../utils/filter-deals';
import { DEFAULT_FILTERS } from '../pipeline-types';

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
});
