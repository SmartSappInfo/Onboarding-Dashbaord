import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Firebase & Contexts
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
  useTerminology: () => ({ singular: 'Campus', plural: 'Campuses' }),
}));

vi.mock('@/components/entities/EntityCombobox', () => ({
  EntityCombobox: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="mock-entity-combobox">{placeholder}</div>
  ),
}));

vi.mock('../../entities/components/media-select', () => ({
  MediaSelect: () => <div data-testid="mock-media-select" />,
}));

vi.mock('@/components/tags/TagSelector', () => ({
  TagSelector: ({ currentTagIds, onTagsChange }: { currentTagIds: string[]; onTagsChange?: (ids: string[]) => void }) => (
    <div data-testid="standard-tag-selector" data-tag-count={currentTagIds.length}>
      <button type="button" onClick={() => onTagsChange?.([...currentTagIds, 'tag_new'])}>Add Test Tag</button>
    </div>
  ),
}));

import TaskEditor from '../TaskEditor';

describe('TaskEditor Phase 3 (Checklist & Reminders Progressive Integration)', () => {
  it('renders Checklist and Reminders collapsible sections in step 2', () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />
    );

    // Switch to step 2 (start from scratch)
    const scratchBtn = screen.getByRole('button', { name: /start from scratch/i });
    fireEvent.click(scratchBtn);

    // Verify Checklist and Reminders headers exist
    expect(screen.getByText(/^checklist$/i)).toBeInTheDocument();
    expect(screen.getByText(/^reminders$/i)).toBeInTheDocument();
  });

  it('binds existing checklist items and reminders into form when editing task', () => {
    const task = {
      id: 'task-99',
      workspaceId: 'ws-123',
      title: 'Review proposal',
      description: 'Audit scope',
      priority: 'high' as const,
      status: 'in_progress' as const,
      category: 'general' as const,
      assignedTo: 'usr_test_1',
      dueDate: '2026-10-15T00:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      reminders: [
        { id: 'rem-1', reminderTime: '2026-10-14T09:00:00.000Z', channels: ['email' as const], sent: false, status: 'scheduled' as const },
      ],
      checklist: [
        { id: 'chk-1', title: 'Verify credentials', completed: true },
      ],
    };

    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        task={task}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />
    );

    expect(screen.getByText('Verify credentials')).toBeInTheDocument();
    expect(screen.getByText(/1 scheduled/i)).toBeInTheDocument();
  });
});
