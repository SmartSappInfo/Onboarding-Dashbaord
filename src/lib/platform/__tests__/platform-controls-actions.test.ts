/**
 * Stage E / Task E1 — operator controls for outbound messaging.
 *
 * These tests pin the two properties that make the control safe to expose in a UI:
 *   1. authorization happens BEFORE any write (a denied caller writes nothing), and
 *   2. the identity recorded in the document comes from the verified session, never from
 *      an argument the caller controls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSet = vi.fn();
const mockGet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { collection: () => ({ doc: () => ({ get: mockGet, set: mockSet }) }) },
}));

vi.mock('@/lib/backoffice/backoffice-auth', () => ({
  authorizeBackofficeSession: vi.fn(async () => ({
    userId: 'u1',
    name: 'Ops',
    email: 'o@e.com',
    role: 'super_admin' as const,
  })),
}));

vi.mock('@/lib/backoffice/audit-logger', () => ({
  logBackofficeAction: vi.fn(async () => undefined),
}));

import {
  getPlatformControlsAction,
  setOutboundPausedAction,
} from '../platform-controls-actions';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import { logBackofficeAction } from '@/lib/backoffice/audit-logger';

const mockedAuthorize = vi.mocked(authorizeBackofficeSession);

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ exists: false });
  mockSet.mockResolvedValue(undefined);
  mockedAuthorize.mockResolvedValue({
    userId: 'u1',
    name: 'Ops',
    email: 'o@e.com',
    role: 'super_admin',
  });
  delete process.env.ALLOW_OUTBOUND_MESSAGING;
});

describe('setOutboundPausedAction', () => {
  it('requires settings:edit (super_admin only)', async () => {
    await setOutboundPausedAction(true, 'incident');
    expect(mockedAuthorize).toHaveBeenCalledWith('settings', 'edit');
  });

  it('records who paused it, from the session and not the caller', async () => {
    await setOutboundPausedAction(true, 'incident');
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        outboundEnabled: false,
        pausedReason: 'incident',
        updatedBy: 'u1',
        updatedByName: 'Ops',
      }),
      { merge: true },
    );
  });

  it('clears the reason when sending is resumed', async () => {
    await setOutboundPausedAction(false, 'back to normal');
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ outboundEnabled: true, pausedReason: '' }),
      { merge: true },
    );
  });

  it('caps the reason so the document cannot be used as storage', async () => {
    await setOutboundPausedAction(true, 'x'.repeat(500));
    const written = mockSet.mock.calls[0][0] as { pausedReason: string };
    expect(written.pausedReason.length).toBeLessThanOrEqual(200);
  });

  it('refuses when the caller is not authorised, and writes nothing', async () => {
    mockedAuthorize.mockRejectedValueOnce(new Error('Forbidden: settings:edit'));
    await expect(setOutboundPausedAction(true, 'x')).rejects.toThrow('Forbidden');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('writes an audit entry naming the actor', async () => {
    await setOutboundPausedAction(true, 'incident');
    expect(logBackofficeAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' }),
      'paused_outbound_messaging',
      'platform_config',
      'messaging_controls',
      expect.objectContaining({ scope: 'platform' }),
    );
  });

  it('reports a write failure as a plain sentence, not a stack trace', async () => {
    mockSet.mockRejectedValueOnce(new Error('firestore exploded at line 42'));
    const res = await setOutboundPausedAction(true, 'incident');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error).not.toContain('firestore exploded');
  });
});

describe('getPlatformControlsAction', () => {
  it('requires settings:view', async () => {
    await getPlatformControlsAction();
    expect(mockedAuthorize).toHaveBeenCalledWith('settings', 'view');
  });

  it('reports sending as on when no control document exists yet', async () => {
    const view = await getPlatformControlsAction();
    expect(view.outboundEnabled).toBe(true);
    expect(view.envFloorAllows).toBe(true);
  });

  it('surfaces the environment floor separately from the operator switch', async () => {
    process.env.ALLOW_OUTBOUND_MESSAGING = 'false';
    const view = await getPlatformControlsAction();
    expect(view.envFloorAllows).toBe(false);
    // The operator switch is still "on"; the floor is what is blocking. The UI needs both
    // to explain why sending is off without lying about which control did it.
    expect(view.outboundEnabled).toBe(true);
  });

  it('reads the paused state and who set it', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        outboundEnabled: false,
        pausedReason: 'provider incident',
        updatedByName: 'Ops',
        updatedAt: '2026-09-12T00:00:00.000Z',
      }),
    });
    const view = await getPlatformControlsAction();
    expect(view.outboundEnabled).toBe(false);
    expect(view.pausedReason).toBe('provider incident');
    expect(view.updatedByName).toBe('Ops');
  });
});
