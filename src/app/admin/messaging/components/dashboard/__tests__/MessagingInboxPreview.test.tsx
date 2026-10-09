import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessagingInboxPreview } from '../MessagingInboxPreview';

describe('MessagingInboxPreview', () => {
  const mockThreads = [
    {
      threadId: 't1',
      entityName: 'St. Mary High School',
      lastMessageSnippet: 'Can you please confirm receipt of the invoice?',
      lastMessageChannel: 'whatsapp' as const,
      lastMessageTimestamp: '2026-10-09T09:15:00Z',
      unreadCount: 2,
      isGroup: false,
      isDirect: true,
    },
    {
      threadId: 't2',
      entityName: 'Parent PTA Group',
      lastMessageSnippet: 'Meeting scheduled for tomorrow at 4 PM.',
      lastMessageChannel: 'sms' as const,
      lastMessageTimestamp: '2026-10-08T14:30:00Z',
      unreadCount: 0,
      isGroup: true,
      isDirect: false,
    },
  ];

  it('renders threads, unread badge, and filters by search query', () => {
    render(<MessagingInboxPreview items={mockThreads} isLoading={false} />);
    expect(screen.getByText(/St. Mary High School/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search conversations/i);
    fireEvent.change(searchInput, { target: { value: 'PTA' } });
    expect(screen.queryByText(/St. Mary High School/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Parent PTA Group/i)).toBeInTheDocument();
  });

  it('renders tab counters and filters by direct mode', () => {
    render(<MessagingInboxPreview items={mockThreads} isLoading={false} />);
    expect(screen.getByText(/All \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Unread \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Groups \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct \(1\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Direct/i }));
    expect(screen.getByText(/St. Mary High School/i)).toBeInTheDocument();
    expect(screen.queryByText(/Parent PTA Group/i)).not.toBeInTheDocument();
  });

  it('invokes onOpenAiAssistant when AI drafting bar is clicked', () => {
    const handleAi = vi.fn();
    render(<MessagingInboxPreview items={mockThreads} isLoading={false} onOpenAiAssistant={handleAi} />);
    
    const aiBtn = screen.getByRole('button', { name: /Ask AI to draft reply/i });
    fireEvent.click(aiBtn);
    expect(handleAi).toHaveBeenCalledTimes(1);
  });

  it('renders skeleton on loading', () => {
    render(<MessagingInboxPreview isLoading={true} />);
    expect(screen.queryByText(/St. Mary High School/i)).not.toBeInTheDocument();
  });
});
