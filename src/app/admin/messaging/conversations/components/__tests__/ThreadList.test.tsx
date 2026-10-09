import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ThreadList from '../ThreadList';
import type { ThreadGroup } from '../../ConversationsClient';
import type { MessageLog } from '@/lib/types';

describe('ThreadList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLog: MessageLog = {
    id: 'msg-1',
    title: 'Admission Notice',
    templateId: 'tmpl-1',
    templateName: 'Admission',
    senderProfileId: 'sender-1',
    senderName: 'SmartSapp Admin',
    channel: 'email',
    recipient: 'ackahrosline5@gmail.com',
    subject: 'Welcome to Term 2',
    body: 'Dear Rosline, please find the term fees attached.',
    status: 'sent',
    sentAt: '2026-10-09T08:00:00.000Z',
    variables: {
      name: 'Rosline Ackah',
      institution: 'Solid Rock Academy',
    },
    workspaceIds: ['ws-1'],
    entityId: 'ent-1',
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
    unreadCount: 2,
  };

  it('renders contact name and institution name on primary line', () => {
    render(
      <ThreadList
        threads={[mockThread]}
        selectedEntityId={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    expect(screen.getByText('Rosline Ackah')).toBeDefined();
    expect(screen.getByText(/Solid Rock Academy/)).toBeDefined();
  });

  it('renders email and phone number as subtext before message preview', () => {
    render(
      <ThreadList
        threads={[mockThread]}
        selectedEntityId={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    expect(screen.getByText('ackahrosline5@gmail.com')).toBeDefined();
    expect(screen.getByText('+233244123456')).toBeDefined();
    expect(screen.getByText('Welcome to Term 2')).toBeDefined();
  });

  it('renders unread badge count next to timestamp', () => {
    render(
      <ThreadList
        threads={[mockThread]}
        selectedEntityId={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    expect(screen.getByText('2')).toBeDefined();
  });

  it('calls onToggleCollapse when collapse button is clicked', () => {
    const onToggleCollapse = vi.fn();
    render(
      <ThreadList
        threads={[mockThread]}
        selectedEntityId={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
        onToggleCollapse={onToggleCollapse}
      />
    );

    const collapseBtn = screen.getByTitle('Collapse inbox list');
    fireEvent.click(collapseBtn);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('renders load older conversations button when hasMore is true and triggers onLoadMore', () => {
    const onLoadMore = vi.fn();
    render(
      <ThreadList
        threads={[mockThread]}
        selectedEntityId={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
        hasMore={true}
        onLoadMore={onLoadMore}
      />
    );

    const loadMoreBtn = screen.getByText(/Load older conversations/i);
    expect(loadMoreBtn).toBeDefined();
    fireEvent.click(loadMoreBtn);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
