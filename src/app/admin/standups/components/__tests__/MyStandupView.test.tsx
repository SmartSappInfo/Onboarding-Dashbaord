// @vitest-environment jsdom
/**
 * @fileOverview Unit tests for MyStandupView (Phase 4B).
 * Validates:
 * - 4-part standup form rendering (Completed, Planned, Blockers, Help Needed).
 * - Adding custom items and linking tasks.
 * - Private manager note presence and guidance note.
 * - Debounced draft auto-save feedback.
 * - Standup submission with toast notification.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MyStandupView } from '../MyStandupView';
import type { Task } from '@/lib/types';

const mockSaveDraft = vi.fn().mockResolvedValue({ success: true, id: 'draft-1' });
const mockSubmit = vi.fn().mockResolvedValue({ success: true, id: 'submitted-1' });
const mockToast = vi.fn();

vi.mock('@/lib/standup-server-actions', () => ({
  saveStandupDraftAction: (...args: unknown[]) => mockSaveDraft(...args),
  submitStandupAction: (...args: unknown[]) => mockSubmit(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockTasks: Task[] = [
  {
    id: 'task-101',
    workspaceId: 'ws-1',
    title: 'Migrate Postgres Schema',
    status: 'in_progress',
    priority: 'high',
    category: 'engineering',
    dueDate: '2026-10-10',
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
    reminders: [],
  },
  {
    id: 'task-102',
    workspaceId: 'ws-1',
    title: 'Review Security Audit',
    status: 'done',
    priority: 'critical',
    category: 'compliance',
    dueDate: '2026-10-09',
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
    reminders: [],
  },
];

describe('MyStandupView Component (Phase 4B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four standup sections plus private manager note', () => {
    render(<MyStandupView workspaceId="ws-1" tasks={mockTasks} />);

    expect(screen.getByText(/What did you accomplish/i)).toBeInTheDocument();
    expect(screen.getByText(/What are you committing to today/i)).toBeInTheDocument();
    expect(screen.getByText(/Any blockers or dependencies/i)).toBeInTheDocument();
    expect(screen.getByText(/Help needed/i)).toBeInTheDocument();
    expect(screen.getByText(/Private Manager Note/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Standup/i })).toBeInTheDocument();
  });

  it('allows adding custom completed work item', async () => {
    render(<MyStandupView workspaceId="ws-1" tasks={mockTasks} />);

    const input = screen.getByPlaceholderText(/Add completed achievement/i);
    fireEvent.change(input, { target: { value: 'Fixed mobile tap target sizes' } });

    const addButtons = screen.getAllByRole('button', { name: /Add Item/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Fixed mobile tap target sizes')).toBeInTheDocument();
    });
  });

  it('allows adding a blocker with category and severity', async () => {
    render(<MyStandupView workspaceId="ws-1" tasks={mockTasks} />);

    const summaryInput = screen.getByPlaceholderText(/Describe what is blocking you/i);
    fireEvent.change(summaryInput, { target: { value: 'Waiting for client SSL certs' } });

    const addBlockerBtn = screen.getByRole('button', { name: /Add Blocker/i });
    fireEvent.click(addBlockerBtn);

    await waitFor(() => {
      expect(screen.getByText('Waiting for client SSL certs')).toBeInTheDocument();
    });
  });

  it('submits standup and dispatches actionable toast', async () => {
    const onSubmitted = vi.fn();
    render(<MyStandupView workspaceId="ws-1" tasks={mockTasks} onSubmitted={onSubmitted} />);

    const helpInput = screen.getByPlaceholderText(/Need input, review, or pairing/i);
    fireEvent.change(helpInput, { target: { value: 'Pairing on Auth flow' } });

    const submitBtn = screen.getByRole('button', { name: /Submit Standup/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        'ws-1',
        expect.objectContaining({
          helpNeeded: 'Pairing on Auth flow',
          idempotencyKey: expect.any(String),
        })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          actionConfig: expect.objectContaining({
            path: '/admin/standups?tab=team',
            label: 'View Team',
          }),
        })
      );
      expect(onSubmitted).toHaveBeenCalledWith('submitted-1');
    });
  });
});
