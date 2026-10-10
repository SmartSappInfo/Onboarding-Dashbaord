import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { MessagingInboxPreview } from '../MessagingInboxPreview';

describe('MessagingInboxPreview', () => {
  const mockThreads = [
    {
      threadId: 't1',
      entityName: 'Kwame George · Gracefilled Academy',
      recipientName: 'Kwame George',
      institutionName: 'Gracefilled Academy',
      phone: '+233244123456',
      email: 'kwame@gracefilled.edu',
      contactAddress: '+233244123456',
      lastMessageSnippet: 'Can you please confirm receipt of the invoice?',
      lastMessageChannel: 'whatsapp' as const,
      lastMessageTimestamp: '2026-10-09T09:15:00Z',
      unreadCount: 2,
      isGroup: false,
      isDirect: true,
    },
    {
      threadId: 't2',
      entityName: 'Rosline Ackah · Solid Rock Academy',
      recipientName: 'Rosline Ackah',
      institutionName: 'Solid Rock Academy',
      email: 'rosline@solidrock.edu',
      phone: '+233200987654',
      contactAddress: 'rosline@solidrock.edu',
      lastMessageSnippet: 'Upcoming staff training schedule attached.',
      lastMessageChannel: 'email' as const,
      lastMessageTimestamp: '2026-10-08T14:30:00Z',
      unreadCount: 0,
      isGroup: false,
      isDirect: true,
    },
    {
      threadId: 't3',
      entityName: 'Parent PTA Group',
      lastMessageSnippet: 'Meeting scheduled for tomorrow at 4 PM.',
      lastMessageChannel: 'sms' as const,
      lastMessageTimestamp: '2026-10-08T14:30:00Z',
      unreadCount: 0,
      isGroup: true,
      isDirect: false,
    },
  ];

  it('renders recipient name, entity name, and channel-specific phone or email', () => {
    render(<MessagingInboxPreview items={mockThreads} isLoading={false} />);

    // Recipient names
    expect(screen.getByText('Kwame George')).toBeInTheDocument();
    expect(screen.getByText(/· Gracefilled Academy/i)).toBeInTheDocument();
    expect(screen.getByText('Rosline Ackah')).toBeInTheDocument();
    expect(screen.getByText(/· Solid Rock Academy/i)).toBeInTheDocument();

    // Channel specific addresses:
    // WhatsApp thread t1 displays phone
    expect(screen.getByText('+233244123456')).toBeInTheDocument();
    // Email thread t2 displays email
    expect(screen.getByText('rosline@solidrock.edu')).toBeInTheDocument();

    // Channel badges
    expect(screen.getByText('WA')).toBeInTheDocument();
    expect(screen.getByText('EMAIL')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
  });

  it('renders threads, unread badge, and filters by search query', () => {
    render(<MessagingInboxPreview items={mockThreads} isLoading={false} />);
    expect(screen.getByText(/Kwame George/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search conversations/i);
    fireEvent.change(searchInput, { target: { value: 'PTA' } });
    expect(screen.queryByText(/Kwame George/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Parent PTA Group/i)).toBeInTheDocument();

    // Search by email address
    fireEvent.change(searchInput, { target: { value: 'rosline@solidrock' } });
    expect(screen.getByText(/Rosline Ackah/i)).toBeInTheDocument();
    expect(screen.queryByText(/Kwame George/i)).not.toBeInTheDocument();

    // Search by phone number
    fireEvent.change(searchInput, { target: { value: '244123456' } });
    expect(screen.getByText(/Kwame George/i)).toBeInTheDocument();
    expect(screen.queryByText(/Rosline Ackah/i)).not.toBeInTheDocument();
  });

  it('renders tab counters and filters by direct mode', () => {
    render(<MessagingInboxPreview items={mockThreads} isLoading={false} />);
    expect(screen.getByText(/All \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Unread \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Groups \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct \(2\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Direct/i }));
    expect(screen.getByText(/Kwame George/i)).toBeInTheDocument();
    expect(screen.getByText(/Rosline Ackah/i)).toBeInTheDocument();
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
    expect(screen.queryByText(/Kwame George/i)).not.toBeInTheDocument();
  });
});
