// @vitest-environment jsdom
/**
 * @fileOverview Unit & Accessibility Tests: Payment Reconciliation UI Workspace (Phase 12 Milestone 3)
 *
 * Implements:
 * - theme.md Section 8 (Standardized Modal Architecture)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first >= 44px touch targets)
 * - Rule 11 (Double-Entry Financial Determinism & Zero-Drift Display)
 * - Rule 13 & 30 (Untrusted Data Isolation Container)
 * - Rule 41 (4-Part Explainability Grid & Confidence Rating)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ReconciliationMatchModal,
  ReconciliationKPIHeader,
  ReconciliationExceptionTable,
} from '@/components/finance/reconciliation';
import {
  type ReconciliationExceptionItem,
  type ReconciliationMetrics,
} from '@/platform/agents/finance/reconciliation/reconciliation-types';

describe('Payment Reconciliation Workspace Components (Phase 12 Milestone 3)', () => {
  const sampleException: ReconciliationExceptionItem = {
    exceptionId: 'exc_test_101',
    payoutId: 'payout_wire_8892',
    payoutReference: 'WIRE-MTN-TX-88921',
    amount: 4500.0,
    currency: 'GHS',
    flaggedReason: 'Exact match identified with high confidence.',
    varianceAmount: 0.0,
    confidenceScore: 92,
    candidateInvoices: [
      {
        id: 'inv_seed_101',
        invoiceNumber: 'INV-2026-042',
        entityId: 'student_adm_042',
        entityName: 'Kofi Mensah',
        totalPayable: 4500.0,
        amountPaid: 0.0,
        balanceDue: 4500.0,
        dueDate: '2026-10-01T00:00:00Z',
        currency: 'GHS',
        status: 'issued',
      },
    ],
    assignedToPersonaId: 'reconciliation_agent',
    createdAt: '2026-10-01T14:30:00Z',
    status: 'OPEN',
    rawMemo: 'School fees payment for Kofi Mensah Term 1',
  };

  const sampleMetrics: ReconciliationMetrics = {
    unmatchedSettlementsCount: 3,
    unmatchedSettlementsAmount: 13500.0,
    matchedTodayCount: 12,
    matchedTodayAmount: 48000.0,
    flaggedDiscrepanciesCount: 2,
    totalNetDiscrepancyAmount: 50.25,
    currency: 'GHS',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ReconciliationMatchModal (theme.md §8 & Security)', () => {
    it('renders modal with demarcated header, title, and tooltip conforming to theme.md §8', () => {
      render(
        <ReconciliationMatchModal
          isOpen={true}
          onClose={vi.fn()}
          exceptionItem={sampleException}
          onResolve={vi.fn()}
        />
      );

      expect(screen.getByText('3-Way Reconciliation Review')).toBeInTheDocument();
      expect(screen.getByText('Auto-Match Candidate')).toBeInTheDocument();

      // Screen reader description
      const srDesc = screen.getByText(
        /Review settlement payout, recorded ledger entry, and open invoice delta/i
      );
      expect(srDesc).toHaveClass('sr-only');
    });

    it('renders 3-way reconciliation diff columns and explainability breakdown', () => {
      render(
        <ReconciliationMatchModal
          isOpen={true}
          onClose={vi.fn()}
          exceptionItem={sampleException}
          onResolve={vi.fn()}
        />
      );

      // 3 Columns
      expect(screen.getByText('1. Bank Settlement')).toBeInTheDocument();
      expect(screen.getByText('2. Ledger Record')).toBeInTheDocument();
      expect(screen.getByText('3. Open Invoice')).toBeInTheDocument();

      // Amounts and references
      expect(screen.getAllByText('4500.00 GHS').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('WIRE-MTN-TX-88921')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-042')).toBeInTheDocument();
      expect(screen.getByText('Kofi Mensah')).toBeInTheDocument();

      // Explainability grid
      expect(screen.getByText(/WHAT:/i)).toBeInTheDocument();
      expect(screen.getByText(/WHY:/i)).toBeInTheDocument();
      expect(screen.getByText(/EXPECTED STATE CHANGE:/i)).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('isolates untrusted external bank wire memo in untrusted_reference_data (Rules 13 & 30)', () => {
      render(
        <ReconciliationMatchModal
          isOpen={true}
          onClose={vi.fn()}
          exceptionItem={sampleException}
          onResolve={vi.fn()}
        />
      );

      const untrustedElement = document.querySelector('untrusted_reference_data');
      expect(untrustedElement).toBeInTheDocument();
      expect(untrustedElement?.textContent).toContain('School fees payment for Kofi Mensah Term 1');
    });

    it('triggers approve action when Approve Match button is clicked', async () => {
      const mockResolve = vi.fn().mockResolvedValue(undefined);

      render(
        <ReconciliationMatchModal
          isOpen={true}
          onClose={vi.fn()}
          exceptionItem={sampleException}
          onResolve={mockResolve}
        />
      );

      const approveBtn = screen.getByRole('button', { name: /Approve Match/i });
      expect(approveBtn).toBeInTheDocument();
      expect(approveBtn).toHaveClass('min-h-[44px]');

      fireEvent.click(approveBtn);

      expect(mockResolve).toHaveBeenCalledWith(
        'exc_test_101',
        'inv_seed_101',
        'APPROVE_MATCH',
        expect.any(String)
      );
    });

    it('shows warning and Adjust button when discrepancy exceeds tolerance (> $0.50)', () => {
      const highDiscrepancyException: ReconciliationExceptionItem = {
        ...sampleException,
        varianceAmount: 25.0,
        flaggedReason: 'Discrepancy of 25.00 GHS exceeds tolerance threshold (0.50 GHS).',
      };

      render(
        <ReconciliationMatchModal
          isOpen={true}
          onClose={vi.fn()}
          exceptionItem={highDiscrepancyException}
          onResolve={vi.fn()}
        />
      );

      expect(screen.getByText('Discrepancy Flagged')).toBeInTheDocument();
      expect(screen.getByText(/Discrepancy Exceeds Tolerance Threshold/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Adjust Variance & Reconcile/i })).toBeInTheDocument();
    });
  });

  describe('ReconciliationKPIHeader', () => {
    it('renders 4 executive KPI cards with proper amounts and currency formatting', () => {
      render(<ReconciliationKPIHeader metrics={sampleMetrics} />);

      expect(screen.getByText('Unmatched Settlements')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      expect(screen.getByText('Matched Today')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();

      expect(screen.getByText('Flagged Discrepancies')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();

      expect(screen.getByText('Net Discrepancy Amount')).toBeInTheDocument();
      expect(screen.getByText('50.25 GHS')).toBeInTheDocument();
    });
  });

  describe('ReconciliationExceptionTable', () => {
    it('renders exception table rows and triggers inspect callback on click', () => {
      const mockInspect = vi.fn();

      render(
        <ReconciliationExceptionTable
          exceptions={[sampleException]}
          onInspect={mockInspect}
        />
      );

      expect(screen.getByText('WIRE-MTN-TX-88921')).toBeInTheDocument();
      expect(screen.getByText('4500.00 GHS')).toBeInTheDocument();
      expect(screen.getByText('Open Queue')).toBeInTheDocument();

      const diffBtn = screen.getByRole('button', { name: /3-Way Diff/i });
      expect(diffBtn).toBeInTheDocument();

      fireEvent.click(diffBtn);
      expect(mockInspect).toHaveBeenCalledWith(sampleException);
    });

    it('renders empty state when zero exceptions are in queue', () => {
      render(
        <ReconciliationExceptionTable
          exceptions={[]}
          onInspect={vi.fn()}
        />
      );

      expect(screen.getByText('Zero Discrepancies in Queue')).toBeInTheDocument();
    });
  });
});
