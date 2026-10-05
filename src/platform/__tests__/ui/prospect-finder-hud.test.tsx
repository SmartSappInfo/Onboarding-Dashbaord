/**
 * @fileOverview Unit Tests for ProspectFinderHud (Phase 10 Milestone 3 Task 4)
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProspectFinderHud } from '@/components/sales/ProspectFinderHud';

describe('ProspectFinderHud Component', () => {
  it('renders active SDR agent persona label and active badge', () => {
    render(
      <ProspectFinderHud
        onOpenMarketResearch={vi.fn()}
        onOpenSegmentToCampaign={vi.fn()}
        activePersona="lead_sdr"
      />
    );
    expect(screen.getByText('Autonomous Lead SDR')).toBeDefined();
    expect(screen.getByText('Active Agent')).toBeDefined();
  });

  it('renders SSE stream status indicator and real-time event counter', () => {
    render(
      <ProspectFinderHud
        onOpenMarketResearch={vi.fn()}
        onOpenSegmentToCampaign={vi.fn()}
        streamStatus="connected"
        realtimeEventCount={5}
      />
    );
    expect(screen.getByText(/connected/i)).toBeDefined();
    expect(screen.getByText('+5 events')).toBeDefined();
  });

  it('triggers onOpenMarketResearch when Research Market button is clicked', () => {
    const handleMarketResearch = vi.fn();
    render(
      <ProspectFinderHud
        onOpenMarketResearch={handleMarketResearch}
        onOpenSegmentToCampaign={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /Research Market/i });
    fireEvent.click(button);
    expect(handleMarketResearch).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenSegmentToCampaign when Turn Segment into Campaign button is clicked', () => {
    const handleSegmentCampaign = vi.fn();
    render(
      <ProspectFinderHud
        onOpenMarketResearch={vi.fn()}
        onOpenSegmentToCampaign={handleSegmentCampaign}
      />
    );

    const button = screen.getByRole('button', { name: /Turn Segment into Campaign/i });
    fireEvent.click(button);
    expect(handleSegmentCampaign).toHaveBeenCalledTimes(1);
  });

  it('triggers onRefresh when Refresh button is clicked', () => {
    const handleRefresh = vi.fn();
    render(
      <ProspectFinderHud
        onOpenMarketResearch={vi.fn()}
        onOpenSegmentToCampaign={vi.fn()}
        onRefresh={handleRefresh}
      />
    );

    const button = screen.getByRole('button', { name: /Refresh/i });
    fireEvent.click(button);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });
});
