import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentAiIntelligenceTab } from '../DocumentAiIntelligenceTab';

const mockSummary = {
  documentId: 'doc_1',
  executiveSummary: 'This is an executive AI summary of the document.',
  keyTakeaways: ['High academic rigor', 'Modern lab facilities'],
  topics: ['Admissions', 'Academics'],
  targetAudience: 'Prospective Students',
  estimatedReadingTimeMinutes: 3,
  generatedAt: '2026-01-01T00:00:00Z',
};

const mockRecommendations = [
  {
    id: 'rec_1',
    pageNumber: 2,
    suggestedLayerType: 'cta' as const,
    buttonLabel: 'Apply Online Now',
    intentDescription: 'Detected application deadline',
    confidenceScore: 92,
    x: 70,
    y: 85,
    width: 25,
    height: 8,
    suggestedAction: {
      type: 'url' as const,
      targetUrl: 'https://smart-sapp.com/apply',
    },
  },
];

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/documents/ai-document-actions', () => ({
  generateDocumentSummaryAction: vi.fn().mockImplementation(async () => ({
    success: true,
    summary: mockSummary,
  })),
  recommendDocumentHotspotsAction: vi.fn().mockImplementation(async () => ({
    success: true,
    recommendations: mockRecommendations,
  })),
  applyAiRecommendedHotspotAction: vi.fn().mockImplementation(async () => ({
    success: true,
    layerId: 'layer_123',
  })),
  saveAiSummaryToDocumentMetadataAction: vi.fn().mockImplementation(async () => ({
    success: true,
  })),
}));

describe('DocumentAiIntelligenceTab Component (Phase 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary generator and generates AI insights', async () => {
    render(
      <DocumentAiIntelligenceTab
        workspaceId="ws_test"
        documentId="doc_1"
      />
    );

    expect(screen.getByText('AI Document Summary & Insights')).toBeDefined();

    const generateBtn = screen.getByText('Generate Summary');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('This is an executive AI summary of the document.')).toBeDefined();
      expect(screen.getByText('High academic rigor')).toBeDefined();
      expect(screen.getByText('Admissions')).toBeDefined();
    });
  });

  it('scans and renders smart CTA recommendations', async () => {
    render(
      <DocumentAiIntelligenceTab
        workspaceId="ws_test"
        documentId="doc_1"
      />
    );

    const scanBtn = screen.getByText('Analyze CTAs');
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByText('Apply Online Now')).toBeDefined();
      expect(screen.getByText('92% confidence')).toBeDefined();
    });

    const applyBtn = screen.getByText('Apply to Page');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText('Applied')).toBeDefined();
    });
  });
});
