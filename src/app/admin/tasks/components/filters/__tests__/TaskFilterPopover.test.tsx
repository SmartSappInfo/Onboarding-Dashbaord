import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskFilterPopover } from '../TaskFilterPopover';

vi.mock('@/components/tags/TagSelector', () => ({
  TagSelector: ({
    currentTagIds,
    onTagsChange,
  }: {
    currentTagIds: string[];
    onTagsChange?: (ids: string[]) => void;
  }) => (
    <div data-testid="mock-tag-selector">
      <span data-testid="tag-count">{currentTagIds.length}</span>
      <button
        type="button"
        onClick={() => onTagsChange?.(['tag-urgent'])}
        data-testid="select-tag-btn"
      >
        Select Tag
      </button>
      <button
        type="button"
        onClick={() => onTagsChange?.([])}
        data-testid="clear-tag-btn"
      >
        Clear Tags
      </button>
    </div>
  ),
}));

describe('TaskFilterPopover (Roadmap §29, UI Spec §507, 513)', () => {
  it('renders trigger button with min-h-[44px] and active badge when filters are applied', () => {
    const { rerender } = render(
      <TaskFilterPopover
        statusFilter="all"
        onStatusChange={vi.fn()}
        priorityFilter="all"
        onPriorityChange={vi.fn()}
        selectedTagId="all"
        onTagChange={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /filters/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain('min-h-[44px]');
    expect(screen.queryByTestId('active-filters-badge')).not.toBeInTheDocument();

    // Rerender with 2 filters active
    rerender(
      <TaskFilterPopover
        statusFilter="todo"
        onStatusChange={vi.fn()}
        priorityFilter="urgent"
        onPriorityChange={vi.fn()}
        selectedTagId="all"
        onTagChange={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );

    const badge = screen.getByTestId('active-filters-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('2');
  });

  it('opens popover and allows selecting status and priority', () => {
    const onStatusChange = vi.fn();
    const onPriorityChange = vi.fn();

    render(
      <TaskFilterPopover
        statusFilter="all"
        onStatusChange={onStatusChange}
        priorityFilter="all"
        onPriorityChange={onPriorityChange}
        selectedTagId="all"
        onTagChange={vi.fn()}
        onClearFilters={vi.fn()}
      />
    );

    // Open popover
    const trigger = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(trigger);

    // Click 'To Do' status chip
    const todoChip = screen.getByRole('button', { name: /to do/i });
    fireEvent.click(todoChip);
    expect(onStatusChange).toHaveBeenCalledWith('todo');

    // Click 'Urgent' priority chip
    const urgentChip = screen.getByRole('button', { name: /urgent/i });
    fireEvent.click(urgentChip);
    expect(onPriorityChange).toHaveBeenCalledWith('urgent');
  });

  it('integrates TagSelector in client draft mode and delegates tag changes', () => {
    const onTagChange = vi.fn();

    render(
      <TaskFilterPopover
        statusFilter="all"
        onStatusChange={vi.fn()}
        priorityFilter="all"
        onPriorityChange={vi.fn()}
        selectedTagId="tag-123"
        onTagChange={onTagChange}
        onClearFilters={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(trigger);

    expect(screen.getByTestId('mock-tag-selector')).toBeInTheDocument();
    expect(screen.getByTestId('tag-count').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('select-tag-btn'));
    expect(onTagChange).toHaveBeenCalledWith('tag-urgent');

    fireEvent.click(screen.getByTestId('clear-tag-btn'));
    expect(onTagChange).toHaveBeenCalledWith('all');
  });

  it('triggers onClearFilters when reset button is clicked', () => {
    const onClearFilters = vi.fn();

    render(
      <TaskFilterPopover
        statusFilter="done"
        onStatusChange={vi.fn()}
        priorityFilter="high"
        onPriorityChange={vi.fn()}
        selectedTagId="tag-1"
        onTagChange={vi.fn()}
        onClearFilters={onClearFilters}
      />
    );

    const trigger = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(trigger);

    const clearButton = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearButton);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
