import { describe, it, expect } from 'vitest';
import { isThreadForUser } from '../user-thread-filter';
import type { ThreadGroup } from '../../ConversationsClient';
import type { MessageLog } from '@/lib/types';

describe('isThreadForUser', () => {
  const baseLog: MessageLog = {
    id: 'log-1',
    title: 'Welcome Message',
    templateId: 'tpl-1',
    templateName: 'Welcome',
    senderProfileId: 'sender-1',
    senderName: 'SmartSapp Admissions',
    channel: 'email',
    recipient: 'client@example.com',
    body: 'Welcome to our platform',
    status: 'sent',
    sentAt: '2026-10-09T10:00:00.000Z',
    variables: {},
    workspaceIds: ['ws-1'],
    providerId: null,
    providerStatus: null,
  };

  const createThread = (logs: MessageLog[]): ThreadGroup => ({
    entityId: 'ent-1',
    realEntityId: 'ent-1',
    entityName: 'Test Client',
    contactName: 'Test Client',
    institutionName: 'Apex School',
    email: 'client@example.com',
    phone: null,
    messages: logs,
    lastMessage: logs[0],
    lastMessageTimestamp: logs[0].sentAt,
    totalMessages: logs.length,
    unreadCount: 0,
  });

  it('returns false when user is null or missing uid', () => {
    const thread = createThread([baseLog]);
    expect(isThreadForUser(thread, null)).toBe(false);
    expect(isThreadForUser(thread, {})).toBe(false);
  });

  it('matches when log.userId matches current user uid', () => {
    const thread = createThread([{ ...baseLog, userId: 'usr-42' as any }]);
    expect(isThreadForUser(thread, { uid: 'usr-42' })).toBe(true);
    expect(isThreadForUser(thread, { uid: 'usr-99' })).toBe(false);
  });

  it('matches when variables.assignedUserId matches user uid', () => {
    const thread = createThread([
      {
        ...baseLog,
        variables: { assignedUserId: 'usr-rep-1' },
      },
    ]);
    expect(isThreadForUser(thread, { uid: 'usr-rep-1' })).toBe(true);
    expect(isThreadForUser(thread, { uid: 'usr-rep-2' })).toBe(false);
  });

  it('matches when recipient email equals user email', () => {
    const thread = createThread([
      {
        ...baseLog,
        recipient: 'manager@smartsapp.com',
      },
    ]);
    expect(
      isThreadForUser(thread, {
        uid: 'usr-manager',
        email: 'manager@smartsapp.com',
      })
    ).toBe(true);
  });

  it('matches when senderName equals user displayName', () => {
    const thread = createThread([
      {
        ...baseLog,
        senderName: 'Sarah Admin',
      },
    ]);
    expect(
      isThreadForUser(thread, {
        uid: 'usr-sarah',
        displayName: 'Sarah Admin',
      })
    ).toBe(true);
  });

  it('returns false when no messages in thread match user', () => {
    const thread = createThread([baseLog]);
    expect(
      isThreadForUser(thread, {
        uid: 'usr-other',
        email: 'other@example.com',
        displayName: 'Other User',
      })
    ).toBe(false);
  });
});
