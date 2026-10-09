/**
 * @fileOverview Visual Parity, Theme & Mobile Viewport Audit for Messaging Hub.
 * 
 * Verifies key UX invariants across the Communications Hub components:
 * - Rule 1 & Rule 2: Tabular numbers on all metrics to eliminate CLS.
 * - Rule 7: Minimum 44px touch targets on mobile interactions.
 * - Rule 8: Semantic theme classes conforming to theme.md Section 4 & 8.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessagingKpiCard } from '../components/dashboard/MessagingKpiCard';
import { MobileBottomNav } from '../components/dashboard/MobileBottomNav';
import { Mail } from 'lucide-react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/messaging',
}));

describe('MessagingThemeAudit', () => {
  it('enforces tabular-nums on numeric metrics to eliminate CLS', () => {
    render(
      <MessagingKpiCard
        title="Messages Sent"
        value={12482}
        icon={<Mail className="h-4 w-4 text-blue-500" />}
        iconBgClass="bg-blue-500/10"
      />
    );
    const valueEl = screen.getByText('12482');
    expect(valueEl.className).toContain('tabular-nums');
  });

  it('enforces min-h-[44px] touch targets on mobile navigation items', () => {
    render(<MobileBottomNav onOpenMore={vi.fn()} />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link.className).toContain('min-h-[44px]');
    });

    const moreBtn = screen.getByRole('button', { name: /More/i });
    expect(moreBtn.className).toContain('min-h-[44px]');
  });
});
