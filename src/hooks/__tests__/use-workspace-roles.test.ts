import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWorkspaceRoles, useRoleLookup } from '../use-workspace-roles';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Role } from '@/lib/types';

vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(),
  useCollection: vi.fn(),
  useMemoFirebase: vi.fn((factory) => factory()),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ path: name })),
  query: vi.fn((col, ...clauses) => ({ col, clauses })),
  where: vi.fn((field, op, val) => ({ field, op, val })),
  orderBy: vi.fn((field, dir) => ({ field, dir })),
}));

describe('useRoleLookup', () => {
  it('returns empty map when passed null or undefined', () => {
    const { result: r1 } = renderHook(() => useRoleLookup(null));
    expect(r1.current.size).toBe(0);

    const { result: r2 } = renderHook(() => useRoleLookup(undefined));
    expect(r2.current.size).toBe(0);
  });

  it('builds an indexed Map from an array of Role entities', () => {
    const mockRoles: Role[] = [
      {
        id: 'role-1',
        name: 'Administrator',
        description: 'Super user',
        organizationId: 'org-1',
        workspaceIds: ['ws-1'],
        permissions: [],
        color: '#ff0000',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'role-2',
        name: 'Finance Officer',
        description: 'Handles billing',
        organizationId: 'org-1',
        workspaceIds: ['ws-1'],
        permissions: [],
        color: '#00ff00',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const { result } = renderHook(() => useRoleLookup(mockRoles));
    expect(result.current.size).toBe(2);
    expect(result.current.get('role-1')?.name).toBe('Administrator');
    expect(result.current.get('role-2')?.name).toBe('Finance Officer');
  });
});

describe('useWorkspaceRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty roleMap and does not query when organizationId is falsy', () => {
    vi.mocked(useFirestore).mockReturnValue({} as ReturnType<typeof useFirestore>);
    vi.mocked(useCollection).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCollection<Role>>);

    const { result } = renderHook(() => useWorkspaceRoles(null));

    expect(result.current.roles).toBeNull();
    expect(result.current.roleMap.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('queries roles collection for the given organization and indexes result in roleMap', () => {
    const mockFirestore = {} as ReturnType<typeof useFirestore>;
    const mockRoles: Role[] = [
      {
        id: 'aP8rWeyeU2uYleUj4VjX',
        name: 'Operations Specialist',
        description: 'Traffic operations',
        organizationId: 'org-123',
        workspaceIds: ['ws-1'],
        permissions: [],
        color: '#2563eb',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    vi.mocked(useFirestore).mockReturnValue(mockFirestore);
    vi.mocked(useCollection).mockReturnValue({
      data: mockRoles,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCollection<Role>>);

    const { result } = renderHook(() => useWorkspaceRoles('org-123'));

    expect(result.current.roles).toHaveLength(1);
    expect(result.current.roleMap.size).toBe(1);
    expect(result.current.roleMap.get('aP8rWeyeU2uYleUj4VjX')?.name).toBe('Operations Specialist');
  });
});
