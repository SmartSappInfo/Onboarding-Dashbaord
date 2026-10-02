// @vitest-environment jsdom
/**
 * @fileOverview UI Test Suite: Knowledge Graph Canvas Visualizer (Phase 4 Milestone 5)
 *
 * Implements PRD §96 (Graph UI), Rules 4, 7, 8, 9, 61, 64, and theme.md §8.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KnowledgeGraphCanvas } from '@/components/brain/KnowledgeGraphCanvas';
import { GraphNodeDetailsDrawer } from '@/components/brain/GraphNodeDetailsDrawer';
import type { EntityGraphResult } from '@/app/actions/memory-actions';

// Mock Server Actions
const mockGetEntityGraphAction = vi.fn();
vi.mock('@/app/actions/memory-actions', () => ({
  getEntityGraphAction: (...args: unknown[]) => mockGetEntityGraphAction(...args),
}));

// Mock Toast Hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('Knowledge Graph Canvas Visualizer (KnowledgeGraphCanvas.tsx & PRD §96)', () => {
  const sampleGraphData: EntityGraphResult = {
    centerNodeId: 'ent_root_1',
    nodes: [
      {
        id: 'ent_root_1',
        label: 'Apex Academy',
        nodeType: 'entity',
        connectionsCount: 3,
        originHref: '/admin/entities/ent_root_1',
      },
      {
        id: 'contact_david',
        label: 'Dr. David Mensah',
        nodeType: 'person',
        connectionsCount: 2,
        originHref: '/admin/contacts/contact_david',
      },
      {
        id: 'deal_enterprise',
        label: 'Enterprise Package Q4',
        nodeType: 'deal',
        connectionsCount: 1,
        originHref: '/admin/deals/deal_enterprise',
      },
      {
        id: 'mem_tuition',
        label: 'Tuition Discount Policy',
        nodeType: 'semantic',
        connectionsCount: 1,
        originHref: '/admin/brain?item=mem_tuition',
      },
    ],
    edges: [
      {
        id: 'edge_1',
        sourceNodeId: 'ent_root_1',
        targetNodeId: 'contact_david',
        relationshipType: 'HAS_CONTACT',
        confidence: 0.95,
      },
      {
        id: 'edge_2',
        sourceNodeId: 'ent_root_1',
        targetNodeId: 'deal_enterprise',
        relationshipType: 'OWNS_DEAL',
        confidence: 0.9,
      },
      {
        id: 'edge_3',
        sourceNodeId: 'ent_root_1',
        targetNodeId: 'mem_tuition',
        relationshipType: 'RELATED_TO',
        confidence: 0.88,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders SVG canvas with center node, connected nodes, and labeled edges', async () => {
    mockGetEntityGraphAction.mockResolvedValueOnce({
      success: true,
      data: sampleGraphData,
    });

    render(<KnowledgeGraphCanvas centerNodeId="ent_root_1" />);

    await waitFor(() => {
      expect(screen.getByText('Apex Academy')).toBeDefined();
      expect(screen.getByText('Dr. David Mensah')).toBeDefined();
      expect(screen.getByText('Enterprise Package Q4')).toBeDefined();
    });

    // Verify SVG container exists
    expect(screen.getByTestId('knowledge-graph-svg')).toBeDefined();
  });

  it('filters nodes by type pill (PRD §96)', async () => {
    mockGetEntityGraphAction.mockResolvedValueOnce({
      success: true,
      data: sampleGraphData,
    });

    render(<KnowledgeGraphCanvas centerNodeId="ent_root_1" />);

    await waitFor(() => {
      expect(screen.getByText('Dr. David Mensah')).toBeDefined();
    });

    // Click "Deals" filter
    const dealsFilterBtn = screen.getByRole('button', { name: /^deals$/i });
    fireEvent.click(dealsFilterBtn);

    // Deal should still be visible
    expect(screen.getByText('Enterprise Package Q4')).toBeDefined();
  });

  it('opens GraphNodeDetailsDrawer upon node selection conforming to theme.md §8', async () => {
    mockGetEntityGraphAction.mockResolvedValueOnce({
      success: true,
      data: sampleGraphData,
    });

    render(<KnowledgeGraphCanvas centerNodeId="ent_root_1" />);

    await waitFor(() => {
      expect(screen.getByText('Apex Academy')).toBeDefined();
    });

    // Click node
    const nodeEl = screen.getByTestId('node-contact_david');
    fireEvent.click(nodeEl);

    // Drawer should open and display node details
    await waitFor(() => {
      expect(screen.getByText('Node Details & Relations')).toBeDefined();
      expect(screen.getAllByText('Dr. David Mensah').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('GraphNodeDetailsDrawer strictly follows theme.md §8 standards', () => {
    const selectedNode = sampleGraphData.nodes[1]; // contact_david
    const incidentEdges = [sampleGraphData.edges[0]]; // edge_1

    render(
      <GraphNodeDetailsDrawer
        open={true}
        onOpenChange={vi.fn()}
        node={selectedNode}
        incidentEdges={incidentEdges}
      />
    );

    // Demarcated header and sr-only description (theme.md §8)
    expect(screen.getByText('Node Details & Relations')).toBeDefined();
    expect(screen.getByText(/graph node relationship inspector/i)).toHaveClass('sr-only');
    expect(screen.getByTestId('card-info-tooltip')).toBeDefined();
  });
});
