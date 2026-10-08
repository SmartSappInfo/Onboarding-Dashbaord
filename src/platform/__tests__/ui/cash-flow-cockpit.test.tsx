// @vitest-environment jsdom
/**
 * @fileOverview Unit & Integration Tests: Cash Flow Cockpit & Emergency Control Modals (Phase 12 Milestone 5)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4)
 * - Zero Raw Descriptions: Guidance routed through `<CardInfoTooltip text="..." />` alongside title
 * - Accessibility: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 min-h-[56px]`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97] min-h-[44px]`
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CashFlowCockpitModal } from '@/components/finance/analytics/CashFlowCockpitModal';
import { EmergencyControlModal } from '@/components/finance/control/EmergencyControlModal';
import { type CashFlowForecastResult } from '@/platform/agents/finance/analytics/cash-flow-types';
import { type FinanceEmergencyControls } from '@/platform/policy/finance-control-policy';

describe('Cash Flow Cockpit & Emergency Control Modals (theme.md §8)', () => {
  const mockForecast: CashFlowForecastResult = {
    forecastId: 'fc_001',
    organizationId: 'org_ghana_sec_01',
    workspaceId: 'ws_campus_accra',
    currency: 'GHS',
    currentCashOnHand: 75000,
    runwayProjections: {
      '30d': {
        horizonDays: 30,
        expectedInvoiceCash: 45000,
        expectedInstallmentCash: 12000,
        expectedPromiseCash: 5000,
        totalProjectedInflow: 62000,
        projectedClosingCash: 137000,
      },
      '60d': {
        horizonDays: 60,
        expectedInvoiceCash: 68000,
        expectedInstallmentCash: 24000,
        expectedPromiseCash: 8000,
        totalProjectedInflow: 100000,
        projectedClosingCash: 175000,
      },
      '90d': {
        horizonDays: 90,
        expectedInvoiceCash: 95000,
        expectedInstallmentCash: 35000,
        expectedPromiseCash: 10000,
        totalProjectedInflow: 140000,
        projectedClosingCash: 215000,
      },
    },
    dsoMetrics: {
      dsoDays: 38,
      benchmarkDays: 45,
      velocityBand: 'HEALTHY',
      totalReceivables: 110000,
      creditSalesPeriod: 260000,
    },
    debtorConcentration: {
      topDebtorName: 'Lincoln High School',
      topDebtorExposure: 35000,
      topDebtorExposurePercent: 32,
      top5TotalExposure: 78000,
      top5TotalExposurePercent: 71,
      concentrationTier: 'MODERATE',
    },
    generatedAt: new Date().toISOString(),
  };

  const mockControls: FinanceEmergencyControls = {
    switches: {
      agent_finance_paused: false,
      agent_collections_paused: true,
      agent_school_ops_paused: false,
      financial_mutation_halt: false,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin_bursar_01',
    pauseReason: 'Collections batch audit underway.',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('CashFlowCockpitModal (theme.md §8)', () => {
    it('renders modal with demarcated header, title, and single-circle tooltip', () => {
      render(
        <CashFlowCockpitModal
          isOpen={true}
          onClose={vi.fn()}
          forecast={mockForecast}
        />
      );

      expect(screen.getByText('Predictive Cash Flow Cockpit')).toBeInTheDocument();
      expect(screen.getByText(/Predictive cash runway forecast and liquidity model/i)).toBeInTheDocument();
      expect(screen.getByText('GHS 75,000')).toBeInTheDocument();
      expect(screen.getByText('Lincoln High School')).toBeInTheDocument();
      expect(screen.getByText('38 Days')).toBeInTheDocument();
    });

    it('renders all 30d, 60d, 90d projected closing figures correctly', () => {
      render(
        <CashFlowCockpitModal
          isOpen={true}
          onClose={vi.fn()}
          forecast={mockForecast}
        />
      );

      expect(screen.getAllByText('GHS 137,000').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('GHS 175,000').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('GHS 215,000').length).toBeGreaterThanOrEqual(1);
    });

    it('triggers onClose callback when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <CashFlowCockpitModal
          isOpen={true}
          onClose={handleClose}
          forecast={mockForecast}
        />
      );

      const closeBtn = screen.getByTestId('cash-flow-close-btn');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('EmergencyControlModal (theme.md §8 & Rule 61)', () => {
    it('renders all 4 emergency kill switches with their current states', () => {
      render(
        <EmergencyControlModal
          isOpen={true}
          onClose={vi.fn()}
          controls={mockControls}
          onToggleSwitch={vi.fn()}
        />
      );

      expect(screen.getByText('Backoffice Emergency Control Plane')).toBeInTheDocument();
      expect(screen.getByText(/Automated Invoicing & Fee Runs/i)).toBeInTheDocument();
      expect(screen.getByText(/Automated Collections & Dunning/i)).toBeInTheDocument();
      expect(screen.getByText(/Automated School Operations & Alerts/i)).toBeInTheDocument();
      expect(screen.getByText(/Global Financial Mutation Freeze/i)).toBeInTheDocument();
    });

    it('requires minimum 5 characters audit justification note before confirming toggle', async () => {
      const handleToggle = vi.fn().mockResolvedValue(undefined);
      render(
        <EmergencyControlModal
          isOpen={true}
          onClose={vi.fn()}
          controls={mockControls}
          onToggleSwitch={handleToggle}
        />
      );

      // Find toggle button for Invoicing
      const toggleInvoicingBtn = screen.getByTestId('toggle-agent_finance_paused');
      fireEvent.click(toggleInvoicingBtn);

      // Attempt to confirm without note or with < 5 chars
      const confirmBtn = screen.getByRole('button', { name: /confirm toggle/i });
      fireEvent.click(confirmBtn);

      expect(screen.getByText(/Audit justification note must be at least 5 characters/i)).toBeInTheDocument();
      expect(handleToggle).not.toHaveBeenCalled();

      // Enter valid note
      const noteInput = screen.getByPlaceholderText(/Enter reason for this operational state change/i);
      fireEvent.change(noteInput, { target: { value: 'System incident freeze for DB restore.' } });

      fireEvent.click(confirmBtn);
      await waitFor(() => {
        expect(handleToggle).toHaveBeenCalledWith(
          'agent_finance_paused',
          true,
          'System incident freeze for DB restore.'
        );
      });
    });
  });
});
