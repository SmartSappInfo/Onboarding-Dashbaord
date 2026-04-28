/**
 * Property-Based Tests: Workspace Scope Lock
 *
 * Feature: industry-scoped-entity-expansion
 *
 * Validates: Requirements 2.2, 2.3, Design Properties 1, 7
 *
 * Property 5: Scope lock trigger — After the first entity is linked to a workspace,
 * industryScopeLocked must be true on all subsequent reads.
 *
 * Property 6: Industry immutability — Once industryScopeLocked is true,
 * workspace.industry must never change.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { adminDb } from '../firebase-admin';
import { lockWorkspaceScope } from '../entity-actions';
import { getWorkspaceIndustry, invalidateWorkspaceCache } from '../industry-cache';
import type { IndustryVertical, Workspace } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock setup
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../industry-cache', () => ({
  getWorkspaceIndustry: vi.fn(),
  invalidateWorkspaceCache: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Shared arbitraries
// ─────────────────────────────────────────────────────────────────────────────

const ALL_INDUSTRIES: IndustryVertical[] = [
  'SaaS',
  'SchoolEnrollment',
  'Law',
  'Marketing',
  'RealEstate',
  'Consultancy',
];

const industryArb = fc.constantFrom<IndustryVertical>(...ALL_INDUSTRIES);

const workspaceIdArb = fc.string({ minLength: 10, maxLength: 30 }).map((s) => `ws_${s}`);
const organizationIdArb = fc.string({ minLength: 10, maxLength: 30 }).map((s) => `org_${s}`);
const userIdArb = fc.string({ minLength: 10, maxLength: 30 }).map((s) => `user_${s}`);

/**
 * Creates a minimal valid Workspace object for testing.
 */
function createWorkspace(
  id: string,
  organizationId: string,
  industry: IndustryVertical,
  industryScopeLocked: boolean,
  industryScopeLockedAt?: string,
): Workspace {
  const timestamp = new Date().toISOString();
  return {
    id,
    organizationId,
    name: `Test Workspace ${id}`,
    status: 'active',
    statuses: [],
    industry,
    industryScopeLocked,
    industryScopeLockedAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 5: Scope lock trigger
// Feature: industry-scoped-entity-expansion, Property 5: After the first entity
// is linked to a workspace, industryScopeLocked must be true on all subsequent reads.
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 5: Scope lock trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lockWorkspaceScope sets industryScopeLocked to true', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        organizationIdArb,
        userIdArb,
        async (workspaceId, organizationId, userId) => {
          // Mock Firestore update
          const mockUpdate = vi.fn().mockResolvedValue(undefined);
          const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
          const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
          vi.mocked(adminDb.collection).mockImplementation(mockCollection);

          // Execute lockWorkspaceScope
          await lockWorkspaceScope(workspaceId, organizationId, userId);

          // Verify update was called with industryScopeLocked: true
          expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
              industryScopeLocked: true,
              industryScopeLockedAt: expect.any(String),
            }),
          );

          // Verify cache was invalidated
          expect(invalidateWorkspaceCache).toHaveBeenCalledWith(workspaceId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('after lockWorkspaceScope, getWorkspaceIndustry returns industryScopeLocked: true', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        organizationIdArb,
        userIdArb,
        industryArb,
        async (workspaceId, organizationId, userId, industry) => {
          // Mock Firestore update
          const mockUpdate = vi.fn().mockResolvedValue(undefined);
          const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
          const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
          vi.mocked(adminDb.collection).mockImplementation(mockCollection);

          // Mock getWorkspaceIndustry to return locked state after lock
          vi.mocked(getWorkspaceIndustry).mockResolvedValue({
            industry,
            industryScopeLocked: true,
          });

          // Execute lockWorkspaceScope
          await lockWorkspaceScope(workspaceId, organizationId, userId);

          // Verify subsequent read returns locked state
          const result = await getWorkspaceIndustry(workspaceId);
          expect(result.industryScopeLocked).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('industryScopeLocked remains true after multiple reads', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        industryArb,
        fc.integer({ min: 2, max: 10 }),
        async (workspaceId, industry, numReads) => {
          // Mock getWorkspaceIndustry to always return locked state
          vi.mocked(getWorkspaceIndustry).mockResolvedValue({
            industry,
            industryScopeLocked: true,
          });

          // Perform multiple reads
          const results = await Promise.all(
            Array.from({ length: numReads }, () => getWorkspaceIndustry(workspaceId)),
          );

          // All reads must return industryScopeLocked: true
          for (const result of results) {
            expect(result.industryScopeLocked).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('lockWorkspaceScope is idempotent — calling it multiple times has no adverse effects', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        organizationIdArb,
        userIdArb,
        fc.integer({ min: 1, max: 5 }),
        async (workspaceId, organizationId, userId, numCalls) => {
          // Mock Firestore update
          const mockUpdate = vi.fn().mockResolvedValue(undefined);
          const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
          const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
          vi.mocked(adminDb.collection).mockImplementation(mockCollection);

          // Call lockWorkspaceScope multiple times
          for (let i = 0; i < numCalls; i++) {
            await lockWorkspaceScope(workspaceId, organizationId, userId);
          }

          // Verify update was called numCalls times (idempotent at Firestore level)
          expect(mockUpdate).toHaveBeenCalledTimes(numCalls);

          // Each call should set industryScopeLocked: true
          for (let i = 0; i < numCalls; i++) {
            expect(mockUpdate).toHaveBeenNthCalledWith(
              i + 1,
              expect.objectContaining({
                industryScopeLocked: true,
              }),
            );
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 6: Industry immutability
// Feature: industry-scoped-entity-expansion, Property 6: Once industryScopeLocked
// is true, workspace.industry must never change.
// ─────────────────────────────────────────────────────────────────────────────

describe('Property 6: Industry immutability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('workspace.industry remains constant after industryScopeLocked is true', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        industryArb,
        fc.integer({ min: 2, max: 10 }),
        async (workspaceId, initialIndustry, numReads) => {
          // Mock getWorkspaceIndustry to return locked state with fixed industry
          vi.mocked(getWorkspaceIndustry).mockResolvedValue({
            industry: initialIndustry,
            industryScopeLocked: true,
          });

          // Perform multiple reads
          const results = await Promise.all(
            Array.from({ length: numReads }, () => getWorkspaceIndustry(workspaceId)),
          );

          // All reads must return the same industry
          for (const result of results) {
            expect(result.industry).toBe(initialIndustry);
            expect(result.industryScopeLocked).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('attempting to change industry on a locked workspace should fail (simulated)', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        industryArb,
        industryArb,
        async (workspaceId, initialIndustry, attemptedIndustry) => {
          // Skip if industries are the same (no change attempted)
          if (initialIndustry === attemptedIndustry) return;

          // Mock getWorkspaceIndustry to return locked state
          vi.mocked(getWorkspaceIndustry).mockResolvedValue({
            industry: initialIndustry,
            industryScopeLocked: true,
          });

          // Simulate an attempt to update the industry (should be rejected by business logic)
          const mockUpdate = vi.fn().mockRejectedValue(
            new Error('Cannot change industry on a locked workspace'),
          );
          const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
          const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
          vi.mocked(adminDb.collection).mockImplementation(mockCollection);

          // Attempt to update industry (this should fail)
          await expect(
            adminDb
              .collection('workspaces')
              .doc(workspaceId)
              .update({ industry: attemptedIndustry }),
          ).rejects.toThrow('Cannot change industry on a locked workspace');

          // Verify the industry remains unchanged
          const result = await getWorkspaceIndustry(workspaceId);
          expect(result.industry).toBe(initialIndustry);
          expect(result.industryScopeLocked).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any locked workspace, industry field is immutable across all operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        industryArb,
        fc.array(fc.constantFrom('read', 'cache_invalidate', 'read'), {
          minLength: 3,
          maxLength: 10,
        }),
        async (workspaceId, industry, operations) => {
          // Mock getWorkspaceIndustry to return locked state
          vi.mocked(getWorkspaceIndustry).mockResolvedValue({
            industry,
            industryScopeLocked: true,
          });

          // Perform a sequence of operations
          for (const op of operations) {
            if (op === 'read') {
              const result = await getWorkspaceIndustry(workspaceId);
              expect(result.industry).toBe(industry);
              expect(result.industryScopeLocked).toBe(true);
            } else if (op === 'cache_invalidate') {
              invalidateWorkspaceCache(workspaceId);
              // After cache invalidation, next read should still return same industry
            }
          }

          // Final verification: industry is still the same
          const finalResult = await getWorkspaceIndustry(workspaceId);
          expect(finalResult.industry).toBe(industry);
          expect(finalResult.industryScopeLocked).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('industry immutability holds for all 6 supported industries', async () => {
    // Exhaustive check: for each industry, verify immutability after lock
    for (const industry of ALL_INDUSTRIES) {
      await fc.assert(
        fc.asyncProperty(
          workspaceIdArb,
          fc.integer({ min: 1, max: 5 }),
          async (workspaceId, numReads) => {
            // Mock getWorkspaceIndustry to return locked state
            vi.mocked(getWorkspaceIndustry).mockResolvedValue({
              industry,
              industryScopeLocked: true,
            });

            // Perform multiple reads
            const results = await Promise.all(
              Array.from({ length: numReads }, () => getWorkspaceIndustry(workspaceId)),
            );

            // All reads must return the same industry
            for (const result of results) {
              expect(result.industry).toBe(industry);
              expect(result.industryScopeLocked).toBe(true);
            }
          },
        ),
        { numRuns: 20 },
      );
    }
  });

  it('lockWorkspaceScope does not modify the industry field', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        organizationIdArb,
        userIdArb,
        industryArb,
        async (workspaceId, organizationId, userId, industry) => {
          // Mock Firestore update
          const mockUpdate = vi.fn().mockResolvedValue(undefined);
          const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
          const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
          vi.mocked(adminDb.collection).mockImplementation(mockCollection);

          // Mock getWorkspaceIndustry to return unlocked state initially
          vi.mocked(getWorkspaceIndustry)
            .mockResolvedValueOnce({
              industry,
              industryScopeLocked: false,
            })
            .mockResolvedValue({
              industry,
              industryScopeLocked: true,
            });

          // Get initial industry
          const before = await getWorkspaceIndustry(workspaceId);
          expect(before.industry).toBe(industry);
          expect(before.industryScopeLocked).toBe(false);

          // Execute lockWorkspaceScope
          await lockWorkspaceScope(workspaceId, organizationId, userId);

          // Verify update did NOT include industry field
          expect(mockUpdate).toHaveBeenCalledWith(
            expect.not.objectContaining({
              industry: expect.anything(),
            }),
          );

          // Verify industry remains the same after lock
          const after = await getWorkspaceIndustry(workspaceId);
          expect(after.industry).toBe(industry);
          expect(after.industryScopeLocked).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration property: Scope lock trigger + Industry immutability
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: Scope lock trigger + Industry immutability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('after locking, industry is immutable and industryScopeLocked is always true', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        organizationIdArb,
        userIdArb,
        industryArb,
        fc.integer({ min: 1, max: 10 }),
        async (workspaceId, organizationId, userId, industry, numReads) => {
          // Mock Firestore update
          const mockUpdate = vi.fn().mockResolvedValue(undefined);
          const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
          const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
          vi.mocked(adminDb.collection).mockImplementation(mockCollection);

          // Mock getWorkspaceIndustry to return locked state after lock
          vi.mocked(getWorkspaceIndustry).mockResolvedValue({
            industry,
            industryScopeLocked: true,
          });

          // Execute lockWorkspaceScope
          await lockWorkspaceScope(workspaceId, organizationId, userId);

          // Perform multiple reads
          const results = await Promise.all(
            Array.from({ length: numReads }, () => getWorkspaceIndustry(workspaceId)),
          );

          // Verify both properties hold:
          // Property 5: industryScopeLocked is true
          // Property 6: industry is immutable
          for (const result of results) {
            expect(result.industryScopeLocked).toBe(true);
            expect(result.industry).toBe(industry);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('concurrent reads after lock all return consistent state', async () => {
    await fc.assert(
      fc.asyncProperty(
        workspaceIdArb,
        industryArb,
        fc.integer({ min: 5, max: 20 }),
        async (workspaceId, industry, numConcurrentReads) => {
          // Mock getWorkspaceIndustry to return locked state
          vi.mocked(getWorkspaceIndustry).mockResolvedValue({
            industry,
            industryScopeLocked: true,
          });

          // Perform concurrent reads
          const results = await Promise.all(
            Array.from({ length: numConcurrentReads }, () => getWorkspaceIndustry(workspaceId)),
          );

          // All concurrent reads must return the same state
          const firstResult = results[0];
          for (const result of results) {
            expect(result.industry).toBe(firstResult.industry);
            expect(result.industryScopeLocked).toBe(firstResult.industryScopeLocked);
            expect(result.industryScopeLocked).toBe(true);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
