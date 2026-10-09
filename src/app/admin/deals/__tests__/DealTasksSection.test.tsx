import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Task } from '@/lib/types';
import { CompactTaskCard } from '@/app/admin/tasks/components/CompactTaskCard';
import { TaskDetailDrawer } from '@/app/admin/tasks/components/TaskDetailDrawer';

// Mock server actions
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

describe('Deals Detail Upcoming Tasks Harmonization (Roadmap §77)', () => {
  const sampleDealTask: Task = {
    id: 'deal-task-1',
    title: 'Schedule Contract Signing Review',
    status: 'todo',
    priority: 'urgent',
    category: 'general',
    workspaceId: 'ws-deal-1',
    dealId: 'deal-999',
    entityId: 'ent-123',
    entityName: 'Globex Corp',
    dueDate: '2026-10-22T10:00:00Z',
    checklist: [
      { id: 'step-1', title: 'Prepare PDF agreement', completed: false },
    ],
    obligationSyncStatus: 'failed',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CompactTaskCard with showRelationship={false} to avoid redundant relationship badge on deal page', () => {
    const handleToggle = vi.fn();
    const handleCardClick = vi.fn();

    render(
      <CompactTaskCard
        task={sampleDealTask}
        showRelationship={false}
        onClick={handleCardClick}
        onToggleComplete={handleToggle}
      />
    );

    expect(screen.getByText('Schedule Contract Signing Review')).toBeDefined();
    expect(screen.getByText(/urgent/i)).toBeDefined();
    // Globex Corp relationship badge should be omitted
    expect(screen.queryByText('Globex Corp')).toBeNull();
  });

  it('opens in-place TaskDetailDrawer when a deal task is clicked', () => {
    function DealTasksWrapper() {
      const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
      const [isOpen, setIsOpen] = React.useState(false);

      return (
        <div>
          <CompactTaskCard
            task={sampleDealTask}
            showRelationship={false}
            onClick={(t) => {
              setSelectedTask(t);
              setIsOpen(true);
            }}
          />
          <TaskDetailDrawer
            task={selectedTask}
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
          />
        </div>
      );
    }

    render(<DealTasksWrapper />);

    const card = screen.getByRole('button', { name: /Task: Schedule Contract Signing Review/i });
    fireEvent.click(card);

    expect(screen.getByRole('button', { name: /close drawer/i })).toBeDefined();
    expect(screen.getByText('Prepare PDF agreement')).toBeDefined();
  });

  it('allows retrying failed contract obligation sync inline from the deal task card', async () => {
    mockRetryTaskObligationSyncAction.mockResolvedValueOnce({
      success: true,
      message: 'Obligation synchronized successfully',
    });

    const handleRetry = async (taskId: string) => {
      const res = await mockRetryTaskObligationSyncAction(taskId);
      if (res.success) {
        mockToast({ title: 'Sync Succeeded' });
      }
    };

    render(
      <CompactTaskCard
        task={sampleDealTask}
        showRelationship={false}
        onRetrySync={handleRetry}
      />
    );

    const retryBtn = screen.getByRole('button', { name: /retry sync/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(mockRetryTaskObligationSyncAction).toHaveBeenCalledWith('deal-task-1');
      expect(mockToast).toHaveBeenCalledWith({ title: 'Sync Succeeded' });
    });
  });
});
