/**
 * @fileOverview Unit tests for SmartSapp Messaging Dashboard — MessagingAllFeaturesModal Component
 * 
 * Conforms to:
 * - Rule 1 (Best Practices, theme.md Section 8 modal standards)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile ergonomics: min-h-[44px] touch target)
 * - Rule 8 (Safe relative routing)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessagingAllFeaturesModal } from '../MessagingAllFeaturesModal';

describe('MessagingAllFeaturesModal', () => {
  it('renders modal dialog conforming to theme.md Section 8 when open', () => {
    render(<MessagingAllFeaturesModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Messaging Directory & Tools')).toBeInTheDocument();
    expect(screen.getByText('Outbound & Broadcasts')).toBeInTheDocument();
    expect(screen.getByText('Inbound & Audience')).toBeInTheDocument();
    expect(screen.getByText('Operations & Audit')).toBeInTheDocument();
  });

  it('renders all directory tool items including Message Styles with safe relative links', () => {
    render(<MessagingAllFeaturesModal open={true} onOpenChange={vi.fn()} />);

    const stylesLink = screen.getByRole('link', { name: /Message Styles/i });
    expect(stylesLink).toHaveAttribute('href', '/admin/messaging/styles');

    const campaignLink = screen.getByRole('link', { name: /Campaign Studio/i });
    expect(campaignLink).toHaveAttribute('href', '/admin/messaging/campaigns');

    const composerLink = screen.getByRole('link', { name: /Message Composer/i });
    expect(composerLink).toHaveAttribute('href', '/admin/messaging/composer');

    const jobsLink = screen.getByRole('link', { name: /Bulk Dispatch Jobs/i });
    expect(jobsLink).toHaveAttribute('href', '/admin/messaging/jobs');

    const audiencesLink = screen.getByRole('link', { name: /Target Audiences/i });
    expect(audiencesLink).toHaveAttribute('href', '/admin/messaging/audiences');

    const variablesLink = screen.getByRole('link', { name: /Template Variables/i });
    expect(variablesLink).toHaveAttribute('href', '/admin/messaging/variables');

    const profilesLink = screen.getByRole('link', { name: /Sender Profiles/i });
    expect(profilesLink).toHaveAttribute('href', '/admin/messaging/profiles');

    const billingLink = screen.getByRole('link', { name: /SMS Units & Billing/i });
    expect(billingLink).toHaveAttribute('href', '/admin/settings?tab=billing');

    // Confirm Call Centre is strictly excluded per user requirements
    expect(screen.queryByText(/Call Centre/i)).not.toBeInTheDocument();
  });

  it('renders section header info tooltips instead of raw text descriptions', () => {
    render(<MessagingAllFeaturesModal open={true} onOpenChange={vi.fn()} />);

    // Info tooltips should be present for section headers and dialog title
    const tooltips = screen.getAllByTestId('card-info-tooltip');
    // 1 for modal title + 3 for the cluster headers = 4
    expect(tooltips.length).toBeGreaterThanOrEqual(4);
  });

  it('triggers onOpenChange(false) when clicking the close button', () => {
    const onOpenChange = vi.fn();
    render(<MessagingAllFeaturesModal open={true} onOpenChange={onOpenChange} />);

    const closeBtn = screen.getByRole('button', { name: /Close Directory/i });
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

