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

  it('renders recipient name on primary line and entity name as subtext', () => {
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
    expect(screen.getByText('Solid Rock Academy')).toBeDefined();
  });

  it('renders message preview and does not render email or phone in list view', () => {
    render(
      <ThreadList
        threads={[mockThread]}
        selectedEntityId={null}
        onSelect={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    // Message preview is visible
    expect(screen.getByText('Welcome to Term 2')).toBeDefined();

    // Email and phone are NOT rendered in the list view
    expect(screen.queryByText('ackahrosline5@gmail.com')).toBeNull();
    expect(screen.queryByText('+233244123456')).toBeNull();
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
