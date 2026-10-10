/**
 * @fileoverview Unit test suite for ScoringRulesTab component.
 * Verifies tabular listview, mobile responsiveness, CardInfoTooltip invariants,
 * grid/list toggling, filtering, and user interactions.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoringRulesTab } from '../ScoringRulesTab';
import type { PolicyScoringRule } from '@/lib/policy-studio/types';

const mockRules: PolicyScoringRule[] = [
  {
    id: 'rule-1',
    eventType: 'phone_call_completed',
    entityType: 'Contact',
    category: 'communication',
    description: 'Awarded when a rep logs a phone call with client notes.',
    enabled: true,
    basePoints: 10,
    targetDimension: 'effort',
    conditions: [{ field: 'durationSeconds', operator: 'greater_than', value: 60 }],
    multipliers: [{ conditionField: 'durationSeconds', multiplier: 1.5, label: 'Long call (>10m)' }],
    updatedAt: '2026-10-09T20:00:00Z',
  },
  {
    id: 'rule-2',
    eventType: 'deal_stage_changed',
    entityType: 'Deal',
    category: 'deals',
    description: 'Awarded when moving deal forward in the sales pipeline.',
    enabled: false,
    basePoints: 50,
    targetDimension: 'outcome',
    conditions: [],
    multipliers: [],
    updatedAt: '2026-10-09T20:00:00Z',
  },
  {
    id: 'rule-3',
    eventType: 'meeting_completed',
    entityType: 'Meeting',
    category: 'meetings',
    description: 'Awarded for holding a scheduled client discovery meeting.',
    enabled: true,
    basePoints: 25,
    targetDimension: 'activity',
    conditions: [],
    multipliers: [],
    updatedAt: '2026-10-09T20:00:00Z',
  },
];

describe('ScoringRulesTab Component', () => {
  it('renders tabular listview by default with correct table headers and rows', () => {
    const onToggleRule = vi.fn();
    const onEditRule = vi.fn();

    const { container } = render(
      <ScoringRulesTab
        rules={mockRules}
        onToggleRule={onToggleRule}
        onEditRule={onEditRule}
      />
    );

    // Desktop table headers must be present
    expect(screen.getByText('Rule & Event')).toBeInTheDocument();
    expect(screen.getByText('Domain Dimension')).toBeInTheDocument();
    expect(screen.getByText('Reward Points')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();

    // Verify rules are displayed
    expect(screen.getAllByText('phone_call_completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('deal_stage_changed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('meeting_completed').length).toBeGreaterThanOrEqual(1);

    // Verify summary counts
    expect(screen.getByText(/Showing 3 of 3 scoring rules/i)).toBeInTheDocument();
    expect(screen.getByText(/2 rules active/i)).toBeInTheDocument();

    // Verify rule descriptions are NOT rendered as raw paragraph text
    expect(screen.queryByText('Awarded when a rep logs a phone call with client notes.')).not.toBeInTheDocument();
    expect(screen.queryByText('Awarded when moving deal forward in the sales pipeline.')).not.toBeInTheDocument();

    // Tooltip trigger buttons must be present
    const tooltipButtons = container.querySelectorAll('button.cursor-help');
    expect(tooltipButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders mobile cards with min 44px touch targets on interactive elements', () => {
    const onToggleRule = vi.fn();
    const onEditRule = vi.fn();

    const { container } = render(
      <ScoringRulesTab
        rules={mockRules}
        onToggleRule={onToggleRule}
        onEditRule={onEditRule}
      />
    );

    // Verify mobile container contains elements with min-h-[44px]
    const mobileContainer = container.querySelector('.md\\:hidden');
    expect(mobileContainer).toBeInTheDocument();

    const touchTargets = mobileContainer?.querySelectorAll('.min-h-\\[44px\\]');
    expect(touchTargets?.length).toBeGreaterThanOrEqual(3);
  });

  it('toggles between Tabular List view and Grid view mode', () => {
    const onToggleRule = vi.fn();
    const onEditRule = vi.fn();

    const { container } = render(
      <ScoringRulesTab
        rules={mockRules}
        onToggleRule={onToggleRule}
        onEditRule={onEditRule}
      />
    );

    // Initially in List view: table is present
    expect(container.querySelector('table')).toBeInTheDocument();

    // Switch to Grid view
    const gridButton = screen.getByRole('button', { name: /Card grid view/i });
    fireEvent.click(gridButton);

    // Table is no longer rendered in Grid view
    expect(container.querySelector('table')).not.toBeInTheDocument();

    // Rule items still rendered as cards
    expect(screen.getByText('phone_call_completed')).toBeInTheDocument();

    // Descriptions still in tooltips, not raw text
    expect(screen.queryByText('Awarded when a rep logs a phone call with client notes.')).not.toBeInTheDocument();

    // Switch back to List view
    const listButton = screen.getByRole('button', { name: /Tabular list view/i });
    fireEvent.click(listButton);

    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('filters rules by domain category', () => {
    const onToggleRule = vi.fn();
    const onEditRule = vi.fn();

    render(
      <ScoringRulesTab
        rules={mockRules}
        onToggleRule={onToggleRule}
        onEditRule={onEditRule}
      />
    );

    // Click "Deals" category pill
    const dealsTab = screen.getByRole('button', { name: 'Deals' });
    fireEvent.click(dealsTab);

    // Only deals rule should be visible
    expect(screen.getByText(/Showing 1 of 3 scoring rules/i)).toBeInTheDocument();
    expect(screen.getAllByText('deal_stage_changed').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('phone_call_completed')).not.toBeInTheDocument();
    expect(screen.queryByText('meeting_completed')).not.toBeInTheDocument();

    // Click "All Domains" pill
    const allTab = screen.getByRole('button', { name: 'All Domains' });
    fireEvent.click(allTab);

    expect(screen.getByText(/Showing 3 of 3 scoring rules/i)).toBeInTheDocument();
  });

  it('filters rules by search term and displays empty state when no rules match', () => {
    const onToggleRule = vi.fn();
    const onEditRule = vi.fn();

    render(
      <ScoringRulesTab
        rules={mockRules}
        onToggleRule={onToggleRule}
        onEditRule={onEditRule}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Filter rules by event or keyword/i);

    // Search for "phone"
    fireEvent.change(searchInput, { target: { value: 'phone' } });
    expect(screen.getByText(/Showing 1 of 3 scoring rules/i)).toBeInTheDocument();
    expect(screen.getAllByText('phone_call_completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('deal_stage_changed')).not.toBeInTheDocument();

    // Search for non-existent keyword
    fireEvent.change(searchInput, { target: { value: 'nonexistent_event_xyz' } });
    expect(screen.getByText('No scoring rules found')).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search criteria or category filter/i)).toBeInTheDocument();
  });

  it('handles rule toggle and edit actions', () => {
    const onToggleRule = vi.fn();
    const onEditRule = vi.fn();

    render(
      <ScoringRulesTab
        rules={mockRules}
        onToggleRule={onToggleRule}
        onEditRule={onEditRule}
      />
    );

    // Toggle switch for phone_call_completed
    const toggleSwitches = screen.getAllByRole('switch', { name: /Toggle rule phone_call_completed/i });
    expect(toggleSwitches.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(toggleSwitches[0]);
    expect(onToggleRule).toHaveBeenCalledWith('rule-1', false);

    // Click edit rule button
    const editButtons = screen.getAllByRole('button', { name: /Edit Rule/i });
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(editButtons[0]);
    expect(onEditRule).toHaveBeenCalledWith(mockRules[0]);
  });
});
