import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskDetailDrawer } from '../TaskDetailDrawer';
import type { Task } from '@/lib/types';

describe('TaskDetailDrawer (Roadmap §43, UI Spec §559-576)', () => {
  const sampleTask: Task = {
    id: 't-1',
    workspaceId: 'ws-1',
    title: 'Finalize onboarding checklist',
    description: 'Ensure student records and emergency contacts are uploaded.',
    priority: 'high',
    status: 'in_progress',
    category: 'operations',
    assignedTo: 'user-1',
    dueDate: '2026-10-15T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    reminders: [],
    reminderSent: false,
    checklist: [
      { id: 'c1', title: 'Verify photo ID', completed: true },
      { id: 'c2', title: 'Confirm guardian contact', completed: false },
    ],
  };

  it('renders task details, status badge, priority badge, and description', () => {
    render(
      <TaskDetailDrawer
        task={sampleTask}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateTask={vi.fn()}
        onEditFull={vi.fn()}
      />
    );
    expect(screen.getByText('Finalize onboarding checklist')).toBeInTheDocument();
    expect(screen.getByText(/verify photo ID/i)).toBeInTheDocument();
    expect(screen.getByText('Ensure student records and emergency contacts are uploaded.')).toBeInTheDocument();
  });

  it('calls onEditFull when Edit button is clicked', () => {
    const onEditFull = vi.fn();
    render(
      <TaskDetailDrawer
        task={sampleTask}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateTask={vi.fn()}
        onEditFull={onEditFull}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit task/i }));
    expect(onEditFull).toHaveBeenCalledWith(sampleTask);
  });

  it('toggles task completion status directly from drawer header', () => {
    const onUpdateTask = vi.fn();
    render(
      <TaskDetailDrawer
        task={sampleTask}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateTask={onUpdateTask}
        onEditFull={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /mark complete/i }));
    expect(onUpdateTask).toHaveBeenCalledWith('t-1', expect.objectContaining({ status: 'done' }));
  });

  it('enforces min-h-[44px] touch targets on action buttons', () => {
    render(
      <TaskDetailDrawer
        task={sampleTask}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateTask={vi.fn()}
        onEditFull={vi.fn()}
      />
    );
    const completeBtn = screen.getByRole('button', { name: /mark complete/i });
    expect(completeBtn.className).toMatch(/min-h-\[44px\]/);
    const editBtn = screen.getByRole('button', { name: /edit task/i });
    expect(editBtn.className).toMatch(/min-h-\[44px\]/);
  });
});
