/**
 * @fileOverview Consolidated Unit & UI Tests for Sales Intelligence Components
 * (PitchRecommendationHud, ProspectFinderHud, SalesExplainableScoreCard).
 *
 * Implements Rule 4 (Strict Typing), Rule 7 (Mobile touch targets),
 * and Rule 41 (Explainability Standard: WHAT, WHY, EXPECTED STATE CHANGE).
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PitchRecommendationHud } from '@/components/sales/PitchRecommendationHud';
import { ProspectFinderHud } from '@/components/sales/ProspectFinderHud';
import { SalesExplainableScoreCard } from '@/components/sales/SalesExplainableScoreCard';
import type {
  LeadPitchRecommendation,
  LeadObjectionHandler,
  LeadScoreBreakdown,
} from '@/platform/agents/sales/context/lead-context-types';

/* ==============================================================================
 * 1. PitchRecommendationHud
 * ============================================================================== */
describe('PitchRecommendationHud Component', () => {
  const mockPitch: LeadPitchRecommendation = {
    prospectId: 'lead_gis_01',
    pitchText: 'Automate student registration and fee collection with 0 reconciliation friction.',
    targetPersona: 'School Bursar & Administrator',
    valuePropositions: [
      'Eliminates paper enrollment queue bottlenecks',
      'Instant mobile money reconciliation for parents',
    ],
    groundingPoints: [
      'Recent school term expansion announcement',
      'High student count (> 500)',
    ],
    confidence: 92,
  };

  const mockObjections: LeadObjectionHandler[] = [
    {
      objection: 'Our existing paper system works fine.',
      counter: 'Most schools find paper costs 3x more in reconciliation staff hours per term.',
      evidence: ['Average 24 hours spent weekly manually checking paper receipts.'],
    },
  ];

  it('renders value proposition and target persona badge', () => {
    render(<PitchRecommendationHud pitch={mockPitch} objections={mockObjections} />);
    expect(screen.getAllByText(/Automate student registration/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/School Bursar & Administrator/i).length).toBeGreaterThan(0);
  });

  it('renders objection handler cards with rebuttal scripts', () => {
    render(<PitchRecommendationHud pitch={mockPitch} objections={mockObjections} />);
    expect(screen.getByText(/Our existing paper system works fine/i)).toBeDefined();
    expect(screen.getByText(/Most schools find paper costs 3x more/i)).toBeDefined();
  });

  it('renders Rule 41 explainability sections (WHAT, WHY, EXPECTED STATE CHANGE)', () => {
    render(<PitchRecommendationHud pitch={mockPitch} objections={mockObjections} />);
    expect(screen.getByText(/^WHAT$/i)).toBeDefined();
    expect(screen.getByText(/^WHY$/i)).toBeDefined();
    expect(screen.getByText(/^EXPECTED STATE CHANGE$/i)).toBeDefined();
  });
});

/* ==============================================================================
 * 2. ProspectFinderHud
 * ============================================================================== */
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

  it('triggers onOpenRevenueSwarm when Launch Revenue Swarm button is clicked', () => {
    const handleRevenueSwarm = vi.fn();
    render(
      <ProspectFinderHud
        onOpenMarketResearch={vi.fn()}
        onOpenSegmentToCampaign={vi.fn()}
        onOpenRevenueSwarm={handleRevenueSwarm}
      />
    );

    const button = screen.getByRole('button', { name: /Launch Revenue Swarm/i });
    fireEvent.click(button);
    expect(handleRevenueSwarm).toHaveBeenCalledTimes(1);
  });
});

/* ==============================================================================
 * 3. SalesExplainableScoreCard
 * ============================================================================== */
describe('SalesExplainableScoreCard Component', () => {
  const mockBreakdown: LeadScoreBreakdown = {
    overallScore: 88,
    priorityTier: 'critical',
    icpFitPoints: 28,
    needPoints: 22,
    intentPoints: 20,
    engagementPoints: 10,
    similarityPoints: 8,
    topPositiveDrivers: [
      'High-intent search query for school management software',
      'Verified Decision Maker with direct email',
    ],
    topNegativeDrivers: [
      'Older domain registration (> 10 years without CMS update)',
    ],
  };

  it('renders overall score and critical priority tier badge', () => {
    render(<SalesExplainableScoreCard breakdown={mockBreakdown} />);
    expect(screen.getByText('88')).toBeDefined();
    expect(screen.getByText(/critical priority/i)).toBeDefined();
  });

  it('renders Rule 41 explainability sections (WHAT, WHY, EXPECTED STATE CHANGE)', () => {
    render(<SalesExplainableScoreCard breakdown={mockBreakdown} />);
    expect(screen.getByText(/^WHAT$/i)).toBeDefined();
    expect(screen.getByText(/^WHY$/i)).toBeDefined();
    expect(screen.getByText(/^EXPECTED STATE CHANGE$/i)).toBeDefined();
  });

  it('renders positive and negative score drivers', () => {
    render(<SalesExplainableScoreCard breakdown={mockBreakdown} />);
    expect(screen.getAllByText(/High-intent search query/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Older domain registration/i).length).toBeGreaterThan(0);
  });
});
