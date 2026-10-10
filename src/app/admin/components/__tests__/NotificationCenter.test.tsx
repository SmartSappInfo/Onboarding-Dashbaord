import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationCenter from '../NotificationCenter';
import type { InAppNotification, Activity } from '@/lib/types';

// Mock Firestore functions
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockWriteBatch = vi.fn(() => ({
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, col, id) => ({ path: `${col}/${id}`, id })),
  collection: vi.fn((_db, name) => ({ path: name, name })),
  query: vi.fn((colRef: { name?: string }) => ({ colName: colRef?.name })),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  writeBatch: () => mockWriteBatch(),
}));

let mockNotifications: InAppNotification[] = [];
let mockActivities: Activity[] = [];
let mockIsLoadingAlerts = false;
let mockIsLoadingActivities = false;

vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(() => ({})),
  useUser: vi.fn(() => ({ user: { uid: 'user-456' } })),
  useCollection: vi.fn((q: { colName?: string } | null) => {
    if (q?.colName === 'activities') {
      return {
        data: mockActivities,
        isLoading: mockIsLoadingActivities,
      };
    }
    return {
      data: mockNotifications,
      isLoading: mockIsLoadingAlerts,
    };
  }),
  useMemoFirebase: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: vi.fn(() => ({ activeWorkspaceId: 'ws-789' })),
}));

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoadingAlerts = false;
    mockIsLoadingActivities = false;
    mockNotifications = [
      {
        id: 'notif-1',
        userId: 'user-456',
        organizationId: 'org-1',
        title: 'New Deal Assigned',
        body: 'You have been assigned to <strong>Acme Deal</strong>.',
        category: 'tasks',
        isRead: false,
        actionUrl: '/admin/pipeline',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        userId: 'user-456',
        organizationId: 'org-1',
        title: 'Meeting Confirmed',
        body: 'Call scheduled with John Doe.',
        category: 'reminders',
        isRead: true,
        actionUrl: '/admin/calendar',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    mockActivities = [
      {
        id: 'act-1',
        organizationId: 'org-1',
        workspaceId: 'ws-789',
        source: 'system',
        type: 'meeting_created',
        description: 'Automated follow-up meeting scheduled',
        timestamp: new Date().toISOString(),
        entityName: 'Springfield High',
      },
    ];
  });

  it('renders a single trigger button with unread count badge', () => {
    render(<NotificationCenter />);

    const trigger = screen.getByRole('button', { name: /Notifications \(1 unread\)/i });
    expect(trigger).toBeInTheDocument();

    const badge = screen.getByTestId('notification-unread-badge');
    expect(badge).toHaveTextContent('1');
  });

  it('caps unread badge at 99+ when unread alerts exceed 99', () => {
    mockNotifications = Array.from({ length: 120 }, (_, i) => ({
      id: `notif-${i}`,
      userId: 'user-456',
      organizationId: 'org-1',
      title: `Alert ${i}`,
      body: 'Test alert',
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    render(<NotificationCenter />);
    const badge = screen.getByTestId('notification-unread-badge');
    expect(badge).toHaveTextContent('99+');
  });

  it('opens dropdown and displays the two dedicated tabs: "Direct Alerts" and "System Feed"', () => {
    render(<NotificationCenter defaultOpen />);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Direct Alerts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /System Feed/i })).toBeInTheDocument();
  });

  it('renders direct alerts tab content with title, sanitized body, and relative timestamp', () => {
    render(<NotificationCenter defaultOpen />);

    expect(screen.getByText('New Deal Assigned')).toBeInTheDocument();
    expect(screen.getByText('Acme Deal')).toBeInTheDocument();
    expect(screen.getByText('Meeting Confirmed')).toBeInTheDocument();
  });

  it('allows marking an individual alert as read', async () => {
    render(<NotificationCenter defaultOpen />);

    const markReadBtn = screen.getByRole('button', { name: /Mark "New Deal Assigned" as read/i });
    fireEvent.click(markReadBtn);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'in_app_notifications/notif-1' }),
      { isRead: true }
    );
  });

  it('allows batch marking all unread alerts as read via writeBatch', async () => {
    render(<NotificationCenter defaultOpen />);

    const markAllBtn = screen.getByRole('button', { name: /Mark all alerts as read/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(mockWriteBatch).toHaveBeenCalled();
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'in_app_notifications/notif-1' }),
        { isRead: true }
      );
      expect(mockBatchCommit).toHaveBeenCalled();
    });
  });

  it('switches to the "System Feed" tab and displays workspace system events', () => {
    render(<NotificationCenter defaultOpen />);

    const systemTab = screen.getByRole('tab', { name: /System Feed/i });
    fireEvent.click(systemTab);

    // Should show system activity description and entity
    expect(screen.getByText('Automated follow-up meeting scheduled')).toBeInTheDocument();
    expect(screen.getByText('Springfield High')).toBeInTheDocument();

    // Link to full activity log
    const auditLink = screen.getByRole('link', { name: /View Complete Audit Timeline/i });
    expect(auditLink).toHaveAttribute('href', '/admin/activities');
  });

  it('displays empty state when direct alerts list is empty', () => {
    mockNotifications = [];
    render(<NotificationCenter defaultOpen />);

    expect(screen.getByText('No alerts')).toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });
});
