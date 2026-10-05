/**
 * @fileOverview Unit Tests for PitchRecommendationHud (Phase 10 Milestone 3 Task 3)
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PitchRecommendationHud } from '@/components/sales/PitchRecommendationHud';
import type { LeadPitchRecommendation, LeadObjectionHandler } from '@/platform/agents/sales/context/lead-context-types';

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
