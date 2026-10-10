import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  useTerminology: () => ({ singular: 'Campus', plural: 'Campuses' }),
}));

vi.mock('@/components/entities/EntityCombobox', () => ({
  EntityCombobox: ({ onChange, placeholder }: { onChange: (id: string, details?: { displayName?: string }) => void; placeholder?: string }) => (
    <div data-testid="mock-entity-combobox">
      <span data-testid="combobox-placeholder">{placeholder}</span>
      <button 
        type="button" 
        data-testid="select-entity-btn"
        onClick={() => onChange('ent_1', { displayName: 'St. Patrick High School' })}
      >
        Select St. Patrick
      </button>
    </div>
  ),
}));

vi.mock('../../entities/components/media-select', () => ({
  MediaSelect: () => <div data-testid="mock-media-select" />,
}));

vi.mock('@/components/tags/TagSelector', () => ({
  TagSelector: () => <div data-testid="standard-tag-selector" />,
}));

import TaskEditor from '../TaskEditor';

describe('TaskEditor Intelligent Base Summary & Detail Box', () => {
  it('prefills the details box with title, institution, and time (time only, not date) for a new task', async () => {
    // 2:30 PM local time
    const scheduledDate = new Date();
    scheduledDate.setHours(14, 30, 0, 0);

    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        task={{
          id: '', // Draft task (new creation)
          title: 'Phone Call',
          category: 'call',
          startDate: scheduledDate.toISOString(),
          dueDate: scheduledDate.toISOString(),
          description: '',
        }}
        preFilledEntityName="Lincoln High School"
      />
    );

    const descriptionInput = screen.getByPlaceholderText('Provide additional details or background context...') as HTMLTextAreaElement;

    // Should contain the title, entity name, and time
    await waitFor(() => {
      expect(descriptionInput.value).toContain('Phone Call for Lincoln High School at');
      expect(descriptionInput.value).toMatch(/\d{1,2}:\d{2}\s+(AM|PM)/i);
    });

    // Strictly verify time only: NO calendar date numbers or month names
    expect(descriptionInput.value).not.toContain(String(scheduledDate.getFullYear()));
  });

  it('updates summary automatically when an entity is selected via EntityCombobox', async () => {
    const scheduledDate = new Date();
    scheduledDate.setHours(10, 0, 0, 0);

    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        task={{
          id: '',
          title: 'Site Visit',
          category: 'visit',
          startDate: scheduledDate.toISOString(),
          dueDate: scheduledDate.toISOString(),
          description: '',
        }}
      />
    );

    const descriptionInput = screen.getByPlaceholderText('Provide additional details or background context...') as HTMLTextAreaElement;

    // Initially without entity
    await waitFor(() => {
      expect(descriptionInput.value).toContain('Site Visit at');
    });

    // Select entity via combobox button
    const selectEntityBtn = screen.getByTestId('select-entity-btn');
    fireEvent.click(selectEntityBtn);

    // Should now include the newly selected entity
    await waitFor(() => {
      expect(descriptionInput.value).toContain('Site Visit for St. Patrick High School at');
    });
  });

  it('does not overwrite user custom description once the user manually edits it', async () => {
    const scheduledDate = new Date();
    scheduledDate.setHours(11, 0, 0, 0);

    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        task={{
          id: '',
          title: 'Document Review',
          category: 'document',
          startDate: scheduledDate.toISOString(),
          dueDate: scheduledDate.toISOString(),
          description: '',
        }}
      />
    );

    const descriptionInput = screen.getByPlaceholderText('Provide additional details or background context...') as HTMLTextAreaElement;

    await waitFor(() => {
      expect(descriptionInput.value).toContain('Document Review at');
    });

    // User types manual notes
    fireEvent.change(descriptionInput, { target: { value: 'Custom notes: NDA and compliance audit.' } });
    expect(descriptionInput.value).toBe('Custom notes: NDA and compliance audit.');

    // Now user changes entity via combobox
    const selectEntityBtn = screen.getByTestId('select-entity-btn');
    fireEvent.click(selectEntityBtn);

    // Custom notes MUST NOT be clobbered
    expect(descriptionInput.value).toBe('Custom notes: NDA and compliance audit.');
  });

  it('provides an Auto-summarize button that allows on-demand re-syncing of the summary', async () => {
    const scheduledDate = new Date();
    scheduledDate.setHours(15, 0, 0, 0);

    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        task={{
          id: '',
          title: 'Follow-up Call',
          category: 'call',
          startDate: scheduledDate.toISOString(),
          dueDate: scheduledDate.toISOString(),
          description: '',
        }}
        preFilledEntityName="Apex Academy"
      />
    );

    const descriptionInput = screen.getByPlaceholderText('Provide additional details or background context...') as HTMLTextAreaElement;

    // Overwrite with custom notes
    fireEvent.change(descriptionInput, { target: { value: 'Old manual text' } });
    expect(descriptionInput.value).toBe('Old manual text');

    // Click Auto-summarize button
    const autoSummarizeBtn = screen.getByTitle('Summarize task name, target institution, and time');
    expect(autoSummarizeBtn).toBeTruthy();
    fireEvent.click(autoSummarizeBtn);

    // It should regenerate the clean base summary
    await waitFor(() => {
      expect(descriptionInput.value).toContain('Follow-up Call for Apex Academy at');
    });
  });

  it('does not auto-summarize or overwrite description when editing an existing task', async () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        task={{
          id: 'task_existing_99',
          title: 'Existing Board Meeting',
          category: 'general',
          description: 'Original persistent meeting minutes.',
          dueDate: '2026-10-20T10:00:00Z',
        }}
      />
    );

    const descriptionInput = screen.getByPlaceholderText('Provide additional details or background context...') as HTMLTextAreaElement;
    expect(descriptionInput.value).toBe('Original persistent meeting minutes.');

    // Auto-summarize button is not shown for existing task edits
    expect(screen.queryByTitle('Summarize task name, target institution, and time')).toBeNull();
  });
});
