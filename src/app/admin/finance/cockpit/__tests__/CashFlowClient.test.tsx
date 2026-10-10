/**
 * @fileOverview Unit tests for CashFlowClient UI styling & title/subtitle compliance
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CashFlowClient } from '../CashFlowClient';
import type { CashFlowForecastResult } from '@/platform/agents/finance/analytics/cash-flow-types';
import type { FinanceEmergencyControls } from '@/platform/policy/finance-control-policy';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: vi.fn(),
}));

vi.mock('@/app/actions/finance-control-actions', () => ({
  getFinanceEmergencyControlsAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
  toggleFinanceEmergencySwitchAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
}));

vi.mock('@/components/finance/analytics/CashFlowCockpitModal', () => ({
  CashFlowCockpitModal: () => <div data-testid="mock-cockpit-modal" />,
}));

vi.mock('@/components/finance/control/EmergencyControlModal', () => ({
  EmergencyControlModal: () => <div data-testid="mock-emergency-modal" />,
}));

vi.mock('@/components/school/SchoolOperationsCockpitModal', () => ({
  SchoolOperationsCockpitModal: () => <div data-testid="mock-school-ops-modal" />,
}));

const mockForecast: CashFlowForecastResult = {
  forecastId: 'test-forecast-1',
  organizationId: 'test-org',
  workspaceId: 'test-ws',
  currentCashOnHand: 50000,
  currency: 'GHS',
  generatedAt: '2026-10-09T12:00:00.000Z',
  runwayProjections: {
    '30d': {
      horizonDays: 30,
      totalProjectedInflow: 0,
      projectedClosingCash: 50000,
      expectedInvoiceCash: 0,
      expectedInstallmentCash: 0,
      expectedPromiseCash: 0,
    },
    '60d': {
      horizonDays: 60,
      totalProjectedInflow: 0,
      projectedClosingCash: 50000,
      expectedInvoiceCash: 0,
      expectedInstallmentCash: 0,
      expectedPromiseCash: 0,
    },
    '90d': {
      horizonDays: 90,
      totalProjectedInflow: 0,
      projectedClosingCash: 50000,
      expectedInvoiceCash: 0,
      expectedInstallmentCash: 0,
      expectedPromiseCash: 0,
    },
  },
  dsoMetrics: {
    dsoDays: 0,
    benchmarkDays: 45,
    velocityBand: 'FAST',
    totalReceivables: 0,
    creditSalesPeriod: 100000,
  },
  debtorConcentration: {
    topDebtorName: 'None',
    topDebtorExposure: 0,
    topDebtorExposurePercent: 0,
    top5TotalExposure: 0,
    top5TotalExposurePercent: 0,
    concentrationTier: 'LOW',
  },
};

const mockControls: FinanceEmergencyControls = {
  updatedAt: '2026-10-09T12:00:00Z',
  updatedBy: 'admin',
  pauseReason: null,
  switches: {
    agent_finance_paused: false,
    agent_collections_paused: false,
    agent_school_ops_paused: false,
    financial_mutation_halt: false,
  },
};

describe('CashFlowClient Title, Badges & Card Subtitle Invariants', () => {
  it('removes the live forecasting pill from the header title area', () => {
    render(
      <CashFlowClient
        initialForecast={mockForecast}
        initialControls={mockControls}
      />
    );

    // Main header title must be present
    expect(screen.getByRole('heading', { level: 1, name: /Predictive Cash Flow Cockpit/i })).toBeInTheDocument();

    // "Live Forecasting" pill must NOT be rendered
    expect(screen.queryByText(/Live Forecasting/i)).not.toBeInTheDocument();
  });

  it('renders card titles with info tooltips and no raw card subtitles', () => {
    const { container } = render(
      <CashFlowClient
        initialForecast={mockForecast}
        initialControls={mockControls}
      />
    );

    // Verify card titles are present
    expect(screen.getByText('Cash On Hand')).toBeInTheDocument();
    expect(screen.getByText('30d Runway')).toBeInTheDocument();
    expect(screen.getByText('60d Runway')).toBeInTheDocument();
    expect(screen.getByText('90d Runway')).toBeInTheDocument();
    expect(screen.getByText('DSO Velocity')).toBeInTheDocument();
    expect(screen.getByText(/Runway Inflow Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/Debtor Concentration Risk/i)).toBeInTheDocument();

    // Ensure raw subtitles are no longer present as plain text paragraphs under titles
    expect(screen.queryByText('Immediate liquidity')).not.toBeInTheDocument();
    expect(screen.queryByText(/Weighted probability modeling across open invoices/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Benchmark: 45d/i)).not.toBeInTheDocument();

    // Verify info tooltip buttons are rendered next to the card titles
    const tooltipTriggers = container.querySelectorAll('button.cursor-help');
    expect(tooltipTriggers.length).toBeGreaterThanOrEqual(7);
  });
});
