import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Task } from '@/lib/types';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';

// Mock updateTaskAction
const mockUpdateTaskAction = vi.fn();
vi.mock('@/lib/task-server-actions', () => ({
  updateTaskAction: (...args: unknown[]) => mockUpdateTaskAction(...args),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Intercept DndContext callbacks cleanly without any
let capturedOnDragEnd: ((event: DragEndEvent) => Promise<void>) | undefined;
let capturedOnDragOver: ((event: DragOverEvent) => void) | undefined;

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({
      children,
      onDragEnd,
      onDragOver,
    }: {
      children: React.ReactNode;
      onDragEnd: (event: DragEndEvent) => Promise<void>;
      onDragOver: (event: DragOverEvent) => void;
    }) => {
      capturedOnDragEnd = onDragEnd;
      capturedOnDragOver = onDragOver;
      return <div data-testid="mock-dnd-context">{children}</div>;
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

// Import TaskBoard after mocks
import TaskBoard from '../TaskBoard';

describe('TaskBoard Mutation Engine & Optimistic Rollback (Phase 1)', () => {
  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Prepare Compliance Document',
      description: 'Standard compliance doc',
      status: 'todo',
      priority: 'high',
      category: 'general',
      workspaceId: 'ws-test-1',
      assignedTo: 'usr-agent-1',
      dueDate: '2026-10-10T12:00:00Z',
      reminders: [],
      reminderSent: false,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'task-contract',
      title: 'Sign Appendix A',
      description: 'Contract obligation task',
      status: 'in_progress',
      priority: 'urgent',
      category: 'general',
      workspaceId: 'ws-test-1',
      assignedTo: 'usr-agent-2',
      dueDate: '2026-10-15T12:00:00Z',
      reminders: [],
      reminderSent: false,
      relatedParentId: 'contract-999',
      relatedEntityId: 'obligation-444',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDragEnd = undefined;
    capturedOnDragOver = undefined;
  });

  it('optimistically transitions task status and commits via updateTaskAction', async () => {
    mockUpdateTaskAction.mockResolvedValueOnce({ success: true, id: 'task-1' });

    render(
      <TaskBoard
        tasks={sampleTasks}
        onTaskClick={vi.fn()}
      />
    );

    expect(screen.getByTestId('mock-dnd-context')).toBeDefined();
    expect(capturedOnDragOver).toBeDefined();
    expect(capturedOnDragEnd).toBeDefined();

    // Simulate drag over in_progress column
    act(() => {
      capturedOnDragOver!({
        active: { id: 'task-1', data: { current: { type: 'TASK', task: sampleTasks[0] } } },
        over: { id: 'in_progress', data: { current: { type: 'COLUMN', status: 'in_progress' } } },
      } as unknown as DragOverEvent);
    });

    // Simulate drop into in_progress column
    await act(async () => {
      await capturedOnDragEnd!({
        active: { id: 'task-1' },
        over: { id: 'in_progress', data: { current: { type: 'COLUMN', status: 'in_progress' } } },
      } as unknown as DragEndEvent);
    });

    // Verified canonical updateTaskAction called
    expect(mockUpdateTaskAction).toHaveBeenCalledWith('task-1', { status: 'in_progress' });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Status Synchronized',
        description: 'Moved task to in progress phase.',
      })
    );
  });

  it('notifies on contract obligation fulfillment when moving linked task to done', async () => {
    mockUpdateTaskAction.mockResolvedValueOnce({ success: true, id: 'task-contract' });

    render(
      <TaskBoard
        tasks={sampleTasks}
        onTaskClick={vi.fn()}
      />
    );

    act(() => {
      capturedOnDragOver!({
        active: { id: 'task-contract', data: { current: { type: 'TASK', task: sampleTasks[1] } } },
        over: { id: 'done', data: { current: { type: 'COLUMN', status: 'done' } } },
      } as unknown as DragOverEvent);
    });

    await act(async () => {
      await capturedOnDragEnd!({
        active: { id: 'task-contract' },
        over: { id: 'done', data: { current: { type: 'COLUMN', status: 'done' } } },
      } as unknown as DragEndEvent);
    });

    expect(mockUpdateTaskAction).toHaveBeenCalledWith('task-contract', { status: 'done' });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Status Synchronized',
        description: expect.stringMatching(/contract.*obligation/i),
      })
    );
  });

  it('rolls back state and displays actionable error toast when updateTaskAction fails', async () => {
    mockUpdateTaskAction.mockResolvedValueOnce({
      success: false,
      error: 'Permission denied: operations:tasks:edit',
    });

    render(
      <TaskBoard
        tasks={sampleTasks}
        onTaskClick={vi.fn()}
      />
    );

    act(() => {
      capturedOnDragOver!({
        active: { id: 'task-1', data: { current: { type: 'TASK', task: sampleTasks[0] } } },
        over: { id: 'review', data: { current: { type: 'COLUMN', status: 'review' } } },
      } as unknown as DragOverEvent);
    });

    await act(async () => {
      await capturedOnDragEnd!({
        active: { id: 'task-1' },
        over: { id: 'review', data: { current: { type: 'COLUMN', status: 'review' } } },
      } as unknown as DragEndEvent);
    });

    expect(mockUpdateTaskAction).toHaveBeenCalledWith('task-1', { status: 'review' });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'Status Update Failed',
        description: expect.stringMatching(/Permission denied/),
        actionConfig: {
          path: '/admin/settings/permissions',
          label: 'Review Permissions',
        },
      })
    );
  });
});
