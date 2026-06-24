// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearStageDealsAction } from '../deal-actions';

// Setup captures
let deletedRefs: string[] = [];
let loggedActivity: Record<string, unknown> | null = null;
let permissionGranted = true;

// Mock canUser
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockImplementation(async () => {
    return { granted: permissionGranted, reason: permissionGranted ? undefined : 'Access Denied' };
  }),
}));

// Mock activity logger
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockImplementation(async (activity: Record<string, unknown>) => {
    loggedActivity = activity;
  }),
}));

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      batch: vi.fn(() => ({
        delete: vi.fn((ref: { id: string }) => {
          deletedRefs.push(ref.id);
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      })),
      collection: vi.fn((name: string) => {
        if (name === 'workspaces') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ organizationId: 'org-1' }),
              }),
            })),
          };
        }
        if (name === 'onboardingStages') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ name: 'Discovery Stage' }),
              }),
            })),
          };
        }
        if (name === 'deals') {
          return {
            where: vi.fn((field1: string, op1: string, val1: string) => {
              return {
                where: vi.fn((field2: string, op2: string, val2: string) => {
                  return {
                    get: vi.fn().mockImplementation(async () => {
                      if (val1 === 'stage-with-deals') {
                        return {
                          empty: false,
                          docs: [
                            { ref: { id: 'deal-1' } },
                            { ref: { id: 'deal-2' } }
                          ],
                        };
                      }
                      return { empty: true, docs: [] };
                    }),
                  };
                }),
              };
            }),
          };
        }
        return {};
      }),
    },
  };
});

describe('clearStageDealsAction', () => {
  beforeEach(() => {
    deletedRefs = [];
    loggedActivity = null;
    permissionGranted = true;
    vi.clearAllMocks();
  });

  it('fails if permission is denied', async () => {
    permissionGranted = false;
    const result = await clearStageDealsAction('stage-with-deals', 'ws-1', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access Denied');
    expect(deletedRefs.length).toBe(0);
  });

  it('returns count 0 if no deals exist in the stage', async () => {
    const result = await clearStageDealsAction('stage-empty', 'ws-1', 'user-1');
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(deletedRefs.length).toBe(0);
  });

  it('successfully batch deletes deals in the stage and logs activity', async () => {
    const result = await clearStageDealsAction('stage-with-deals', 'ws-1', 'user-1');
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(deletedRefs).toContain('deal-1');
    expect(deletedRefs).toContain('deal-2');
    expect(deletedRefs.length).toBe(2);

    expect(loggedActivity).not.toBeNull();
    expect(loggedActivity?.type).toBe('deals_cleared');
    expect(loggedActivity?.organizationId).toBe('org-1');
    expect(loggedActivity?.workspaceId).toBe('ws-1');
  });
});
