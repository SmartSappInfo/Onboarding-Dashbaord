import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import MessageThread from '../MessageThread';
import type { ThreadGroup } from '../../ConversationsClient';
import type { MessageLog } from '@/lib/types';

describe('MessageThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLog: MessageLog = {
    id: 'msg-1',
    title: 'Admissions Inquiry',
    templateId: 'tmpl-1',
    templateName: 'Admission Info',
    senderProfileId: 'sender-1',
    senderName: 'SmartSapp Admissions',
    channel: 'email',
    recipient: 'ackahrosline5@gmail.com',
    subject: 'Term 2 Schedule',
    body: 'Dear Rosline, the term calendar has been updated.',
    status: 'sent',
    sentAt: '2026-10-09T08:00:00.000Z',
    variables: {
      name: 'Rosline Ackah',
      institution: 'Solid Rock Academy',
    },
    workspaceIds: ['ws-1'],
    providerId: null,
    providerStatus: null,
  };

  const mockThread: ThreadGroup = {
    entityId: 'ent-1',
    realEntityId: 'ent-1',
    entityName: 'Rosline Ackah · Solid Rock Academy',
    contactName: 'Rosline Ackah',
    institutionName: 'Solid Rock Academy',
    email: 'ackahrosline5@gmail.com',
    phone: '+233244123456',
    messages: [mockLog],
    lastMessage: mockLog,
    lastMessageTimestamp: '2026-10-09T08:00:00.000Z',
    totalMessages: 1,
    unreadCount: 0,
  };

  it('renders contact name and institution name in header', () => {
    render(<MessageThread thread={mockThread} />);
    expect(screen.getByText('Rosline Ackah')).toBeDefined();
    expect(screen.getByText(/Solid Rock Academy/)).toBeDefined();
  });

  it('renders mobile back button and triggers onBack when clicked', () => {
    const onBack = vi.fn();
    render(<MessageThread thread={mockThread} onBack={onBack} />);

    const backBtn = screen.getByRole('button', { name: /Inbox/i });
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders left expand toggle button when thread list is collapsed', () => {
    const onExpandThreadList = vi.fn();
    render(
      <MessageThread
        thread={mockThread}
        isThreadListCollapsed={true}
        onExpandThreadList={onExpandThreadList}
      />
    );

    const expandBtn = screen.getByTitle('Expand contacts list');
    expect(expandBtn).toBeDefined();
    fireEvent.click(expandBtn);
    expect(onExpandThreadList).toHaveBeenCalledTimes(1);
  });

  it('renders properties toggle button and triggers onToggleProperties', () => {
    const onToggleProperties = vi.fn();
    render(
      <MessageThread
        thread={mockThread}
        isPropertiesCollapsed={false}
        onToggleProperties={onToggleProperties}
      />
    );

    const propsToggleBtn = screen.getByTitle('Hide contact details');
    expect(propsToggleBtn).toBeDefined();
    fireEvent.click(propsToggleBtn);
    expect(onToggleProperties).toHaveBeenCalledTimes(1);
  });
});
