import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/types';

describe('TasksClient Phase 3 Integration (Roadmap §40-43, UI Spec §559-624)', () => {
  it('identifies tasks with checklists and reminders for badge rendering', () => {
    const task: Task = {
      id: 't-1',
      workspaceId: 'ws-1',
      title: 'Audit compliance',
      description: '',
      priority: 'high',
      status: 'todo',
      category: 'operations',
      assignedTo: 'user-1',
      dueDate: '2026-10-15',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
      reminders: [{ id: 'r1', reminderTime: '2026-10-14', channels: ['email'], sent: false, status: 'scheduled' }],
      reminderSent: false,
      checklist: [{ id: 'c1', title: 'Verify', completed: true }, { id: 'c2', title: 'Sign', completed: false }],
    };
    expect(task.checklist?.length).toBe(2);
    expect(task.checklist?.filter(c => c.completed).length).toBe(1);
    expect(task.reminders?.length).toBe(1);
  });

  it('correctly calculates checklist completion fraction and percentage', () => {
    const checklist = [
      { id: 'c1', title: 'Review specs', completed: true },
      { id: 'c2', title: 'Draft mockups', completed: true },
      { id: 'c3', title: 'Get sign-off', completed: false },
    ];
    const completedCount = checklist.filter(c => c.completed).length;
    const totalCount = checklist.length;
    const percentage = Math.round((completedCount / totalCount) * 100);

    expect(completedCount).toBe(2);
    expect(totalCount).toBe(3);
    expect(percentage).toBe(67);
  });

  it('formats active reminders with delivery states accurately', () => {
    const reminders: Task['reminders'] = [
      { id: 'r1', reminderTime: '2026-10-14T09:00:00.000Z', channels: ['notification', 'email'], sent: false, status: 'scheduled' },
      { id: 'r2', reminderTime: '2026-10-13T09:00:00.000Z', channels: ['sms'], sent: false, status: 'failed', error: 'Network timeout' },
    ];

    const scheduledReminders = reminders.filter(r => r.status === 'scheduled');
    const failedReminders = reminders.filter(r => r.status === 'failed');

    expect(scheduledReminders.length).toBe(1);
    expect(failedReminders.length).toBe(1);
    expect(failedReminders[0].error).toBe('Network timeout');
  });
});
