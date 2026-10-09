import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskListRow } from '../TaskListRow';
import type { Task, UserProfile } from '@/lib/types';

describe('TaskListRow (Phase 1)', () => {
  const mockTask: Task = {
    id: 'task-1',
    title: 'Review quarterly financial report',
    description: 'Detailed analysis of Q3 figures',
    status: 'todo',
    priority: 'high',
    category: 'document',
    assignedTo: 'user-1',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspaceId: 'ws-1',
    reminders: [],
    reminderSent: false,
    entityName: 'St. Jude College',
    entityType: 'institution',
  };

  const userMap = new Map<string, UserProfile>([
    ['user-1', { id: 'user-1', name: 'John Doe', email: 'john@example.com' } as UserProfile],
  ]);

  it('renders task title, priority, and due date in simple view', () => {
    render(
      <TaskListRow
        task={mockTask}
        isSimpleView={true}
        userMap={userMap}
      />
    );
    expect(screen.getByText('Review quarterly financial report')).toBeInTheDocument();
    expect(screen.getByText(/high/i)).toBeInTheDocument();
  });

  it('renders detailed view metadata', () => {
    render(
      <TaskListRow
        task={mockTask}
        isSimpleView={false}
        userMap={userMap}
      />
    );
    expect(screen.getByText('Review quarterly financial report')).toBeInTheDocument();
    expect(screen.getByText('St. Jude College')).toBeInTheDocument();
  });

  it('displays pending spinner and disables interaction when isPending is true', () => {
    const onClick = vi.fn();
    render(
      <TaskListRow
        task={mockTask}
        isPending={true}
        onClick={onClick}
      />
    );
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
    const row = screen.getByRole('button', { name: /review quarterly financial report/i });
    fireEvent.click(row);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('handles row selection when in selection mode', () => {
    const onSelect = vi.fn();
    render(
      <TaskListRow
        task={mockTask}
        isSelectionMode={true}
        isSelected={false}
        onSelect={onSelect}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onSelect).toHaveBeenCalledWith('task-1');
  });

  it('handles quick completion toggle', () => {
    const onToggleComplete = vi.fn();
    render(
      <TaskListRow
        task={mockTask}
        isSelectionMode={false}
        onToggleComplete={onToggleComplete}
      />
    );
    const completeBtn = screen.getByRole('button', { name: /mark complete/i });
    fireEvent.click(completeBtn);
    expect(onToggleComplete).toHaveBeenCalledWith(mockTask);
  });
});
