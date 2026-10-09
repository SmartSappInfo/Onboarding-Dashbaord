// @vitest-environment jsdom
/**
 * @fileOverview Unit tests for TaskDetailDrawer AI Checklist Suggestions (Phase 4D).
 * Validates:
 * - "Suggest steps with AI" button presence.
 * - Calling suggestTaskChecklistAction.
 * - Staging new steps into task checklist via onUpdateTask.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskDetailDrawer } from '../TaskDetailDrawer';
import type { Task } from '@/lib/types';

const mockSuggestAction = vi.fn();
const mockToast = vi.fn();

vi.mock('@/app/actions/task-copilot-actions', () => ({
  suggestTaskChecklistAction: (...args: unknown[]) => mockSuggestAction(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockTask: Task = {
  id: 'task-100',
  workspaceId: 'ws-1',
  title: 'Deploy microservice to staging',
  status: 'in_progress',
  priority: 'high',
  category: 'engineering',
  dueDate: '2026-10-15',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
  reminders: [],
  checklist: [{ id: 'c1', title: 'Run linter', completed: true, position: 0 }],
};

describe('TaskDetailDrawer AI Integration (Phase 4D)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Suggest steps with AI button', () => {
    render(
      <TaskDetailDrawer
        task={mockTask}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Suggest steps with AI/i })).toBeInTheDocument();
  });

  it('generates and appends checklist steps via onUpdateTask', async () => {
    mockSuggestAction.mockResolvedValue({
      success: true,
      checklist: {
        taskId: 'task-100',
        taskTitle: 'Deploy microservice to staging',
        items: ['Run pre-flight tests', 'Deploy container image'],
      },
    });

    const onUpdateTask = vi.fn();

    render(
      <TaskDetailDrawer
        task={mockTask}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateTask={onUpdateTask}
      />
    );

    const suggestBtn = screen.getByRole('button', { name: /Suggest steps with AI/i });
    fireEvent.click(suggestBtn);

    await waitFor(() => {
      expect(mockSuggestAction).toHaveBeenCalledWith(
        'ws-1',
        'task-100',
        'Deploy microservice to staging'
      );
      expect(onUpdateTask).toHaveBeenCalledWith(
        'task-100',
        expect.objectContaining({
          checklist: expect.arrayContaining([
            expect.objectContaining({ title: 'Run linter' }),
            expect.objectContaining({ title: 'Run pre-flight tests' }),
            expect.objectContaining({ title: 'Deploy container image' }),
          ]),
        })
      );
    });
  });
});
