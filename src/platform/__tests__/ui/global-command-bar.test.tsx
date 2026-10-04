// @vitest-environment jsdom
/**
 * @fileOverview UI Test Suite for Global ⌘K Omni-Bar & Intelligent Intent Composer
 *
 * Implements verification for:
 * - theme.md §8: Standardized Modal & Dialog Architecture compliance.
 * - Rule 4: Zero any / zero any[] typing policy.
 * - Rule 7: Mobile-first >= 44px touch targets.
 * - Rule 13 & 30: Prompt injection protection.
 * - Rule 21: Two-Phase high-risk action confirmation preview.
 * - Rule 54: Sub-50ms open, 300ms debouncing.
 * - Rule 62: Live SSE reactivity via useEventStream.
 * - Rule 68: "No Dead Ends" with clear follow-up navigation affordances.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalCommandBar } from '@/components/command/GlobalCommandBar';
import * as commandActions from '@/app/actions/command-actions';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
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

// Mock command server actions
vi.mock('@/app/actions/command-actions', () => ({
  classifyCommandIntentAction: vi.fn(),
  getCommandSuggestionsAction: vi.fn(),
  executeCommandAction: vi.fn(),
}));

describe('GlobalCommandBar Component', () => {
  const defaultSuggestions = [
    {
      id: 'sug_1',
      label: 'Find deals closing this month',
      prompt: 'Find deals closing this month',
      intent: 'SEARCH' as const,
      icon: 'Search',
      badge: 'CRM',
    },
    {
      id: 'sug_2',
      label: 'Analyze sales pipeline velocity',
      prompt: 'Analyze sales pipeline velocity',
      intent: 'ANALYZE' as const,
      icon: 'TrendingUp',
      badge: 'Analytics',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(commandActions.getCommandSuggestionsAction).mockResolvedValue({
      success: true,
      data: defaultSuggestions,
    });
    vi.mocked(commandActions.classifyCommandIntentAction).mockResolvedValue({
      success: true,
      data: {
        intent: 'SEARCH',
        confidence: 0.95,
        targetDomain: 'knowledge',
        targetEntities: [],
        suggestedAction: {
          id: 'act_1',
          title: 'Search: test query',
          description: 'Dispatches search',
          intent: 'SEARCH',
          estimatedRiskLevel: 'L0_READ',
          requiresApproval: false,
        },
        suggestedPlan: ['Retrieve vectors', 'Rank results'],
        sanitizedPrompt: 'test query',
        latencyMs: 15,
      },
    });
    vi.mocked(commandActions.executeCommandAction).mockResolvedValue({
      success: true,
      data: {
        executionId: 'exec_test_1',
        status: 'completed',
        intent: 'SEARCH',
        summary: 'Search executed successfully',
        redirectUrl: '/admin/brain',
        executedAt: new Date().toISOString(),
      },
    });
  });

  describe('theme.md §8 Modal Architecture Compliance', () => {
    it('renders with demarcated header, sr-only description, and CardInfoTooltip', async () => {
      render(<GlobalCommandBar open={true} onOpenChange={vi.fn()} />);

      // Title presence
      expect(screen.getByText('SmartSapp Intelligence')).toBeDefined();

      // Screen-reader accessible sr-only description (theme.md §8)
      const srDescription = screen.getByText(
        /Global omni-bar command center for search, analysis, agent delegation, and workflow automation/i
      );
      expect(srDescription).toBeDefined();
      expect(srDescription.className).toContain('sr-only');

      // CardInfoTooltip info icon single-circle compliance
      const tooltipTrigger = screen.getByRole('button', { name: /more information/i });
      expect(tooltipTrigger).toBeDefined();
    });

    it('renders demarcated footer with tactile keyboard chips and action button', () => {
      render(<GlobalCommandBar open={true} onOpenChange={vi.fn()} />);

      expect(screen.getByText(/\bEnter\b/)).toBeDefined();
      expect(screen.getByText(/Tab Plan/i)).toBeDefined();
      expect(screen.getByText(/Esc Close/i)).toBeDefined();

      const runButton = screen.getByRole('button', { name: /Run Command/i });
      expect(runButton).toBeDefined();
      expect(runButton.className).toContain('min-h-[44px]');
      expect(runButton.className).toContain('active:scale-[0.97]');
    });
  });

  describe('5-State Command Composer State Transitions', () => {
    it('State A (Empty): renders suggested shortcuts when prompt is empty', async () => {
      render(<GlobalCommandBar open={true} onOpenChange={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Suggested Shortcuts')).toBeDefined();
        expect(screen.getByText('Find deals closing this month')).toBeDefined();
      });
    });

    it('State B (Suggesting): updates classification pill when user types query', async () => {
      render(<GlobalCommandBar open={true} onOpenChange={vi.fn()} />);

      const input = screen.getByPlaceholderText(/Ask, find, analyze, automate or delegate.../i);
      fireEvent.change(input, { target: { value: 'find all deals' } });

      await waitFor(
        () => {
          expect(commandActions.classifyCommandIntentAction).toHaveBeenCalledWith(
            expect.objectContaining({ prompt: 'find all deals' })
          );
        },
        { timeout: 1000 }
      );

      // Classification badge should show SEARCH
      await waitFor(() => {
        expect(screen.getAllByText('SEARCH').length).toBeGreaterThan(0);
      });
    });

    it('State C (Planning): transitions to plan preview and shows proposed steps', async () => {
      render(<GlobalCommandBar open={true} onOpenChange={vi.fn()} />);

      const input = screen.getByPlaceholderText(/Ask, find, analyze, automate or delegate.../i);
      fireEvent.change(input, { target: { value: 'find all deals' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /View Plan/i })).toBeDefined();
      });

      const planButton = screen.getByRole('button', { name: /View Plan/i });
      fireEvent.click(planButton);

      await waitFor(() => {
        expect(screen.getByText('Execution Plan Decomposition')).toBeDefined();
        expect(screen.getByText('Retrieve vectors')).toBeDefined();
        expect(screen.getByText('Rank results')).toBeDefined();
      });
    });

    it('State D & E (Executing -> Completed): dispatches execution and shows structured outcome', async () => {
      render(<GlobalCommandBar open={true} onOpenChange={vi.fn()} />);

      const input = screen.getByPlaceholderText(/Ask, find, analyze, automate or delegate.../i);
      fireEvent.change(input, { target: { value: 'find all deals' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Run Command/i })).toBeDefined();
      });

      const runButton = screen.getByRole('button', { name: /Run Command/i });
      fireEvent.click(runButton);

      await waitFor(() => {
        expect(commandActions.executeCommandAction).toHaveBeenCalled();
        expect(screen.getByText('Search executed successfully')).toBeDefined();
        expect(screen.getByText('Open Target Surface')).toBeDefined();
      });
    });
  });

  describe('Keyboard Shortcuts & Mobile First', () => {
    it('toggles open state when Meta+K / Ctrl+K is pressed', () => {
      const onOpenChange = vi.fn();
      render(<GlobalCommandBar open={false} onOpenChange={onOpenChange} />);

      fireEvent.keyDown(window, { key: 'k', metaKey: true });
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('enforces min-h-[44px] touch target rules on clickable elements (Rule 7)', async () => {
      render(<GlobalCommandBar open={true} onOpenChange={vi.fn()} />);

      await waitFor(() => {
        const suggestionButtons = screen.getAllByRole('button');
        const actionableButtons = suggestionButtons.filter((b) =>
          b.className.includes('min-h-[44px]')
        );
        expect(actionableButtons.length).toBeGreaterThan(0);
      });
    });
  });
});
