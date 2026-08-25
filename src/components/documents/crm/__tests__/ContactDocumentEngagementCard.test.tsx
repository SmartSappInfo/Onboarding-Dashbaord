import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ContactDocumentEngagementCard } from '../ContactDocumentEngagementCard';

// Mock Server Actions
vi.mock('@/lib/documents/crm-actions', () => ({
  getContactDocumentInsightsAction: vi.fn().mockResolvedValue({
    success: true,
    insights: {
      contactId: 'contact_456',
      workspaceId: 'ws_1',
      totalDocumentsRead: 2,
      totalReadingTimeSeconds: 150,
      averageCompletionPercentage: 85.0,
      totalEngagementScore: 45,
      engagements: [
        {
          id: 'eng_1',
          documentId: 'doc_1',
          documentTitle: 'Admissions Prospectus 2026',
          slug: 'admissions-2026',
          lastReadAt: '2026-01-01T00:00:00Z',
          totalSessions: 3,
          highestCompletionPercentage: 100,
          totalDwellTimeSeconds: 120,
          engagementScore: 35,
          pagesViewed: [1, 2, 3, 4],
          hotspotsClickedCount: 2,
          hasLeadSubmitted: true,
        },
      ],
    },
  }),
}));

// Mock Toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('ContactDocumentEngagementCard Component', () => {
  it('renders contact document engagement metrics and reading history', async () => {
    render(
      <ContactDocumentEngagementCard
        workspaceId="ws_1"
        contactId="contact_456"
        contactName="Sarah Connor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Document Engagement/i)).toBeDefined();
      expect(screen.getByText('2 Docs')).toBeDefined();
      expect(screen.getByText('2m 30s')).toBeDefined(); // 150 seconds formatted
      expect(screen.getByText('85%')).toBeDefined();
      expect(screen.getByText('+45 pts')).toBeDefined();
      expect(screen.getByText('Admissions Prospectus 2026')).toBeDefined();
      expect(screen.getByText(/100% Completed/i)).toBeDefined();
      expect(screen.getByText(/Inquiry Captured/i)).toBeDefined();
    });
  });
});
