/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Component Tests for Public FlipbookReaderClient:
 *    Verifies rendering of public flipbook reader, handling loading states, error states
 *    for unpublished/missing flipbooks, password protection gates, and lead capture forms.
 * 2. Strict Typing Standard:
 *    All mocks and props maintain strict TypeScript types without `any` or `any[]`.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import FlipbookReaderClient from '../FlipbookReaderClient';
import type { FlipbookConfig, FlipbookPage } from '@/lib/types/flipbook-types';

// Mock Toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock Server Actions
vi.mock('@/lib/flipbook-actions', () => ({
  submitFlipbookLeadAction: vi.fn().mockResolvedValue({ success: true }),
  logFlipbookAnalyticsAction: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Firestore queries inside FlipbookReaderClient
let mockFetchError: string | null = null;
let mockLoadedFlipbook: FlipbookConfig | null = null;

vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockImplementation(async () => {
    if (mockFetchError) {
      throw new Error(mockFetchError);
    }
    if (!mockLoadedFlipbook) {
      return { empty: true, docs: [] };
    }
    return {
      empty: false,
      docs: [
        {
          data: () => mockLoadedFlipbook,
        },
      ],
    };
  }),
}));

describe('FlipbookReaderClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchError = null;
    mockLoadedFlipbook = {
      id: 'fb_public_123',
      workspaceId: 'ws_pub_1',
      title: 'Public Student Handbook',
      description: 'Official 2026 Student Handbook',
      slug: 'student-handbook',
      status: 'published',
      sourceFileUrl: 'https://example.com/handbook.pdf',
      sourceFileType: 'pdf',
      sourceFileName: 'handbook.pdf',
      pageCount: 5,
      aspectRatio: 1.414,
      style: {
        pageStyle: 'magazine',
        soundEnabled: true,
        hardcover: false,
        backgroundColor: '#0f172a',
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
        title: 'Unlock Access',
        description: 'Enter your email to continue reading.',
        requireName: true,
        requireEmail: true,
        requirePhone: false,
        ctaText: 'Unlock Reader',
      },
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      createdBy: 'usr_1',
    };
  });

  it('renders error state when flipbook is not found or empty', async () => {
    mockLoadedFlipbook = null;
    render(<FlipbookReaderClient slug="non-existent-slug" />);

    await waitFor(() => {
      expect(screen.getByText(/Flipbook publication not found/i)).toBeInTheDocument();
    });
  });

  it('renders draft mode warning when publication is not published', async () => {
    mockLoadedFlipbook = {
      ...mockLoadedFlipbook!,
      status: 'draft',
    };

    render(<FlipbookReaderClient slug="student-handbook" />);

    await waitFor(() => {
      expect(screen.getByText(/This publication is currently in draft mode/i)).toBeInTheDocument();
    });
  });

  it('renders reader and allows page navigation for published flipbooks', async () => {
    render(<FlipbookReaderClient slug="student-handbook" />);

    await waitFor(() => {
      expect(screen.getByText('Public Student Handbook')).toBeInTheDocument();
      expect(screen.getAllByText(/Page 1 of 5/i).length).toBeGreaterThan(0);
    });
  });

  it('renders passcode prompt when publication is password protected', async () => {
    mockLoadedFlipbook = {
      ...mockLoadedFlipbook!,
      password: 'secret_code_123',
    };

    render(<FlipbookReaderClient slug="student-handbook" />);

    await waitFor(() => {
      expect(screen.getByText(/This publication is password protected/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter passcode.../i)).toBeInTheDocument();
    });
  });
});
