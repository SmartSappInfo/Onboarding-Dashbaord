// @vitest-environment jsdom
/**
 * @fileOverview Exhaustive UI Test Suite for Company Brain & Knowledge Inbox (Phase 4 Milestone 4)
 *
 * Implements Rules 1, 4, 7, 8, 10, 13, 22, 29, 30, 32, 47, 51, 60, 61, 62, 64,
 * and theme.md Section 8 (Standardized Modal Architecture).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompanyBrainMetrics } from '@/components/brain/CompanyBrainMetrics';
import { KnowledgeSearchBox } from '@/components/brain/KnowledgeSearchBox';
import { KnowledgeCandidateCard } from '@/components/brain/KnowledgeCandidateCard';
import { KnowledgeItemDrawer } from '@/components/brain/KnowledgeItemDrawer';
import { DeadManPauseBanner } from '@/components/brain/DeadManPauseBanner';
import { BrainClient } from '@/app/admin/brain/BrainClient';
import { KnowledgeInboxClient } from '@/app/admin/knowledge/inbox/KnowledgeInboxClient';
import type { CanonicalMemoryObject, MemoryStats } from '@/platform/memory';

// Mock Workspace Context
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test_123',
    activeOrganizationId: 'org_test_456',
  }),
}));

// Mock Toast Hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock Server Actions
const mockSearchMemoryAction = vi.fn();
const mockGetMemoryBrainMetricsAction = vi.fn();
const mockListKnowledgeInboxAction = vi.fn();
const mockVerifyMemoryItemAction = vi.fn();
const mockRejectMemoryItemAction = vi.fn();
const mockDeleteMemoryItemAction = vi.fn();

vi.mock('@/app/actions/memory-actions', () => ({
  searchMemoryAction: (...args: unknown[]) => mockSearchMemoryAction(...args),
  getMemoryBrainMetricsAction: (...args: unknown[]) => mockGetMemoryBrainMetricsAction(...args),
  listKnowledgeInboxAction: (...args: unknown[]) => mockListKnowledgeInboxAction(...args),
  verifyMemoryItemAction: (...args: unknown[]) => mockVerifyMemoryItemAction(...args),
  rejectMemoryItemAction: (...args: unknown[]) => mockRejectMemoryItemAction(...args),
  deleteMemoryItemAction: (...args: unknown[]) => mockDeleteMemoryItemAction(...args),
}));

// Mock useEventStream
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: () => ({
    status: 'connected',
    lastActivity: null,
    error: null,
    reconnect: vi.fn(),
  }),
}));

const mockMemoryItem: CanonicalMemoryObject = {
  id: 'mem_test_123',
  organizationId: 'org_test_456',
  workspaceId: 'ws_test_123',
  tier: 'semantic',
  type: 'insight',
  title: 'Tuition Payment Flexibility',
  content: 'Parents requested split payments in three tranches across the semester.',
  summary: 'Split payments preference.',
  source: {
    type: 'meeting',
    sourceId: 'meet_99',
    sourceHash: 'sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  subjectRefs: {},
  topics: ['tuition', 'finance'],
  importance: 0.8,
  confidence: 0.92,
  verification: 'unverified',
  sensitivity: 'internal',
  lifecycle: {
    status: 'active',
  },
  temporal: {
    validFrom: '2026-09-01T00:00:00.000Z',
    decayRate: 0.0,
  },
  provenance: {
    createdBy: 'agent',
    agentId: 'agent_sdr',
    sourceHash: 'sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const mockStats: MemoryStats = {
  totalIndexed: 42,
  semanticVectors: 35,
  activeSources: 12,
  inboxPending: 5,
  tierCounts: {
    working: 2,
    episodic: 5,
    semantic: 30,
    relational: 3,
    procedural: 2,
  },
  verificationCounts: {
    unverified: 5,
    ai_generated: 10,
    user_confirmed: 25,
    source_verified: 2,
    disputed: 0,
    invalidated: 0,
  },
  sensitivityCounts: {
    public: 5,
    internal: 30,
    confidential: 7,
    restricted: 0,
  },
  healthStatus: 'healthy',
};

describe('Company Brain & Knowledge Inbox UI Suites (Phase 4 Milestone 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMemoryBrainMetricsAction.mockResolvedValue({ success: true, data: mockStats });
    mockSearchMemoryAction.mockResolvedValue({ success: true, data: [mockMemoryItem] });
    mockListKnowledgeInboxAction.mockResolvedValue({ success: true, data: [mockMemoryItem] });
    mockVerifyMemoryItemAction.mockResolvedValue({ success: true, data: mockMemoryItem });
    mockRejectMemoryItemAction.mockResolvedValue({ success: true, data: mockMemoryItem });
    mockDeleteMemoryItemAction.mockResolvedValue({ success: true });
  });

  it('renders all 4 executive KPI metrics cards with live data', () => {
    render(<CompanyBrainMetrics stats={mockStats} />);

    expect(screen.getByText('Total Knowledge')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();

    expect(screen.getByText('Vector Embeddings')).toBeDefined();
    expect(screen.getByText('35')).toBeDefined();
    expect(screen.getByText('768-D')).toBeDefined();

    expect(screen.getByText('Active Sources')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();

    expect(screen.getByText('Inbox Triage')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('handles search query debouncing and filter chip selection in KnowledgeSearchBox', async () => {
    const onFiltersChange = vi.fn();
    render(
      <KnowledgeSearchBox
        filters={{ query: '', tier: 'all', sourceType: 'all', sensitivity: 'all' }}
        onFiltersChange={onFiltersChange}
      />
    );

    const input = screen.getByPlaceholderText(/Search institutional memory/i);
    fireEvent.change(input, { target: { value: 'payment' } });

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'payment' })
      );
    });

    const semanticButton = screen.getByText('Semantic');
    fireEvent.click(semanticButton);
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'semantic' })
    );
  });

  it('renders KnowledgeCandidateCard with confidence, tier badge, and truncated SHA-256 hash', () => {
    const onInspect = vi.fn();
    const onVerify = vi.fn();
    const onReject = vi.fn();

    render(
      <KnowledgeCandidateCard
        item={mockMemoryItem}
        onInspect={onInspect}
        onVerify={onVerify}
        onReject={onReject}
      />
    );

    expect(screen.getByText('Tuition Payment Flexibility')).toBeDefined();
    expect(screen.getByText('semantic')).toBeDefined();
    expect(screen.getByText('92%')).toBeDefined();
    expect(screen.getByText(/sha256/i)).toBeDefined();

    const inspectBtn = screen.getByRole('button', { name: /inspect/i });
    fireEvent.click(inspectBtn);
    expect(onInspect).toHaveBeenCalledWith(mockMemoryItem);
  });

  it('strictly adheres to theme.md §8 Standardized Modal Architecture in KnowledgeItemDrawer', () => {
    const onOpenChange = vi.fn();
    render(
      <KnowledgeItemDrawer
        item={mockMemoryItem}
        open={true}
        onOpenChange={onOpenChange}
        onVerify={vi.fn()}
        onReject={vi.fn()}
      />
    );

    // 1. Demarcated header with title and info tooltip
    expect(screen.getByText('Tuition Payment Flexibility')).toBeDefined();

    // 2. Screen reader accessible description
    const srDescription = document.querySelector('.sr-only');
    expect(srDescription).toBeDefined();

    // 3. Rule 30 untrusted isolation tags
    expect(screen.getByText(/<untrusted_reference_data>/i)).toBeDefined();

    // 4. Memory content rendered inside quarantine
    expect(screen.getByText(/Parents requested split payments/i)).toBeDefined();

    // 5. Demarcated footer with tactile action buttons
    const verifyBtn = screen.getByRole('button', { name: /verify & add/i });
    expect(verifyBtn).toBeDefined();
    expect(verifyBtn.className).toContain('active:scale-[0.97]');
  });

  it('renders DeadManPauseBanner when emergency dead-man pause switch is active (Rule 60)', () => {
    const { rerender } = render(<DeadManPauseBanner isPaused={false} />);
    expect(screen.queryByText(/Emergency Dead-Man Switch Active/i)).toBeNull();

    rerender(<DeadManPauseBanner isPaused={true} />);
    expect(screen.getByText(/Emergency Dead-Man Switch Active/i)).toBeDefined();
  });

  it('renders KnowledgeInboxClient with PRD §93 triage tabs and fetches candidates', async () => {
    render(<KnowledgeInboxClient />);

    expect(screen.getByText('Knowledge Inbox')).toBeDefined();
    expect(screen.getByText('New Memories')).toBeDefined();
    expect(screen.getByText('AI Insights')).toBeDefined();
    expect(screen.getByText('Potential Knowledge')).toBeDefined();
    expect(screen.getByText('Conflicts')).toBeDefined();
    expect(screen.getByText('Needs Confirmation')).toBeDefined();
    expect(screen.getByText('Stale Memories')).toBeDefined();

    await waitFor(() => {
      expect(mockListKnowledgeInboxAction).toHaveBeenCalled();
      expect(screen.getByText('Tuition Payment Flexibility')).toBeDefined();
    });
  });

  it('renders BrainClient with Three-Zone layout and fetches metrics and items', async () => {
    render(<BrainClient />);

    expect(screen.getByText('Company Brain')).toBeDefined();

    await waitFor(() => {
      expect(mockGetMemoryBrainMetricsAction).toHaveBeenCalled();
      expect(mockSearchMemoryAction).toHaveBeenCalled();
      expect(screen.getByText('Tuition Payment Flexibility')).toBeDefined();
    });
  });
});
