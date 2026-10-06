import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/types';

describe('TasksClient Scope & Filter Filtering Invariants (Phase 2)', () => {
  const currentUserId = 'user_current';
  const mockTasks: Task[] = [
    {
      id: 'task_1',
      workspaceId: 'ws_1',
      title: 'My personal task',
      description: '',
      priority: 'high',
      status: 'todo',
      category: 'follow_up',
      assignedTo: [currentUserId],
      dueDate: '2026-10-06T12:00:00Z',
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-01T12:00:00Z',
      reminders: [],
      reminderSent: false,
      tagIds: ['tag_urgent'],
    },
    {
      id: 'task_2',
      workspaceId: 'ws_1',
      title: 'Teammate task',
      description: '',
      priority: 'medium',
      status: 'in_progress',
      category: 'follow_up',
      assignedTo: ['user_teammate'],
      dueDate: '2026-10-06T12:00:00Z',
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-01T12:00:00Z',
      reminders: [],
      reminderSent: false,
      tagIds: ['tag_marketing'],
    },
    {
      id: 'task_3',
      workspaceId: 'ws_1',
      title: 'Unassigned task',
      description: '',
      priority: 'low',
      status: 'todo',
      category: 'follow_up',
      assignedTo: [],
      dueDate: '2026-10-06T12:00:00Z',
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-01T12:00:00Z',
      reminders: [],
      reminderSent: false,
      tagIds: [],
    },
  ];

  function filterTasks(
    tasks: Task[],
    scope: 'my' | 'team' | 'all',
    selectedTagId: string | 'all',
    userId: string
  ): Task[] {
    return tasks.filter((task) => {
      // Scope filter
      let matchesScope = true;
      const assignees = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : task.assignedTo
        ? [task.assignedTo]
        : [];

      if (scope === 'my') {
        matchesScope = assignees.includes(userId);
      } else if (scope === 'team') {
        matchesScope = assignees.length > 0;
      }

      // Tag filter
      const matchesTag =
        selectedTagId === 'all' || (Boolean(task.tagIds) && task.tagIds!.includes(selectedTagId));

      return matchesScope && matchesTag;
    });
  }

  it('filters by "my" scope', () => {
    const result = filterTasks(mockTasks, 'my', 'all', currentUserId);
    expect(result.map((t) => t.id)).toEqual(['task_1']);
  });

  it('filters by "team" scope', () => {
    const result = filterTasks(mockTasks, 'team', 'all', currentUserId);
    expect(result.map((t) => t.id)).toEqual(['task_1', 'task_2']);
  });

  it('filters by "all" scope', () => {
    const result = filterTasks(mockTasks, 'all', 'all', currentUserId);
    expect(result.length).toBe(3);
  });

  it('filters by specific tagId', () => {
    const result = filterTasks(mockTasks, 'all', 'tag_marketing', currentUserId);
    expect(result.map((t) => t.id)).toEqual(['task_2']);
  });
});
