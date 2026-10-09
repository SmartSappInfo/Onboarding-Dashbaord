/**
 * @fileOverview Unit tests for SmartSapp Messaging Dashboard — MessagingKpiCard Component
 * 
 * Conforms to:
 * - Rule 1 (Best Practices, Vercel layout shifts, tabular-nums, Emil Kowalski tactile interactions)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile ergonomics: min-h-[44px] touch target)
 * - Rule 8 (Safe relative routing)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessageSquare } from 'lucide-react';
import { MessagingKpiCard } from '../MessagingKpiCard';

describe('MessagingKpiCard', () => {
  it('renders title, formatted value with tabular numbers, and icon', () => {
    render(
      <MessagingKpiCard
        title="Messages Sent"
        value="12,482"
        icon={<MessageSquare data-testid="test-icon" className="h-5 w-5" />}
        iconBgClass="bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
      />
    );

    expect(screen.getByText('Messages Sent')).toBeInTheDocument();
    const valueEl = screen.getByText('12,482');
    expect(valueEl).toBeInTheDocument();
    expect(valueEl).toHaveClass('tabular-nums');
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders positive trend badge and subtitle', () => {
    render(
      <MessagingKpiCard
        title="Delivery Rate"
        value="99.7%"
        icon={<MessageSquare className="h-5 w-5" />}
        iconBgClass="bg-emerald-50 text-emerald-600"
        trend={{ formatted: '↑ 1.2%', isPositive: true, isNeutral: false, deltaValue: 1.2 }}
        subtitle="vs. last 7 days"
      />
    );

    expect(screen.getByText('↑ 1.2%')).toBeInTheDocument();
    expect(screen.getByText('vs. last 7 days')).toBeInTheDocument();
  });

  it('renders negative and neutral trend badges with proper color coding', () => {
    const { rerender } = render(
      <MessagingKpiCard
        title="Messages Sent"
        value="8,200"
        icon={<MessageSquare className="h-5 w-5" />}
        iconBgClass="bg-blue-50 text-blue-600"
        trend={{ formatted: '↓ 5.2%', isPositive: false, isNeutral: false, deltaValue: -5.2 }}
      />
    );
    const negativeBadge = screen.getByText('↓ 5.2%');
    expect(negativeBadge).toBeInTheDocument();
    expect(negativeBadge).toHaveClass('text-rose-600');

    rerender(
      <MessagingKpiCard
        title="Messages Sent"
        value="8,200"
        icon={<MessageSquare className="h-5 w-5" />}
        iconBgClass="bg-blue-50 text-blue-600"
        trend={{ formatted: '0%', isPositive: false, isNeutral: true, deltaValue: 0 }}
      />
    );
    const neutralBadge = screen.getByText('0%');
    expect(neutralBadge).toBeInTheDocument();
    expect(neutralBadge).toHaveClass('text-muted-foreground');
  });

  it('renders interactive action link with tactile feedback and min-h-[44px]', () => {
    render(
      <MessagingKpiCard
        title="SMS Unit Balance"
        value="941"
        icon={<MessageSquare className="h-5 w-5" />}
        iconBgClass="bg-orange-50 text-orange-600"
        actionLink={{ label: 'Top up now →', href: '/admin/settings?tab=billing' }}
      />
    );

    const link = screen.getByRole('link', { name: /Top up now/i });
    expect(link).toHaveAttribute('href', '/admin/settings?tab=billing');
    expect(link).toHaveClass('active:scale-[0.97]');
    expect(link).toHaveClass('min-h-[44px]');
  });

  it('renders badge with status indicator dot', () => {
    render(
      <MessagingKpiCard
        title="Provider Status"
        value="All Systems Active"
        icon={<MessageSquare className="h-5 w-5" />}
        iconBgClass="bg-purple-50 text-purple-600"
        badge={{
          label: 'Healthy',
          variant: 'emerald',
          indicatorDotClass: 'bg-emerald-500 animate-pulse',
        }}
      />
    );

    expect(screen.getByText('Provider Status')).toBeInTheDocument();
    expect(screen.getByText('All Systems Active')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});
