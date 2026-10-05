import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkspaceVisibility } from '@/hooks/use-workspace-visibility';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';

vi.mock('@/context/TenantContext', () => ({
  useTenant: vi.fn(),
}));

vi.mock('@/firebase', () => ({
  useUser: vi.fn(),
}));

describe('useWorkspaceVisibility', () => {
  it('returns fail-closed restricted state when workspace settings are not explicitly false', () => {
    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: {
        id: 'ws_1',
        name: 'Workspace 1',
        // No explicit visibility flags set -> fail-closed true
      },
      isWorkspaceAdmin: false,
      currentUserProfile: undefined,
    } as unknown as ReturnType<typeof useTenant>);

    vi.mocked(useUser).mockReturnValue({
      user: { uid: 'usr_1', email: 'user@example.com' },
    } as unknown as ReturnType<typeof useUser>);

    const { result } = renderHook(() => useWorkspaceVisibility());

    expect(result.current.restrictEntitiesToAssigned).toBe(true);
    expect(result.current.restrictDealsToAssigned).toBe(true);
    expect(result.current.restrictTasksToAssigned).toBe(true);
    expect(result.current.isWorkspaceAdmin).toBe(false);

    // Entity checks
    expect(result.current.canViewEntity({ assignedTo: { userId: 'usr_1', name: null, email: null } })).toBe(true);
    expect(result.current.canViewEntity({ assignedTo: { userId: 'other_user', name: null, email: null } })).toBe(false);
    expect(result.current.canViewEntity({ createdBy: 'usr_1' })).toBe(true);

    // Deal checks
    expect(result.current.canViewDeal({ assignedTo: { userId: 'usr_1', name: null, email: null } })).toBe(true);
    expect(result.current.canViewDeal({ createdBy: 'usr_1' })).toBe(true);
    expect(result.current.canViewDeal({ assignedTo: { userId: 'other_user', name: null, email: null } })).toBe(false);

    // Task checks
    expect(result.current.canViewTask({ assignedTo: 'usr_1' })).toBe(true);
    expect(result.current.canViewTask({ assignedTo: 'user@example.com' })).toBe(true);
    expect(result.current.canViewTask({ createdBy: 'usr_1' })).toBe(true);
    expect(result.current.canViewTask({ assignedTo: 'other_user' })).toBe(false);
  });

  it('bypasses restrictions when isWorkspaceAdmin is true', () => {
    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: {
        id: 'ws_1',
        name: 'Workspace 1',
        restrictVisibilityToAssigned: true,
        restrictDealsVisibilityToAssigned: true,
        restrictTasksVisibilityToAssigned: true,
      },
      isWorkspaceAdmin: true,
      currentUserProfile: { role: 'admin' },
    } as unknown as ReturnType<typeof useTenant>);

    vi.mocked(useUser).mockReturnValue({
      user: { uid: 'usr_admin', email: 'admin@example.com' },
    } as unknown as ReturnType<typeof useUser>);

    const { result } = renderHook(() => useWorkspaceVisibility());

    expect(result.current.isWorkspaceAdmin).toBe(true);
    expect(result.current.canViewEntity({ assignedTo: { userId: 'anyone', name: null, email: null } })).toBe(true);
    expect(result.current.canViewDeal({ assignedTo: { userId: 'anyone', name: null, email: null } })).toBe(true);
    expect(result.current.canViewTask({ assignedTo: 'anyone' })).toBe(true);
  });
});
