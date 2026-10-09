import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskBoard from '../TaskBoard';
import { TaskListRow } from '../TaskListRow';
import { TaskCard } from '../TaskCard';
import { CompactTaskCard } from '../CompactTaskCard';
import { TaskDetailDrawer } from '../TaskDetailDrawer';
import { TaskEmptyState } from '../primitives/TaskEmptyState';
import { TaskSkeleton } from '../primitives/TaskSkeleton';
import type { Task, UserProfile } from '@/lib/types';

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@dnd-kit/sortable');
  return {
    ...actual,
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    }),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const longTitle = 'A'.repeat(200);

const stressTask: Task = {
  id: 'task-stress-1',
  workspaceId: 'ws-stress',
  title: longTitle,
  description: 'Detailed description for stress testing viewport layout and overflow behavior.',
  priority: 'urgent',
  status: 'in_progress',
  category: 'document',
  assignedTo: ['u1', 'u2', 'u3', 'u4'],
  dueDate: '2026-11-01T10:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  reminders: [],
  reminderSent: false,
  checklist: [
    { id: 'c1', title: 'Step 1', completed: true },
    { id: 'c2', title: 'Step 2', completed: false },
    { id: 'c3', title: 'Step 3', completed: false },
  ],
};

const stressUserMap = new Map<string, UserProfile>([
  ['u1', { id: 'u1', name: 'User One', email: 'u1@example.com' } as UserProfile],
  ['u2', { id: 'u2', name: 'User Two', email: 'u2@example.com' } as UserProfile],
  ['u3', { id: 'u3', name: 'User Three', email: 'u3@example.com' } as UserProfile],
  ['u4', { id: 'u4', name: 'User Four', email: 'u4@example.com' } as UserProfile],
]);

describe('Tasks Cross-Device Responsive Layout Verification (Roadmap §79 / UI Spec)', () => {
  it('Pillar 2 - Test 1: renders Desktop (>=1024px) multi-column Kanban board and drawer panel', () => {
    // 1. TaskBoard renders all 5 columns in horizontal layout
    const { unmount: unmountBoard } = render(
      <TaskBoard
        tasks={[stressTask]}
        onTaskClick={vi.fn()}
        userMap={stressUserMap}
      />
    );
    expect(screen.getByRole('heading', { name: /backlog/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /in progress/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /waiting/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /review/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /resolved/i })).toBeInTheDocument();
    unmountBoard();

    // 2. TaskDetailDrawer renders side="right" slide-over layout
    const { unmount: unmountDrawer } = render(
      <TaskDetailDrawer
        task={stressTask}
        isOpen={true}
        onClose={vi.fn()}
      />
    );
    const drawerEl = document.querySelector('[role="dialog"]');
    expect(drawerEl).toBeInTheDocument();
    expect(drawerEl?.className).toContain('w-full');
    expect(drawerEl?.className).toContain('sm:max-w-xl');
    unmountDrawer();
  });

  it('Pillar 2 - Test 2: verifies Mobile (<768px) responsive adaptivity on list row and compact cards', () => {
    // 1. TaskListRow adapts with responsive padding and text scaling
    const { container: listContainer, unmount: unmountList } = render(
      <TaskListRow
        task={stressTask}
        userMap={stressUserMap}
      />
    );
    const rowEl = listContainer.querySelector('[role="button"]');
    expect(rowEl?.className).toContain('px-4');
    expect(rowEl?.className).toContain('sm:px-6');
    unmountList();

    // 2. CompactTaskCard adapts for mobile touch and layout
    const { container: compactContainer, unmount: unmountCompact } = render(
      <CompactTaskCard
        task={stressTask}
        userMap={stressUserMap}
      />
    );
    const compactEl = compactContainer.querySelector('[role="button"]');
    expect(compactEl?.className).toContain('p-3.5');
    expect(compactEl?.className).toContain('sm:p-4');
    unmountCompact();
  });

  it('Pillar 2 - Test 3: verifies content stress handling for 200-char titles and multi-assignees', () => {
    // 1. TaskCard handles 200-char title without overflow
    const { unmount: unmountCard } = render(
      <TaskCard
        task={stressTask}
        userMap={stressUserMap}
      />
    );
    const titleEl = screen.getByText(longTitle);
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.className).toContain('break-words');
    unmountCard();

    // 2. TaskListRow truncates long title gracefully
    const { unmount: unmountList } = render(
      <TaskListRow
        task={stressTask}
        userMap={stressUserMap}
      />
    );
    const listTitle = screen.getByText(longTitle);
    expect(listTitle.className).toContain('truncate');
    unmountList();

    // 3. CompactTaskCard renders checklist progress
    const { unmount: unmountCompact } = render(
      <CompactTaskCard
        task={stressTask}
        userMap={stressUserMap}
      />
    );
    expect(screen.getByText('1/3')).toBeInTheDocument();
    unmountCompact();
  });

  it('Pillar 2 - Test 4: verifies system states (TaskEmptyState, TaskSkeleton) render without UI jitter', () => {
    // 1. Initial Empty State
    const { unmount: unmountEmpty } = render(
      <TaskEmptyState isFiltered={false} onCreateTask={vi.fn()} />
    );
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
    unmountEmpty();

    // 2. Filtered Empty State
    const { unmount: unmountFiltered } = render(
      <TaskEmptyState isFiltered={true} onClearFilters={vi.fn()} />
    );
    expect(screen.getByText(/no tasks match these filters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
    unmountFiltered();

    // 3. Skeleton Loading State (List & Card)
    const { container: skeletonListContainer, unmount: unmountSkelList } = render(
      <TaskSkeleton count={3} mode="list" />
    );
    expect(skeletonListContainer.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(3);
    unmountSkelList();

    const { container: skeletonCardContainer, unmount: unmountSkelCard } = render(
      <TaskSkeleton count={4} mode="card" />
    );
    expect(skeletonCardContainer.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(4);
    unmountSkelCard();
  });
});
