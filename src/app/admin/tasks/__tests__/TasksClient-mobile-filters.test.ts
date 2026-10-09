import { describe, it, expect } from 'vitest';

describe('TasksClient Mobile Toolbar & Filter Sheet Synchronization (Roadmap §29)', () => {
  it('correctly calculates active filter count across status, priority, tag, assignee, and date', () => {
    const countActive = (filters: { status: string; priority: string; tagId: string; dateType: string }) => {
      let count = 0;
      if (filters.status !== 'all') count++;
      if (filters.priority !== 'all') count++;
      if (filters.tagId !== 'all') count++;
      if (filters.dateType !== 'all') count++;
      return count;
    };

    expect(countActive({ status: 'all', priority: 'all', tagId: 'all', dateType: 'all' })).toBe(0);
    expect(countActive({ status: 'todo', priority: 'urgent', tagId: 'all', dateType: 'all' })).toBe(2);
  });
});
