import { describe, it, expect } from 'vitest';
import { applyDealFilters } from './filter-deals';
import { DEFAULT_FILTERS, type KanbanFilters } from '../pipeline-types';
import type { Deal } from '@/lib/types';

function makeDeal(overrides: Partial<Deal>): Deal {
  return {
    id: 'd1',
    organizationId: 'org',
    workspaceId: 'ws',
    entityId: 'e1',
    pipelineId: 'p1',
    stageId: 's1',
    name: 'Acme Deal',
    value: 1000,
    status: 'open',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const filters = (over: Partial<KanbanFilters>): KanbanFilters => ({ ...DEFAULT_FILTERS, ...over });

describe('applyDealFilters', () => {
  it('returns all deals with default filters', () => {
    const deals = [makeDeal({ id: 'a' }), makeDeal({ id: 'b' })];
    expect(applyDealFilters(deals, DEFAULT_FILTERS, null)).toHaveLength(2);
  });

  it('filters by status', () => {
    const deals = [makeDeal({ id: 'a', status: 'open' }), makeDeal({ id: 'b', status: 'won' })];
    const result = applyDealFilters(deals, filters({ status: 'won' }), null);
    expect(result.map(d => d.id)).toEqual(['b']);
  });

  it('local assignee filter OVERRIDES the global assignee', () => {
    const deals = [
      makeDeal({ id: 'a', assignedTo: { userId: 'u1', name: 'A', email: '' } }),
      makeDeal({ id: 'b', assignedTo: { userId: 'u2', name: 'B', email: '' } }),
    ];
    // Global says u1, but local filter says u2 — local wins.
    const result = applyDealFilters(deals, filters({ assignedToId: 'u2' }), 'u1');
    expect(result.map(d => d.id)).toEqual(['b']);
  });

  it('falls back to the global assignee when no local assignee is set', () => {
    const deals = [
      makeDeal({ id: 'a', assignedTo: { userId: 'u1', name: 'A', email: '' } }),
      makeDeal({ id: 'b', assignedTo: { userId: 'u2', name: 'B', email: '' } }),
    ];
    const result = applyDealFilters(deals, DEFAULT_FILTERS, 'u1');
    expect(result.map(d => d.id)).toEqual(['a']);
  });

  it('filters unassigned deals', () => {
    const deals = [
      makeDeal({ id: 'a', assignedTo: { userId: 'u1', name: 'A', email: '' } }),
      makeDeal({ id: 'b', assignedTo: null }),
    ];
    const result = applyDealFilters(deals, filters({ assignedToId: 'unassigned' }), null);
    expect(result.map(d => d.id)).toEqual(['b']);
  });

  it('filters by value range (inclusive)', () => {
    const deals = [makeDeal({ id: 'a', value: 500 }), makeDeal({ id: 'b', value: 1500 }), makeDeal({ id: 'c', value: 3000 })];
    const result = applyDealFilters(deals, filters({ valueMin: 1000, valueMax: 2000 }), null);
    expect(result.map(d => d.id)).toEqual(['b']);
  });

  it('matches search against name and focal contacts', () => {
    const deals = [
      makeDeal({ id: 'a', name: 'Northwind Renewal' }),
      makeDeal({ id: 'b', name: 'Acme', focalContacts: [{ id: 'fc1', name: 'Jane Doe' }] }),
    ];
    expect(applyDealFilters(deals, filters({ searchTerm: 'northwind' }), null).map(d => d.id)).toEqual(['a']);
    expect(applyDealFilters(deals, filters({ searchTerm: 'jane' }), null).map(d => d.id)).toEqual(['b']);
  });

  it('filters by stage multi-select', () => {
    const deals = [makeDeal({ id: 'a', stageId: 's1' }), makeDeal({ id: 'b', stageId: 's2' }), makeDeal({ id: 'c', stageId: 's3' })];
    const result = applyDealFilters(deals, filters({ stageIds: ['s1', 's3'] }), null);
    expect(result.map(d => d.id)).toEqual(['a', 'c']);
  });

  it('filters by tags via the linked entity resolver', () => {
    const deals = [
      makeDeal({ id: 'a', entityId: 'e1' }),
      makeDeal({ id: 'b', entityId: 'e2' }),
      makeDeal({ id: 'c', entityId: 'e3' }),
    ];
    const tagsByEntity: Record<string, string[]> = { e1: ['vip', 'hot'], e2: ['cold'], e3: [] };
    const result = applyDealFilters(deals, filters({ tagIds: ['vip'] }), null, id => tagsByEntity[id] ?? []);
    expect(result.map(d => d.id)).toEqual(['a']);
  });

  it('ignores tag filter when no resolver is provided', () => {
    const deals = [makeDeal({ id: 'a', entityId: 'e1' })];
    // No resolver → entity has no resolvable tags → excluded when a tag filter is active.
    const result = applyDealFilters(deals, filters({ tagIds: ['vip'] }), null);
    expect(result).toHaveLength(0);
  });

  it('filters by forecast close-date range inclusive of the upper day', () => {
    const deals = [
      makeDeal({ id: 'a', expectedCloseDate: '2026-03-01T10:00:00.000Z' }),
      makeDeal({ id: 'b', expectedCloseDate: '2026-03-15T23:00:00.000Z' }),
      makeDeal({ id: 'c', expectedCloseDate: '2026-04-01T10:00:00.000Z' }),
    ];
    const result = applyDealFilters(deals, filters({ closeDateFrom: '2026-03-01', closeDateTo: '2026-03-15' }), null);
    expect(result.map(d => d.id)).toEqual(['a', 'b']);
  });
});
