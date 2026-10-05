/**
 * @fileOverview Unit Tests for SalesExplainableScoreCard (Phase 10 Milestone 3 Task 3)
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SalesExplainableScoreCard } from '@/components/sales/SalesExplainableScoreCard';
import type { LeadScoreBreakdown } from '@/platform/agents/sales/context/lead-context-types';

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
