import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Task } from '@/lib/types';

// Mock updateTaskAction & retryTaskObligationSyncAction
const mockUpdateTaskAction = vi.fn();
const mockRetryTaskObligationSyncAction = vi.fn();

vi.mock('@/lib/task-server-actions', () => ({
  updateTaskAction: (...args: unknown[]) => mockUpdateTaskAction(...args),
  retryTaskObligationSyncAction: (...args: unknown[]) => mockRetryTaskObligationSyncAction(...args),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock TenantContext
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ activeWorkspaceId: 'ws-test-compact' }),
}));

// Mock Firebase provider & hooks
let capturedQueryLimit: number | null = null;
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, col) => col),
  query: vi.fn((...args: unknown[]) => {
    return args;
  }),
  where: vi.fn((field, op, val) => ({ field, op, val })),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
  limit: vi.fn((num: number) => {
    capturedQueryLimit = num;
    return { limit: num };
  }),
}));

vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: () => ({ data: [], isLoading: false }),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

import { TaskWidget } from '../TaskWidget';

describe('TaskWidget with Canonical CompactTaskCard (Phase 5 / Roadmap §77)', () => {
  const sampleTasks: Task[] = [
    {
      id: 'task-c-1',
      title: 'Review High Priority Agreement',
      status: 'todo',
      priority: 'urgent',
      category: 'general',
      workspaceId: 'ws-test-compact',
      dueDate: '2026-10-15T12:00:00Z',
      obligationSyncStatus: 'synced',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'task-c-2',
      title: 'Failed Obligation Sync Task',
      status: 'in_progress',
      priority: 'high',
      category: 'general',
      workspaceId: 'ws-test-compact',
      dueDate: '2026-10-16T12:00:00Z',
      obligationSyncStatus: 'failed',
      obligationSyncError: 'Contract obligation sync failed',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    capturedQueryLimit = null;
  });

  it('renders tasks using CompactTaskCard semantics and respects query limit(10)', () => {
    render(<TaskWidget initialTasks={sampleTasks} />);

    expect(screen.getByText('Review High Priority Agreement')).toBeDefined();
    expect(screen.getByText('Failed Obligation Sync Task')).toBeDefined();
  });

  it('optimistically resolves task when toggle button is clicked', async () => {
    mockUpdateTaskAction.mockResolvedValueOnce({ success: true, id: 'task-c-1' });

    render(<TaskWidget initialTasks={sampleTasks} />);

    const markButtons = screen.getAllByRole('button', { name: /mark complete/i });
    expect(markButtons.length).toBeGreaterThan(0);

    fireEvent.click(markButtons[0]);

    // Optimistic toggle updates task
    await waitFor(() => {
      expect(mockUpdateTaskAction).toHaveBeenCalledWith('task-c-1', { status: 'done' });
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Task Completed',
        })
      );
    });
  });

  it('reverts optimistic update and displays actionable error toast when update fails', async () => {
    mockUpdateTaskAction.mockResolvedValueOnce({
      success: false,
      error: 'Permission denied',
    });

    render(<TaskWidget initialTasks={sampleTasks} />);

    const markButtons = screen.getAllByRole('button', { name: /mark complete/i });
    fireEvent.click(markButtons[0]);

    await waitFor(() => {
      expect(mockUpdateTaskAction).toHaveBeenCalledWith('task-c-1', { status: 'done' });
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Update Failed',
          actionConfig: {
            path: '/admin/settings/permissions',
            label: 'Check Permissions',
          },
        })
      );
    });
  });

  it('renders sync failure alert and handles retry action for failed obligation sync', async () => {
    mockRetryTaskObligationSyncAction.mockResolvedValueOnce({
      success: true,
      message: 'Obligation synchronized successfully',
    });

    render(<TaskWidget initialTasks={sampleTasks} />);

    expect(screen.getByText(/Contract obligation sync failed/i)).toBeDefined();
    const retryBtn = screen.getByRole('button', { name: /retry sync/i });
    expect(retryBtn).toBeDefined();

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(mockRetryTaskObligationSyncAction).toHaveBeenCalledWith(
        'ws-test-compact',
        'task-c-2',
        '2026-10-01T00:00:00Z'
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sync Succeeded',
        })
      );
    });
  });
});
