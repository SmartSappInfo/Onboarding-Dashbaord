// @vitest-environment jsdom
/**
 * @fileOverview Test Suite for WhatsAppLauncherModal (Phase 10 Milestone 4 Task 5)
 *
 * Implements:
 * - theme.md Section 8 (Standardized Modal Architecture).
 * - Rule 4: Strict Typing (Zero `any` or `any[]`).
 * - Rule 7: Mobile touch targets >= 44px with active:scale-[0.97].
 * - Rule 13 & 30: Untrusted reference data containerization via `<untrusted-reference-data>`.
 * - Direct `wa.me` URL dispatch link.
 * - 1-Click script copy to clipboard with toast notification.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WhatsAppLauncherModal } from '@/components/sales/WhatsAppLauncherModal';
import type { OutreachMessageDraft } from '@/platform/agents/sales/outbound/sdr-outbound-types';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('WhatsAppLauncherModal Component (Phase 10 Milestone 4)', () => {
  const mockDraft: OutreachMessageDraft = {
    id: 'draft_wa_test_01',
    prospectId: 'prosp_school_99',
    recipientName: 'Mrs. Cynthia Appiah',
    recipientAddress: '+233249112233',
    channel: 'whatsapp',
    stepIndex: 1,
    dayOffset: 0,
    body: 'Good morning Mrs. Appiah, following up from our conversation regarding automated school fee collection.',
    whatsappUrl: 'https://wa.me/233249112233?text=Good%20morning%20Mrs.%20Appiah',
    variablesUsed: ['contact.firstName', 'institution.name'],
    groundingPoints: ['Warm school administrator prospect', 'Verified phone'],
    status: 'draft',
    payloadHash: 'a'.repeat(64),
    explainability: {
      what: 'Direct WhatsApp outreach message',
      why: 'Warm school administrator prospect',
      expectedStateChange: 'Initiate 1-on-1 dialogue',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    draft: mockDraft,
    onMarkDispatched: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal adhering to theme.md §8 with single-circle info tooltip', () => {
    render(<WhatsAppLauncherModal {...defaultProps} />);

    // Title
    expect(screen.getByText(/WhatsApp Direct Dispatch/i)).toBeInTheDocument();

    // Zero Raw Descriptions rule: screen-reader only description
    const srDesc = document.querySelector('.sr-only');
    expect(srDesc).toBeInTheDocument();
    expect(srDesc?.textContent).toContain('WhatsApp');

    // Single-circle tooltip
    const tooltipBtn = document.querySelector('[data-state]');
    expect(tooltipBtn).toBeInTheDocument();
  });

  it('renders recipient E.164 phone and contact details', () => {
    render(<WhatsAppLauncherModal {...defaultProps} />);

    expect(screen.getByText('Mrs. Cynthia Appiah')).toBeInTheDocument();
    expect(screen.getByText('+233249112233')).toBeInTheDocument();
  });

  it('containerizes untrusted message draft inside <untrusted-reference-data> element (Rules 13 & 30)', () => {
    render(<WhatsAppLauncherModal {...defaultProps} />);

    const untrustedContainer = document.querySelector('untrusted-reference-data');
    expect(untrustedContainer).toBeInTheDocument();
    expect(untrustedContainer?.textContent).toContain('Good morning Mrs. Appiah');
  });

  it('copies script to clipboard and triggers feedback toast on click', async () => {
    render(<WhatsAppLauncherModal {...defaultProps} />);

    const copyBtn = screen.getByRole('button', { name: /Copy Script/i });
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockDraft.body);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Script Copied',
      })
    );
  });

  it('provides a direct WhatsApp launch button with wa.me URL', () => {
    render(<WhatsAppLauncherModal {...defaultProps} />);

    const launchBtn = screen.getByRole('link', { name: /Open in WhatsApp/i });
    expect(launchBtn).toBeInTheDocument();
    expect(launchBtn).toHaveAttribute('href', mockDraft.whatsappUrl);
    expect(launchBtn).toHaveAttribute('target', '_blank');
  });
});
