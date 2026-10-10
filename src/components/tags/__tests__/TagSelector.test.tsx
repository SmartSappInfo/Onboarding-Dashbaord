/**
 * @fileoverview Unit tests for TagSelector (Tag Selection Single Source of Truth)
 *
 * Verifies that:
 * 1. TagSelector mounts cleanly in JSDOM using useMediaQuery's JSDOM fallback.
 * 2. Applied tags render as Badges with labels and removal actions.
 * 3. Client/draft mode updates tags correctly via onTagsChange callback.
 * 4. Tag removal and tag application trigger onTagsChange with expected IDs.
 * 5. Search filtering accurately filters available tags.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagSelector } from '../TagSelector';
import type { Tag } from '@/lib/types';

const mockTags: Tag[] = [
  {
    id: 'tag-1',
    name: 'VIP Client',
    slug: 'vip-client',
    category: 'status',
    color: '#EF4444',
    description: 'High value client',
    workspaceId: 'ws-123',
    organizationId: 'org-123',
    isSystem: false,
    usageCount: 5,
    createdBy: 'user-test',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
  },
  {
    id: 'tag-2',
    name: 'Lead',
    slug: 'lead',
    category: 'lifecycle',
    color: '#3B82F6',
    description: 'Inbound prospect',
    workspaceId: 'ws-123',
    organizationId: 'org-123',
    isSystem: false,
    usageCount: 12,
    createdBy: 'user-test',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
  },
  {
    id: 'tag-3',
    name: 'Follow Up Needed',
    slug: 'follow-up-needed',
    category: 'behavioral',
    color: '#F97316',
    description: 'Follow-up required within 48h',
    workspaceId: 'ws-123',
    organizationId: 'org-123',
    isSystem: false,
    usageCount: 2,
    createdBy: 'user-test',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
  },
];

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
}));

vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useUser: () => ({ user: { uid: 'user-test', displayName: 'Tester' } }),
  useCollection: () => ({ data: mockTags, loading: false }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws-123',
    activeOrganizationId: 'org-123',
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/platform/capabilities/ui/use-capability', () => ({
  useCapability: () => ({
    execute: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('@/lib/tag-actions', () => ({
  createTagAction: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 'tag-new', name: 'New Custom Tag' },
  }),
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-root">{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="popover-content" className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('TagSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders applied tags as Badges and provides add tag button', () => {
    render(
      <TagSelector
        currentTagIds={['tag-1', 'tag-2']}
        onTagsChange={vi.fn()}
      />
    );

    // Verify applied tag badges with accessible labels
    expect(screen.getByLabelText(/Tag: VIP Client/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tag: Lead/i)).toBeInTheDocument();

    // Verify Add Tag trigger button exists
    const addTagButton = screen.getByRole('button', { name: /add tag/i });
    expect(addTagButton).toBeInTheDocument();
  });

  it('invokes onTagsChange with updated tags when an applied tag is removed in draft mode', () => {
    const handleTagsChange = vi.fn();
    render(
      <TagSelector
        currentTagIds={['tag-1', 'tag-2']}
        onTagsChange={handleTagsChange}
      />
    );

    const removeVipButton = screen.getByRole('button', { name: /remove tag vip client/i });
    fireEvent.click(removeVipButton);

    // In draft mode, onTagsChange receives the remaining tag ids
    expect(handleTagsChange).toHaveBeenCalledWith(['tag-2']);
  });

  it('invokes onTagsChange when selecting an unapplied tag from the list', () => {
    const handleTagsChange = vi.fn();
    render(
      <TagSelector
        currentTagIds={['tag-1']}
        onTagsChange={handleTagsChange}
      />
    );

    // Click the unapplied tag "Follow Up Needed"
    const followUpOption = screen.getByRole('option', { name: /follow up needed/i });
    expect(followUpOption).toBeInTheDocument();

    fireEvent.click(followUpOption);

    // onTagsChange receives both tags
    expect(handleTagsChange).toHaveBeenCalledWith(['tag-1', 'tag-3']);
  });

  it('filters available tags based on search input query', () => {
    render(
      <TagSelector
        currentTagIds={['tag-1']}
        onTagsChange={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search tags…');
    fireEvent.change(searchInput, { target: { value: 'Follow' } });

    // "Follow Up Needed" should match and be visible
    expect(screen.getByRole('option', { name: /follow up needed/i })).toBeInTheDocument();

    // "Lead" should not match and be filtered out
    expect(screen.queryByRole('option', { name: /lead/i })).not.toBeInTheDocument();
  });

  it('displays "Create tag" option when search query has no exact match', () => {
    render(
      <TagSelector
        currentTagIds={['tag-1']}
        onTagsChange={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search tags…');
    fireEvent.change(searchInput, { target: { value: 'Brand New Tag' } });

    expect(screen.getByText(/create tag "brand new tag"/i)).toBeInTheDocument();
  });
});
