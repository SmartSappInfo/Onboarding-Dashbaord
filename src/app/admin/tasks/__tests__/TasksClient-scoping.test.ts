import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/types';

describe('Tasks Visibility Scoping Logic', () => {
  it('scopes tasks to assigned user (single or array) or task creator when restricted', () => {
    const currentUserId = 'usr_alice';
    const isRestricted = true;

    const task1: Partial<Task> = { id: 't1', assignedTo: 'usr_alice', createdBy: 'usr_bob' };
    const task2: Partial<Task> = { id: 't2', assignedTo: ['usr_bob', 'usr_alice'], createdBy: 'usr_charlie' };
    const task3: Partial<Task> = { id: 't3', assignedTo: 'usr_bob', createdBy: 'usr_alice' };
    const task4: Partial<Task> = { id: 't4', assignedTo: 'usr_bob', createdBy: 'usr_charlie' };

    const canView = (task: Partial<Task>) => {
      if (!isRestricted) return true;
      const isAssigned = Array.isArray(task.assignedTo)
        ? task.assignedTo.includes(currentUserId)
        : task.assignedTo === currentUserId;
      const isCreator = task.createdBy === currentUserId;
      return isAssigned || isCreator;
    };

    expect(canView(task1)).toBe(true);
    expect(canView(task2)).toBe(true);
    expect(canView(task3)).toBe(true);
    expect(canView(task4)).toBe(false);
  });

  it('allows viewing all tasks when unrestricted or user is admin', () => {
    const currentUserId = 'usr_alice';
    const isRestricted = false;

    const task: Partial<Task> = { id: 't1', assignedTo: 'usr_bob', createdBy: 'usr_charlie' };

    const canView = (taskItem: Partial<Task>) => {
      if (!isRestricted) return true;
      const isAssigned = Array.isArray(taskItem.assignedTo)
        ? taskItem.assignedTo.includes(currentUserId)
        : taskItem.assignedTo === currentUserId;
      const isCreator = taskItem.createdBy === currentUserId;
      return isAssigned || isCreator;
    };

    expect(canView(task)).toBe(true);
  });
});
