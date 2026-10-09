import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Task } from '@/lib/types';
import { TaskDetailDrawer } from '../TaskDetailDrawer';

// Mock server actions
const mockRetryTaskObligationSyncAction = vi.fn();
vi.mock('@/lib/task-server-actions', () => ({
  retryTaskObligationSyncAction: (...args: unknown[]) => mockRetryTaskObligationSyncAction(...args),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('TaskDetailDrawer Contract Obligation Recovery (Roadmap §78)', () => {
  const sampleFailedTask: Task = {
    id: 'task-sync-fail-1',
    title: 'Deliver Term Sheet Addendum',
    status: 'todo',
    priority: 'urgent',
    category: 'general',
    workspaceId: 'ws-recovery-1',
    relatedEntityType: 'Submission',
    relatedParentId: 'contract-456',
    relatedEntityId: 'ob-789',
    dueDate: '2026-10-25T12:00:00Z',
    obligationSyncStatus: 'failed',
    obligationSyncError: 'Contract obligation status 409 conflict',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders prominent recovery warning banner when obligationSyncStatus is failed', () => {
    render(
      <TaskDetailDrawer
        task={sampleFailedTask}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Contract obligation could not be synchronized/i)).toBeDefined();
    expect(screen.getByText(/Contract obligation status 409 conflict/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /retry synchronization/i })).toBeDefined();
  });

  it('invokes retryTaskObligationSyncAction and notifies user on success', async () => {
    mockRetryTaskObligationSyncAction.mockResolvedValueOnce({
      success: true,
      message: 'Obligation synchronized successfully',
    });
    const handleUpdate = vi.fn();

    render(
      <TaskDetailDrawer
        task={sampleFailedTask}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateTask={handleUpdate}
      />
    );

    const retryBtn = screen.getByRole('button', { name: /retry synchronization/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(mockRetryTaskObligationSyncAction).toHaveBeenCalledWith('task-sync-fail-1');
      expect(handleUpdate).toHaveBeenCalledWith(
        'task-sync-fail-1',
        expect.objectContaining({
          obligationSyncStatus: 'synced',
        })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sync Succeeded',
        })
      );
    });
  });

  it('displays actionable toast with relative link on retry failure', async () => {
    mockRetryTaskObligationSyncAction.mockResolvedValueOnce({
      success: false,
      error: 'Downstream provider unreachable',
    });

    render(
      <TaskDetailDrawer
        task={sampleFailedTask}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const retryBtn = screen.getByRole('button', { name: /retry synchronization/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(mockRetryTaskObligationSyncAction).toHaveBeenCalledWith('task-sync-fail-1');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Sync Failed',
          actionConfig: {
            path: '/admin/finance/agreements',
            label: 'View Agreements',
          },
        })
      );
    });
  });
});
