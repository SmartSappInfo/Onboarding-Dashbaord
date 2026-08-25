import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentObservabilityDashboard } from '../DocumentObservabilityDashboard';

const mockHealthReport = {
  workspaceId: 'ws_test',
  pipelineHealth: {
    averageDurationSeconds: 3.5,
    successRatePercentage: 99.8,
    sloTargetMet: true,
    status: 'healthy' as const,
  },
  viewerAvailability: {
    uptimePercentage: 99.98,
    averageRenderLatencyMs: 38,
    sloTargetMet: true,
    status: 'healthy' as const,
  },
  eventThroughput: {
    eventsPerMinute: 45,
    rejectionRatePercentage: 0.1,
    rateLimitTrippedCount: 1,
  },
  aiHealth: {
    averageInferenceMs: 160,
    fallbackInvocationRatePercentage: 0,
    groundedCitationRatePercentage: 100,
  },
  overallStatus: 'healthy' as const,
  generatedAt: '2026-01-01T00:00:00Z',
};

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/documents/document-observability-actions', () => ({
  getWorkspaceHealthReportAction: vi.fn().mockImplementation(async () => ({
    success: true,
    report: mockHealthReport,
  })),
}));

describe('DocumentObservabilityDashboard Component (Phase 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders enterprise SLO health gauges and telemetry metrics', async () => {
    render(<DocumentObservabilityDashboard workspaceId="ws_test" />);

    expect(screen.getByText('Enterprise Observability & SLO Health')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('99.8%')).toBeDefined();
      expect(screen.getByText('99.98%')).toBeDefined();
      expect(screen.getByText('45 ev/m')).toBeDefined();
    });
  });

  it('switches RBAC roles to view granular permissions', async () => {
    render(<DocumentObservabilityDashboard workspaceId="ws_test" />);

    expect(screen.getByText('Enterprise RBAC Permission Matrix')).toBeDefined();

    // Switch to CONTENT MANAGER
    const contentManagerTab = screen.getByText('CONTENT MANAGER');
    fireEvent.click(contentManagerTab);

    await waitFor(() => {
      expect(screen.getByText('documents.create')).toBeDefined();
      expect(screen.getByText('documents.publish')).toBeDefined();
    });
  });
});
