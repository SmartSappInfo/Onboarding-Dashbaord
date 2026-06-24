import { describe, it, expect } from 'vitest';
import { channelMeta, CHANNEL_META } from '../channel-meta';

describe('channelMeta', () => {
  it('returns WhatsApp identity for the whatsapp channel', () => {
    const m = channelMeta('whatsapp');
    expect(m.label).toBe('WhatsApp');
    expect(m.group).toBe('WhatsApp Templates');
    expect(m).toBe(CHANNEL_META.whatsapp);
  });

  it('returns distinct identities for email and sms', () => {
    expect(channelMeta('email').label).toBe('Email');
    expect(channelMeta('sms').label).toBe('SMS');
  });

  it('falls back to email for unknown channels', () => {
    expect(channelMeta('in_app')).toBe(CHANNEL_META.email);
    expect(channelMeta('')).toBe(CHANNEL_META.email);
  });
});
