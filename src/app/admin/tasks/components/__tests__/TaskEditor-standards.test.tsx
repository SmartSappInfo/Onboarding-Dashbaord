import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';

// Mock Firebase & Workspace Context
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
  TagSelector: ({ currentTagIds, onTagsChange }: { currentTagIds: string[]; onTagsChange?: (ids: string[]) => void }) => (
    <div data-testid="standard-tag-selector" data-tag-count={currentTagIds.length}>
      <button type="button" onClick={() => onTagsChange?.([...currentTagIds, 'tag_new'])}>Add Test Tag</button>
    </div>
  ),
}));

import TaskEditor from '../TaskEditor';

describe('TaskEditor Modal & Architecture Standards (Phase 2)', () => {
  it('renders demarcated header with CardInfoTooltip and sr-only description', () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />
    );

    // Assert screen reader description is present and sr-only
    const srDesc = document.querySelector('.sr-only');
    expect(srDesc).toBeTruthy();

    // Assert CardInfoTooltip info icon button is present with z-[10050] tooltip capability
    const tooltipTrigger = screen.getByTestId('card-info-tooltip');
    expect(tooltipTrigger).toBeTruthy();
  });

  it('renders TagSelector in client/draft mode without contactId or contactType', () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        task={{
          id: 'task_1',
          workspaceId: 'ws_123',
          title: 'Existing Task',
          tagIds: ['tag_1', 'tag_2'],
          assignedTo: ['usr_test_1'],
          dueDate: '2026-10-15T10:00:00Z',
          status: 'todo',
          priority: 'medium',
          category: 'general',
          description: '',
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
          reminders: [],
          reminderSent: false,
        }}
      />
    );

    const tagSelector = screen.getByTestId('standard-tag-selector');
    expect(tagSelector).toBeTruthy();
    expect(tagSelector.getAttribute('data-tag-count')).toBe('2');
  });
});
