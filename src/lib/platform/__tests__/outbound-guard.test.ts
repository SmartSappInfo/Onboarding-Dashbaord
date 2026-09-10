import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// src/test/setup.ts stubs this module for the rest of the suite. This file tests the real
// implementation, so opt out.
vi.unmock('@/lib/platform/outbound-guard');

const mockGet = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { collection: () => ({ doc: () => ({ get: mockGet }) }) },
}));

import {
  assertOutboundAllowed,
  isOutboundAllowed,
  OutboundBlockedError,
  __resetOutboundCache,
} from '../outbound-guard';

const ORIGINAL = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  __resetOutboundCache();
  mockGet.mockResolvedValue({ exists: false, data: () => undefined });
});
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('assertOutboundAllowed', () => {
  it('allows sending when nothing is configured, so production is unaffected', async () => {
    delete process.env.ALLOW_OUTBOUND_MESSAGING;
    await expect(assertOutboundAllowed('email')).resolves.toBeUndefined();
  });

  it('blocks when the environment floor is false', async () => {
    process.env.ALLOW_OUTBOUND_MESSAGING = 'false';
    await expect(assertOutboundAllowed('sms')).rejects.toBeInstanceOf(OutboundBlockedError);
  });

  it('ignores an operator re-enable when the environment floor is false', async () => {
    process.env.ALLOW_OUTBOUND_MESSAGING = 'false';
    mockGet.mockResolvedValue({ exists: true, data: () => ({ outboundEnabled: true }) });
    await expect(assertOutboundAllowed('sms')).rejects.toBeInstanceOf(OutboundBlockedError);
  });

  it('never reads Firestore when the environment floor blocks, so staging cannot be re-enabled', async () => {
    process.env.ALLOW_OUTBOUND_MESSAGING = 'false';
    await assertOutboundAllowed('email').catch(() => undefined);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('blocks when an operator has paused sending, and surfaces the reason', async () => {
    delete process.env.ALLOW_OUTBOUND_MESSAGING;
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ outboundEnabled: false, pausedReason: 'provider incident' }),
    });
    await expect(assertOutboundAllowed('email')).rejects.toThrow(/provider incident/);
  });

  it('allows sending if the config read fails, so Firestore cannot halt production', async () => {
    delete process.env.ALLOW_OUTBOUND_MESSAGING;
    mockGet.mockRejectedValue(new Error('unavailable'));
    await expect(assertOutboundAllowed('email')).resolves.toBeUndefined();
  });

  it('reads the config at most once across concurrent callers', async () => {
    delete process.env.ALLOW_OUTBOUND_MESSAGING;
    await Promise.all([
      assertOutboundAllowed('email'),
      assertOutboundAllowed('sms'),
      assertOutboundAllowed('push'),
      assertOutboundAllowed('whatsapp'),
    ]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('serves later calls from cache rather than re-reading', async () => {
    delete process.env.ALLOW_OUTBOUND_MESSAGING;
    await assertOutboundAllowed('email');
    await assertOutboundAllowed('email');
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});

describe('isOutboundAllowed', () => {
  it('reports state without throwing, for status displays', async () => {
    process.env.ALLOW_OUTBOUND_MESSAGING = 'false';
    await expect(isOutboundAllowed()).resolves.toBe(false);
  });
});
