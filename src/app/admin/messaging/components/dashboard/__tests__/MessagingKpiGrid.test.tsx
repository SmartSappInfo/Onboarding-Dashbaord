/**
 * @fileOverview Unit tests for SmartSapp Messaging Dashboard — MessagingKpiGrid Component
 * 
 * Conforms to:
 * - Rule 1 (Best Practices, Vercel CLS elimination, Emil Kowalski tactile interactions)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile ergonomics: 2x2 grid layout, min-h-[44px] touch target)
 * - Rule 8 (Safe relative routing)
 * - Rule 21 & 24 (Graceful degradation & Provider fault tolerance)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessagingKpiGrid } from '../MessagingKpiGrid';
import type { MessagingKpiMetrics } from '@/lib/types/messaging-dashboard';

describe('MessagingKpiGrid', () => {
  const mockMetrics: MessagingKpiMetrics = {
    messagesSent: 12482,
    messagesSentDeltaPercentage: 24,
    deliveryRate: 99.7,
    deliveryRateDeltaPercentage: 1.2,
    smsBalance: 941,
    providerStatus: 'healthy',
    providerStatusLabel: 'All Systems Active',
  };

  it('renders all 4 stat cards with formatted values and indicators', () => {
    render(<MessagingKpiGrid metrics={mockMetrics} />);

    // Card 1: Messages Sent
    expect(screen.getByText('Messages Sent')).toBeInTheDocument();
    expect(screen.getByText('12,482')).toBeInTheDocument();
    expect(screen.getByText('↑ 24%')).toBeInTheDocument();

    // Card 2: Delivery Rate
    expect(screen.getByText('Delivery Rate')).toBeInTheDocument();
    expect(screen.getByText('99.7%')).toBeInTheDocument();
    expect(screen.getByText('↑ 1.2%')).toBeInTheDocument();

    // Card 3: SMS Unit Balance
    expect(screen.getByText('SMS Unit Balance')).toBeInTheDocument();
    expect(screen.getByText('941')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Top up now/i })).toHaveAttribute(
      'href',
      '/admin/settings?tab=billing'
    );

    // Card 4: Provider Status
    expect(screen.getByText('Provider Status')).toBeInTheDocument();
    expect(screen.getByText('All Systems Active')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('renders low balance warning badge when SMS units are below threshold', () => {
    const lowMetrics: MessagingKpiMetrics = {
      ...mockMetrics,
      smsBalance: 42,
    };
    render(<MessagingKpiGrid metrics={lowMetrics} lowBalanceThreshold={100} />);

    expect(screen.getByText('Low balance')).toBeInTheDocument();
  });

  it('renders exhausted warning badge when SMS units are zero', () => {
    const exhaustedMetrics: MessagingKpiMetrics = {
      ...mockMetrics,
      smsBalance: 0,
    };
    render(<MessagingKpiGrid metrics={exhaustedMetrics} lowBalanceThreshold={100} />);

    expect(screen.getByText('Exhausted')).toBeInTheDocument();
  });

  it('renders degraded provider status correctly without crashing', () => {
    const degradedMetrics: MessagingKpiMetrics = {
      ...mockMetrics,
      providerStatus: 'degraded',
      providerStatusLabel: 'mNotify Gateway Latency',
    };
    render(<MessagingKpiGrid metrics={degradedMetrics} />);

    expect(screen.getByText('mNotify Gateway Latency')).toBeInTheDocument();
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('renders skeleton cards when isLoading is true to eliminate layout shift (CLS)', () => {
    render(<MessagingKpiGrid isLoading={true} />);

    const skeletons = screen.getAllByTestId('kpi-skeleton-card');
    expect(skeletons).toHaveLength(4);
  });

  it('renders skeleton cards when metrics is null or undefined', () => {
    render(<MessagingKpiGrid metrics={null} />);

    const skeletons = screen.getAllByTestId('kpi-skeleton-card');
    expect(skeletons).toHaveLength(4);
  });
});
