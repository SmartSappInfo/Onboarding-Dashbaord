/**
 * @fileoverview Unit tests for PromptsLibraryClient
 *
 * Verifies that:
 * 1. Prompt card headers are left-aligned.
 * 2. Card titles render with CardInfoTooltip instead of centered subtitle blocks.
 * 3. Badges and card titles are aligned to the left edge of the card.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PromptsLibraryClient from '../PromptsLibraryClient';
import type { GlobalPrompt } from '@/lib/pms-types';

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganizationId: 'org-test',
    activeWorkspaceId: 'ws-test',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/pms-repository', () => ({
  getGlobalPrompts: vi.fn(),
  getTenantOverrides: vi.fn(),
  deleteTenantOverride: vi.fn(),
}));

const mockPrompts: GlobalPrompt[] = [
  {
    id: 'email-gen',
    title: 'High-Fidelity Email Template Generator',
    description: 'Generates polished, context-aware emails for outreach and follow-ups.',
    category: 'emails',
    tags: ['outreach', 'email'],
    variables: ['prompt', 'channel', 'availableVariables'],
    aiModels: ['googleai/gemini-2.0-flash'],
    version: 1,
    updatedAt: '2026-10-09T00:00:00Z',
    updatedBy: 'system',
    systemPrompt: 'You are an email assistant.',
    userPromptTemplate: 'Hello {{prompt}}',
  },
];

describe('PromptsLibraryClient - Card Header Layout', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getGlobalPrompts, getTenantOverrides } = await import('@/lib/pms-repository');
    vi.mocked(getGlobalPrompts).mockResolvedValue({
      success: true,
      data: mockPrompts,
    });
    vi.mocked(getTenantOverrides).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it('renders left-aligned card header with title and CardInfoTooltip', async () => {
    render(<PromptsLibraryClient />);

    await waitFor(() => {
      expect(screen.getByText('High-Fidelity Email Template Generator')).toBeInTheDocument();
    });

    // Verify category badge and status badge
    expect(screen.getAllByText('emails').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Subscribed')).toBeInTheDocument();

    // Verify CardInfoTooltip trigger is rendered beside title
    const tooltipButton = screen.getByRole('button', { name: /more information/i });
    expect(tooltipButton).toBeInTheDocument();

    // Verify CardHeader has text-left and items-start styling
    const cardTitle = screen.getByText('High-Fidelity Email Template Generator');
    const cardHeader = cardTitle.closest('[data-slot="card-header"]');
    expect(cardHeader).toBeInTheDocument();
    expect(cardHeader).toHaveClass('text-left');
    expect(cardHeader).toHaveClass('items-start');

    // Verify raw description paragraph is eliminated under title
    expect(
      screen.queryByText('Generates polished, context-aware emails for outreach and follow-ups.')
    ).not.toBeInTheDocument();
  });
});
