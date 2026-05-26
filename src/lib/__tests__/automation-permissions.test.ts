import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertAutomationManagePermission } from '../automation-permissions';

const mockCanUser = vi.fn();

vi.mock('../workspace-permissions', () => ({
  canUser: (...args: unknown[]) => mockCanUser(...args),
}));

describe('assertAutomationManagePermission', () => {
  beforeEach(() => {
    mockCanUser.mockReset();
  });

  it('grants when user has edit on one workspace', async () => {
    mockCanUser
      .mockResolvedValueOnce({ granted: false })
      .mockResolvedValueOnce({ granted: true });

    await expect(
      assertAutomationManagePermission('user-1', ['ws-a', 'ws-b'], 'edit')
    ).resolves.toBeUndefined();

    expect(mockCanUser).toHaveBeenCalledWith('user-1', 'operations', 'automations', 'edit', 'ws-b');
  });

  it('throws when no workspace grants permission', async () => {
    mockCanUser.mockResolvedValue({ granted: false, reason: 'denied' });

    await expect(
      assertAutomationManagePermission('user-1', ['ws-a'], 'delete')
    ).rejects.toThrow(/permission/i);
  });
});
