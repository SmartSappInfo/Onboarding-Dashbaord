import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import EntityContextPanel from '../EntityContextPanel';
import type { ThreadGroup } from '../../ConversationsClient';
import type { MessageLog, WorkspaceEntity } from '@/lib/types';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id, collection })),
  collection: vi.fn((_db, name) => ({ path: name, name })),
  getFirestore: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
}));

// Mock useFirestore and useDoc hooks
vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(() => ({})),
  useDoc: vi.fn(),
  useMemoFirebase: vi.fn((fn: () => unknown) => fn()),
}));

import { useDoc } from '@/firebase';

describe('EntityContextPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLog: MessageLog = {
    id: 'msg-1',
    title: 'Test Message',
    templateId: 'tmpl-1',
    templateName: 'Welcome Template',
    senderProfileId: 'sender-1',
    senderName: 'SmartSapp Admin',
    channel: 'sms',
    recipient: '+233244123456',
    subject: 'Welcome to SmartSapp',
    body: 'Hello Rosline, welcome to Solid Rock Academy!',
    status: 'sent',
    sentAt: '2026-10-09T08:00:00.000Z',
    variables: {
      name: 'Rosline Ackah',
      institution: 'Solid Rock Academy',
    },
    workspaceIds: ['ws-1'],
    entityId: 'entity-123',
    providerId: null,
    providerStatus: null,
  };

  const mockThread: ThreadGroup = {
    entityId: 'entity-123',
    realEntityId: 'entity-123',
    entityName: 'Rosline Ackah · Solid Rock Academy',
    contactName: 'Rosline Ackah',
    institutionName: 'Solid Rock Academy',
    email: 'rosline@solidrock.edu',
    phone: '+233244123456',
    messages: [mockLog],
    lastMessage: mockLog,
    lastMessageTimestamp: '2026-10-09T08:00:00.000Z',
    totalMessages: 1,
    unreadCount: 0,
  };

  it('renders loading skeleton when isLoading is true', () => {
    vi.mocked(useDoc).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(<EntityContextPanel thread={mockThread} />);
    expect(screen.getByTestId('entity-context-skeleton')).toBeDefined();
  });

  it('renders CRM entity details when entity doc is loaded from Firestore', () => {
    vi.mocked(useDoc).mockReturnValue({
      data: {
        id: 'entity-123',
        entityId: 'entity-123',
        displayName: 'Solid Rock Academy',
        primaryEmail: 'info@solidrock.edu',
        primaryPhone: '+233201112222',
        primaryContactName: 'Dr. Mensah',
        status: 'Active',
      } as unknown as WorkspaceEntity & { id: string },
      isLoading: false,
      error: null,
    });

    render(<EntityContextPanel thread={mockThread} />);
    expect(screen.getByText('Solid Rock Academy')).toBeDefined();
    expect(screen.getByText('Dr. Mensah')).toBeDefined();
    expect(screen.getByText('info@solidrock.edu')).toBeDefined();
    expect(screen.getByText('View Full Profile')).toBeDefined();
  });

  it('renders rich Universal Contact Profile fallback when entity is not found in Firestore', () => {
    vi.mocked(useDoc).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    render(<EntityContextPanel thread={mockThread} />);
    expect(screen.getByText('Rosline Ackah')).toBeDefined();
    expect(screen.getByText('Solid Rock Academy')).toBeDefined();
    expect(screen.getByText('rosline@solidrock.edu')).toBeDefined();
    expect(screen.getByText('+233244123456')).toBeDefined();
    expect(screen.getByText(/Direct Contact/i)).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    vi.mocked(useDoc).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    const onClose = vi.fn();
    render(<EntityContextPanel thread={mockThread} onClose={onClose} />);

    const closeBtn = screen.getByTitle('Close details panel');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
