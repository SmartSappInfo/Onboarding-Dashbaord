import { describe, it, expect } from 'vitest';
import type { Task, TaskChecklistItem, TaskReminder } from '@/lib/types';

describe('Task Checklist & Reminders Domain Contracts (Phase 3)', () => {
  it('defines valid TaskChecklistItem structure with completion metadata', () => {
    const item: TaskChecklistItem = {
      id: 'chk-1',
      title: 'Review contract terms',
      completed: true,
      completedAt: '2026-10-09T10:00:00.000Z',
      completedBy: 'user-123',
    };
    expect(item.id).toBe('chk-1');
    expect(item.completed).toBe(true);
    expect(item.completedAt).toBeDefined();
    expect(item.completedBy).toBe('user-123');
  });

  it('defines valid TaskReminder structure with delivery statuses', () => {
    const reminder: TaskReminder = {
      id: 'rem-1',
      reminderTime: '2026-10-10T09:00:00.000Z',
      channels: ['notification', 'email'],
      sent: false,
      status: 'scheduled',
      error: null,
    };
    expect(reminder.id).toBe('rem-1');
    expect(reminder.status).toBe('scheduled');
    expect(reminder.channels).toContain('email');
  });

  it('allows Task to carry checklist items and reminders', () => {
    const task: Partial<Task> = {
      id: 'task-1',
      title: 'Prepare Proposal',
      checklist: [
        { id: 'c1', title: 'Confirm budget', completed: true },
        { id: 'c2', title: 'Send draft', completed: false },
      ],
      reminders: [
        { id: 'r1', reminderTime: '2026-10-10T09:00:00.000Z', channels: ['email'], sent: false, status: 'scheduled' },
      ],
    };
    expect(task.checklist?.length).toBe(2);
    expect(task.reminders?.length).toBe(1);
  });
});
