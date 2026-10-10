import { describe, it, expect } from 'vitest';
import {
  getAssignedUserStorageKey,
  resolveInitialAssignedUser,
} from '@/context/GlobalFilterProvider';

describe('Assigned User Preference Resolution & Governance', () => {
  const CURRENT_USER_ID = 'usr_beatrice_123';
  const OTHER_USER_ID = 'usr_sarah_456';
  const WORKSPACE_ID = 'ws_campus_hq';

  it('generates a workspace- and user-scoped storage key', () => {
    const key = getAssignedUserStorageKey(WORKSPACE_ID, CURRENT_USER_ID);
    expect(key).toBe(`crm_assigned_pref_${WORKSPACE_ID}_${CURRENT_USER_ID}`);
  });

  it('falls back to global key if workspaceId or userId is missing', () => {
    expect(getAssignedUserStorageKey(undefined, CURRENT_USER_ID)).toBe('globalAssignedUserId');
    expect(getAssignedUserStorageKey(WORKSPACE_ID, undefined)).toBe('globalAssignedUserId');
  });

  it('defaults to current logged-in user on initial load when no preference is saved', () => {
    const result = resolveInitialAssignedUser({
      urlParam: null,
      storedValue: null,
      isRestricted: false,
      currentUserId: CURRENT_USER_ID,
    });
    expect(result).toBe(CURRENT_USER_ID);
  });

  it('restores "All Contacts" (null) when user previously chose "all"', () => {
    const result = resolveInitialAssignedUser({
      urlParam: null,
      storedValue: 'all',
      isRestricted: false,
      currentUserId: CURRENT_USER_ID,
    });
    expect(result).toBeNull();
  });

  it('restores "unassigned" when user previously chose "unassigned"', () => {
    const result = resolveInitialAssignedUser({
      urlParam: null,
      storedValue: 'unassigned',
      isRestricted: false,
      currentUserId: CURRENT_USER_ID,
    });
    expect(result).toBe('unassigned');
  });

  it('restores specific team member when user previously chose that member', () => {
    const result = resolveInitialAssignedUser({
      urlParam: null,
      storedValue: OTHER_USER_ID,
      isRestricted: false,
      currentUserId: CURRENT_USER_ID,
    });
    expect(result).toBe(OTHER_USER_ID);
  });

  it('honors URL param ?assignedTo when present, taking precedence over localStorage', () => {
    const result = resolveInitialAssignedUser({
      urlParam: OTHER_USER_ID,
      storedValue: 'all',
      isRestricted: false,
      currentUserId: CURRENT_USER_ID,
    });
    expect(result).toBe(OTHER_USER_ID);
  });

  it('strictly enforces currentUserId when workspace isRestricted is true, ignoring "all" preference', () => {
    const result = resolveInitialAssignedUser({
      urlParam: 'all',
      storedValue: 'all',
      isRestricted: true, // Workspace governance lock
      currentUserId: CURRENT_USER_ID,
    });
    expect(result).toBe(CURRENT_USER_ID);
  });
});
