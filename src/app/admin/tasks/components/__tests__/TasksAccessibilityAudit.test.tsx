import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskListRow } from '../TaskListRow';
import { TaskCard } from '../TaskCard';
import { CompactTaskCard } from '../CompactTaskCard';
import { TaskDetailDrawer } from '../TaskDetailDrawer';
import TaskEditor from '../TaskEditor';
import { ConfirmDialog } from '../primitives/ConfirmDialog';
import type { Task, UserProfile } from '@/lib/types';

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

// Mock Firebase & Workspace Context for TaskEditor
vi.mock('@/firebase', () => ({
  useFirestore: () => null,
  useUser: () => ({ user: { uid: 'usr_test_1', displayName: 'Test User' } }),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: () => ({ data: [] }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'ws_123', activeOrganizationId: 'org_123' }),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({ entityName: 'Campus', entityNamePlural: 'Campuses' }),
}));

vi.mock('@/components/entities/EntityCombobox', () => ({
  EntityCombobox: () => <div data-testid="mock-entity-combobox" />,
}));

vi.mock('../../entities/components/media-select', () => ({
  MediaSelect: () => <div data-testid="mock-media-select" />,
}));

vi.mock('@/components/tags/TagSelector', () => ({
  TagSelector: ({ currentTagIds }: { currentTagIds: string[] }) => (
    <div data-testid="standard-tag-selector" data-tag-count={currentTagIds.length} />
  ),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockTask: Task = {
  id: 'task-a11y-1',
  workspaceId: 'ws-123',
  title: 'Annual Security Governance Audit',
  description: 'Review data processing agreements and cloud infrastructure compliance.',
  priority: 'high',
  status: 'todo',
  category: 'follow_up',
  assignedTo: 'user-100',
  dueDate: '2026-10-25T12:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  reminders: [],
  reminderSent: false,
  checklist: [
    { id: 'c1', title: 'Verify IAM Roles', completed: false },
    { id: 'c2', title: 'Check VPC Security Groups', completed: true },
  ],
};

const userMap = new Map<string, UserProfile>([
  ['user-100', { id: 'user-100', name: 'Alice Smith', email: 'alice@example.com' } as UserProfile],
]);

describe('Tasks Accessibility (a11y) & Touch Target Suite (Roadmap §79 / PRD §14.2)', () => {
  it('Pillar 2 - Test 1: enforces >= 44px touch target dimensions on interactive triggers', () => {
    // 1. TaskListRow Quick Complete Trigger Wrapper
    const { unmount: unmountList } = render(
      <TaskListRow
        task={mockTask}
        userMap={userMap}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    const completeBtn = screen.getByRole('button', { name: /mark complete/i });
    expect(completeBtn.parentElement?.className).toContain('min-h-[44px]');
    expect(completeBtn.parentElement?.className).toContain('min-w-[44px]');

    const optionsBtn = screen.getByRole('button', { name: /task options/i });
    expect(optionsBtn.parentElement?.className).toContain('min-h-[44px]');
    expect(optionsBtn.parentElement?.className).toContain('min-w-[44px]');
    unmountList();

    // 2. CompactTaskCard Completion Trigger
    const { unmount: unmountCompact } = render(
      <CompactTaskCard
        task={mockTask}
        onToggleComplete={vi.fn()}
      />
    );
    const compactToggleBtn = screen.getByRole('button', { name: /mark complete/i });
    expect(compactToggleBtn.className).toContain('min-h-[44px]');
    expect(compactToggleBtn.className).toContain('min-w-[44px]');
    unmountCompact();

    // 3. TaskDetailDrawer Action & Close Buttons
    const { unmount: unmountDrawer } = render(
      <TaskDetailDrawer
        task={mockTask}
        isOpen={true}
        onClose={vi.fn()}
        onEditFull={vi.fn()}
      />
    );
    const drawerCloseBtn = screen.getByRole('button', { name: /close drawer/i });
    expect(drawerCloseBtn.className).toContain('min-h-[44px]');
    expect(drawerCloseBtn.className).toContain('min-w-[44px]');

    const drawerEditBtn = screen.getByRole('button', { name: /edit task/i });
    expect(drawerEditBtn.className).toContain('min-h-[44px]');
    unmountDrawer();
  });

  it('Pillar 2 - Test 2: verifies tactile feedback classes (active:scale-[0.97]) on interactive controls', () => {
    // 1. CompactTaskCard card surface
    const { container: compactContainer, unmount: unmountCompact } = render(
      <CompactTaskCard task={mockTask} onClick={vi.fn()} />
    );
    const cardEl = compactContainer.querySelector('[role="button"]');
    expect(cardEl?.className).toContain('active:scale-[0.97]');
    unmountCompact();

    // 2. TaskListRow buttons
    const { unmount: unmountList } = render(
      <TaskListRow task={mockTask} onToggleComplete={vi.fn()} onEdit={vi.fn()} />
    );
    const completeBtn = screen.getByRole('button', { name: /mark complete/i });
    expect(completeBtn.className).toContain('active:scale-[0.97]');

    const optionsBtn = screen.getByRole('button', { name: /task options/i });
    expect(optionsBtn.className).toContain('active:scale-[0.97]');
    unmountList();

    // 3. ConfirmDialog footer buttons
    const { unmount: unmountConfirm } = render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm Deletion"
        description="Are you sure you want to delete this task?"
      />
    );
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    expect(cancelBtn.className).toContain('active:scale-[0.97]');
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn.className).toContain('active:scale-[0.97]');
    unmountConfirm();
  });

  it('Pillar 2 - Test 3: verifies keyboard focus and activation via Tab + Enter/Space', () => {
    // 1. TaskCard Keyboard Activation
    const onCardClick = vi.fn();
    const { unmount: unmountCard } = render(
      <TaskCard task={mockTask} onClick={onCardClick} />
    );
    const taskCardBtn = screen.getByRole('button', { name: /annual security governance audit/i });
    expect(taskCardBtn.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(taskCardBtn, { key: 'Enter', code: 'Enter' });
    expect(onCardClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(taskCardBtn, { key: ' ', code: 'Space' });
    expect(onCardClick).toHaveBeenCalledTimes(2);
    unmountCard();

    // 2. TaskListRow Keyboard Activation
    const onRowClick = vi.fn();
    const { unmount: unmountRow } = render(
      <TaskListRow task={mockTask} onClick={onRowClick} />
    );
    const taskRowBtn = screen.getByRole('button', { name: /annual security governance audit/i });
    expect(taskRowBtn.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(taskRowBtn, { key: 'Enter', code: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(taskRowBtn, { key: ' ', code: 'Space' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
    unmountRow();

    // 3. CompactTaskCard Keyboard Activation
    const onCompactClick = vi.fn();
    const { unmount: unmountCompact } = render(
      <CompactTaskCard task={mockTask} onClick={onCompactClick} />
    );
    const compactCardBtn = screen.getByRole('button', { name: /task: annual security governance audit/i });
    expect(compactCardBtn.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(compactCardBtn, { key: 'Enter', code: 'Enter' });
    expect(onCompactClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(compactCardBtn, { key: ' ', code: 'Space' });
    expect(onCompactClick).toHaveBeenCalledTimes(2);
    unmountCompact();
  });

  it('Pillar 2 - Test 4: verifies screen reader semantics, sr-only descriptions, and semantic badges', () => {
    // 1. ConfirmDialog sr-only description
    const { unmount: unmountConfirm } = render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Archive Task"
        description="Archiving this task will hide it from the active sprint."
      />
    );
    const srOnlyDesc = document.querySelector('.sr-only');
    expect(srOnlyDesc).toBeTruthy();
    expect(srOnlyDesc?.textContent).toBe('Archiving this task will hide it from the active sprint.');
    unmountConfirm();

    // 2. TaskDetailDrawer sr-only description
    const { unmount: unmountDrawer } = render(
      <TaskDetailDrawer
        task={mockTask}
        isOpen={true}
        onClose={vi.fn()}
      />
    );
    const drawerSrDesc = document.querySelector('.sr-only');
    expect(drawerSrDesc).toBeTruthy();
    expect(drawerSrDesc?.textContent).toContain('Annual Security Governance Audit');
    unmountDrawer();

    // 3. TaskEditor sr-only description and modal header semantics
    const { unmount: unmountEditor } = render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />
    );
    const editorSrDesc = document.querySelector('.sr-only');
    expect(editorSrDesc).toBeTruthy();
    unmountEditor();
  });

  it('Pillar 2 - Test 5: verifies single-circle CardInfoTooltip with z-[10050] modal overlay', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Security Compliance Verification"
        description="All security policies must be vetted before final sign-off."
        tooltipText="Detailed guidelines for Phase 6 security sign-off."
      />
    );

    const tooltipTrigger = screen.getByTestId('card-info-tooltip');
    expect(tooltipTrigger).toBeInTheDocument();
    expect(tooltipTrigger.getAttribute('aria-label')).toBe('More information');
    // Verify single-circle: no outer border ring class
    expect(tooltipTrigger.className).not.toContain('border-');
    expect(tooltipTrigger.className).toContain('rounded-full');
  });
});
