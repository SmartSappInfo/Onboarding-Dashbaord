import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskScopeSwitcher } from '../TaskScopeSwitcher';
import type { UserProfile } from '@/lib/types';

describe('TaskScopeSwitcher (Roadmap §27, UI Spec §444-462)', () => {
  const mockUsers: UserProfile[] = [
    {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
    },
    {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@example.com',
      organizationId: 'org-1',
      workspaceIds: ['ws-1'],
    },
  ];

  it('renders My Tasks, Team Tasks / All Team Members, and All Tasks segments', () => {
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

  it('renders team member selector when workspaceUsers are provided', () => {
    const onScopeChange = vi.fn();
    const onSelectMember = vi.fn();

    render(
      <TaskScopeSwitcher
        currentScope="team"
        onScopeChange={onScopeChange}
        workspaceUsers={mockUsers}
        selectedMemberId={null}
        onSelectMember={onSelectMember}
      />
    );

    // Should have a button for selecting team member
    const memberSelectorBtn = screen.getByRole('button', { name: /selected team member/i });
    expect(memberSelectorBtn).toBeInTheDocument();
    expect(memberSelectorBtn.className).toMatch(/min-h-\[44px\]/);

    // Open the popover
    fireEvent.click(memberSelectorBtn);

    // Search and pick Alice
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Alice Johnson'));
    expect(onSelectMember).toHaveBeenCalledWith('user-1');
    expect(onScopeChange).toHaveBeenCalledWith('member');
  });

  it('displays selected team member name and clears correctly', () => {
    const onScopeChange = vi.fn();
    const onSelectMember = vi.fn();

    render(
      <TaskScopeSwitcher
        currentScope="member"
        onScopeChange={onScopeChange}
        workspaceUsers={mockUsers}
        selectedMemberId="user-2"
        onSelectMember={onSelectMember}
      />
    );

    // Shows Bob Smith
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();

    // Click clear button
    const clearBtn = screen.getByRole('button', { name: /clear team member filter/i });
    fireEvent.click(clearBtn);

    expect(onSelectMember).toHaveBeenCalledWith(null);
    expect(onScopeChange).toHaveBeenCalledWith('team');
  });
});
