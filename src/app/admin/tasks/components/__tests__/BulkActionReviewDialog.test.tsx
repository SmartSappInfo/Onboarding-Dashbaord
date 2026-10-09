import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionReviewDialog } from '../BulkActionReviewDialog';

describe('BulkActionReviewDialog (Phase 1)', () => {
  const sampleTasks = [
    { id: 'task-1', title: 'Prepare onboarding packet' },
    { id: 'task-2', title: 'Review compliance clauses' },
    { id: 'task-3', title: 'Collect payment proof' },
  ];

  it('renders status change review stage with task count, target label, and title previews', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <BulkActionReviewDialog
        isOpen={true}
        onClose={onClose}
        actionType="status"
        selectedTaskIds={['task-1', 'task-2', 'task-3']}
        selectedTasks={sampleTasks}
        targetValue="done"
        targetLabel="Resolved"
        onConfirm={onConfirm}
      />
    );

    // Verify title and description
    expect(screen.getByText(/Review Bulk Status Update/i)).toBeInTheDocument();
    expect(screen.getByText(/3 tasks selected/i)).toBeInTheDocument();
    expect(screen.getByText(/target status:/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolved/i)).toBeInTheDocument();

    // Verify task preview
    expect(screen.getByText('Prepare onboarding packet')).toBeInTheDocument();
    expect(screen.getByText('Review compliance clauses')).toBeInTheDocument();
    expect(screen.getByText('Collect payment proof')).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole('button', { name: /apply status update/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith({
      actionType: 'status',
      taskIds: ['task-1', 'task-2', 'task-3'],
      targetValue: 'done',
      targetLabel: 'Resolved',
    });
  });

  it('renders destructive delete warning with red destructive CTA and impact explanation', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <BulkActionReviewDialog
        isOpen={true}
        onClose={onClose}
        actionType="delete"
        selectedTaskIds={['task-1', 'task-2']}
        selectedTasks={sampleTasks.slice(0, 2)}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText(/Review Bulk Deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/2 tasks will be permanently deleted/i)).toBeInTheDocument();
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();

    const deleteButton = screen.getByRole('button', { name: /delete 2 tasks/i });
    expect(deleteButton).toHaveClass('bg-destructive');

    fireEvent.click(deleteButton);
    expect(onConfirm).toHaveBeenCalledWith({
      actionType: 'delete',
      taskIds: ['task-1', 'task-2'],
      targetValue: undefined,
      targetLabel: undefined,
    });
  });

  it('renders partial failure stage with failure reasons and retry button', () => {
    const onRetryFailed = vi.fn();
    const onClose = vi.fn();

    const failedTasks = [
      { id: 'task-2', title: 'Review compliance clauses', error: 'Workspace permission denied' },
    ];

    render(
      <BulkActionReviewDialog
        isOpen={true}
        onClose={onClose}
        actionType="status"
        selectedTaskIds={['task-1', 'task-2', 'task-3']}
        selectedTasks={sampleTasks}
        targetValue="done"
        targetLabel="Resolved"
        failedTasks={failedTasks}
        onConfirm={vi.fn()}
        onRetryFailed={onRetryFailed}
      />
    );

    expect(screen.getByText(/Action Completed with Errors/i)).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 tasks failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Review compliance clauses/i)).toBeInTheDocument();
    expect(screen.getByText(/Workspace permission denied/i)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /retry failed tasks/i });
    fireEvent.click(retryButton);
    expect(onRetryFailed).toHaveBeenCalledWith(['task-2']);
  });

  it('displays loading spinner and disables buttons during execution', () => {
    render(
      <BulkActionReviewDialog
        isOpen={true}
        onClose={vi.fn()}
        actionType="assign"
        selectedTaskIds={['task-1']}
        selectedTasks={sampleTasks.slice(0, 1)}
        targetValue="usr-123"
        targetLabel="Jane Doe"
        isExecuting={true}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /reassign tasks/i })).toBeDisabled();
  });
});
