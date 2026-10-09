import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from '../TaskCard';
import type { Task } from '@/lib/types';

describe('TaskCard Mutation Feedback & Contract Sync (Phase 1)', () => {
  const baseTask: Task = {
    id: 'task-100',
    title: 'Finalize Institutional SLA',
    description: 'Ensure all clauses are signed',
    status: 'in_progress',
    priority: 'urgent',
    category: 'document',
    assignedTo: 'user-1',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspaceId: 'ws-1',
    reminders: [],
    reminderSent: false,
    entityName: 'Apex Academy',
    entityType: 'institution',
    relatedEntityType: 'School',
  };

  it('renders pending saving indicator and disables card click when isPending is true', () => {
    const onClick = vi.fn();
    render(
      <TaskCard
        task={baseTask}
        isPending={true}
        onClick={onClick}
      />
    );

    expect(screen.getByText(/saving/i)).toBeInTheDocument();
    const card = screen.getByRole('button', { name: /finalize institutional sla/i });
    fireEvent.click(card);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders contract obligation sync status badge', () => {
    const { rerender } = render(
      <TaskCard
        task={{ ...baseTask, status: 'done' }}
        obligationSyncStatus="pending"
      />
    );
    expect(screen.getByText(/sync pending/i)).toBeInTheDocument();

    rerender(
      <TaskCard
        task={{ ...baseTask, status: 'done' }}
        obligationSyncStatus="synced"
      />
    );
    expect(screen.getByText(/synced/i)).toBeInTheDocument();
  });
});
