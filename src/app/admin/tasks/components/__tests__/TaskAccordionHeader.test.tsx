import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskAccordionHeader, type SubFilterOption } from '../TaskAccordionHeader';

describe('TaskAccordionHeader (Roadmap §28, UI Spec §510)', () => {
  const mockFilters: SubFilterOption<'today' | 'yesterday' | 'all_time'>[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'all_time', label: 'All Time' },
  ];

  it('renders title, count, and filter chips', () => {
    render(
      <TaskAccordionHeader
        title="Completed"
        count={7}
        filterOptions={mockFilters}
        activeFilter="today"
        onSelectFilter={vi.fn()}
        isExpanded={true}
        onToggleExpand={vi.fn()}
      />
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter completed by today/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter completed by yesterday/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter completed by all time/i })).toBeInTheDocument();
  });

  it('calls onSelectFilter and does NOT trigger onToggleExpand when a filter chip is clicked', () => {
    const onSelectFilter = vi.fn();
    const onToggleExpand = vi.fn();

    render(
      <TaskAccordionHeader
        title="Completed"
        count={7}
        filterOptions={mockFilters}
        activeFilter="today"
        onSelectFilter={onSelectFilter}
        isExpanded={true}
        onToggleExpand={onToggleExpand}
      />
    );

    const yesterdayChip = screen.getByRole('button', { name: /filter completed by yesterday/i });
    fireEvent.click(yesterdayChip);

    expect(onSelectFilter).toHaveBeenCalledWith('yesterday');
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('triggers onToggleExpand when clicking the accordion header background/title', () => {
    const onToggleExpand = vi.fn();

    render(
      <TaskAccordionHeader
        title="Completed"
        count={7}
        filterOptions={mockFilters}
        activeFilter="today"
        onSelectFilter={vi.fn()}
        isExpanded={true}
        onToggleExpand={onToggleExpand}
      />
    );

    const toggleButton = screen.getByTestId('accordion-toggle-btn');
    fireEvent.click(toggleButton);

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it('satisfies touch target requirements on filter chips', () => {
    render(
      <TaskAccordionHeader
        title="Completed"
        count={7}
        filterOptions={mockFilters}
        activeFilter="today"
        onSelectFilter={vi.fn()}
        isExpanded={true}
        onToggleExpand={vi.fn()}
      />
    );

    const chip = screen.getByRole('button', { name: /filter completed by today/i });
    expect(chip.className).toContain('min-h-[44px]');
  });
});
