import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import DocumentEditorClient from '../[id]/edit/DocumentEditorClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test_123',
    isLoading: false,
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'mock_collection' })),
  query: vi.fn(() => ({ id: 'mock_query' })),
  where: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'usr_test_123', email: 'admin@example.com' } }),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useDoc: () => ({
    data: {
      id: 'doc_123',
      workspaceId: 'ws_test_123',
      title: 'University Prospectus',
      description: '2026 Admissions Prospectus',
      slug: 'prospectus-2026',
      status: 'published',
      documentType: 'prospectus',
      activeVersionId: 'doc_123_v1',
      defaultViewerMode: 'flipbook',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    isLoading: false,
  }),
  useCollection: () => ({
    data: [
      {
        id: 'p_1',
        documentId: 'doc_123',
        versionId: 'doc_123_v1',
        workspaceId: 'ws_test_123',
        pageNumber: 1,
        renderedAssetUrl: 'https://example.com/page1.jpg',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        width: 800,
        height: 1130,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => <button data-tab={value}>{children}</button>,
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-tab-content={value}>{children}</div>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (c: boolean) => void }) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}));

vi.mock('@/components/tags/TagSelector', () => ({
  TagSelector: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="tag-selector">{placeholder || 'Tags'}</div>
  ),
}));

vi.mock('@/lib/document-actions', () => ({
  updateDocumentAction: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('@/lib/documents/document-version-actions', () => ({
  createDocumentVersionAction: vi.fn(),
  promoteDocumentVersionAction: vi.fn(),
  archiveDocumentVersionAction: vi.fn(),
  getDocumentVersionsAction: vi.fn(() => Promise.resolve({
    success: true,
    versions: [
      {
        id: 'doc_123_v1',
        documentId: 'doc_123',
        workspaceId: 'ws_test_123',
        versionNumber: 1,
        status: 'ready',
        createdBy: 'usr_test_123',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
  })),
}));

describe('DocumentEditorClient Component', () => {
  it('renders all studio tabs and document metadata', async () => {
    await act(async () => {
      render(<DocumentEditorClient documentId="doc_123" />);
    });
    expect(screen.getByText('University Prospectus')).toBeDefined();
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Pages')).toBeDefined();
    expect(screen.getByText('Overlays')).toBeDefined();
    expect(screen.getByText('Viewer Mode')).toBeDefined();
    expect(screen.getByText('Versions')).toBeDefined();
    expect(screen.getByText('Access & Links')).toBeDefined();
  });
});
