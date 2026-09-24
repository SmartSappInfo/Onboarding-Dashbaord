import { describe, it, expect, vi } from 'vitest';
import { CommunityService } from '../community-service';
import type { CommunitySpace } from '@/lib/types/community';

describe('CommunityService', () => {
  describe('Slug Sanitization', () => {
    it('sanitizes community space names into clean slugs', () => {
      expect(CommunityService.sanitizeSlug('Wins & Celebrations 🎉')).toBe('wins-celebrations');
      expect(CommunityService.sanitizeSlug('Tuition & Fee Q&A!')).toBe('tuition-fee-qa');
      expect(CommunityService.sanitizeSlug('   VIP Mastermind & Leadership   ')).toBe(
        'vip-mastermind-leadership'
      );
    });

    it('sanitizes discussion post titles accurately', () => {
      expect(
        CommunityService.sanitizeSlug(
          'What payment channel do your school parents prefer most in 2026?'
        )
      ).toBe('what-payment-channel-do-your-school-parents-prefer-most-in-2026');
    });
  });

  describe('Space Entitlement Checks (isUserEntitledToSpace)', () => {
    const baseSpace: CommunitySpace = {
      id: 'space_1',
      organizationId: 'org_1',
      portalId: 'portal_1',
      workspaceIds: ['ws_1'],
      name: 'General Discussion',
      slug: 'general',
      visibility: 'members_only',
      order: 1,
      postCount: 5,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };

    it('allows access to public and members_only spaces', () => {
      expect(CommunityService.isUserEntitledToSpace(baseSpace, [])).toBe(true);
      expect(
        CommunityService.isUserEntitledToSpace({ ...baseSpace, visibility: 'public' }, [])
      ).toBe(true);
    });

    it('allows administrators and owners to access any space unconditionally', () => {
      const gatedSpace: CommunitySpace = {
        ...baseSpace,
        visibility: 'plan_gated',
        allowedPlanIds: ['plan_vip'],
      };
      expect(CommunityService.isUserEntitledToSpace(gatedSpace, [], 'admin')).toBe(true);
      expect(CommunityService.isUserEntitledToSpace(gatedSpace, [], 'owner')).toBe(true);
    });

    it('denies access to plan_gated spaces if user lacks an entitled plan', () => {
      const gatedSpace: CommunitySpace = {
        ...baseSpace,
        visibility: 'plan_gated',
        allowedPlanIds: ['plan_vip', 'plan_pro'],
      };
      expect(CommunityService.isUserEntitledToSpace(gatedSpace, ['plan_free'])).toBe(false);
      expect(CommunityService.isUserEntitledToSpace(gatedSpace, [])).toBe(false);
    });

    it('grants access to plan_gated spaces when user has an entitled plan', () => {
      const gatedSpace: CommunitySpace = {
        ...baseSpace,
        visibility: 'plan_gated',
        allowedPlanIds: ['plan_vip', 'plan_pro'],
      };
      expect(CommunityService.isUserEntitledToSpace(gatedSpace, ['plan_starter', 'plan_pro'])).toBe(
        true
      );
      expect(CommunityService.isUserEntitledToSpace(gatedSpace, ['plan_vip'])).toBe(true);
    });

    it('permits access to plan_gated space if allowedPlanIds is empty (fallback)', () => {
      const emptyGatedSpace: CommunitySpace = {
        ...baseSpace,
        visibility: 'plan_gated',
        allowedPlanIds: [],
      };
      expect(CommunityService.isUserEntitledToSpace(emptyGatedSpace, [])).toBe(true);
    });
  });

  describe('Chunked Batch Deletion', () => {
    it('executes in safe chunks without exceeding Firestore limits', async () => {
      // Create mock doc refs
      const mockCommit = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn();
      const mockBatch = {
        delete: mockDelete,
        commit: mockCommit,
      };

      // Mock adminDb
      const { adminDb } = await import('@/lib/firebase-admin');
      const originalBatch = adminDb.batch;
      adminDb.batch = vi.fn().mockReturnValue(mockBatch) as unknown as typeof adminDb.batch;

      const fakeRefs = Array.from({ length: 950 }, (_, i) => ({
        id: `ref_${i}`,
      })) as unknown as Array<FirebaseFirestore.DocumentReference>;

      await CommunityService.chunkedBatchDelete(fakeRefs);

      // 950 items in chunks of 450 = 3 chunks (450, 450, 50)
      expect(mockCommit).toHaveBeenCalledTimes(3);
      expect(mockDelete).toHaveBeenCalledTimes(950);

      // Restore
      adminDb.batch = originalBatch;
    });
  });
});
