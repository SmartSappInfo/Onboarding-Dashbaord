/**
 * @fileOverview Unit Tests: useTaskCursorPagination Hook (Phase 4A)
 *
 * Validates Rule 4 (Strict Typing), Rule 9 (Load & Throttling),
 * Roadmap §46-48, and PRD SCL-01/02.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskCursorPagination } from '../useTaskCursorPagination';
import type { Task } from '@/lib/types';

describe('useTaskCursorPagination (Phase 4A Cursor Engine)', () => {
  const mockTasksPage1: Task[] = Array.from({ length: 5 }, (_, i) => ({
    id: `task-${i + 1}`,
    workspaceId: 'ws-1',
    title: `Task ${i + 1}`,
    description: '',
    priority: 'medium',
    status: 'todo',
    category: 'general',
    assignedTo: 'usr-1',
    dueDate: `2026-10-${10 + i}T00:00:00.000Z`,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    reminders: [],
    reminderSent: false,
  }));

  const mockTasksPage2: Task[] = Array.from({ length: 5 }, (_, i) => ({
    id: `task-${i + 6}`,
    workspaceId: 'ws-1',
    title: `Task ${i + 6}`,
    description: '',
    priority: 'medium',
    status: 'todo',
    category: 'general',
    assignedTo: 'usr-1',
    dueDate: `2026-10-${15 + i}T00:00:00.000Z`,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    reminders: [],
    reminderSent: false,
  }));

  it('initializes with first page of tasks and reports hasMore accurately', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      tasks: mockTasksPage1,
      hasMore: true,
      nextCursor: 'cursor-page-1-end',
    });

    const { result } = renderHook(() =>
      useTaskCursorPagination({
        workspaceId: 'ws-1',
        pageSize: 5,
        fetcher: fetchPage,
      })
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.tasks.length).toBe(5);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.totalLoaded).toBe(5);
  });

  it('appends next page without duplicate records on loadMore', async () => {
    let callCount = 0;
    const fetchPage = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          tasks: mockTasksPage1,
          hasMore: true,
          nextCursor: 'cursor-1',
        });
      }
      return Promise.resolve({
        tasks: mockTasksPage2,
        hasMore: false,
        nextCursor: null,
      });
    });

    const { result } = renderHook(() =>
      useTaskCursorPagination({
        workspaceId: 'ws-1',
        pageSize: 5,
        fetcher: fetchPage,
      })
    );

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.tasks.length).toBe(5);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.tasks.length).toBe(10);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.totalLoaded).toBe(10);
  });

  it('deduplicates tasks if an item is returned across page boundaries', async () => {
    const overlappingPage2 = [mockTasksPage1[4], ...mockTasksPage2];
    let callCount = 0;
    const fetchPage = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          tasks: mockTasksPage1,
          hasMore: true,
          nextCursor: 'cursor-1',
        });
      }
      return Promise.resolve({
        tasks: overlappingPage2,
        hasMore: false,
        nextCursor: null,
      });
    });

    const { result } = renderHook(() =>
      useTaskCursorPagination({
        workspaceId: 'ws-1',
        pageSize: 5,
        fetcher: fetchPage,
      })
    );

    await act(async () => {
      await result.current.refresh();
    });
    await act(async () => {
      await result.current.loadMore();
    });

    // 5 initial + 5 unique from page 2 = 10 unique tasks total
    expect(result.current.tasks.length).toBe(10);
  });
});
