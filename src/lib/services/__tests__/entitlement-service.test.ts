import { describe, it, expect } from 'vitest';
import { EntitlementService } from '../entitlement-service';
import type { AccessGrant, EntitlementCheckResult } from '@/lib/types/membership';
import type { ContentItem } from '@/lib/types/content';
import type { PageBlock } from '@/lib/types';

describe('EntitlementService', () => {
  describe('Grant Validity Checks', () => {
    it('returns true for grants without an expiration timestamp (lifetime)', () => {
      const grant: AccessGrant = {
        id: 'grant-1',
        organizationId: 'org-1',
        portalId: 'portal-1',
        membershipId: 'mem-1',
        userId: 'user-1',
        grantType: 'manual_admin_grant',
        resourceType: 'course',
        resourceId: 'course-101',
        grantedAt: new Date().toISOString(),
        grantedBy: 'admin',
        createdAt: new Date().toISOString(),
      };

      expect(EntitlementService.isGrantValid(grant)).toBe(true);
    });

    it('returns true for future expiration timestamps', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const grant: AccessGrant = {
        id: 'grant-2',
        organizationId: 'org-1',
        portalId: 'portal-1',
        membershipId: 'mem-1',
        userId: 'user-1',
        grantType: 'membership_plan',
        resourceType: 'course',
        resourceId: 'course-102',
        grantedAt: new Date().toISOString(),
        expiresAt: futureDate.toISOString(),
        grantedBy: 'admin',
        createdAt: new Date().toISOString(),
      };

      expect(EntitlementService.isGrantValid(grant)).toBe(true);
    });

    it('returns false for past expiration timestamps', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const grant: AccessGrant = {
        id: 'grant-3',
        organizationId: 'org-1',
        portalId: 'portal-1',
        membershipId: 'mem-1',
        userId: 'user-1',
        grantType: 'membership_plan',
        resourceType: 'course',
        resourceId: 'course-103',
        grantedAt: new Date().toISOString(),
        expiresAt: pastDate.toISOString(),
        grantedBy: 'admin',
        createdAt: new Date().toISOString(),
      };

      expect(EntitlementService.isGrantValid(grant)).toBe(false);
    });
  });

  describe('Admin Bypass Evaluation', () => {
    it('returns hasAccess: true and reason: admin_bypass when isOrgAdmin is true', async () => {
      const result = await EntitlementService.evaluateEntitlement(
        'portal-1',
        'admin-user',
        'course',
        'protected-course-id',
        true // isOrgAdmin
      );

      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('admin_bypass');
    });

    it('returns hasAccess: false and reason: no_entitlement for unauthenticated visitors', async () => {
      const result = await EntitlementService.evaluateEntitlement(
        'portal-1',
        null, // visitor
        'course',
        'protected-course-id',
        false
      );

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('no_entitlement');
    });
  });

  describe('Content Item Access Evaluation', () => {
    const publicItem: ContentItem = {
      id: 'content-public',
      organizationId: 'org-1',
      portalId: 'portal-1',
      workspaceIds: ['ws-1'],
      type: 'article',
      title: 'Public Guide',
      slug: 'public-guide',
      status: 'published',
      visibility: 'public',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'author',
    };

    const membersOnlyItem: ContentItem = {
      id: 'content-members',
      organizationId: 'org-1',
      portalId: 'portal-1',
      workspaceIds: ['ws-1'],
      type: 'article',
      title: 'Member Playbook',
      slug: 'member-playbook',
      status: 'published',
      visibility: 'membership_required',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'author',
    };

    it('allows public access for items marked visibility: public', async () => {
      const result = await EntitlementService.evaluateContentItemAccess(
        publicItem,
        null, // unauthenticated visitor
        'portal-1',
        false
      );

      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('public_access');
    });

    it('denies access with auth_required for unauthenticated visitors on membership_required items', async () => {
      const result = await EntitlementService.evaluateContentItemAccess(
        membersOnlyItem,
        null,
        'portal-1',
        false
      );

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('auth_required');
    });

    it('grants admin_bypass on membership_required item when isOrgAdmin is true', async () => {
      const result = await EntitlementService.evaluateContentItemAccess(
        membersOnlyItem,
        'admin-123',
        'portal-1',
        true
      );

      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('admin_bypass');
    });
  });

  describe('Content Teaser Truncation & Sanitization Guard', () => {
    const mockBlocks: PageBlock[] = [
      {
        id: 'blk-1',
        type: 'text',
        props: { text: 'Paragraph 1: Introduction to Executive Finance' },
      },
      {
        id: 'blk-2',
        type: 'text',
        props: { text: 'Paragraph 2: Proprietary valuation equations and numbers' },
      },
      {
        id: 'blk-3',
        type: 'image',
        props: { url: 'https://cdn.smartsapp.com/confidential-sheet.pdf' },
      },
    ];

    const fullItem: ContentItem = {
      id: 'item-100',
      organizationId: 'org-1',
      portalId: 'portal-1',
      workspaceIds: ['ws-1'],
      type: 'resource',
      title: 'Confidential Valuation Model',
      slug: 'confidential-valuation',
      summary: 'Executive spreadsheet for valuation planning.',
      content: 'Paragraph 1... Paragraph 2...',
      blocks: mockBlocks,
      media: {
        fileUrl: 'https://cdn.smartsapp.com/model.xlsx',
        downloadUrl: 'https://cdn.smartsapp.com/model.xlsx',
        fileName: 'model.xlsx',
        fileSize: 1048576,
      },
      status: 'published',
      visibility: 'membership_required',
      teaserMode: 'first_block',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'analyst',
    };

    it('returns full unaltered item when visitor has valid access', () => {
      const grantedResult: EntitlementCheckResult = {
        hasAccess: true,
        reason: 'plan_entitlement',
      };

      const sanitized = EntitlementService.sanitizeContentItemForVisitor(fullItem, grantedResult);

      expect(sanitized.blocks?.length).toBe(3);
      expect(sanitized.media?.downloadUrl).toBe('https://cdn.smartsapp.com/model.xlsx');
      expect(sanitized.isGated).toBeUndefined();
    });

    it('truncates blocks to first block and strips download URLs when teaserMode is first_block and access is denied', () => {
      const deniedResult: EntitlementCheckResult = {
        hasAccess: false,
        reason: 'auth_required',
      };

      const sanitized = EntitlementService.sanitizeContentItemForVisitor(fullItem, deniedResult);

      expect(sanitized.isGated).toBe(true);
      expect(sanitized.accessDeniedReason).toBe('auth_required');
      // Exactly 1 block preserved
      expect(sanitized.blocks?.length).toBe(1);
      expect(sanitized.blocks?.[0].id).toBe('blk-1');
      // Download URLs must be stripped to prevent unauthorized downloads
      expect(sanitized.media?.downloadUrl).toBeUndefined();
      expect(sanitized.media?.fileUrl).toBeUndefined();
      // Summary is preserved
      expect(sanitized.summary).toBe('Executive spreadsheet for valuation planning.');
    });

    it('strips all blocks when teaserMode is summary and access is denied', () => {
      const deniedResult: EntitlementCheckResult = {
        hasAccess: false,
        reason: 'membership_required',
      };

      const itemWithSummaryTeaser: ContentItem = {
        ...fullItem,
        teaserMode: 'summary',
      };

      const sanitized = EntitlementService.sanitizeContentItemForVisitor(itemWithSummaryTeaser, deniedResult);

      expect(sanitized.isGated).toBe(true);
      expect(sanitized.blocks?.length).toBe(0);
      expect(sanitized.summary).toBe('Executive spreadsheet for valuation planning.');
    });

    it('preserves exactly two blocks when teaserMode is two_blocks and access is denied', () => {
      const deniedResult: EntitlementCheckResult = {
        hasAccess: false,
        reason: 'plan_upgrade_required',
      };

      const itemWithTwoBlocksTeaser: ContentItem = {
        ...fullItem,
        teaserMode: 'two_blocks',
      };

      const sanitized = EntitlementService.sanitizeContentItemForVisitor(itemWithTwoBlocksTeaser, deniedResult);

      expect(sanitized.isGated).toBe(true);
      expect(sanitized.blocks?.length).toBe(2);
      expect(sanitized.blocks?.[0].id).toBe('blk-1');
      expect(sanitized.blocks?.[1].id).toBe('blk-2');
    });
  });
});
