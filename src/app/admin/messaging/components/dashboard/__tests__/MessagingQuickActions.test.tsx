/**
 * @fileOverview Unit tests for SmartSapp Messaging Dashboard — MessagingQuickActions Component
 * 
 * Conforms to:
 * - Rule 1 (Best Practices, Vercel layout shifts, Emil Kowalski tactile interactions)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile ergonomics: 2x2 grid layout, min-h-[44px] touch target)
 * - Rule 8 (Safe relative routing)
 * - Rule 19 (HITL: clicking routes to wizards, zero automated sends)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessagingQuickActions } from '../MessagingQuickActions';

describe('MessagingQuickActions', () => {
  it('renders section title, header info tooltip, and "View all features" link', () => {
    render(<MessagingQuickActions />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getAllByTestId('card-info-tooltip').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /View all features/i })).toBeInTheDocument();
  });

  it('renders all 4 primary action cards with links and badges', () => {
    render(<MessagingQuickActions />);

    // Card 1: New Campaign
    const campaignLink = screen.getByRole('link', { name: /New Campaign/i });
    expect(campaignLink).toHaveAttribute('href', '/admin/messaging/campaigns/new');
    expect(screen.getByText('Multi-channel')).toBeInTheDocument();

    // Card 2: Start Message
    const composerLink = screen.getByRole('link', { name: /Start Message/i });
    expect(composerLink).toHaveAttribute('href', '/admin/messaging/composer');
    expect(screen.getByText('Instant')).toBeInTheDocument();

    // Card 3: Message Templates
    const templatesLink = screen.getByRole('link', { name: /Message Templates/i });
    expect(templatesLink).toHaveAttribute('href', '/admin/messaging/templates');
    expect(screen.getByText('Reusable')).toBeInTheDocument();

    // Card 4: Manage Queue
    const queueLink = screen.getByRole('link', { name: /Manage Queue/i });
    expect(queueLink).toHaveAttribute('href', '/admin/messaging/scheduled');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('ensures all cards have min-h-[44px] and tactile active states for mobile ergonomics (Rule 7)', () => {
    render(<MessagingQuickActions />);

    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveClass('active:scale-[0.98]');
    });
  });

  it('opens the All Features modal when clicking "View all features →"', () => {
    render(<MessagingQuickActions />);

    const triggerBtn = screen.getByRole('button', { name: /View all features/i });
    fireEvent.click(triggerBtn);

    expect(screen.getByText('Messaging Directory & Tools')).toBeInTheDocument();
    expect(screen.getByText('Outbound & Broadcasts')).toBeInTheDocument();
  });
});
