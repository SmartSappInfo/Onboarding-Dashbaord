import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskEmptyState } from '../primitives/TaskEmptyState';
import { TaskErrorState } from '../primitives/TaskErrorState';
import { TaskSkeleton } from '../primitives/TaskSkeleton';
import { ConfirmDialog } from '../primitives/ConfirmDialog';

describe('Task System States & Dialogs (Phase 1)', () => {
  describe('TaskEmptyState', () => {
    it('renders initial empty state when no filters are active', () => {
      const onCreate = vi.fn();
      render(
        <TaskEmptyState
          isFiltered={false}
          onCreateTask={onCreate}
        />
      );
      expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
      const btn = screen.getByRole('button', { name: /create task/i });
      fireEvent.click(btn);
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('renders filtered empty state with clear filters button when filters are active', () => {
      const onClear = vi.fn();
      render(
        <TaskEmptyState
          isFiltered={true}
          onClearFilters={onClear}
        />
      );
      expect(screen.getByText(/no tasks match/i)).toBeInTheDocument();
      const btn = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(btn);
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('TaskErrorState', () => {
    it('renders error message and actionable retry button', () => {
      const onRetry = vi.fn();
      render(
        <TaskErrorState
          message="Could not load tasks."
          onRetry={onRetry}
        />
      );
      expect(screen.getByText('Could not load tasks.')).toBeInTheDocument();
      const btn = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(btn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders relative link when actionConfig is provided', () => {
      render(
        <TaskErrorState
          message="Permission denied."
          actionConfig={{ path: '/admin/settings/permissions', label: 'View permissions' }}
        />
      );
      const link = screen.getByRole('link', { name: /view permissions/i });
      expect(link).toHaveAttribute('href', '/admin/settings/permissions');
    });
  });

  describe('TaskSkeleton', () => {
    it('renders list skeletons without crashing', () => {
      const { container } = render(<TaskSkeleton variant="list" count={3} />);
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('renders board skeletons without crashing', () => {
      const { container } = render(<TaskSkeleton variant="board" />);
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
  });

  describe('ConfirmDialog', () => {
    it('renders confirmation modal when open and handles confirm', async () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          title="Delete 5 tasks?"
          description="This action cannot be undone."
          confirmText="Delete tasks"
          variant="destructive"
        />
      );

      expect(screen.getByText('Delete 5 tasks?')).toBeInTheDocument();
      expect(screen.getAllByText('This action cannot be undone.').length).toBeGreaterThan(0);

      const confirmBtn = screen.getByRole('button', { name: /delete tasks/i });
      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
