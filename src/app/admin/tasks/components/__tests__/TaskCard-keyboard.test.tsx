import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import TaskCard from '../TaskCard';
import type { Task } from '@/lib/types';

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

const mockTask: Task = {
  id: 'task_kb_1',
  workspaceId: 'ws_1',
  title: 'Audit user security permissions',
  description: 'Annual security check',
  priority: 'high',
  status: 'todo',
  category: 'follow_up',
  assignedTo: ['usr_1'],
  dueDate: '2026-10-15T10:00:00Z',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  reminders: [],
  reminderSent: false,
};

describe('TaskCard Keyboard Accessibility (Phase 2 - UI-02)', () => {
  it('renders an accessible status switcher trigger for keyboard users', () => {
    const onStatusChange = vi.fn();
    render(<TaskCard task={mockTask} onStatusChange={onStatusChange} />);

    const menuTrigger = screen.getByRole('button', { name: /change status/i });
    expect(menuTrigger).toBeTruthy();
  });

  it('triggers onStatusChange when selecting a new status', async () => {
    const onStatusChange = vi.fn();
    render(<TaskCard task={mockTask} onStatusChange={onStatusChange} />);

    const menuTrigger = screen.getByRole('button', { name: /change status/i });
    fireEvent.keyDown(menuTrigger, { key: 'Enter', code: 'Enter' });

    const inProgressOption = await screen.findByRole('menuitem', { name: /in progress/i });
    fireEvent.click(inProgressOption);

    expect(onStatusChange).toHaveBeenCalledWith('task_kb_1', 'in_progress');
  });
});
