import { describe, it, expect } from 'vitest';
import {
  buildReminderJobKey,
  evaluateNotificationFallback,
  calculateReminderTriggerTime,
} from '../notification-cascade-service';

describe('Notification Cascade Service', () => {
  it('builds idempotent job keys', () => {
    const key = buildReminderJobKey('m_123', 'reminder_24h', 'whatsapp');
    expect(key).toBe('reminder_m_123_reminder_24h_whatsapp');
  });

  it('evaluates channel fallback hierarchy', () => {
    expect(evaluateNotificationFallback('whatsapp')).toBe('sms');
    expect(evaluateNotificationFallback('sms')).toBe('email');
    expect(evaluateNotificationFallback('email')).toBeNull();
  });

  it('calculates scheduled trigger times for reminder offsets', () => {
    const start = '2026-08-25T14:00:00.000Z';
    const trigger24h = calculateReminderTriggerTime(start, 1440); // 24h = 1440 min
    expect(trigger24h).toBe('2026-08-24T14:00:00.000Z');

    const trigger15m = calculateReminderTriggerTime(start, 15);
    expect(trigger15m).toBe('2026-08-25T13:45:00.000Z');
  });
});
