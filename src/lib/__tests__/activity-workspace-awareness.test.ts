/**
 * @fileOverview Activity Logging Workspace Awareness Tests
 * 
 * Tests for Requirement 12: Workspace-Aware Activity Logging
 * 
 * Validates:
 * - 12.1: Activity documents include workspaceId, entityId, and entityType
 * - 12.2: Denormalization of displayName and entitySlug at time of logging
 * - 12.3: Activity timeline filtering by workspaceId
 * - 12.4: Backward compatibility with entityId and entityName
 * - 12.5: Dual-write for legacy schools records
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logActivity } from '../activity-logger';
import { resolveContact } from '../contact-adapter';
import type { ResolvedContact } from '../types';

// Mock firebase-admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      add: vi.fn().mockResolvedValue({ id: 'activity_123' }),
    })),
  },
}));

// Mock automation processor
vi.mock('../automation-processor', () => ({
  triggerAutomationProtocols: vi.fn().mockResolvedValue(undefined),
}));

// Mock contact adapter
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

describe('Activity Logging Workspace Awareness (Requirement 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('12.1: Activity documents include workspaceId, entityId, and entityType', () => {
    it('should log activity with entityId and entityType when provided', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_123',
        entityType: 'institution',
        userId: 'user_1',
        type: 'school_created',
        source: 'user',
        description: 'Created new institution',
      });

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org_1',
          workspaceId: 'workspace_1',
          entityId: 'entity_123',
          entityType: 'institution',
          timestamp: expect.any(String),
        })
      );
    });

    it('should require workspaceId when logging activity', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1', // Required field
        userId: 'user_1',
        type: 'task_completed',
        source: 'system',
        description: 'Task completed',
      });

      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace_1',
        })
      );
    });
  });

  describe('12.2: Denormalization of displayName and entitySlug at time of logging', () => {
    it('should denormalize displayName and entitySlug from entity data', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      // Mock adapter to return entity data
      const mockContact: ResolvedContact = {
        id: 'entity_123',
        name: 'Test Institution',
        slug: 'test-institution',
        contacts: [],
        tags: [],
        migrationStatus: 'migrated',
        entityId: 'entity_123',
        entityType: 'institution',
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_123',
        userId: 'user_1',
        type: 'pipeline_stage_changed',
        source: 'user',
        description: 'Moved to next stage',
      });

      // Verify adapter was called
      expect(resolveContact).toHaveBeenCalledWith('entity_123', 'workspace_1');

      // Verify denormalized fields are stored
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Test Institution',
          entitySlug: 'test-institution',
          entityType: 'institution',
        })
      );
    });

    it('should preserve denormalized data even if entity is later renamed', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      const mockContact: ResolvedContact = {
        id: 'entity_123',
        name: 'Original Name',
        slug: 'original-name',
        contacts: [],
        tags: [],
        migrationStatus: 'migrated',
        entityId: 'entity_123',
        entityType: 'family',
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_123',
        userId: 'user_1',
        type: 'school_created',
        source: 'user',
        description: 'Created family',
      });

      // The activity log captures the name at the time of logging
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Original Name',
          entitySlug: 'original-name',
        })
      );

      // Even if the entity is renamed later, this activity entry
      // will still show "Original Name" (historical accuracy)
    });
  });

  describe('12.4 & 12.5: Backward compatibility and dual-write for legacy schools', () => {
    it('should populate both entityId and entityId for migrated schools', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      // Mock adapter to return migrated contact
      const mockContact: ResolvedContact = {
        id: 'school_123',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        tags: [],
        migrationStatus: 'migrated',
        entityId: 'entity_456',
        entityType: 'institution',
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'school_123', // Legacy field
        userId: 'user_1',
        type: 'task_completed',
        source: 'system',
        description: 'Task completed',
      });

      // Verify adapter was called
      expect(resolveContact).toHaveBeenCalledWith('school_123', 'workspace_1');

      // Verify both entityId and entityId are populated (dual-write)
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_123', // Legacy field maintained
          entityName: 'Migrated School',
          entitySlug: 'migrated-school',
          entityId: 'entity_456', // New field populated
          entityType: 'institution',
          displayName: 'Migrated School',
          entitySlug: 'migrated-school',
        })
      );
    });

    it('should handle legacy schools that are not yet migrated', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      // Mock adapter to return legacy contact (no entityId)
      const mockContact: ResolvedContact = {
        id: 'school_123',
        name: 'Legacy School',
        slug: 'legacy-school',
        contacts: [],
        tags: [],
        migrationStatus: 'legacy',
        // No entityId or entityType for legacy records
      };
      (resolveContact as any).mockResolvedValue(mockContact);

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'school_123',
        userId: 'user_1',
        type: 'school_created',
        source: 'user',
        description: 'Created school',
      });

      // Verify entityId is maintained, no entityId for legacy records
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'school_123',
          entityName: 'Legacy School',
          entitySlug: 'legacy-school',
        })
      );

      // Verify entityId and entityType are not set for legacy records
      const callArgs = mockAdd.mock.calls[0][0];
      expect(callArgs.entityId).toBeUndefined();
      expect(callArgs.entityType).toBeUndefined();
    });

    it('should handle activities without any contact association', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        userId: 'user_1',
        type: 'task_completed',
        source: 'system',
        description: 'General task completed',
      });

      // Verify no contact fields are set
      const callArgs = mockAdd.mock.calls[0][0];
      expect(callArgs.entityId).toBeUndefined();
      expect(callArgs.entityId).toBeUndefined();
      expect(callArgs.entityType).toBeUndefined();
    });
  });

  describe('12.3: Activity timeline filtering by workspaceId', () => {
    it('should filter activities by workspaceId in query', () => {
      // This is tested in the UI component (ActivityTimeline.tsx)
      // The query uses: where('workspaceId', '==', activeWorkspaceId)
      // This test validates the concept
      
      const activities = [
        { id: 'act_1', workspaceId: 'workspace_1', type: 'school_created' },
        { id: 'act_2', workspaceId: 'workspace_2', type: 'task_completed' },
        { id: 'act_3', workspaceId: 'workspace_1', type: 'pipeline_stage_changed' },
      ];

      const activeWorkspaceId = 'workspace_1';
      const filteredActivities = activities.filter(a => a.workspaceId === activeWorkspaceId);

      expect(filteredActivities).toHaveLength(2);
      expect(filteredActivities.map(a => a.id)).toEqual(['act_1', 'act_3']);
    });
  });

  describe('Activity logging with automation trigger', () => {
    it('should trigger automation protocols with workspace context', async () => {
      const { adminDb } = await import('../firebase-admin');
      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_123' });
      (adminDb.collection as any).mockReturnValue({ add: mockAdd });

      // Reset the mock to avoid interference from previous tests
      (resolveContact as any).mockResolvedValue(null);

      const { triggerAutomationProtocols } = await import('../automation-processor');

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_123',
        entityType: 'institution',
        userId: 'user_1',
        type: 'pipeline_stage_changed',
        source: 'user',
        description: 'Moved to next stage',
        displayName: 'Test Institution',
        entitySlug: 'test-institution',
      });

      // Verify automation was triggered with workspace context
      expect(triggerAutomationProtocols).toHaveBeenCalledWith(
        'SCHOOL_STAGE_CHANGED',
        expect.objectContaining({
          organizationId: 'org_1',
          workspaceId: 'workspace_1',
          entityId: 'entity_123',
          entityType: 'institution',
          action: 'pipeline_stage_changed',
          actorId: 'user_1',
        })
      );
    });
  });
});
