import { describe, it, expect } from 'vitest';
import { getMessagingCategory, getMessagingCategoryLabel } from '../automations/messaging-step-category';

describe('Messaging Step Category Resolver', () => {
  it('should categorize SEND_MESSAGE by config.channel correctly', () => {
    expect(getMessagingCategory('SEND_MESSAGE', 'sms')).toBe('SMS');
    expect(getMessagingCategory('SEND_MESSAGE', 'whatsapp')).toBe('WHATSAPP');
    expect(getMessagingCategory('SEND_MESSAGE', 'email')).toBe('EMAIL');
    expect(getMessagingCategory('SEND_MESSAGE', undefined)).toBe('EMAIL');
  });

  it('should categorize direct node action types correctly', () => {
    expect(getMessagingCategory('DIRECT_SMS')).toBe('SMS');
    expect(getMessagingCategory('SEND_SMS')).toBe('SMS');
    expect(getMessagingCategory('SEND_NOTIFICATION_SMS')).toBe('SMS');

    expect(getMessagingCategory('DIRECT_EMAIL')).toBe('EMAIL');
    expect(getMessagingCategory('SEND_EMAIL')).toBe('EMAIL');
    expect(getMessagingCategory('SEND_NOTIFICATION_EMAIL')).toBe('EMAIL');

    expect(getMessagingCategory('DIRECT_WHATSAPP')).toBe('WHATSAPP');
    expect(getMessagingCategory('SEND_WHATSAPP')).toBe('WHATSAPP');
  });

  it('should return human-readable category labels', () => {
    expect(getMessagingCategoryLabel('SMS')).toBe('SMS');
    expect(getMessagingCategoryLabel('EMAIL')).toBe('Email');
    expect(getMessagingCategoryLabel('WHATSAPP')).toBe('WhatsApp');
    expect(getMessagingCategoryLabel('NOTIFICATION_IN_APP')).toBe('In-App Notification');
  });

  it('should strictly isolate SMS nodes from Email and WhatsApp nodes', () => {
    const nodes = [
      { id: '1', data: { actionType: 'SEND_MESSAGE', config: { channel: 'email' } } },
      { id: '2', data: { actionType: 'SEND_MESSAGE', config: { channel: 'sms' } } },
      { id: '3', data: { actionType: 'DIRECT_SMS' } },
      { id: '4', data: { actionType: 'SEND_MESSAGE', config: { channel: 'whatsapp' } } },
    ];

    const smsNodes = nodes.filter(
      (n) => getMessagingCategory(n.data.actionType, n.data.config?.channel) === 'SMS'
    );

    expect(smsNodes.map((n) => n.id)).toEqual(['2', '3']);
  });
});
