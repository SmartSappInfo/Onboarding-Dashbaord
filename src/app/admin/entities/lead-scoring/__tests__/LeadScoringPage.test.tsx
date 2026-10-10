/**
 * @fileOverview Unit tests for Lead Scoring & Cleanup Center header title and info tooltip invariants
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LeadScoringPage from '../page';

// Mock firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'mock_collection' })),
  query: vi.fn(() => ({ id: 'mock_query' })),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    commit: vi.fn().mockResolvedValue(true),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock @/firebase
vi.mock('@/firebase', () => ({
  useFirestore: () => ({ id: 'mock_firestore' }),
  useDoc: () => ({ data: null, isLoading: false }),
  useCollection: () => ({ data: [], isLoading: false }),
  useMemoFirebase: (fn: () => unknown) => fn(),
}));

// Mock context & hooks
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'test-workspace',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock actions
vi.mock('@/lib/automation-actions', () => ({
  verifySingleContactAction: vi.fn().mockResolvedValue({ success: true }),
  deleteContactAction: vi.fn().mockResolvedValue({ success: true }),
  bulkCleanContactsAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/scoring-performance-engine', () => ({
  adjustLeadScoreAction: vi.fn().mockResolvedValue({ success: true }),
  bulkAdjustScoresAction: vi.fn().mockResolvedValue({ success: true }),
  bulkArchiveEntitiesAction: vi.fn().mockResolvedValue({ success: true }),
  bulkDeleteEntitiesAction: vi.fn().mockResolvedValue({ success: true }),
  bulkAssignEntitiesAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Lead Scoring & Cleanup Center Title & Info Icon Invariants', () => {
  it('renders page title with CardInfoTooltip and no raw description paragraph', () => {
    const { container } = render(<LeadScoringPage />);

    // Page Heading must be present
    const heading = screen.getByRole('heading', { level: 1, name: /Lead Scoring & Cleanup Center/i });
    expect(heading).toBeInTheDocument();

    // Raw subtitle paragraph must NOT be rendered under the title
    expect(
      screen.queryByText(/Evaluate contact scores, run bulk adjustments, soft-archive stale leads, and customize scoring conditions/i)
    ).not.toBeInTheDocument();

    // CardInfoTooltip trigger button must be present next to the heading
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders card title area descriptions in info icons and no raw descriptions in Settings tab', async () => {
    const { container } = render(<LeadScoringPage />);

    // Click "Scoring Configurations" tab
    const settingsTab = screen.getByRole('tab', { name: /Scoring Configurations/i });
    fireEvent.pointerDown(settingsTab);
    fireEvent.mouseDown(settingsTab);
    fireEvent.click(settingsTab);

    // Verify Card Title is present
    expect(screen.getByText(/Auto-Scoring Mapping Rules/i)).toBeInTheDocument();

    // Verify raw card header description is NOT rendered as raw text
    expect(
      screen.queryByText(/Set system parameters to automatically adjust scores when integrations detect verification/i)
    ).not.toBeInTheDocument();

    // Verify raw section descriptions are NOT rendered as raw text
    expect(
      screen.queryByText(/Automatically adjust score once email quality is checked in the background/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Award points once a phone number passes background verification/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Automatically adjust lead scores when specific activities\/engagements are logged in the CRM history/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Configure global defaults for call campaign outcomes/i)
    ).not.toBeInTheDocument();

    // Tooltip trigger buttons must be present for the card and sections
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(5);
  });
});

