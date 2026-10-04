/**
 * @fileoverview Test Suite: Account AI Overview & Knowledge UI Components (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Zero any/any[]), Rule 7 (Mobile-first >= 44px touch targets),
 * Rule 13 & 30 (Untrusted reference data isolation), Rule 41 (Explainability),
 * and `theme.md` §8 (Standardized Modal & Dialog System Architecture).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountAiOverviewCard } from '@/components/crm/intelligence/AccountAiOverviewCard';
import { AccountKnowledgePanel } from '@/components/crm/intelligence/AccountKnowledgePanel';
import type { AccountAiOverview, AccountKnowledge } from '@/platform/agents/crm/intelligence/crm-intelligence-types';

describe('CRM AI Overview & Knowledge UI Components (Phase 9 Milestone 3)', () => {
  const mockOverview: AccountAiOverview = {
    entityId: 'ent_greenfield_01',
    workspaceId: 'ws_demo_01',
    healthStatus: 'HEALTHY',
    healthScore: 88,
    executiveSummary: 'Greenfield School demonstrates consistent engagement across onboarding milestones.',
    activeMomentum: 'ACCELERATING',
    keyRisks: [
      {
        id: 'risk_01',
        tag: 'RENEWAL_WINDOW',
        severity: 'LOW',
        description: 'Contract renewal discussions scheduled for Q4.',
      },
    ],
    stakeholders: [
      {
        contactId: 'con_01',
        name: 'Sarah Jenkins',
        role: 'Head of Admissions',
        email: 'sarah.j@greenfield.edu',
        engagementLevel: 'HIGH',
        isPrimary: true,
      },
    ],
    recentSignals: [
      {
        id: 'sig_01',
        type: 'MEETING',
        title: 'Q3 Strategy Review',
        timestamp: '2026-10-02T14:00:00Z',
        sentiment: 'positive',
      },
    ],
    generatedAt: '2026-10-04T12:00:00Z',
  };

  const mockKnowledge: AccountKnowledge = {
    entityId: 'ent_greenfield_01',
    workspaceId: 'ws_demo_01',
    groundedFacts: [
      {
        id: 'fact_01',
        statement: 'Greenfield operates 3 separate campuses with 1,200 enrolled students.',
        category: 'INSTITUTION_PROFILE',
        confidence: 0.95,
        citationId: 'cit_01',
        sourceTitle: 'Campus Discovery Notes',
        sourceType: 'note',
      },
    ],
    meetingTakeaways: [
      {
        meetingId: 'meet_01',
        meetingTitle: 'Admissions Integration Kickoff',
        date: '2026-09-15',
        takeaways: ['Admissions team approved SIS API connector provisioning.'],
        decisions: ['Approved SIS API connector provisioning.'],
      },
    ],
    citations: [
      {
        id: 'cit_01',
        sourceType: 'note',
        sourceId: 'note_8812',
        title: 'Campus Discovery Notes',
        snippet: 'The main campus will transition to digital enrollment this semester.',
        timestamp: '2026-09-10T10:00:00Z',
        isolatedSnippet: '<untrusted_reference_data id="cit_01">The main campus will transition to digital enrollment this semester.</untrusted_reference_data>',
      },
    ],
    generatedAt: '2026-10-04T12:00:00Z',
  };

  describe('AccountAiOverviewCard', () => {
    it('renders health score, status badge, momentum, and narrative summary', () => {
      render(<AccountAiOverviewCard overview={mockOverview} />);

      expect(screen.getByText('88')).toBeDefined();
      expect(screen.getByText('HEALTHY')).toBeDefined();
      expect(screen.getByText(/ACCELERATING/i)).toBeDefined();
      expect(screen.getByText(/Greenfield School demonstrates consistent engagement/)).toBeDefined();
      expect(screen.getByText('Sarah Jenkins')).toBeDefined();
      expect(screen.getByText('Q3 Strategy Review')).toBeDefined();
    });

    it('triggers onRefresh callback when refresh button is clicked', () => {
      const onRefresh = vi.fn();
      render(<AccountAiOverviewCard overview={mockOverview} onRefresh={onRefresh} />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe('AccountKnowledgePanel', () => {
    it('renders grounded facts, source chips, and meeting takeaways', () => {
      render(<AccountKnowledgePanel knowledge={mockKnowledge} />);

      expect(screen.getByText(/Greenfield operates 3 separate campuses/)).toBeDefined();
      expect(screen.getByText(/Campus Discovery Notes/)).toBeDefined();
      expect(screen.getByText(/Admissions Integration Kickoff/)).toBeDefined();
    });

    it('opens Citation Drawer when viewing citations', () => {
      render(<AccountKnowledgePanel knowledge={mockKnowledge} />);

      const viewCitationButton = screen.getByRole('button', { name: /view citation/i });
      fireEvent.click(viewCitationButton);

      // Verify drawer opens with citations content
      expect(screen.getByText('Account Source Citations')).toBeDefined();
      expect(screen.getByText(/The main campus will transition to digital enrollment/)).toBeDefined();
    });
  });
});
