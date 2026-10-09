// @vitest-environment jsdom
/**
 * @fileOverview Unit & Integration tests for Task Copilot Bar and Dialog (Phase 4D).
 * Validates:
 * - Natural-language task drafting via TaskCopilotBar.
 * - Review and ambiguity display in TaskCopilotDialog.
 * - Two-Phase Action Model invariant: zero database writes before explicit user confirmation.
 * - Task creation dispatch with checklist items.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskCopilotBar } from '../TaskCopilotBar';
import { TaskCopilotDialog } from '../TaskCopilotDialog';
import type { TaskCopilotProposal } from '@/ai/schemas/task-copilot-schemas';

const mockParseAction = vi.fn();
const mockCreateTask = vi.fn().mockResolvedValue({ success: true, data: { id: 'task-new-1' } });
const mockToast = vi.fn();

vi.mock('@/app/actions/task-copilot-actions', () => ({
  parseTaskPromptAction: (...args: unknown[]) => mockParseAction(...args),
}));

vi.mock('@/lib/task-server-actions', () => ({
  createTaskAction: (...args: unknown[]) => mockCreateTask(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('Task Copilot Engine & Two-Phase Dialog (Phase 4D)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TaskCopilotBar', () => {
    it('renders AI input bar and triggers parsing action on submit', async () => {
      mockParseAction.mockResolvedValue({
        success: true,
        proposal: {
          title: 'Review staging build',
          priority: 'high',
          category: 'engineering',
          confidenceScore: 0.9,
          provenanceNotes: [],
          suggestedChecklist: [],
          detectedAmbiguities: [],
        },
      });

      render(<TaskCopilotBar workspaceId="ws-1" />);

      const input = screen.getByLabelText(/Describe a task with AI/i);
      fireEvent.change(input, { target: { value: 'Review staging build high priority' } });

      const button = screen.getByRole('button', { name: /Draft with AI/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockParseAction).toHaveBeenCalledWith(
          'ws-1',
          'Review staging build high priority'
        );
      });
    });
  });

  describe('TaskCopilotDialog & Confirmation', () => {
    const mockProposal: TaskCopilotProposal = {
      title: 'Prepare demo for client meeting',
      description: 'Demo latest portal features',
      priority: 'high',
      category: 'general',
      dueDate: '2026-10-15',
      assignedTo: [],
      confidenceScore: 0.95,
      provenanceNotes: ['Parsed via AI'],
      suggestedChecklist: ['Verify staging seed data', 'Rehearse slide deck'],
      detectedAmbiguities: [
        {
          field: 'assignedTo',
          options: ['Sarah Jenkins', 'Sarah Connor'],
          reason: 'Multiple team members named Sarah',
        },
      ],
    };

    it('renders proposal details, ambiguities, and checklist items', () => {
      render(
        <TaskCopilotDialog
          open={true}
          onOpenChange={vi.fn()}
          proposal={mockProposal}
          workspaceId="ws-1"
        />
      );

      expect(screen.getByText('Review AI Task Proposal')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Prepare demo for client meeting')).toBeInTheDocument();
      expect(screen.getByText(/Multiple team members named Sarah/i)).toBeInTheDocument();
      expect(screen.getByText('Verify staging seed data')).toBeInTheDocument();
      expect(screen.getByText('Rehearse slide deck')).toBeInTheDocument();
    });

    it('creates task ONLY when user clicks Confirm & Create Task (Two-Phase Action Model)', async () => {
      const onTaskCreated = vi.fn();
      const onOpenChange = vi.fn();

      render(
        <TaskCopilotDialog
          open={true}
          onOpenChange={onOpenChange}
          proposal={mockProposal}
          workspaceId="ws-1"
          onTaskCreated={onTaskCreated}
        />
      );

      // Verify no create action called yet
      expect(mockCreateTask).not.toHaveBeenCalled();

      // Click Confirm & Create Task
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Create Task/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            workspaceId: 'ws-1',
            title: 'Prepare demo for client meeting',
            priority: 'high',
            category: 'general',
            dueDate: '2026-10-15',
            checklist: expect.arrayContaining([
              expect.objectContaining({ title: 'Verify staging seed data' }),
              expect.objectContaining({ title: 'Rehearse slide deck' }),
            ]),
          })
        );
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onTaskCreated).toHaveBeenCalledWith('task-new-1');
      });
    });

    it('does NOT create task if user cancels', () => {
      const onOpenChange = vi.fn();

      render(
        <TaskCopilotDialog
          open={true}
          onOpenChange={onOpenChange}
          proposal={mockProposal}
          workspaceId="ws-1"
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelBtn);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });
});
