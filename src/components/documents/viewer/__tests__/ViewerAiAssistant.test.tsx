import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ViewerAiAssistant } from '../ViewerAiAssistant';

const mockQaResponse = {
  answer: 'The annual tuition fee is $12,500 with merit scholarships available.',
  citations: [
    {
      pageNumber: 2,
      textSnippet: 'Tuition and Financial Aid: The annual tuition fee is $12,500.',
    },
  ],
  suggestedFollowUps: ['How do I apply?'],
};

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/documents/ai-document-actions', () => ({
  askDocumentQuestionAction: vi.fn().mockImplementation(async () => ({
    success: true,
    response: mockQaResponse,
  })),
}));

describe('ViewerAiAssistant Component (Phase 12)', () => {
  const onPageSelectMock = vi.fn();
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders welcome message when opened', () => {
    render(
      <ViewerAiAssistant
        isOpen={true}
        onClose={onCloseMock}
        workspaceId="ws_test"
        documentId="doc_1"
        documentTitle="Admissions 2026"
        onPageSelect={onPageSelectMock}
      />
    );

    expect(screen.getByText('AI Document Assistant')).toBeDefined();
    expect(screen.getByText(/Ask me anything about this publication/)).toBeDefined();
  });

  it('submits a question and renders assistant answer with clickable page citation', async () => {
    render(
      <ViewerAiAssistant
        isOpen={true}
        onClose={onCloseMock}
        workspaceId="ws_test"
        documentId="doc_1"
        documentTitle="Admissions 2026"
        onPageSelect={onPageSelectMock}
      />
    );

    const input = screen.getByPlaceholderText('Ask anything about this document...');
    fireEvent.change(input, { target: { value: 'What is the tuition?' } });

    const submitBtn = screen.getByTitle('Send Question');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/The annual tuition fee is \$12,500/)).toBeDefined();
      expect(screen.getByText('Page 2')).toBeDefined();
    });

    // Clicking page citation should invoke onPageSelect(2)
    const citationBtn = screen.getByText('Page 2');
    fireEvent.click(citationBtn);

    expect(onPageSelectMock).toHaveBeenCalledWith(2);
  });
});
