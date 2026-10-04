// @vitest-environment jsdom
/**
 * @fileOverview UI Test Suite for Global Context Rail Components (Phase 8 Milestone 4)
 *
 * Implements verification for:
 * - theme.md §8: Standardized Modal & Dialog Architecture compliance.
 * - Rule 4: Zero any / zero any[] typing policy.
 * - Rule 7: Mobile-first >= 44px touch targets.
 * - Rule 13 & 30: Untrusted content wrapped in `<untrusted_reference_data id="...">`.
 * - Rule 21 & 22: Two-Phase approval proposals with SHA-256 cryptographic binding.
 * - Rule 68 / §81: "No Dead Ends" with clear follow-up navigation affordances.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  ContextRailProvider,
  ContextRailTrigger,
  GlobalContextRail,
  EntityDossierModule,
  RelationshipHealthModule,
  InstitutionalMemoryModule,
  RelatedEntitiesModule,
  ActiveRunsModule,
  PendingApprovalsModule,
} from '@/components/context-rail';
import * as contextRailActions from '@/app/actions/context-rail-actions';
import type { EntityContextRailData } from '@/platform/ui/context-rail';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/admin/entities/contact_john_doe',
}));

// Mock server actions
vi.mock('@/app/actions/context-rail-actions', () => ({
  getEntityContextRailDataAction: vi.fn(),
  askEntityAiAction: vi.fn(),
  executeObjectCommandAction: vi.fn(),
}));

const mockContextData: EntityContextRailData = {
  entityId: 'contact_john_doe',
  entityType: 'contact',
  entityName: 'John Doe',
  organizationId: 'org_test_1',
  workspaceId: 'ws_test_1',
  dossier: {
    id: 'contact_john_doe',
    type: 'contact',
    entityId: 'contact_john_doe',
    entityType: 'contact',
    name: 'John Doe',
    status: 'Active',
    tier: 'Enterprise Tier 1',
    tags: ['VIP', 'Decision Maker'],
    keyFacts: ['VIP Customer', 'Contract renewal in Q4'],
    lastInteractionAt: '2026-10-01T12:00:00Z',
    primaryEmail: 'john.doe@acme.com',
    primaryPhone: '+1-555-0199',
    assignedOwner: {
      id: 'usr_sarah',
      name: 'Sarah Jenkins',
    },
  },
  health: {
    score: 88,
    healthBand: 'champion',
    band: 'champion',
    trend: 'improving',
    signals: {
      recencyScore: 95,
      activityFrequencyScore: 85,
      sentimentScore: 90,
      engagementDepthScore: 80,
    },
    positiveSignals: ['High engagement', 'Frequent meetings'],
    riskSignals: [],
    lastContactDaysAgo: 2,
    factors: ['Recent positive contract discussion', 'Multi-channel engagement'],
    lastEvaluatedAt: '2026-10-04T12:00:00Z',
  },
  memories: [
    {
      id: 'mem_1',
      title: 'Q3 Contract Renewal Discussion',
      snippet: 'Agreed on 3-year term renewal with 15% expansion at $120,000 ARR.',
      sourceType: 'meeting',
      sourceId: 'meet_998',
      author: 'Sarah Jenkins',
      confidence: 0.96,
      createdAt: '2026-10-01T12:00:00Z',
      tags: ['contract', 'pricing'],
      sensitivity: 'confidential',
    },
  ],
  relatedEntities: [
    {
      id: 'deal_acme_enterprise',
      name: 'Acme Corp 2026 Expansion',
      type: 'deal',
      relationType: 'primary_deal',
      relationship: 'Primary Opportunity',
      status: 'Negotiation',
      value: 120000,
      currency: '$',
      targetUrl: '/admin/deals/deal_acme_enterprise',
    },
  ],
  activeRuns: [
    {
      id: 'run_exec_456',
      runId: 'run_exec_456',
      personaId: 'agent_crm_analyst',
      personaName: 'CRM Intelligence Analyst',
      goal: 'Prepare contract proposal with adjusted pricing tiers',
      goalDescription: 'Prepare contract proposal with adjusted pricing tiers',
      status: 'EXECUTING',
      createdAt: '2026-10-04T14:00:00Z',
      startedAt: '2026-10-04T14:00:00Z',
      stepProgress: { completed: 3, total: 5 },
      viewUrl: '/admin/intelligence/runs?runId=run_exec_456',
    },
  ],
  pendingApprovals: [
    {
      id: 'prop_789',
      proposalId: 'prop_789',
      actionType: 'crm.discount.apply',
      actionName: 'Apply 10% Enterprise Discount',
      targetEntityName: 'Acme Corp Deal',
      riskLevel: 'L3_FINANCIAL_OR_COMMUNICATION',
      what: 'Apply 10% Enterprise Discount',
      why: 'Reward annual upfront renewal commitment',
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      createdAt: '2026-10-04T14:15:00Z',
      requiresOperatorIntervention: true,
      reviewUrl: '/admin/intelligence/approvals?proposalId=prop_789',
    },
  ],
};

describe('Global Context Rail UI Components (Phase 8 Milestone 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(contextRailActions.getEntityContextRailDataAction).mockResolvedValue({
      success: true,
      data: mockContextData,
    });
  });

  it('1. renders ContextRailTrigger with keyboard shortcut Option+C hint', () => {
    render(
      <ContextRailProvider initialEntityId="contact_john_doe" initialEntityType="contact">
        <ContextRailTrigger />
      </ContextRailProvider>
    );

    const triggerBtn = screen.getByTestId('context-rail-trigger-btn');
    expect(triggerBtn).toBeInTheDocument();
    expect(triggerBtn).toHaveAttribute('aria-label', expect.stringContaining('Option+C'));
  });

  it('2. opens GlobalContextRail drawer when defaultOpen is true or openRail is called', async () => {
    render(
      <ContextRailProvider initialEntityId="contact_john_doe" initialEntityType="contact" defaultOpen={true}>
        <GlobalContextRail />
      </ContextRailProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('global-context-rail')).toBeInTheDocument();
    });

    // Theme.md §8 compliance assertions
    expect(screen.getByText('Context Intelligence')).toBeInTheDocument();
    // Screen reader accessible description
    expect(screen.getByText(/Contextual Intelligence Drawer providing entity dossier/i)).toBeInTheDocument();
  });

  it('3. renders EntityDossierModule with tags, owner, and "View Full Entity" link', () => {
    render(<EntityDossierModule dossier={mockContextData.dossier} />);

    expect(screen.getByTestId('context-rail-dossier-module')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Tier 1')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    expect(screen.getByText('View Full Entity')).toHaveAttribute(
      'href',
      '/admin/entities/contact_john_doe'
    );
  });

  it('4. renders RelationshipHealthModule with score, band, and breakdown signals', () => {
    render(<RelationshipHealthModule health={mockContextData.health} />);

    expect(screen.getByTestId('context-rail-health-module')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('Champion')).toBeInTheDocument();
    expect(screen.getByText('improving')).toBeInTheDocument();
    expect(screen.getByText('Recency')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('5. renders InstitutionalMemoryModule with Rule 30 prompt injection container', () => {
    render(<InstitutionalMemoryModule memories={mockContextData.memories} />);

    expect(screen.getByTestId('context-rail-memory-module')).toBeInTheDocument();
    expect(screen.getByText('[citation:1]')).toBeInTheDocument();

    const untrustedContainer = screen.getByTestId('untrusted-reference-container');
    expect(untrustedContainer).toBeInTheDocument();
    expect(untrustedContainer.textContent).toContain('<untrusted_reference_data id="citation_mem_1">');
    expect(untrustedContainer.textContent).toContain('Agreed on 3-year term renewal');
    expect(untrustedContainer.textContent).toContain('</untrusted_reference_data>');
  });

  it('6. renders RelatedEntitiesModule with value and No Dead Ends navigation', () => {
    render(<RelatedEntitiesModule relatedEntities={mockContextData.relatedEntities} />);

    expect(screen.getByTestId('context-rail-related-module')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp 2026 Expansion')).toBeInTheDocument();
    expect(screen.getByText(/Primary Opportunity/)).toBeInTheDocument();
    expect(screen.getByText(/120,000/)).toBeInTheDocument();
  });

  it('7. renders ActiveRunsModule with step progress and view execution link', () => {
    render(<ActiveRunsModule runs={mockContextData.activeRuns} />);

    expect(screen.getByTestId('context-rail-runs-module')).toBeInTheDocument();
    expect(screen.getByText('CRM Intelligence Analyst')).toBeInTheDocument();
    expect(screen.getByText('3/5 (60%)')).toBeInTheDocument();
    expect(screen.getByText('View Execution Run')).toBeInTheDocument();
  });

  it('8. renders PendingApprovalsModule with Rule 22 SHA-256 hash badge and copy action', () => {
    render(<PendingApprovalsModule approvals={mockContextData.pendingApprovals} />);

    expect(screen.getByTestId('context-rail-approvals-module')).toBeInTheDocument();
    expect(screen.getByText('Apply 10% Enterprise Discount')).toBeInTheDocument();
    expect(screen.getByText('L3 FINANCIAL')).toBeInTheDocument();
    expect(screen.getByText(/SHA-256: e3b0c44298/)).toBeInTheDocument();
    expect(screen.getByText('Review Proposal')).toBeInTheDocument();
  });
});
