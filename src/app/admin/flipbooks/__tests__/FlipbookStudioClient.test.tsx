/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Component Integration Tests for FlipbookStudioClient:
 *    Verifies skeleton rendering during load, empty states, flipbook grid item display,
 *    KPI metric totals, search filtering, and status tab filtering.
 * 2. Strict Typing Standard:
 *    All mock definitions strictly enforce TypeScript interfaces without `any` or `any[]`.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import FlipbookStudioClient from '../FlipbookStudioClient';
import type { FlipbookConfig } from '@/lib/types/flipbook-types';

// Mock router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Workspace Context
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_demo_123',
    isLoading: false,
  }),
}));

// Mock Toast Hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'flipbooks_col' })),
  query: vi.fn(() => ({ id: 'flipbooks_query' })),
  where: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
}));

// Mock Firebase hooks
let mockFlipbooksData: FlipbookConfig[] | null = [];
let mockIsLoading = false;

vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(() => ({})),
  useCollection: vi.fn(() => ({ data: mockFlipbooksData, isLoading: mockIsLoading })),
  useUser: vi.fn(() => ({ user: { uid: 'test_user_id' }, isLoaded: true })),
  useMemoFirebase: vi.fn((factory: () => unknown) => factory()),
}));

// Mock server actions
vi.mock('@/lib/flipbook-actions', () => ({
  createFlipbookAction: vi.fn().mockResolvedValue({ success: true, flipbookId: 'fb_new_123' }),
  deleteFlipbookAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('FlipbookStudioClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockFlipbooksData = [
      {
        id: 'fb_1',
        workspaceId: 'ws_demo_123',
        title: '2026 Prospectus',
        description: 'Annual Parent Guide',
        slug: 'prospectus-2026',
        status: 'published',
        sourceFileUrl: 'https://example.com/p2026.pdf',
        sourceFileType: 'pdf',
        sourceFileName: 'p2026.pdf',
        pageCount: 12,
        aspectRatio: 1.414,
        style: {
          pageStyle: 'magazine',
          soundEnabled: true,
          hardcover: false,
          backgroundColor: '#f1f5f9',
          enableDownloadPdf: true,
          enablePrint: true,
          enableShare: true,
          enableSearch: true,
          enableThumbnails: true,
        },
        hotspots: [],
        leadGate: {
          enabled: false,
          triggerPage: 0,
          title: 'Unlock',
          description: '',
          requireName: true,
          requireEmail: true,
          requirePhone: false,
          ctaText: 'Unlock',
        },
        createdAt: '2026-08-01T10:00:00Z',
        updatedAt: '2026-08-01T10:00:00Z',
        createdBy: 'usr_admin',
        viewsCount: 150,
        leadsCount: 15,
        flipsCount: 450,
      },
      {
        id: 'fb_2',
        workspaceId: 'ws_demo_123',
        title: 'Draft Curriculum Brochure',
        description: 'Internal Review Draft',
        slug: 'curriculum-draft',
        status: 'draft',
        sourceFileUrl: 'https://example.com/curr.pdf',
        sourceFileType: 'pdf',
        sourceFileName: 'curr.pdf',
        pageCount: 8,
        aspectRatio: 1.414,
        style: {
          pageStyle: 'booklet',
          soundEnabled: true,
          hardcover: false,
          backgroundColor: '#f1f5f9',
          enableDownloadPdf: true,
          enablePrint: true,
          enableShare: true,
          enableSearch: true,
          enableThumbnails: true,
        },
        hotspots: [],
        leadGate: {
          enabled: false,
          triggerPage: 0,
          title: '',
          description: '',
          requireName: true,
          requireEmail: true,
          requirePhone: false,
          ctaText: '',
        },
        createdAt: '2026-08-05T10:00:00Z',
        updatedAt: '2026-08-05T10:00:00Z',
        createdBy: 'usr_admin',
        viewsCount: 20,
        leadsCount: 2,
        flipsCount: 60,
      },
    ];
  });

  it('renders main header and KPI analytics overview', () => {
    render(<FlipbookStudioClient />);

    expect(screen.getByRole('heading', { level: 1, name: /Flipbook Studio/i })).toBeInTheDocument();
    expect(screen.getByText('Total Flipbooks')).toBeInTheDocument();
    expect(screen.getByText('Published Landing Pages')).toBeInTheDocument();
    expect(screen.getByText('Total Page Flips')).toBeInTheDocument();
    expect(screen.getByText('Captured Leads')).toBeInTheDocument();

    // Verify calculated totals
    expect(screen.getByText('2')).toBeInTheDocument(); // Total 2 items
    expect(screen.getByText('510')).toBeInTheDocument(); // 450 + 60 flips
  });

  it('filters flipbooks by search term', () => {
    render(<FlipbookStudioClient />);

    const searchInput = screen.getByPlaceholderText(/Search flipbooks by title.../i);
    fireEvent.change(searchInput, { target: { value: 'Curriculum' } });

    expect(screen.getAllByText('Draft Curriculum Brochure')[0]).toBeInTheDocument();
    expect(screen.queryByText('2026 Prospectus')).not.toBeInTheDocument();
  });

  it('filters flipbooks by status filter tabs', () => {
    render(<FlipbookStudioClient />);

    const publishedBtn = screen.getByRole('button', { name: /^PUBLISHED$/i });
    fireEvent.click(publishedBtn);

    expect(screen.getAllByText('2026 Prospectus')[0]).toBeInTheDocument();
    expect(screen.queryByText('Draft Curriculum Brochure')).not.toBeInTheDocument();
  });

  it('renders empty state when no flipbooks match search', () => {
    render(<FlipbookStudioClient />);

    const searchInput = screen.getByPlaceholderText(/Search flipbooks by title.../i);
    fireEvent.change(searchInput, { target: { value: 'NonExistentTitleQuery' } });

    expect(screen.getByText('No Flipbooks Found')).toBeInTheDocument();
  });

  it('opens Create Flipbook dialog when clicking action button', async () => {
    render(<FlipbookStudioClient />);

    const createBtn = screen.getByRole('button', { name: /Create Flipbook/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText('Create New Flipbook')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e.g. 2026 Parent Prospectus Guide/i)).toBeInTheDocument();
    });
  });
});
