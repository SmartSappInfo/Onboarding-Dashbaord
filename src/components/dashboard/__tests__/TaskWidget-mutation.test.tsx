import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Task } from '@/lib/types';

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

// Mock TenantContext
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ activeWorkspaceId: 'ws-test-widget' }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock Firebase provider & hooks
vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: () => ({ data: [], isLoading: false }),
}));

import { TaskWidget } from '../TaskWidget';

describe('TaskWidget Mutation Engine (Phase 1)', () => {
  const sampleTasks: Task[] = [
    {
      id: 'task-widget-1',
      title: 'Review NDA Submission',
      description: 'Review submitted NDA agreement',
      status: 'todo',
      priority: 'high',
      category: 'general',
      workspaceId: 'ws-test-widget',
      assignedTo: 'usr-agent-1',
      dueDate: '2026-10-10T12:00:00Z',
      reminders: [],
      reminderSent: false,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'task-widget-2',
      title: 'Task Without Due Date',
      description: 'Legacy task without due date',
      status: 'in_progress',
      priority: 'medium',
      category: 'general',
      workspaceId: 'ws-test-widget',
      assignedTo: 'usr-agent-2',
      dueDate: '',
      reminders: [],
      reminderSent: false,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tasks safely even if dueDate is undefined', () => {
    render(<TaskWidget initialTasks={sampleTasks} />);
    expect(screen.getByText('Review NDA Submission')).toBeDefined();
    expect(screen.getByText('Task Without Due Date')).toBeDefined();
  });

  it('calls updateTaskAction with status done when complete button is clicked', async () => {
    mockUpdateTaskAction.mockResolvedValueOnce({ success: true, id: 'task-widget-1' });

    render(<TaskWidget initialTasks={sampleTasks} />);

    const completeButtons = screen.getAllByRole('button', { name: /complete/i });
    expect(completeButtons.length).toBeGreaterThan(0);

    fireEvent.click(completeButtons[0]);

    await waitFor(() => {
      expect(mockUpdateTaskAction).toHaveBeenCalledWith('task-widget-1', { status: 'done' });
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Task Completed',
          description: expect.stringMatching(/resolved/i),
        })
      );
    });
  });

  it('displays actionable error toast when updateTaskAction fails', async () => {
    mockUpdateTaskAction.mockResolvedValueOnce({
      success: false,
      error: 'Permission denied: operations:tasks:edit',
    });

    render(<TaskWidget initialTasks={sampleTasks} />);

    const completeButtons = screen.getAllByRole('button', { name: /complete/i });
    fireEvent.click(completeButtons[0]);

    await waitFor(() => {
      expect(mockUpdateTaskAction).toHaveBeenCalledWith('task-widget-1', { status: 'done' });
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
});
