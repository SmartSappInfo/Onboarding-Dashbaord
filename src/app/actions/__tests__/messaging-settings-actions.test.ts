import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkspaceMessagingSettingsAction,
  updateWorkspaceMessagingSettingsAction,
} from '../messaging-settings-actions';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDoc = vi.fn((_path?: string) => ({
  get: mockGet,
  set: mockSet,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    doc: (path: string) => mockDoc(path),
  },
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async (workspaceId: string) => {
    if (workspaceId === 'unauthorized') {
      throw new Error('Unauthorized');
    }
    return {
      uid: 'user_123',
      profile: {
        id: 'user_123',
        organizationId: 'org_123',
        email: 'admin@smartsapp.com',
        workspaceIds: [workspaceId],
        isAuthorized: true,
      },
      isSystemAdmin: false,
    };
  }),
}));

vi.mock('@/lib/messaging/messaging-dashboard-cache', () => ({
  dashboardSummaryCache: new Map<string, unknown>(),
}));

describe('messaging-settings-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default settings when doc does not exist (Rule 21)', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const res = await getWorkspaceMessagingSettingsAction('ws_123');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.lowBalanceThreshold).toBe(100);
      expect(res.data.channelKillSwitches.sms).toBe(false);
      expect(res.data.version).toBe(1);
    }
  });

  it('updates settings, increments version, and invalidates cache', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ version: 1, lowBalanceThreshold: 100 }),
    });
    mockSet.mockResolvedValueOnce(undefined);

    const res = await updateWorkspaceMessagingSettingsAction('ws_123', {
      lowBalanceThreshold: 200,
      quickTemplateIds: ['tpl_fee'],
      aiPromptStarters: ['Custom prompt'],
      channelKillSwitches: { sms: true, whatsapp: false, email: false },
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.version).toBe(2);
      expect(res.data.lowBalanceThreshold).toBe(200);
    }
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith('workspaces/ws_123/messaging_settings/current');
  });

  it('rejects unauthorized caller (Rule 8 & 18)', async () => {
    const res = await updateWorkspaceMessagingSettingsAction('unauthorized', {
      lowBalanceThreshold: 50,
      quickTemplateIds: ['tpl_welcome'],
      aiPromptStarters: [],
      channelKillSwitches: { sms: false, whatsapp: false, email: false },
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/unauthorized/i);
    }
  });

  it('prevents concurrency overwrite when expectedVersion mismatches (Rule 18)', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ version: 3, lowBalanceThreshold: 100 }),
    });

    const res = await updateWorkspaceMessagingSettingsAction(
      'ws_123',
      { lowBalanceThreshold: 150 },
      2 // Stale expected version
    );

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe('CONCURRENCY_CONFLICT');
    }
    expect(mockSet).not.toHaveBeenCalled();
  });
});
