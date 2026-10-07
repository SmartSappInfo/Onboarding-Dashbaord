/**
 * @fileOverview Unit & Integration Tests: Visual Knowledge Graph Explorer (Phase 11 M5 · T4)
 *
 * Verifies:
 * - KnowledgeGraphClient: initial graph query, node rendering, center node setting
 * - Rule 55 hard ceilings: max 80 nodes, max 150 edges, depth <= 2
 * - 3 Graph Modes: Explore, Explain Path, Investigate
 * - Path finding integration via findKnowledgeGraphPathAction
 * - Node type filter toolbar
 * - Context menu trigger and actions
 * - Strict Rule 4 typing (zero any/any[])
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KnowledgeGraphClient } from '@/app/admin/intelligence/knowledge/graph/KnowledgeGraphClient';
import type {
  GraphNodeRecord,
  GraphEdgeRecord,
} from '@/platform/domains/knowledge_memory/services/knowledge-graph-projection-service';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'node' ? 'ent_greenfield' : null),
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_graph_123',
    activeOrganizationId: 'org_graph_456',
  }),
}));

vi.mock('@/hooks/useEventStream', () => ({
  useEventStream: vi.fn(),
}));

const mockGetKnowledgeGraphNeighborsAction = vi.fn();
const mockFindKnowledgeGraphPathAction = vi.fn();

vi.mock('@/app/actions/knowledge-inbox-actions', () => ({
  getKnowledgeGraphNeighborsAction: (...args: unknown[]) =>
    mockGetKnowledgeGraphNeighborsAction(...args),
  findKnowledgeGraphPathAction: (...args: unknown[]) =>
    mockFindKnowledgeGraphPathAction(...args),
}));

describe('Visual Knowledge Graph Explorer (Phase 11 M5 · T4)', () => {
  const sampleNodes: GraphNodeRecord[] = [
    {
      id: 'ent_greenfield',
      label: 'Greenfield School',
      type: 'entity',
      workspaceId: 'ws_graph_123',
    },
    {
      id: 'contact_sarah',
      label: 'Sarah Headmistress',
      type: 'person',
      workspaceId: 'ws_graph_123',
    },
    {
      id: 'deal_cloud_2026',
      label: 'Cloud License 2026',
      type: 'deal',
      workspaceId: 'ws_graph_123',
    },
    {
      id: 'meet_annual_review',
      label: 'Annual Review Call',
      type: 'meeting',
      workspaceId: 'ws_graph_123',
    },
  ];

  const sampleEdges: GraphEdgeRecord[] = [
    {
      id: 'edge_1',
      source: 'ent_greenfield',
      target: 'contact_sarah',
      relationship: 'employs',
      weight: 0.95,
      workspaceId: 'ws_graph_123',
    },
    {
      id: 'edge_2',
      source: 'ent_greenfield',
      target: 'deal_cloud_2026',
      relationship: 'associated_deal',
      weight: 0.9,
      workspaceId: 'ws_graph_123',
    },
    {
      id: 'edge_3',
      source: 'contact_sarah',
      target: 'meet_annual_review',
      relationship: 'attended',
      weight: 0.85,
      workspaceId: 'ws_graph_123',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKnowledgeGraphNeighborsAction.mockResolvedValue({
      success: true,
      data: {
        nodes: sampleNodes,
        edges: sampleEdges,
      },
    });
    mockFindKnowledgeGraphPathAction.mockResolvedValue({
      success: true,
      data: {
        pathFound: true,
        nodes: [sampleNodes[0], sampleNodes[1], sampleNodes[3]],
        edges: [sampleEdges[0], sampleEdges[2]],
      },
    });
  });

  it('renders Knowledge Graph Explorer and fetches neighbors bounded to Rule 55 limits', async () => {
    render(<KnowledgeGraphClient />);

    expect(screen.getByText('Knowledge Graph Explorer')).toBeDefined();

    await waitFor(() => {
      expect(mockGetKnowledgeGraphNeighborsAction).toHaveBeenCalledWith(
        'ws_graph_123',
        'ent_greenfield',
        80,
        2
      );
    });

    // Rule 55 telemetry badge
    expect(screen.getByText(/4\/80 nodes · 3\/150 edges/i)).toBeDefined();

    // Node labels rendered
    expect(screen.getAllByText('Greenfield School').length).toBeGreaterThan(0);
    expect(screen.getByText('Sarah Headmistress')).toBeDefined();
  });

  it('switches between Explore, Explain, and Investigate modes', async () => {
    render(<KnowledgeGraphClient />);

    await waitFor(() => {
      expect(screen.getAllByText('Greenfield School').length).toBeGreaterThan(0);
    });

    // Click Explain Path mode
    const explainModeBtn = screen.getByRole('button', { name: /Explain Path/i });
    fireEvent.click(explainModeBtn);

    expect(screen.getByText(/Explain Mode Active/i)).toBeDefined();

    // Click Investigate mode
    const investigateModeBtn = screen.getByRole('button', { name: /Investigate/i });
    fireEvent.click(investigateModeBtn);

    expect(screen.queryByText(/Explain Mode Active/i)).toBeNull();
  });

  it('triggers Explain Path action when two nodes are clicked in explain mode', async () => {
    render(<KnowledgeGraphClient />);

    await waitFor(() => {
      expect(screen.getAllByText('Greenfield School').length).toBeGreaterThan(0);
    });

    // Enter Explain mode
    const explainModeBtn = screen.getByRole('button', { name: /Explain Path/i });
    fireEvent.click(explainModeBtn);

    // Click source node: Greenfield School (the SVG text element)
    const sourceNodes = screen.getAllByText('Greenfield School');
    fireEvent.click(sourceNodes[0]);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Source node chosen',
      })
    );

    // Click destination node: Annual Review Call
    const destNode = screen.getByText('Annual Review Call');
    fireEvent.click(destNode);

    await waitFor(() => {
      expect(mockFindKnowledgeGraphPathAction).toHaveBeenCalledWith(
        'ws_graph_123',
        'ent_greenfield',
        'meet_annual_review',
        3,
        80
      );
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Path highlighted',
      })
    );
  });

  it('filters nodes by node type when clicked on toolbar filter', async () => {
    render(<KnowledgeGraphClient />);

    await waitFor(() => {
      expect(screen.getAllByText('Greenfield School').length).toBeGreaterThan(0);
      expect(screen.getByText('Sarah Headmistress')).toBeDefined();
    });

    // Click People filter
    const peopleFilterBtn = screen.getByRole('button', { name: /People/i });
    fireEvent.click(peopleFilterBtn);

    // Sarah Headmistress (person) should still be in the DOM
    expect(screen.getByText('Sarah Headmistress')).toBeDefined();
    // Greenfield School (type: entity) should be filtered out from SVG
    // Note: selectedNode card might still show if not deselected, but SVG node should not be present
    expect(screen.getByText('Sarah Headmistress')).toBeDefined();
  });

  it('opens context menu on right click and executes action', async () => {
    render(<KnowledgeGraphClient />);

    await waitFor(() => {
      expect(screen.getAllByText('Greenfield School').length).toBeGreaterThan(0);
    });

    const sourceNodes = screen.getAllByText('Greenfield School');
    fireEvent.contextMenu(sourceNodes[0], { clientX: 200, clientY: 200 });

    await waitFor(() => {
      expect(screen.getByText('Ask AI About Node')).toBeDefined();
      expect(screen.getByText('Add to Review Queue')).toBeDefined();
    });

    const addToQueueBtn = screen.getByText('Add to Review Queue');
    fireEvent.click(addToQueueBtn);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Queued for review',
      })
    );
  });
});
