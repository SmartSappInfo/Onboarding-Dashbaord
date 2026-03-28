/**
 * Unit tests for Activity module dual-write and query functionality
 * 
 * Tests Requirements:
 * - 4.1: Activity logging with dual-write (schoolId + entityId)
 * - 4.2: Activity queries with entityId/schoolId fallback
 * - 4.3: Activity UI displays entity information
 * - 26.2: Integration tests for activity module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logActivity } from '../activity-logger';
import { getActivitiesForContact } from '../activity-actions';
import { resolveContact } from '../contact-adapter';
import { adminDb } from '../firebase-admin';
import type { Activity, ResolvedContact } from '../types';

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
    it('should populate both schoolId and entityId when only entityId provided', async () => {
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
        { entityId: 'entity_123' },
        'workspace_1'
      );

      // Verify activity was created with both identifiers
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'entity_123',
          schoolId: 'school_123',
          schoolName: 'Test School',
          schoolSlug: 'test-school',
          displayName: 'Test School',
          entitySlug: 'test-school',
          entityType: 'institution',
        })
      );
    });

    it('should populate both schoolId and entityId when only schoolId provided (migrated contact)', async () => {
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
      };

      (resolveContact as any).mockResolvedValue(mockContact);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_2' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        schoolId: 'school_456',
        userId: 'user_1',
        type: 'call',
        source: 'manual',
        description: 'Test call',
      });

      // Verify resolveContact was called with schoolId
      expect(resolveContact).toHaveBeenCalledWith(
        { schoolId: 'school_456' },
        'workspace_1'
      );

      // Verify activity was created with both identifiers
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: 'school_456',
          entityId: 'entity_456',
          schoolName: 'Migrated School',
          schoolSlug: 'migrated-school',
          displayName: 'Migrated School',
          entitySlug: 'migrated-school',
          entityType: 'institution',
        })
      );
    });

    it('should only populate schoolId when schoolId provided (legacy contact)', async () => {
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
      };

      (resolveContact as any).mockResolvedValue(mockContact);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_3' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        schoolId: 'school_789',
        userId: 'user_1',
        type: 'email',
        source: 'manual',
        description: 'Test email',
      });

      // Verify activity was created with only schoolId (no entityId for legacy)
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: 'school_789',
          schoolName: 'Legacy School',
          schoolSlug: 'legacy-school',
          displayName: 'Legacy School',
          entitySlug: 'legacy-school',
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
        { entityId: 'entity_123' },
        'workspace_1'
      );

      // Verify query used entityId
      expect(mockWhere1).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockWhere2).toHaveBeenCalledWith('entityId', '==', 'entity_123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('activity_1');
    });

    it('should query by schoolId when only schoolId provided', async () => {
      const mockActivities = [
        {
          id: 'activity_2',
          schoolId: 'school_456',
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
        { schoolId: 'school_456' },
        'workspace_1'
      );

      // Verify query used schoolId
      expect(mockWhere1).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockWhere2).toHaveBeenCalledWith('schoolId', '==', 'school_456');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('activity_2');
    });

    it('should prefer entityId when both identifiers provided', async () => {
      const mockActivities = [
        {
          id: 'activity_3',
          entityId: 'entity_789',
          schoolId: 'school_789',
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
        { entityId: 'entity_789', schoolId: 'school_789' },
        'workspace_1'
      );

      // Verify query used entityId (preferred)
      expect(mockWhere2).toHaveBeenCalledWith('entityId', '==', 'entity_789');
      expect(mockWhere2).not.toHaveBeenCalledWith('schoolId', '==', 'school_789');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no identifier provided', async () => {
      const result = await getActivitiesForContact({}, 'workspace_1');
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
        { entityId: 'entity_123' },
        'workspace_1',
        25
      );

      // Verify limit was applied
      expect(mockLimit).toHaveBeenCalledWith(25);
      expect(result).toHaveLength(25);
    });
  });
});
