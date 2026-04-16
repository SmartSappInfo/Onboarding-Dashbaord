/**
 * Unit tests for Activity module dual-write and query functionality
 * 
 * Tests Requirements:
 * - 4.1: Activity logging with dual-write (entityId + entityId)
 * - 4.2: Activity queries with entityId/entityId fallback
 * - 4.3: Activity UI displays entity information
 * - 26.2: Integration tests for activity module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logActivity } from '../activity-logger';
import { getActivitiesForContact } from '../activity-actions';
import { resolveContact } from '../contact-adapter';
import { adminDb } from '../firebase-admin';
import type { ResolvedContact } from '../types';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

// Mock Contact Adapter
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

// Mock automation processor
vi.mock('../automation-processor', () => ({
  triggerAutomationProtocols: vi.fn().mockResolvedValue(undefined),
}));

describe('Activity Module - Dual-Write and Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logActivity - Dual-Write Pattern', () => {
    it('should populate both entityId and entityId when only entityId provided', async () => {
      // Mock contact resolution
      const mockContact: ResolvedContact = {
        id: 'entity_123',
        name: 'Test School',
        slug: 'test-school',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_123',
        migrationStatus: 'migrated',
        schoolData: {
          id: 'school_123',
          name: 'Test School',
          slug: 'test-school',
        } as any,
        tags: [],
        entityContacts: [],
      };

      (resolveContact as any).mockResolvedValue(mockContact);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_1' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_123',
        userId: 'user_1',
        type: 'note',
        source: 'manual',
        description: 'Test activity',
      });

      // Verify resolveContact was called with entityId
      expect(resolveContact).toHaveBeenCalledWith(
        'entity_123',
        'workspace_1'
      );

      // Verify activity was created with both identifiers
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_123',
          entityName: 'Test School',
          entitySlug: 'test-school',
          displayName: 'Test School',
          entityType: 'institution',
        })
      );
    });

    it('should populate both entityId and entityId when only entityId provided (migrated contact)', async () => {
      // Mock migrated contact resolution
      const mockContact: ResolvedContact = {
        id: 'school_456',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_456',
        migrationStatus: 'migrated',
        schoolData: {
          id: 'school_456',
          name: 'Migrated School',
          slug: 'migrated-school',
        } as any,
        tags: [],
        entityContacts: [],
      };

      (resolveContact as any).mockResolvedValue(mockContact);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_2' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'school_456',
        userId: 'user_1',
        type: 'call',
        source: 'manual',
        description: 'Test call',
      });

      // Verify resolveContact was called with entityId
      expect(resolveContact).toHaveBeenCalledWith(
        'school_456',
        'workspace_1'
      );

      // Verify activity was created with both identifiers
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_456',
          entityName: 'Migrated School',
          entitySlug: 'migrated-school',
          displayName: 'Migrated School',
          entityType: 'institution',
        })
      );
    });

    it('should only populate entityId when entityId provided (legacy contact)', async () => {
      // Mock legacy contact resolution
      const mockContact: ResolvedContact = {
        id: 'school_789',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        migrationStatus: 'legacy',
        schoolData: {
          id: 'school_789',
          name: 'Legacy School',
          slug: 'legacy-school',
        } as any,
        tags: [],
        entityContacts: [],
      };

      (resolveContact as any).mockResolvedValue(mockContact);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_3' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'school_789',
        userId: 'user_1',
        type: 'email',
        source: 'manual',
        description: 'Test email',
      });

      // Verify activity was created with only entityId (no entityId for legacy)
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_789',
          entityName: 'Legacy School',
          entitySlug: 'legacy-school',
          displayName: 'Legacy School',
          // entityId should be undefined for legacy contacts
        })
      );
    });

    it('should populate denormalized fields (displayName, entitySlug) for performance', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_999',
        name: 'Performance Test School',
        slug: 'performance-test',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_999',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      (resolveContact as any).mockResolvedValue(mockContact);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_4' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_999',
        userId: 'user_1',
        type: 'meeting',
        source: 'manual',
        description: 'Test meeting',
      });

      // Verify denormalized fields are populated
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Performance Test School',
          entitySlug: 'performance-test',
          entityType: 'institution',
        })
      );
    });
  });

  describe('getActivitiesForContact - Query Fallback Pattern', () => {
    it('should query by entityId when provided', async () => {
      const mockActivities = [
        {
          id: 'activity_1',
          entityId: 'entity_123',
          workspaceId: 'workspace_1',
          type: 'note',
          description: 'Test note',
          timestamp: new Date().toISOString(),
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        docs: mockActivities.map(a => ({ id: a.id, data: () => a })),
      });

      const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
      (adminDb.collection as any).mockReturnValue({ where: mockWhere1 });

      const result = await getActivitiesForContact(
        'entity_123',
        'workspace_1'
      );

      // Verify query used entityId
      expect(mockWhere1).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockWhere2).toHaveBeenCalledWith('entityId', '==', 'entity_123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('activity_1');
    });

    it('should query by entityId when only entityId provided', async () => {
      const mockActivities = [
        {
          id: 'activity_2',
          entityId: 'school_456',
          workspaceId: 'workspace_1',
          type: 'call',
          description: 'Test call',
          timestamp: new Date().toISOString(),
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        docs: mockActivities.map(a => ({ id: a.id, data: () => a })),
      });

      const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
      (adminDb.collection as any).mockReturnValue({ where: mockWhere1 });

      const result = await getActivitiesForContact(
        'school_456',
        'workspace_1'
      );

      // Verify query used entityId
      expect(mockWhere1).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockWhere2).toHaveBeenCalledWith('entityId', '==', 'school_456');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('activity_2');
    });

    it('should prefer entityId when both identifiers provided', async () => {
      const mockActivities = [
        {
          id: 'activity_3',
          entityId: 'school_789',
          workspaceId: 'workspace_1',
          type: 'email',
          description: 'Test email',
          timestamp: new Date().toISOString(),
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        docs: mockActivities.map(a => ({ id: a.id, data: () => a })),
      });

      const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
      (adminDb.collection as any).mockReturnValue({ where: mockWhere1 });

      const result = await getActivitiesForContact(
        'school_789',
        'workspace_1'
      );

      // Verify query used entityId (preferred)
      expect(mockWhere2).toHaveBeenCalledWith('entityId', '==', 'entity_789');
      expect(mockWhere2).not.toHaveBeenCalledWith('entityId', '==', 'school_789');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no identifier provided', async () => {
      const result = await getActivitiesForContact('', 'workspace_1');
      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const mockActivities = Array.from({ length: 100 }, (_, i) => ({
        id: `activity_${i}`,
        entityId: 'entity_123',
        workspaceId: 'workspace_1',
        type: 'note',
        description: `Test note ${i}`,
        timestamp: new Date().toISOString(),
      }));

      const mockGet = vi.fn().mockResolvedValue({
        docs: mockActivities.slice(0, 25).map(a => ({ id: a.id, data: () => a })),
      });

      const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
      (adminDb.collection as any).mockReturnValue({ where: mockWhere1 });

      const result = await getActivitiesForContact(
        'entity_123',
        'workspace_1',
        25
      );

      // Verify limit was applied
      expect(mockLimit).toHaveBeenCalledWith(25);
      expect(result).toHaveLength(25);
    });
  });

  describe('Contact Adapter Integration', () => {
    it('should handle contact resolution failure gracefully', async () => {
      // Mock contact resolution failure
      (resolveContact as any).mockResolvedValue(null);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_5' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_nonexistent',
        userId: 'user_1',
        type: 'note',
        source: 'manual',
        description: 'Test activity with nonexistent entity',
      });

      // Verify activity was still created (graceful degradation)
      expect(mockAdd).toHaveBeenCalled();
      
      // Verify activity has entityId but no resolved fields
      const activityData = mockAdd.mock.calls[0][0];
      expect(activityData.entityId).toBe('entity_nonexistent');
      expect(activityData.entityId).toBeUndefined();
      expect(activityData.displayName).toBeUndefined();
    });

    it('should use Contact Adapter for different entity types', async () => {
      const entityTypes: Array<'institution' | 'family' | 'person'> = ['institution', 'family', 'person'];
      
      for (const entityType of entityTypes) {
        vi.clearAllMocks();
        
        const mockContact: ResolvedContact = {
          id: `entity_${entityType}`,
          name: `Test ${entityType}`,
          slug: `test-${entityType}`,
          contacts: [],
          entityType,
          entityId: `entity_${entityType}`,
          migrationStatus: 'migrated',
          tags: [],
        entityContacts: [],
        };

        (resolveContact as any).mockResolvedValue(mockContact);

        const mockAdd = vi.fn().mockResolvedValue({ id: `activity_${entityType}` });
        (adminDb.collection as any).mockReturnValue({ add: mockAdd });

        await logActivity({
          organizationId: 'org_1',
          workspaceId: 'workspace_1',
          entityId: `entity_${entityType}`,
          userId: 'user_1',
          type: 'note',
          source: 'manual',
          description: `Test ${entityType} activity`,
        });

        // Verify entityType is correctly set
        expect(mockAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType,
            displayName: `Test ${entityType}`,
          })
        );
      }
    });

    it('should handle both identifiers provided with Contact Adapter', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_both',
        name: 'Both Identifiers School',
        slug: 'both-identifiers',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_both',
        migrationStatus: 'migrated',
        schoolData: {
          id: 'school_both',
          name: 'Both Identifiers School',
          slug: 'both-identifiers',
        } as any,
        tags: [],
        entityContacts: [],
      };

      (resolveContact as any).mockResolvedValue(mockContact);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_both' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'school_both',
        userId: 'user_1',
        type: 'note',
        source: 'manual',
        description: 'Test with both identifiers',
      });

      // Verify resolveContact was called with both identifiers
      expect(resolveContact).toHaveBeenCalledWith(
        'school_both',
        'workspace_1'
      );

      // Verify both identifiers are preserved
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_both',
          entityType: 'institution',
        })
      );
    });

    it('should handle workspace-scoped queries through Contact Adapter', async () => {
      const mockActivities = [
        {
          id: 'activity_ws1',
          entityId: 'entity_123',
          workspaceId: 'workspace_1',
          type: 'note',
          description: 'Workspace 1 activity',
          timestamp: new Date().toISOString(),
        },
      ];

      const mockGet = vi.fn().mockResolvedValue({
        docs: mockActivities.map(a => ({ id: a.id, data: () => a })),
      });

      const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
      (adminDb.collection as any).mockReturnValue({ where: mockWhere1 });

      const result = await getActivitiesForContact(
        'entity_123',
        'workspace_1'
      );

      // Verify workspace boundary is enforced
      expect(mockWhere1).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(result).toHaveLength(1);
      expect(result[0].workspaceId).toBe('workspace_1');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing workspaceId gracefully', async () => {
      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_no_workspace' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: undefined as any,
        entityId: 'entity_123',
        userId: 'user_1',
        type: 'note',
        source: 'manual',
        description: 'Test without workspace',
      });

      // Verify activity was created without contact resolution
      expect(resolveContact).not.toHaveBeenCalled();
      expect(mockAdd).toHaveBeenCalled();
    });

    it('should handle query errors gracefully', async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error('Firestore error'));
      const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
      (adminDb.collection as any).mockReturnValue({ where: mockWhere1 });

      const result = await getActivitiesForContact(
        'entity_123',
        'workspace_1'
      );

      // Verify empty array returned on error
      expect(result).toEqual([]);
    });

    it('should handle activity types that trigger automations', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_automation',
        name: 'Automation Test School',
        slug: 'automation-test',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_automation',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      (resolveContact as any).mockResolvedValue(mockContact);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_automation' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      // Test activity type that triggers automation
      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_automation',
        userId: 'user_1',
        type: 'task_completed',
        source: 'manual',
        description: 'Task completed activity',
      });

      // Verify activity was created with correct type
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task_completed',
          entityId: 'entity_automation',
        })
      );
    });

    it('should handle activities with metadata', async () => {
      const mockContact: ResolvedContact = {
        id: 'entity_metadata',
        name: 'Metadata Test School',
        slug: 'metadata-test',
        contacts: [],
        entityType: 'institution',
        entityId: 'entity_metadata',
        migrationStatus: 'migrated',
        tags: [],
        entityContacts: [],
      };

      (resolveContact as any).mockResolvedValue(mockContact);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_metadata' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      const metadata = {
        formId: 'form_123',
        submissionId: 'submission_456',
        customField: 'custom value',
      };

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_metadata',
        userId: 'user_1',
        type: 'form_submission',
        source: 'manual',
        description: 'Form submission activity',
        metadata,
      });

      // Verify metadata is preserved
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
        })
      );
    });

    it('should handle default limit in getActivitiesForContact', async () => {
      const mockActivities = Array.from({ length: 50 }, (_, i) => ({
        id: `activity_${i}`,
        entityId: 'entity_123',
        workspaceId: 'workspace_1',
        type: 'note',
        description: `Test note ${i}`,
        timestamp: new Date().toISOString(),
      }));

      const mockGet = vi.fn().mockResolvedValue({
        docs: mockActivities.map(a => ({ id: a.id, data: () => a })),
      });

      const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere2 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
      (adminDb.collection as any).mockReturnValue({ where: mockWhere1 });

      // Call without limit parameter (should use default of 50)
      const result = await getActivitiesForContact(
        'entity_123',
        'workspace_1'
      );

      // Verify default limit of 50 was applied
      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(result).toHaveLength(50);
    });
  });
});
