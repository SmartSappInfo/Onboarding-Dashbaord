import { describe, it, expect } from 'vitest';
import {
  CHANNEL_REGISTRY,
  ALL_CHANNELS,
  getChannelMeta,
  contactResolutionChannel,
  assertNever,
} from '../channel-registry';
import type { MessageChannel } from '@/lib/types';

/**
 * Phase R — single source of truth for channel behavior.
 *
 * These pin the mappings that the previously-scattered `=== 'email' ? : 'sms'`
 * ternaries relied on (spec §3C). They MUST stay green through the refactor —
 * they are the proof that email/SMS behavior is unchanged while WhatsApp slots
 * in cleanly (F1/F2/F4).
 */

describe('channel-registry', () => {
  it('has an entry for every MessageChannel (exhaustive)', () => {
    const expected: MessageChannel[] = ['email', 'sms', 'whatsapp', 'in_app', 'push'];
    expect(ALL_CHANNELS.slice().sort()).toEqual(expected.slice().sort());
    for (const channel of ALL_CHANNELS) {
      expect(CHANNEL_REGISTRY[channel]).toBeDefined();
      expect(CHANNEL_REGISTRY[channel].key).toBe(channel);
    }
  });

  it('maps recipient fields correctly', () => {
    expect(CHANNEL_REGISTRY.email.recipientField).toBe('email');
    expect(CHANNEL_REGISTRY.sms.recipientField).toBe('phone');
    expect(CHANNEL_REGISTRY.whatsapp.recipientField).toBe('phone');
    expect(CHANNEL_REGISTRY.in_app.recipientField).toBe('userId');
    expect(CHANNEL_REGISTRY.push.recipientField).toBe('userId');
  });

  it('maps suppression keys (only contact channels are suppressible)', () => {
    expect(CHANNEL_REGISTRY.email.suppressionKey).toBe('email');
    expect(CHANNEL_REGISTRY.sms.suppressionKey).toBe('sms');
    expect(CHANNEL_REGISTRY.whatsapp.suppressionKey).toBe('whatsapp');
    expect(CHANNEL_REGISTRY.in_app.suppressionKey).toBeNull();
    expect(CHANNEL_REGISTRY.push.suppressionKey).toBeNull();
  });

  it('classifies contact channels', () => {
    expect(CHANNEL_REGISTRY.email.isContactChannel).toBe(true);
    expect(CHANNEL_REGISTRY.sms.isContactChannel).toBe(true);
    expect(CHANNEL_REGISTRY.whatsapp.isContactChannel).toBe(true);
    expect(CHANNEL_REGISTRY.in_app.isContactChannel).toBe(false);
    expect(CHANNEL_REGISTRY.push.isContactChannel).toBe(false);
  });

  describe('contactResolutionChannel — preserves the OLD ternary behavior', () => {
    // The legacy code was: `channel === 'email' ? 'email' : 'sms'`.
    it('email resolves to email', () => {
      expect(contactResolutionChannel('email')).toBe('email');
    });
    it('sms resolves to sms (phone)', () => {
      expect(contactResolutionChannel('sms')).toBe('sms');
    });
    it('whatsapp resolves to sms (phone) — same contact field as SMS', () => {
      expect(contactResolutionChannel('whatsapp')).toBe('sms');
    });
  });

  it('getChannelMeta throws on an unknown channel', () => {
    expect(() => getChannelMeta('carrier-pigeon' as MessageChannel)).toThrow(/channel/i);
  });

  it('assertNever throws with context', () => {
    expect(() => assertNever('x' as never, 'channel')).toThrow(/channel/i);
  });
});
