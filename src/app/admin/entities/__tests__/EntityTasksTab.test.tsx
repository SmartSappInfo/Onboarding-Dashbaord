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

describe('CRM Entity Tasks Tab Harmonization (Roadmap §77)', () => {
  const sampleEntityTask: Task = {
    id: 'ent-task-1',
    title: 'Follow up on NDA status',
    status: 'todo',
    priority: 'urgent',
    category: 'general',
    workspaceId: 'ws-entity-1',
    entityId: 'entity-123',
    entityName: 'Acme Corp',
    entityType: 'organization',
    dueDate: '2026-10-20T12:00:00Z',
    checklist: [
      { id: 'c1', title: 'Call legal counsel', completed: false },
    ],
    obligationSyncStatus: 'failed',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CompactTaskCard with showRelationship={false} to suppress duplicate entity chip', () => {
    const handleCardClick = vi.fn();
    const handleToggle = vi.fn();

    render(
      <CompactTaskCard
        task={sampleEntityTask}
        showRelationship={false}
        onClick={handleCardClick}
        onToggleComplete={handleToggle}
      />
    );

    // Title and priority rendered
    expect(screen.getByText('Follow up on NDA status')).toBeDefined();
    expect(screen.getByText(/urgent/i)).toBeDefined();

    // Relationship badge should NOT be rendered when showRelationship={false}
    expect(screen.queryByText('Acme Corp')).toBeNull();
  });

  it('triggers slide-over detail drawer when card is clicked in place', () => {
    function EntityTasksWrapper() {
      const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
      const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

      return (
        <div>
          <CompactTaskCard
            task={sampleEntityTask}
            showRelationship={false}
            onClick={(task) => {
              setSelectedTask(task);
              setIsDrawerOpen(true);
            }}
          />
          <TaskDetailDrawer
            task={selectedTask}
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
          />
        </div>
      );
    }

    render(<EntityTasksWrapper />);

    // Click the card
    const card = screen.getByRole('button', { name: /Task: Follow up on NDA status/i });
    fireEvent.click(card);

    // Detail drawer should open in place with full inspection
    expect(screen.getByRole('button', { name: /close drawer/i })).toBeDefined();
    expect(screen.getByText('Call legal counsel')).toBeDefined();
  });

  it('handles downstream contract obligation sync retry within the entity view', async () => {
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
        task={sampleEntityTask}
        showRelationship={false}
        onRetrySync={handleRetry}
      />
    );

    const retryBtn = screen.getByRole('button', { name: /retry sync/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(mockRetryTaskObligationSyncAction).toHaveBeenCalledWith('ent-task-1');
      expect(mockToast).toHaveBeenCalledWith({ title: 'Sync Succeeded' });
    });
  });
});
