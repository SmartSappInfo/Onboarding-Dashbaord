/**
 * Every provider boundary must refuse to send when the kill switch is engaged.
 *
 * These are deliberately integration-flavoured: they import the real service modules and
 * assert they throw BEFORE any network call. If someone adds a new send path, the right
 * fix is to guard it and add a case here — not to relax these.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// src/test/setup.ts stubs the guard so ordinary messaging suites are unaffected by the
// extra config read. This file is testing the guard itself, so opt out.
vi.unmock('@/lib/platform/outbound-guard');

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: vi.fn().mockResolvedValue({ exists: false }) }) }),
  },
}));

// Fail loudly if anything reaches the network despite the guard.
const fetchSpy = vi.fn(() => {
  throw new Error('network call escaped the kill switch');
});
vi.stubGlobal('fetch', fetchSpy);

const ORIGINAL = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ALLOW_OUTBOUND_MESSAGING = 'false';
});
afterEach(() => { process.env = { ...ORIGINAL }; });

describe('provider boundaries respect the kill switch', () => {
  it('blocks email', async () => {
    const { sendEmail } = await import('@/lib/resend-service');
    await expect(
      sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' }),
    ).rejects.toThrow(/disabled/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks batch email', async () => {
    const { sendBatchEmails } = await import('@/lib/resend-service');
    await expect(
      sendBatchEmails([{ to: 'a@b.com', subject: 's', html: '<p>x</p>' }]),
    ).rejects.toThrow(/disabled/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks sms', async () => {
    const { sendSms } = await import('@/lib/mnotify-service');
    await expect(
      sendSms({ recipient: '+233000000000', message: 'm', sender: 'Sender' }),
    ).rejects.toThrow(/disabled/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks push, and does so before the missing-credentials early return', async () => {
    const { sendPushNotification } = await import('@/lib/onesignal-service');
    await expect(
      sendPushNotification(['user-1'], 'title', 'message'),
    ).rejects.toThrow(/disabled/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
