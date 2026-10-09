import { describe, it, expect } from 'vitest';
import { extractThreadIdentity } from '../thread-identity';
import type { MessageLog } from '@/lib/types';

describe('extractThreadIdentity', () => {
  const createBaseLog = (overrides: Partial<MessageLog> = {}): MessageLog => ({
    id: 'log-1',
    title: 'Test Broadcast',
    templateId: 'tmpl-1',
    templateName: 'Welcome',
    senderProfileId: 'sender-1',
    senderName: 'SmartSapp Admin',
    channel: 'email',
    recipient: 'ackahrosline5@gmail.com',
    body: 'Hello Rosline!',
    status: 'sent',
    sentAt: '2026-10-09T08:00:00.000Z',
    variables: {},
    workspaceIds: ['ws-1'],
    providerId: null,
    providerStatus: null,
    ...overrides,
  });

  it('extracts contact name and institution name from message variables', () => {
    const log = createBaseLog({
      recipient: 'ackahrosline5@gmail.com',
      variables: {
        name: 'Rosline Ackah',
        institution: 'Solid Rock Academy',
        phone: '+233244123456',
      },
    });

    const result = extractThreadIdentity([log]);
    expect(result.contactName).toBe('Rosline Ackah');
    expect(result.institutionName).toBe('Solid Rock Academy');
    expect(result.email).toBe('ackahrosline5@gmail.com');
    expect(result.phone).toBe('+233244123456');
    expect(result.realEntityId).toBeNull();
  });

  it('scans earlier messages in thread if the latest message is missing variables', () => {
    const olderLog = createBaseLog({
      id: 'log-older',
      recipient: 'ackahrosline5@gmail.com',
      variables: {
        contact_name: 'Rosline Ackah',
        school: 'Solid Rock Academy',
      },
      sentAt: '2026-10-08T08:00:00.000Z',
    });

    const newerLog = createBaseLog({
      id: 'log-newer',
      recipient: 'ackahrosline5@gmail.com',
      variables: {}, // No variables in quick follow-up
      sentAt: '2026-10-09T08:00:00.000Z',
    });

    const result = extractThreadIdentity([newerLog, olderLog]);
    expect(result.contactName).toBe('Rosline Ackah');
    expect(result.institutionName).toBe('Solid Rock Academy');
    expect(result.email).toBe('ackahrosline5@gmail.com');
  });

  it('preserves realEntityId if present on any message', () => {
    const log = createBaseLog({
      entityId: 'crm-entity-999',
      displayName: 'Solid Rock Academy',
      recipient: '+233201112222',
      channel: 'sms',
      variables: {
        name: 'Headmaster Mensah',
      },
    });

    const result = extractThreadIdentity([log]);
    expect(result.realEntityId).toBe('crm-entity-999');
    expect(result.contactName).toBe('Headmaster Mensah');
    expect(result.phone).toBe('+233201112222');
  });

  it('falls back gracefully to extracting username from email when no variables exist', () => {
    const log = createBaseLog({
      recipient: 'kwame.mensah@gmail.com',
      channel: 'email',
      variables: {},
    });

    const result = extractThreadIdentity([log]);
    expect(result.contactName).toBe('Kwame Mensah');
    expect(result.email).toBe('kwame.mensah@gmail.com');
    expect(result.institutionName).toBe('');
  });

  it('falls back to raw recipient string if formatted phone number is used', () => {
    const log = createBaseLog({
      recipient: '+233244123456',
      channel: 'sms',
      variables: {},
    });

    const result = extractThreadIdentity([log]);
    expect(result.contactName).toBe('+233244123456');
    expect(result.phone).toBe('+233244123456');
  });
});
