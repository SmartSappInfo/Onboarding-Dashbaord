import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ConversationsClient from '../ConversationsClient';
import type { MessageLog } from '@/lib/types';

// Mock Firebase hooks
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id, collection })),
  collection: vi.fn((_db, name) => ({ path: name, name })),
  getFirestore: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
}));

vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(() => ({})),
  useDoc: vi.fn(() => ({ data: null, isLoading: false, error: null })),
  useCollection: vi.fn(),
  useMemoFirebase: vi.fn((fn: () => unknown) => fn()),
  useUser: vi.fn(() => ({
    user: { uid: 'usr-admin', email: 'admin@smartsapp.com', displayName: 'Admin' } as any,
    isUserLoading: false,
    userError: null,
  })),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: vi.fn(() => ({ activeWorkspaceId: 'ws-123' })),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: vi.fn(() => ({
    isSuperAdmin: true,
    isWorkspaceAdmin: true,
    currentUserProfile: {
      id: 'usr-admin',
      name: 'Admin',
      displayName: 'Admin',
      email: 'admin@smartsapp.com',
    },
  })),
}));

import { useCollection, useDoc, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';

describe('ConversationsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const mockLogs: MessageLog[] = [
    {
      id: 'log-1',
      title: 'Broadcast',
      templateId: 'tmpl-1',
      templateName: 'Welcome',
      senderProfileId: 'sender-1',
      senderName: 'Admin',
      channel: 'email',
      recipient: 'ackahrosline5@gmail.com',
      body: 'Welcome to Solid Rock Academy!',
      status: 'sent',
      sentAt: '2026-10-09T08:00:00.000Z',
      variables: {
        name: 'Rosline Ackah',
        institution: 'Solid Rock Academy',
        phone: '+233244123456',
      },
      workspaceIds: ['ws-123'],
      entityId: 'ent-1',
      providerId: null,
      providerStatus: null,
    },
    {
      id: 'log-2',
      title: 'Direct SMS',
      templateId: 'tmpl-2',
      templateName: 'Reminder',
      senderProfileId: 'sender-1',
      senderName: 'Admin',
      channel: 'sms',
      recipient: '+233201112222',
      body: 'Reminder: meeting today at 2pm',
      status: 'sent',
      sentAt: '2026-10-09T07:00:00.000Z',
      variables: {
        contact_name: 'Dr. Mensah',
        school: 'Accra Academy',
      },
      workspaceIds: ['ws-123'],
      providerId: null,
      providerStatus: null,
    },
  ];

  it('renders initial loading spinner when logs are loading for the first time', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(<ConversationsClient />);
    expect(screen.getByTestId('conversations-initial-loading')).toBeDefined();
  });

  it('renders threads and contacts list when logs load', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      error: null,
    });

    render(<ConversationsClient />);
    expect(screen.getByText('Rosline Ackah')).toBeDefined();
    expect(screen.getAllByText(/Solid Rock Academy/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Dr. Mensah')).toBeDefined();
    expect(screen.getAllByText(/Accra Academy/).length).toBeGreaterThanOrEqual(1);
  });

  it('selects a thread and displays message history and contact details', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      error: null,
    });

    render(<ConversationsClient />);

    // Select first contact
    const contactBtn = screen.getByText('Rosline Ackah');
    fireEvent.click(contactBtn);

    // Verify MessageThread header shows selected contact
    expect(screen.getAllByText('Rosline Ackah').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Welcome to Solid Rock Academy!').length).toBeGreaterThanOrEqual(1);

    // Verify EntityContextPanel is mounted for the contact
    expect(screen.getByText('Direct Contact')).toBeDefined();
    expect(screen.getAllByText('ackahrosline5@gmail.com').length).toBeGreaterThanOrEqual(1);
  });

  it('does not unmount the UI during progressive pagination (stale-while-revalidate)', () => {
    // Simulating initial load complete, now fetching more logs
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: true, // isLoading is true while fetching batch 2
      error: null,
    });

    render(<ConversationsClient />);

    // UI should NOT show full-page loader because logs already exist!
    expect(screen.queryByTestId('conversations-initial-loading')).toBeNull();
    expect(screen.getByText('Rosline Ackah')).toBeDefined();
  });

  it('toggles left contacts panel collapse', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      error: null,
    });

    render(<ConversationsClient />);

    // Select a thread first
    fireEvent.click(screen.getByText('Rosline Ackah'));

    // Find and click collapse button in ThreadList
    const collapseBtn = screen.getByTitle('Collapse inbox list');
    fireEvent.click(collapseBtn);

    // Now ThreadList is collapsed and MessageThread displays expand button
    expect(screen.getByTitle('Expand contacts list')).toBeDefined();

    // Click expand button to restore
    fireEvent.click(screen.getByTitle('Expand contacts list'));
    expect(screen.getByTitle('Collapse inbox list')).toBeDefined();
  });

  it('toggles right contact details panel collapse', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      error: null,
    });

    render(<ConversationsClient />);

    // Select a thread first
    fireEvent.click(screen.getByText('Rosline Ackah'));

    // Right panel is visible
    expect(screen.getByTitle('Hide contact details')).toBeDefined();

    // Click toggle to collapse
    fireEvent.click(screen.getByTitle('Hide contact details'));
    expect(screen.getByTitle('Show contact details')).toBeDefined();
  });

  it('handles mobile back button to return to contacts list', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      error: null,
    });

    render(<ConversationsClient />);

    // Select thread
    fireEvent.click(screen.getByText('Rosline Ackah'));
    expect(screen.getAllByText('Welcome to Solid Rock Academy!').length).toBeGreaterThanOrEqual(1);

    // Click mobile back button (Inbox)
    const backBtn = screen.getByLabelText('Back to conversations Inbox');
    fireEvent.click(backBtn);

    // Thread is deselected, returning to default view
    expect(screen.getByText('No conversation selected')).toBeDefined();
  });

  it('toggles mobile slide-over details sheet when viewport is mobile', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      error: null,
    });

    // Simulate mobile viewport
    window.innerWidth = 390;

    render(<ConversationsClient />);

    // Select thread
    fireEvent.click(screen.getByText('Rosline Ackah'));

    // Details button exists
    const detailsBtn = screen.getByLabelText(/Show contact details|Hide contact details/);
    fireEvent.click(detailsBtn);

    // Verify contact details are displayed inside sheet
    expect(screen.getAllByText('Contact Details').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ackahrosline5@gmail.com').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "All Conversations" header and scope switcher by default', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      error: null,
    });
    vi.mocked(useDoc).mockReturnValue({
      data: {
        id: 'current',
        allowViewingAllMessages: true,
        version: 1,
        quickTemplateIds: [],
        aiPromptStarters: [],
        channelKillSwitches: { sms: false, whatsapp: false, email: false },
        lowBalanceThreshold: 100,
      } as any,
      isLoading: false,
      error: null,
    });

    render(<ConversationsClient />);

    expect(screen.getByText('All Conversations')).toBeDefined();
    expect(screen.getByRole('button', { name: /All/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Mine/i })).toBeDefined();
  });

  it('filters threads to logged-in user when scope is switched to "Mine"', () => {
    // mockLogs[0] has senderName: 'Admin'
    // mockLogs[1] has variables.assignedUserId: 'usr-agent-9'
    const customLogs: MessageLog[] = [
      {
        ...mockLogs[0],
        id: 'log-mine',
        userId: 'usr-current-user',
        recipient: 'mine@example.com',
        variables: { name: 'Mine Contact' },
      },
      {
        ...mockLogs[1],
        id: 'log-other',
        userId: 'usr-other-user',
        recipient: 'other@example.com',
        variables: { name: 'Other Contact' },
      },
    ];

    vi.mocked(useCollection).mockReturnValue({
      data: customLogs,
      isLoading: false,
      error: null,
    });
    vi.mocked(useUser).mockReturnValue({
      user: { uid: 'usr-current-user', email: 'me@example.com', displayName: 'Me' } as any,
      isUserLoading: false,
      userError: null,
    });

    render(<ConversationsClient />);

    // In "All" view, both contacts are visible
    expect(screen.getByText('Mine Contact')).toBeDefined();
    expect(screen.getByText('Other Contact')).toBeDefined();

    // Click "Mine" button
    const mineBtn = screen.getByText('Mine').closest('button')!;
    fireEvent.click(mineBtn);

    // Header changes to "My Conversations"
    expect(screen.getByText('My Conversations')).toBeDefined();

    // Only "Mine Contact" is visible
    expect(screen.getByText('Mine Contact')).toBeDefined();
    expect(screen.queryByText('Other Contact')).toBeNull();
  });

  it('locks scope to "mine" and shows policy message when allowViewingAllMessages is false for non-admin', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      error: null,
    });
    // Non-admin user
    vi.mocked(useTenant).mockReturnValue({
      isSuperAdmin: false,
      isWorkspaceAdmin: false,
      currentUserProfile: { id: 'usr-staff', name: 'Staff User', email: 'staff@example.com' },
    } as any);
    // Settings prohibit viewing all messages
    vi.mocked(useDoc).mockReturnValue({
      data: {
        id: 'current',
        allowViewingAllMessages: false,
        version: 1,
        quickTemplateIds: [],
        aiPromptStarters: [],
        channelKillSwitches: { sms: false, whatsapp: false, email: false },
        lowBalanceThreshold: 100,
      } as any,
      isLoading: false,
      error: null,
    });

    render(<ConversationsClient />);

    // Title should be "My Conversations"
    expect(screen.getByText('My Conversations')).toBeDefined();
    // Scope switcher should NOT be visible; instead the policy notice is rendered
    expect(screen.getByText(/Showing your conversations \(workspace policy\)/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^All$/i })).toBeNull();
  });

  it('allows admin to view all messages even if allowViewingAllMessages is false', () => {
    vi.mocked(useCollection).mockReturnValue({
      data: mockLogs,
      isLoading: false,
      error: null,
    });
    // Admin user override
    vi.mocked(useTenant).mockReturnValue({
      isSuperAdmin: true,
      isWorkspaceAdmin: true,
      currentUserProfile: { id: 'usr-admin', name: 'Admin', email: 'admin@example.com' },
    } as any);
    // Setting is false for workspace
    vi.mocked(useDoc).mockReturnValue({
      data: {
        id: 'current',
        allowViewingAllMessages: false,
        version: 1,
        quickTemplateIds: [],
        aiPromptStarters: [],
        channelKillSwitches: { sms: false, whatsapp: false, email: false },
        lowBalanceThreshold: 100,
      } as any,
      isLoading: false,
      error: null,
    });

    render(<ConversationsClient />);

    // Admins bypass restriction and can see "All Conversations" and the switcher
    expect(screen.getByText('All Conversations')).toBeDefined();
    expect(screen.getByRole('button', { name: /All/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Mine/i })).toBeDefined();
  });
});
