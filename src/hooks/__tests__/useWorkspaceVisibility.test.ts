import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkspaceVisibility } from '../use-workspace-visibility';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';

// Mock dependencies
vi.mock('@/context/TenantContext', () => ({
  useTenant: vi.fn(),
}));

vi.mock('@/firebase', () => ({
  useUser: vi.fn(),
}));

describe('useWorkspaceVisibility', () => {
  const mockUser = { uid: 'user_123' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({ user: mockUser } as any);
  });

  it('restricts standard users by default (restrictVisibilityToAssigned is undefined)', () => {
    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: { id: 'ws_1' }, // restrictVisibilityToAssigned is omitted (undefined)
      isSuperAdmin: false,
    } as any);

    const { result } = renderHook(() => useWorkspaceVisibility());

    expect(result.current.restrictToAssigned).toBe(true);
    expect(result.current.currentUserUid).toBe('user_123');

    // Assigned to current user
    const assignedEntity = {
      id: 'entity_1',
      assignedTo: { userId: 'user_123', name: 'Test User', email: 'test@example.com' },
    } as any;
    expect(result.current.canViewEntity(assignedEntity)).toBe(true);

    // Assigned to someone else
    const otherEntity = {
      id: 'entity_2',
      assignedTo: { userId: 'user_456', name: 'Other User', email: 'other@example.com' },
    } as any;
    expect(result.current.canViewEntity(otherEntity)).toBe(false);

    // Unassigned entity
    const unassignedEntity = {
      id: 'entity_3',
      assignedTo: null,
    } as any;
    expect(result.current.canViewEntity(unassignedEntity)).toBe(false);

    // Null entity
    expect(result.current.canViewEntity(null)).toBe(false);
  });

  it('restricts standard users when restrictVisibilityToAssigned is true', () => {
    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: { id: 'ws_1', restrictVisibilityToAssigned: true },
      isSuperAdmin: false,
    } as any);

    const { result } = renderHook(() => useWorkspaceVisibility());

    expect(result.current.restrictToAssigned).toBe(true);

    // Assigned to current user
    const assignedEntity = {
      id: 'entity_1',
      assignedTo: { userId: 'user_123', name: 'Test User', email: 'test@example.com' },
    } as any;
    expect(result.current.canViewEntity(assignedEntity)).toBe(true);

    // Assigned to someone else
    const otherEntity = {
      id: 'entity_2',
      assignedTo: { userId: 'user_456', name: 'Other User', email: 'other@example.com' },
    } as any;
    expect(result.current.canViewEntity(otherEntity)).toBe(false);
  });

  it('does NOT restrict standard users when restrictVisibilityToAssigned is false', () => {
    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: { id: 'ws_1', restrictVisibilityToAssigned: false },
      isSuperAdmin: false,
    } as any);

    const { result } = renderHook(() => useWorkspaceVisibility());

    expect(result.current.restrictToAssigned).toBe(false);

    // Any entity should be viewable
    const otherEntity = {
      id: 'entity_2',
      assignedTo: { userId: 'user_456', name: 'Other User', email: 'other@example.com' },
    } as any;
    expect(result.current.canViewEntity(otherEntity)).toBe(true);

    const unassignedEntity = {
      id: 'entity_3',
      assignedTo: null,
    } as any;
    expect(result.current.canViewEntity(unassignedEntity)).toBe(true);
  });

  it('does NOT restrict Super Admins even when restrictVisibilityToAssigned is true', () => {
    vi.mocked(useTenant).mockReturnValue({
      activeWorkspace: { id: 'ws_1', restrictVisibilityToAssigned: true },
      isSuperAdmin: true,
    } as any);

    const { result } = renderHook(() => useWorkspaceVisibility());

    expect(result.current.restrictToAssigned).toBe(false);

    // Any entity should be viewable
    const otherEntity = {
      id: 'entity_2',
      assignedTo: { userId: 'user_456', name: 'Other User', email: 'other@example.com' },
    } as any;
    expect(result.current.canViewEntity(otherEntity)).toBe(true);
  });
});
