import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskCalendar from '../TaskCalendar';
import type { Task } from '@/lib/types';

describe('TaskCalendar Standards & Mobile Agenda (Roadmap §28, UI Spec §491-501)', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Audit Compliance Clause',
      status: 'todo',
      priority: 'high',
      dueDate: new Date().toISOString(),
      assignedTo: 'user-1',
      workspaceId: 'ws-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'document',
      reminders: [],
      reminderSent: false,
    },
    {
      id: 'task-2',
      title: 'Overdue Vendor Agreement',
      status: 'todo',
      priority: 'urgent',
      dueDate: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days overdue
      assignedTo: 'user-1',
      workspaceId: 'ws-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'document',
      reminders: [],
      reminderSent: false,
    }
  ];

  it('renders calendar controls with Month, Week, Day, and Agenda options', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^day$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agenda/i })).toBeInTheDocument();
  });

  it('renders overdue task section in Agenda view', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /agenda/i }));
    expect(screen.getByText('Overdue Tasks')).toBeInTheDocument();
    expect(screen.getByText('Overdue Vendor Agreement')).toBeInTheDocument();
  });

  it('satisfies min-h-[44px] touch targets on navigation controls', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={vi.fn()}
      />
    );
    const todayBtn = screen.getByRole('button', { name: /today/i });
    expect(todayBtn.className).toMatch(/min-h-\[44px\]/);
  });
});
