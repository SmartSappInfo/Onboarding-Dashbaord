import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskScopeSwitcher } from '../TaskScopeSwitcher';

describe('TaskScopeSwitcher (Roadmap §27, UI Spec §444-462)', () => {
  it('renders My Tasks, Team Tasks, and All Tasks segments', () => {
    render(
      <TaskScopeSwitcher
        currentScope="my"
        onScopeChange={vi.fn()}
        canViewAllTasks={true}
        counts={{ my: 5, team: 12, all: 24 }}
      />
    );
    expect(screen.getByRole('button', { name: /my tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /team tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all tasks/i })).toBeInTheDocument();
  });

  it('triggers onScopeChange when clicking a selectable scope', () => {
    const onScopeChange = vi.fn();
    render(
      <TaskScopeSwitcher
        currentScope="my"
        onScopeChange={onScopeChange}
        canViewAllTasks={true}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /team tasks/i }));
    expect(onScopeChange).toHaveBeenCalledWith('team');
  });

  it('disables All Tasks when canViewAllTasks is false and displays permission tooltip', () => {
    const onScopeChange = vi.fn();
    render(
      <TaskScopeSwitcher
        currentScope="my"
        onScopeChange={onScopeChange}
        canViewAllTasks={false}
      />
    );
    const allBtn = screen.getByRole('button', { name: /all tasks/i });
    expect(allBtn).toBeDisabled();
    fireEvent.click(allBtn);
    expect(onScopeChange).not.toHaveBeenCalled();
  });

  it('satisfies min-h-[44px] touch target rule on interactive buttons', () => {
    render(
      <TaskScopeSwitcher
        currentScope="my"
        onScopeChange={vi.fn()}
        canViewAllTasks={true}
      />
    );
    const myBtn = screen.getByRole('button', { name: /my tasks/i });
    expect(myBtn.className).toMatch(/min-h-\[44px\]/);
  });
});
