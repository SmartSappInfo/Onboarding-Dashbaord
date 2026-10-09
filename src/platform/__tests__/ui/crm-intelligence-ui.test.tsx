/**
 * @fileOverview Consolidated UI Test Suite: CRM Intelligence & Knowledge UI Components
 * (AccountAiOverviewCard, AccountKnowledgePanel, KnowledgeContextPanel).
 *
 * Implements Rule 4 (Zero any/any[]), Rule 7 (Mobile-first >= 44px touch targets),
 * Rule 13 & 30 (Untrusted reference data isolation), Rule 41 (Explainability),
 * and theme.md §8 (Standardized Modal & Dialog System Architecture).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountAiOverviewCard } from '@/components/crm/intelligence/AccountAiOverviewCard';
import { AccountKnowledgePanel } from '@/components/crm/intelligence/AccountKnowledgePanel';
import { KnowledgeContextPanel } from '@/components/crm/KnowledgeContextPanel';
import type { AccountAiOverview, AccountKnowledge } from '@/platform/agents/crm/intelligence/crm-intelligence-types';
import type { EntityContextResult } from '@/app/actions/memory-actions';

// Mock Server Actions for KnowledgeContextPanel
const mockGetEntityContextAction = vi.fn();
vi.mock('@/app/actions/memory-actions', () => ({
  getEntityContextAction: (...args: unknown[]) => mockGetEntityContextAction(...args),
}));

// Mock Toast Hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

/* ==============================================================================
 * 1. Account AI Overview & Knowledge Panels
 * ============================================================================== */
describe('Account AI Overview & Knowledge Panels (Phase 9 Milestone 3)', () => {
  const mockOverview: AccountAiOverview = {
    entityId: 'ent_greenfield_01',
    workspaceId: 'ws_demo_01',
    healthStatus: 'HEALTHY',
    healthScore: 88,
    executiveSummary: 'Greenfield School demonstrates consistent engagement across onboarding milestones.',
    activeMomentum: 'ACCELERATING',
    keyRisks: [
      {
        id: 'risk_01',
        tag: 'RENEWAL_WINDOW',
        severity: 'LOW',
        description: 'Contract renewal discussions scheduled for Q4.',
      },
    ],
    stakeholders: [
      {
        contactId: 'con_01',
        name: 'Sarah Jenkins',
        role: 'Head of Admissions',
        email: 'sarah.j@greenfield.edu',
        engagementLevel: 'HIGH',
        isPrimary: true,
      },
    ],
    recentSignals: [
      {
        id: 'sig_01',
        type: 'MEETING',
        title: 'Q3 Strategy Review',
        timestamp: '2026-10-02T14:00:00Z',
        sentiment: 'positive',
      },
    ],
    generatedAt: '2026-10-04T12:00:00Z',
  };

  const mockKnowledge: AccountKnowledge = {
    entityId: 'ent_greenfield_01',
    workspaceId: 'ws_demo_01',
    groundedFacts: [
      {
        id: 'fact_01',
        statement: 'Greenfield operates 3 separate campuses with 1,200 enrolled students.',
        category: 'INSTITUTION_PROFILE',
        confidence: 0.95,
        citationId: 'cit_01',
        sourceTitle: 'Campus Discovery Notes',
        sourceType: 'note',
      },
    ],
    meetingTakeaways: [
      {
        meetingId: 'meet_01',
        meetingTitle: 'Admissions Integration Kickoff',
        date: '2026-09-15',
        takeaways: ['Admissions team approved SIS API connector provisioning.'],
        decisions: ['Approved SIS API connector provisioning.'],
      },
    ],
    citations: [
      {
        id: 'cit_01',
        sourceType: 'note',
        sourceId: 'note_8812',
        title: 'Campus Discovery Notes',
        snippet: 'The main campus will transition to digital enrollment this semester.',
        timestamp: '2026-09-10T10:00:00Z',
        isolatedSnippet: '<untrusted_reference_data id="cit_01">The main campus will transition to digital enrollment this semester.</untrusted_reference_data>',
      },
    ],
    generatedAt: '2026-10-04T12:00:00Z',
  };

  describe('AccountAiOverviewCard', () => {
    it('renders health score, status badge, momentum, and narrative summary', () => {
      render(<AccountAiOverviewCard overview={mockOverview} />);

      expect(screen.getByText('88')).toBeDefined();
      expect(screen.getByText('HEALTHY')).toBeDefined();
      expect(screen.getByText(/ACCELERATING/i)).toBeDefined();
      expect(screen.getByText(/Greenfield School demonstrates consistent engagement/)).toBeDefined();
      expect(screen.getByText('Sarah Jenkins')).toBeDefined();
      expect(screen.getByText('Q3 Strategy Review')).toBeDefined();
    });

    it('triggers onRefresh callback when refresh button is clicked', () => {
      const onRefresh = vi.fn();
      render(<AccountAiOverviewCard overview={mockOverview} onRefresh={onRefresh} />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe('AccountKnowledgePanel', () => {
    it('renders grounded facts, source chips, and meeting takeaways', () => {
      render(<AccountKnowledgePanel knowledge={mockKnowledge} />);

      expect(screen.getByText(/Greenfield operates 3 separate campuses/)).toBeDefined();
      expect(screen.getByText(/Campus Discovery Notes/)).toBeDefined();
      expect(screen.getByText(/Admissions Integration Kickoff/)).toBeDefined();
    });

    it('opens Citation Drawer when viewing citations', () => {
      render(<AccountKnowledgePanel knowledge={mockKnowledge} />);

      const viewCitationButton = screen.getByRole('button', { name: /view citation/i });
      fireEvent.click(viewCitationButton);

      expect(screen.getByText('Account Source Citations')).toBeDefined();
      expect(screen.getByText(/The main campus will transition to digital enrollment/)).toBeDefined();
    });
  });
});

/* ==============================================================================
 * 2. KnowledgeContextPanel
 * ============================================================================== */
describe('KnowledgeContextPanel (Phase 4 Milestone 5)', () => {
  const sampleContextData: EntityContextResult = {
    entityId: 'ent_contact_123',
    entityType: 'contact',
    compiledContext: '<untrusted_reference_data id="mem_1">Director stressed urgent onboarding timeline before Q4.</untrusted_reference_data>',
    evidence: [
      {
        id: 'mem_1',
        citationTag: '[meeting:meet_sept]',
        verbatimSnippet: 'Director stressed urgent onboarding timeline before Q4.',
        score: 0.94,
        confidence: 0.95,
        sourceType: 'meeting',
        sourceId: 'meet_sept',
        author: 'Joseph Aidoo',
        sensitivity: 'internal',
      },
      {
        id: 'mem_2',
        citationTag: '[crm:note_88]',
        verbatimSnippet: 'Key stakeholder asked for custom WhatsApp automation integration.',
        score: 0.88,
        confidence: 0.9,
        sourceType: 'crm',
        sourceId: 'note_88',
        author: 'Sarah Admin',
        sensitivity: 'internal',
      },
    ],
    tokenCount: 420,
    truncated: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then displays grounded context', async () => {
    mockGetEntityContextAction.mockResolvedValueOnce({
      success: true,
      data: sampleContextData,
    });

    render(
      <KnowledgeContextPanel
        entityId="ent_contact_123"
        entityType="contact"
        entityName="Dr. David Mensah"
      />
    );

    expect(screen.getByTestId('knowledge-context-skeleton')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Institutional Memory & Context')).toBeDefined();
      expect(screen.getByText(/420 tokens/i)).toBeDefined();
    });

    expect(screen.getByText('[meeting:meet_sept]')).toBeDefined();
    expect(screen.getByText('[crm:note_88]')).toBeDefined();
  });

  it('renders prompt injection quarantine isolation banner (Rule 30)', async () => {
    mockGetEntityContextAction.mockResolvedValueOnce({
      success: true,
      data: sampleContextData,
    });

    render(
      <KnowledgeContextPanel
        entityId="ent_contact_123"
        entityType="contact"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('<untrusted_reference_data>')).toBeDefined();
    });
  });

  it('triggers onInspectItem callback when an evidence card is clicked', async () => {
    mockGetEntityContextAction.mockResolvedValueOnce({
      success: true,
      data: sampleContextData,
    });

    const handleInspect = vi.fn();

    render(
      <KnowledgeContextPanel
        entityId="ent_contact_123"
        entityType="contact"
        onInspectEvidenceId={handleInspect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('[meeting:meet_sept]')).toBeDefined();
    });

    const inspectBtn = screen.getAllByRole('button', { name: /inspect/i })[0];
    fireEvent.click(inspectBtn);

    expect(handleInspect).toHaveBeenCalledWith('mem_1');
  });

  it('renders empty state when no memories exist for the entity', async () => {
    mockGetEntityContextAction.mockResolvedValueOnce({
      success: true,
      data: {
        entityId: 'ent_contact_empty',
        compiledContext: '',
        evidence: [],
        tokenCount: 0,
        truncated: false,
      },
    });

    render(
      <KnowledgeContextPanel
        entityId="ent_contact_empty"
        entityType="contact"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no institutional memory found/i)).toBeDefined();
    });
  });

  it('dispatches on-demand search when typing in "Ask SmartSapp" input', async () => {
    mockGetEntityContextAction
      .mockResolvedValueOnce({
        success: true,
        data: sampleContextData,
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          ...sampleContextData,
          compiledContext: 'Filtered context on budget requirements.',
        },
      });

    render(
      <KnowledgeContextPanel
        entityId="ent_contact_123"
        entityType="contact"
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ask smartsapp about this entity/i)).toBeDefined();
    });

    const input = screen.getByPlaceholderText(/ask smartsapp about this entity/i);
    fireEvent.change(input, { target: { value: 'budget discount' } });

    const searchBtn = screen.getByRole('button', { name: /query/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(mockGetEntityContextAction).toHaveBeenCalledTimes(2);
    });
  });
});
