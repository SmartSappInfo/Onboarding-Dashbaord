import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskFilterChips, type FilterChipItem } from '../TaskFilterChips';

describe('TaskFilterChips (Roadmap §29, UI Spec §507, 513)', () => {
  const sampleChips: FilterChipItem[] = [
    { key: 'status', label: 'Status: In Progress', value: 'in_progress' },
    { key: 'priority', label: 'Priority: Urgent', value: 'urgent' },
    { key: 'tag', label: 'Tag: High Value', value: 'tag-1' },
  ];

  it('renders active filter chips with label and dismiss buttons', () => {
    render(
      <TaskFilterChips
        chips={sampleChips}
        totalMatching={8}
        onRemoveChip={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(screen.getByText('Status: In Progress')).toBeInTheDocument();
    expect(screen.getByText('Priority: Urgent')).toBeInTheDocument();
    expect(screen.getByText('Tag: High Value')).toBeInTheDocument();
    expect(screen.getByText(/tasks match/i)).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('calls onRemoveChip when individual X button is clicked', () => {
    const onRemoveChip = vi.fn();
    render(
      <TaskFilterChips
        chips={sampleChips}
        onRemoveChip={onRemoveChip}
        onClearAll={vi.fn()}
      />
    );
    const removeButtons = screen.getAllByRole('button', { name: /remove filter/i });
    fireEvent.click(removeButtons[0]);
    expect(onRemoveChip).toHaveBeenCalledWith(sampleChips[0]);
  });

  it('calls onClearAll when Clear all button is clicked', () => {
    const onClearAll = vi.fn();
    render(
      <TaskFilterChips
        chips={sampleChips}
        onRemoveChip={vi.fn()}
        onClearAll={onClearAll}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when chips array is empty', () => {
    const { container } = render(
      <TaskFilterChips
        chips={[]}
        onRemoveChip={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
