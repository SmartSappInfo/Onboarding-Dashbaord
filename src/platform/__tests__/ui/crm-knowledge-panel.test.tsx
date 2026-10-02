// @vitest-environment jsdom
/**
 * @fileOverview UI Test Suite: CRM Knowledge Context Panel (Phase 4 Milestone 5)
 *
 * Implements Rules 4, 7, 8, 10, 13, 30, 47, 51, 64.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KnowledgeContextPanel } from '@/components/crm/KnowledgeContextPanel';
import type { EntityContextResult } from '@/app/actions/memory-actions';

// Mock Server Actions
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

describe('CRM Knowledge Context Panel (KnowledgeContextPanel.tsx)', () => {
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

    // Shows loading skeleton initially
    expect(screen.getByTestId('knowledge-context-skeleton')).toBeDefined();

    // Resolves and displays AI context summary
    await waitFor(() => {
      expect(screen.getByText('Institutional Memory & Context')).toBeDefined();
      expect(screen.getByText(/420 tokens/i)).toBeDefined();
    });

    // Evidence citation pills
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
