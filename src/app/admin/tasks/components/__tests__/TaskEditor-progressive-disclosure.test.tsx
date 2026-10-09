import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';

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
  useTerminology: () => ({ entityName: 'Campus', entityNamePlural: 'Campuses' }),
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

describe('TaskEditor Progressive Disclosure & Ergonomics (Roadmap §31-32, PRD §14.2)', () => {
  it('renders dominant title input with min-h-[44px] on the form screen', () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />
    );

    // Click "Start From Scratch" to advance to Step 2
    const scratchBtn = screen.getByRole('button', { name: /start from scratch/i });
    fireEvent.click(scratchBtn);

    const titleInput = screen.getByPlaceholderText(/what needs to be done\?/i);
    expect(titleInput).toBeInTheDocument();
    expect(titleInput.className).toMatch(/min-h-\[44px\]/);
  });

  it('renders essential work controls and progressive organization section with TagSelector', () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start from scratch/i }));

    // Priority & Status
    expect(screen.getByText(/priority/i)).toBeInTheDocument();
    expect(screen.getByText(/status/i)).toBeInTheDocument();

    // Organization section with TagSelector
    expect(screen.getByTestId('standard-tag-selector')).toBeInTheDocument();
  });

  it('pre-fills CRM entity name when preFilledEntityName is supplied', () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        preFilledEntityName="Acme International School"
        disableEntitySelect={true}
        task={{
          id: 'task_entity_1',
          title: 'Review School Contract',
          entityId: 'ent_acme',
          entityType: 'institution',
          workspaceId: 'ws_123',
          dueDate: '2026-10-20T10:00:00Z',
          assignedTo: ['usr_test_1'],
          status: 'todo',
          priority: 'high',
          category: 'document',
          description: '',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
          reminders: [],
          reminderSent: false,
        }}
      />
    );

    expect(screen.getByText('Acme International School')).toBeInTheDocument();
  });
});
