/**
 * @fileOverview Unit & Integration Tests for GraphReasoningModal (Phase 13 Milestone 5 Task 3)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & geometry: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl
 * - Demarcated header: <DialogHeader demarcated> (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20)
 * - Single-circle info tooltip: <CardInfoTooltip text="..." /> at z-[10050]
 * - Zero raw descriptions: <DialogDescription className="sr-only">
 * - Demarcated footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5
 * - Tactile action buttons: min-h-[44px] rounded-xl active:scale-[0.97]
 * - Rules 4, 7, 8, 13, 30, 41, 47, 51, 55, 60.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GraphReasoningModal } from '@/components/supervisor/GraphReasoningModal';

// Mock server actions
vi.mock('@/app/actions/graph-reasoning-actions', () => ({
  getDecisionMakerInfluenceMapAction: vi.fn(async () => ({
    success: true,
    data: {
      entityId: 'ent_campus_accra',
      entityLabel: 'Accra Premier Campus',
      totalStakeholders: 120, // Exceeds 80, triggers Rule 55 clamp banner
      keyDecisionMakerCount: 2,
      clamped: true,
      analyzedAt: new Date().toISOString(),
      keyDecisionMakerIds: ['contact_ceo_01', 'contact_cfo_02'],
      stakeholders: [
        {
          nodeId: 'contact_ceo_01',
          nodeLabel: 'Dr. Kwame Mensah',
          nodeType: 'CONTACT',
          degreeCentrality: 88,
          betweennessCentrality: 92,
          compositeInfluenceScore: 91,
          authorityWeight: 1.0,
          directConnectionCount: 15,
          indirectConnectionCount: 42,
          isKeyDecisionMaker: true,
          roleCategory: 'EXECUTIVE',
          influenceDrivers: ['Primary budget signatory', 'Board member'],
        },
        {
          nodeId: 'contact_cfo_02',
          nodeLabel: 'Abena Osei',
          nodeType: 'CONTACT',
          degreeCentrality: 78,
          betweennessCentrality: 82,
          compositeInfluenceScore: 84,
          authorityWeight: 0.9,
          directConnectionCount: 12,
          indirectConnectionCount: 30,
          isKeyDecisionMaker: true,
          roleCategory: 'FINANCIAL',
          influenceDrivers: ['Procurement gatekeeper', 'Signs contracts > $50k'],
        },
      ],
    },
  })),
  detectAccountRiskContagionAction: vi.fn(async () => ({
    success: true,
    data: {
      rootEntityId: 'ent_campus_accra',
      rootEntityLabel: 'Accra Premier Campus',
      initialRiskScore: 85,
      compositeContagionScore: 78,
      contagionRiskTier: 'ELEVATED',
      totalRevenueExposure: 145000,
      clamped: false,
      analyzedAt: new Date().toISOString(),
      blastRadius: { entityCount: 3, dealCount: 2, contactCount: 5 },
      affectedNodes: [
        {
          nodeId: 'ent_sister_kumasi',
          label: 'Kumasi Tech Campus',
          relationship: 'SISTER_CAMPUS',
          hopDistance: 1,
          transmittedRiskScore: 72,
          vulnerabilityFactor: 0.85,
          associatedDealAmount: 95000,
        },
      ],
      riskTransmissionVectors: [
        {
          vectorType: 'SHARED_VENDOR',
          weight: 0.8,
          evidence: 'Shared primary catering and facility vendor experiencing default.',
        },
      ],
      mitigationPlaybook: ['Isolate vendor shared accounts', 'Verify escrow deposits'],
    },
  })),
  findCausalRelationshipPathAction: vi.fn(async () => ({
    success: true,
    data: {
      sourceNodeId: 'contact_ceo_01',
      sourceLabel: 'Dr. Kwame Mensah',
      targetNodeId: 'ent_sister_kumasi',
      targetLabel: 'Kumasi Tech Campus',
      pathFound: true,
      connectionStrength: 85,
      traversalDepth: 2,
      analyzedAt: new Date().toISOString(),
      hops: [
        {
          hopIndex: 0,
          fromNodeId: 'contact_ceo_01',
          fromLabel: 'Dr. Kwame Mensah',
          toNodeId: 'ent_campus_accra',
          toLabel: 'Accra Premier Campus',
          relationship: 'MANAGES',
          weight: 1.0,
        },
        {
          hopIndex: 1,
          fromNodeId: 'ent_campus_accra',
          fromLabel: 'Accra Premier Campus',
          toNodeId: 'ent_sister_kumasi',
          toLabel: 'Kumasi Tech Campus',
          relationship: 'SISTER_CAMPUS',
          weight: 0.85,
        },
      ],
      causalInferenceNarrative:
        'Dr. Kwame Mensah exerts operational control over Accra Premier Campus which shares governance with Kumasi Tech Campus.',
      explainabilityGrid: {
        what: 'Multi-hop executive governance influence link detected.',
        why: 'Dr. Mensah sits on the governing council spanning both campus entities.',
        impact: 'Decisions made at Accra campus propagate directly to Kumasi operations.',
        risk: 'Leadership turnover in Accra impacts ongoing negotiations in Kumasi.',
      },
    },
  })),
}));

// Mock use-toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('GraphReasoningModal (theme.md §8 & Rule 55 Compliance)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal dialog with demarcated header, title, and single-circle tooltip', () => {
    render(
      <GraphReasoningModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        defaultEntityId="ent_campus_accra"
        defaultEntityLabel="Accra Premier Campus"
      />
    );

    expect(screen.getByText('Graph Reasoning & Relationship Intelligence')).toBeDefined();
    const tooltipTrigger = screen.getByRole('button', { name: /more information/i });
    expect(tooltipTrigger).toBeDefined();
  });

  it('hides long description clutter behind screen-reader only class (theme.md §8.2)', () => {
    render(
      <GraphReasoningModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        defaultEntityId="ent_campus_accra"
      />
    );

    const srOnlyDesc = document.querySelector('.sr-only');
    expect(srOnlyDesc).toBeDefined();
    expect(srOnlyDesc?.textContent).toContain('Interactive relationship graph explorer');
  });

  it('enforces Rule 55 bounds and displays performance clamping banner when nodes exceed 80', async () => {
    render(
      <GraphReasoningModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        defaultEntityId="ent_campus_accra"
        initialMode="influence"
      />
    );

    await waitFor(() => {
      // Clamped banner (Rule 55)
      expect(screen.getByText(/showing most relevant 80 of 120 nodes/i)).toBeDefined();
    });
  });

  it('renders Influence Centrality mode with composite scores and key decision-maker badges', async () => {
    render(
      <GraphReasoningModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        defaultEntityId="ent_campus_accra"
        initialMode="influence"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Kwame Mensah')).toBeDefined();
      expect(screen.getByText('Abena Osei')).toBeDefined();
      expect(screen.getAllByText(/key decision-maker/i).length).toBeGreaterThan(0);
      expect(screen.getByText('91')).toBeDefined(); // Composite score
    });
  });

  it('switches to Risk Contagion mode and displays total revenue exposure and transmission paths', async () => {
    render(
      <GraphReasoningModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        defaultEntityId="ent_campus_accra"
        initialMode="influence"
      />
    );

    const contagionTab = screen.getByRole('button', { name: /risk contagion/i });
    fireEvent.click(contagionTab);

    await waitFor(() => {
      expect(screen.getByText(/kumasi tech campus/i)).toBeDefined();
      expect(screen.getByText(/\$145,000/i)).toBeDefined();
      expect(screen.getByText(/shared_vendor/i)).toBeDefined();
    });
  });

  it('switches to Causal Paths mode and renders Rule 41 4-part explainability grid', async () => {
    render(
      <GraphReasoningModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        defaultEntityId="ent_campus_accra"
        initialMode="influence"
      />
    );

    const causalTab = screen.getByRole('button', { name: /causal paths/i });
    fireEvent.click(causalTab);

    await waitFor(() => {
      // 4-part grid (Rule 41)
      expect(screen.getByText('WHAT')).toBeDefined();
      expect(screen.getByText('WHY')).toBeDefined();
      expect(screen.getByText('IMPACT')).toBeDefined();
      expect(screen.getByText('RISK')).toBeDefined();
      expect(screen.getByText(/multi-hop executive governance influence link detected/i)).toBeDefined();
    });
  });

  it('isolates raw narrative context inside untrusted reference data container (Rules 13 & 30)', async () => {
    render(
      <GraphReasoningModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
        defaultEntityId="ent_campus_accra"
        initialMode="causal"
      />
    );

    await waitFor(() => {
      const container = document.querySelector('[data-testid="untrusted-reference-container"]');
      expect(container).toBeDefined();
      expect(container?.getAttribute('data-untrusted-source')).toBe('graph_reasoning_engine');
    });
  });

  it('renders tactile footer with rounded-xl active:scale-[0.97] close button', () => {
    render(
      <GraphReasoningModal
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org_test_123"
        workspaceId="ws_test_456"
      />
    );

    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    const footerCloseBtn = closeButtons.find((btn) => btn.textContent === 'Close') ?? closeButtons[0];
    expect(footerCloseBtn.className).toContain('active:scale-[0.97]');
    expect(footerCloseBtn.className).toContain('min-h-[44px]');
  });
});
