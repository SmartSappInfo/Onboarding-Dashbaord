/**
 * @fileOverview Integration Tests for Contact Adapter Layer
 * 
 * Tests that existing features (activity logger, messaging, automation, tasks)
 * work correctly with the adapter layer for both legacy and migrated contacts.
 * 
 * Requirements: 18
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logActivity } from '../activity-logger';
import { sendMessage } from '../messaging-engine';
import { adminDb } from '../firebase-admin';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

// Mock automation processor to avoid circular dependencies
vi.mock('../automation-processor', () => ({
  triggerAutomationProtocols: vi.fn().mockResolvedValue(undefined),
}));

// Mock messaging services
vi.mock('../mnotify-service', () => ({
  sendSms: vi.fn().mockResolvedValue({ summary: { _id: 'sms_123' }, status: 'sent' }),
}));

vi.mock('../resend-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'email_123' }),
}));

// Mock messaging actions
vi.mock('../messaging-actions', () => ({
  resolveTagVariables: vi.fn().mockResolvedValue({
    contact_tags: 'tag1, tag2',
  }),
}));

describe('Adapter Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Activity Logger Integration', () => {
    it('should log activity with legacy school data', async () => {
      const mockSchool = {
        id: 'school_1',
        name: 'Test School',
        slug: 'test-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_1' });

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'school_1',
                data: () => mockSchool,
              }),
            }),
          };
        } else if (collectionName === 'activities') {
          return {
            add: mockAdd,
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'school_1',
        userId: 'user_1',
        type: 'test_activity',
        source: 'user_action',
        description: 'Test activity',
      });

      expect(mockAdd).toHaveBeenCalled();
      const activityData = mockAdd.mock.calls[0][0];
      expect(activityData.entityName).toBe('Test School');
      expect(activityData.entitySlug).toBe('test-school');
    });

    it('should log activity with migrated entity data', async () => {
      const mockSchool = {
        id: 'school_2',
        name: 'Migrated School',
        slug: 'migrated-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [],
        migrationStatus: 'migrated',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockEntity = {
        id: 'entity_1',
        organizationId: 'org_1',
        entityType: 'institution',
        name: 'Migrated School',
        slug: 'migrated-school',
        contacts: [],
        globalTags: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockWorkspaceEntity = {
        id: 'we_1',
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'entity_1',
        entityType: 'institution',
        pipelineId: 'pipeline_2',
        stageId: 'stage_2',
        status: 'active',
        workspaceTags: [],
        displayName: 'Migrated School',
        addedAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockAdd = vi.fn().mockResolvedValue({ id: 'activity_2' });

      let callCount = 0;
      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'school_2',
                data: () => mockSchool,
              }),
            }),
          };
        } else if (collectionName === 'entities') {
          callCount++;
          if (callCount === 1) {
            return {
              where: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue({
                empty: false,
                docs: [{ id: 'entity_1', data: () => mockEntity }],
              }),
            };
          } else {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  id: 'entity_1',
                  data: () => mockEntity,
                }),
              }),
            };
          }
        } else if (collectionName === 'workspace_entities') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: 'we_1', data: () => mockWorkspaceEntity }],
            }),
          };
        } else if (collectionName === 'activities') {
          return {
            add: mockAdd,
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      await logActivity({
        organizationId: 'org_1',
        workspaceId: 'workspace_1',
        entityId: 'school_2',
        userId: 'user_1',
        type: 'test_activity',
        source: 'user_action',
        description: 'Test activity',
      });

      expect(mockAdd).toHaveBeenCalled();
      const activityData = mockAdd.mock.calls[0][0];
      expect(activityData.entityName).toBe('Migrated School');
      expect(activityData.entityId).toBe('entity_1');
      expect(activityData.entityType).toBe('institution');
      expect(activityData.displayName).toBe('Migrated School');
    });
  });

  describe('Messaging Engine Integration', () => {
    it('should send message with legacy school data', async () => {
      const mockSchool = {
        id: 'school_3',
        name: 'Test School',
        slug: 'test-school',
        workspaceIds: ['workspace_1'],
        status: 'Active',
        schoolStatus: 'Active',
        pipelineId: 'pipeline_1',
        focalPersons: [
          {
            name: 'John Doe',
            phone: '+1234567890',
            email: 'john@test.com',
            type: 'Principal',
            isSignatory: true,
          },
        ],
        createdAt: '2024-01-01T00:00:00Z',
      };

      const mockTemplate = {
        id: 'template_1',
        name: 'Test Template',
        channel: 'email',
        subject: 'Hello {{school_name}}',
        body: 'Message to {{contact_name}}',
        workspaceIds: ['workspace_1'],
        variables: [],
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mockSenderProfile = {
        id: 'sender_1',
        name: 'SmartSapp',
        identifier: 'noreply@smartsapp.com',
        channel: 'email',
        isDefault: true,
        isActive: true,
      };

      const mockAdd = vi.fn().mockResolvedValue({ id: 'log_1' });

      const mockCollection = vi.fn((collectionName: string) => {
        if (collectionName === 'schools') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'school_3',
                data: () => mockSchool,
              }),
            }),
          };
        } else if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'template_1',
                data: () => mockTemplate,
              }),
            }),
          };
        } else if (collectionName === 'sender_profiles') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'sender_1',
                data: () => mockSenderProfile,
              }),
            }),
          };
        } else if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: true,
              forEach: vi.fn(),
            }),
          };
        } else if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: true,
            }),
          };
        } else if (collectionName === 'message_logs') {
          return {
            add: mockAdd,
          };
        } else if (collectionName === 'activities') {
          return {
            add: vi.fn().mockResolvedValue({ id: 'activity_1' }),
          };
        }
        return {};
      });

      (adminDb.collection as any) = mockCollection;

      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'test@example.com',
        variables: {},
        entityId: 'school_3',
      });

      expect(result.success).toBe(true);
      expect(mockAdd).toHaveBeenCalled();
    });
  });
});
