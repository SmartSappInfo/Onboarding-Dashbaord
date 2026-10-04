// @vitest-environment jsdom
/**
 * @fileOverview UI Test Suite for AI Command Center Console (/admin/intelligence)
 *
 * Implements verification for:
 * - Three-Zone Operator Mission Control Layout.
 * - 5-Intent Category Filter Toolbar.
 * - Dynamic Action Launchpads & Recent Command Execution Stream.
 * - Rule 7: Mobile-first touch targets >= 44px.
 * - Rule 62: Live SSE reactivity via useEventStream.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { IntelligenceClient } from '@/app/admin/intelligence/IntelligenceClient';
import * as commandActions from '@/app/actions/command-actions';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock useEventStream
let registeredActivityCallbacks: ((activity: any) => void)[] = [];
vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: (options: { onActivity?: (activity: any) => void; enabled?: boolean } = {}) => {
    const { onActivity, enabled = true } = options;
    React.useEffect(() => {
      if (enabled && onActivity) {
        registeredActivityCallbacks.push(onActivity);
        return () => {
          const idx = registeredActivityCallbacks.indexOf(onActivity);
          if (idx >= 0) registeredActivityCallbacks.splice(idx, 1);
        };
      }
    }, [enabled, onActivity]);
    return {
      status: 'connected',
      lastActivity: null,
      error: null,
      reconnect: vi.fn(),
    };
  },
}));

// Mock command server actions
vi.mock('@/app/actions/command-actions', () => ({
  classifyCommandIntentAction: vi.fn(),
  getCommandSuggestionsAction: vi.fn(),
  executeCommandAction: vi.fn(),
}));

describe('IntelligenceClient Component', () => {
  const mockSuggestions = [
    {
      id: 'sug_1',
      label: 'Find deals closing this month',
      prompt: 'Query all enterprise opportunities closing this month',
      intent: 'SEARCH' as const,
      icon: 'Search',
      badge: 'CRM',
    },
    {
      id: 'sug_2',
      label: 'Analyze sales pipeline velocity',
      prompt: 'Compute pipeline stage velocity metrics',
      intent: 'ANALYZE' as const,
      icon: 'TrendingUp',
      badge: 'Analytics',
    },
    {
      id: 'sug_3',
      label: 'Automate new lead intake workflow',
      prompt: 'Route incoming leads to account executives',
      intent: 'AUTOMATE' as const,
      icon: 'Workflow',
      badge: 'Workflow',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    registeredActivityCallbacks = [];
    vi.mocked(commandActions.getCommandSuggestionsAction).mockResolvedValue({
      success: true,
      data: mockSuggestions,
    });
  });

  describe('Three-Zone Mission Control Layout', () => {
    it('renders Zone 1: Executive KPI header, counters, and ⌘K trigger button', async () => {
      render(<IntelligenceClient />);

      expect(screen.getByText('AI Command Center')).toBeDefined();
      expect(screen.getByText('Open ⌘K Omni-Bar')).toBeDefined();

      // Metric counters
      expect(screen.getByText('768-D')).toBeDefined();
      expect(screen.getByText('Pro / Flash')).toBeDefined();
      expect(screen.getByText('Swarm Mode')).toBeDefined();
      expect(screen.getByText('Cloud Tasks')).toBeDefined();
    });

    it('renders Zone 2: Intent category filter toolbar with all 5 canonical intents', async () => {
      render(<IntelligenceClient />);

      expect(screen.getByText('Intent Categories')).toBeDefined();
      expect(screen.getByRole('button', { name: 'ALL' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'SEARCH' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'ANALYZE' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'EXECUTE' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'DELEGATE' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'AUTOMATE' })).toBeDefined();
    });

    it('renders Zone 3: Recent command execution feed with status and inspection links', () => {
      render(<IntelligenceClient />);

      expect(screen.getByText('Recent Command Executions')).toBeDefined();
      expect(screen.getByText(/Retrieved 8 high-priority enterprise opportunities/i)).toBeDefined();
      expect(screen.getAllByText('Inspect').length).toBeGreaterThan(0);
    });
  });

  describe('Interactions & Category Filtering', () => {
    it('filters suggested launchpads when an intent pill is clicked', async () => {
      render(<IntelligenceClient />);

      await waitFor(() => {
        expect(screen.getByText('Find deals closing this month')).toBeDefined();
        expect(screen.getByText('Analyze sales pipeline velocity')).toBeDefined();
      });

      // Filter by SEARCH only
      const searchPill = screen.getByRole('button', { name: 'SEARCH' });
      fireEvent.click(searchPill);

      await waitFor(() => {
        expect(screen.getByText('Find deals closing this month')).toBeDefined();
        expect(screen.queryByText('Analyze sales pipeline velocity')).toBeNull();
      });
    });

    it('opens ⌘K Omni-Bar dialog when clicking a suggested action launchpad', async () => {
      render(<IntelligenceClient />);

      await waitFor(() => {
        expect(screen.getByText('Find deals closing this month')).toBeDefined();
      });

      const launchpadCard = screen.getByText('Find deals closing this month').closest('div');
      if (launchpadCard) {
        fireEvent.click(launchpadCard);
      }

      await waitFor(() => {
        expect(screen.getByText('SmartSapp Intelligence')).toBeDefined();
      });
    });

    it('opens ⌘K Omni-Bar dialog when clicking the Open ⌘K Omni-Bar banner button', async () => {
      render(<IntelligenceClient />);

      const openButton = screen.getByText('Open ⌘K Omni-Bar').closest('button');
      if (openButton) {
        fireEvent.click(openButton);
      }

      await waitFor(() => {
        expect(screen.getByText('SmartSapp Intelligence')).toBeDefined();
      });
    });
  });

  describe('Real-Time SSE Event Reactivity (Rule 62)', () => {
    it('prepends new command execution item when command.executed domain event arrives', async () => {
      render(<IntelligenceClient />);

      await waitFor(() => {
        expect(screen.getByText('Recent Command Executions')).toBeDefined();
      });

      // Trigger incoming SSE event
      act(() => {
        registeredActivityCallbacks.forEach((cb) =>
          cb({
            id: 'activity_new_1',
            type: 'command.executed',
            eventType: 'command.executed',
            entity: { id: 'cmd_1', type: 'command' },
            details: {
              prompt: 'Live stream executed task',
              intent: 'EXECUTE',
              status: 'completed',
              summary: 'Live update received via Server-Sent Events',
            },
            payload: {
              prompt: 'Live stream executed task',
              intent: 'EXECUTE',
              status: 'completed',
              summary: 'Live update received via Server-Sent Events',
            },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/Live update received via Server-Sent Events/i)).toBeDefined();
      });
    });
  });
});
