/**
 * Unit Tests for Messaging Module - EntityId Migration
 * 
 * Tests the messaging module's support for entityId migration including:
 * - Message sending with entityId
 * - Message log creation with dual-write (entityId + entityId)
 * - Message queries by entityId and entityId
 * - Contact Adapter integration
 * 
 * Requirements:
 * - Requirement 15.1: Message sending with entityId
 * - Requirement 15.2: Message log creation with dual-write
 * - Requirement 15.3: MessageComposer accepts entityId
 * - Requirement 15.4: MessageHistory uses Contact Adapter
 * - Requirement 15.5: Message queries support both identifiers
 * - Requirement 22.1: Query fallback pattern
 * - Requirement 23.1: Contact Adapter integration
 * - Requirement 26.2: Unit tests for messaging module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendMessage } from '../messaging-engine';
import { 
  getMessagesForContact, 
  getMessagesForEntities, 
  countMessagesForContact 
} from '../message-query-helpers';
import { resolveContact } from '../contact-adapter';
import { adminDb } from '../firebase-admin';
import type { MessageLog } from '../types';

// Mock dependencies
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

vi.mock('../messaging-actions', () => ({
  resolveTagVariables: vi.fn().mockResolvedValue({
    contact_tags: 'tag1, tag2',
    tag_count: 2,
  }),
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../mnotify-service', () => ({
  sendSms: vi.fn().mockResolvedValue({ 
    summary: { _id: 'sms_123' }, 
    status: 'sent' 
  }),
}));

vi.mock('../resend-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ 
    id: 'email_123' 
  }),
}));

vi.mock('../messaging-utils', () => ({
  resolveVariables: vi.fn((template, vars) => template),
  renderBlocksToHtml: vi.fn(() => '<p>Test content</p>'),
}));

vi.mock('../migration-status-utils', () => ({
  getContactEmail: vi.fn(() => 'contact@example.com'),
  getContactPhone: vi.fn(() => '+1234567890'),
  getContactSignatory: vi.fn(() => ({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    type: 'Principal',
  })),
}));

describe('Messaging Module - EntityId Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Sending with EntityId (Requirement 15.1)', () => {
    it('should send message with entityId only', async () => {
      // Setup mocks
      const mockTemplateDoc = {
        exists: true,
        id: 'template_1',
        data: () => ({
          id: 'template_1',
          name: 'Test Template',
          channel: 'email',
          subject: 'Test Subject',
          body: 'Test body',
          workspaceIds: ['workspace_1'],
        }),
      };

      const mockSenderDoc = {
        exists: true,
        id: 'sender_1',
        data: () => ({
          id: 'sender_1',
          name: 'Test Sender',
          identifier: 'sender@example.com',
          channel: 'email',
          isDefault: true,
          isActive: true,
        }),
      };

      const mockContact = {
        id: 'entity_123',
        name: 'Test Institution',
        contacts: [],
        entityId: 'entity_123',
        entityType: 'institution' as const,
        migrationStatus: 'migrated' as const,
        tags: [],
      };

      const mockLogRef = { id: 'log_1' };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTemplateDoc),
            }),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockSenderDoc),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [mockSenderDoc],
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ forEach: vi.fn() }),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockResolvedValue(mockLogRef),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Call sendMessage with entityId only
      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'recipient@example.com',
        variables: {},
        entityId: 'entity_123',
        entityType: 'institution',
        workspaceId: 'workspace_1',
      });

      // Verify success
      expect(result.success).toBe(true);
      expect(result.logId).toBe('log_1');

      // Verify Contact Adapter was called with entityId
      expect(resolveContact).toHaveBeenCalledWith('entity_123', 'workspace_1');
    });

    it('should send message with entityId only (legacy)', async () => {
      // Setup mocks
      const mockTemplateDoc = {
        exists: true,
        id: 'template_1',
        data: () => ({
          id: 'template_1',
          name: 'Test Template',
          channel: 'sms',
          body: 'Test SMS',
          workspaceIds: ['workspace_1'],
        }),
      };

      const mockSenderDoc = {
        exists: true,
        id: 'sender_1',
        data: () => ({
          id: 'sender_1',
          name: 'Test Sender',
          identifier: '+1234567890',
          channel: 'sms',
          isDefault: true,
          isActive: true,
        }),
      };

      const mockContact = {
        id: 'school_1',
        name: 'Test School',
        contacts: [],
        schoolData: {
          id: 'school_1',
          name: 'Test School',
          slug: 'test-school',
          workspaceIds: ['workspace_1'],
          status: 'Active' as const,
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        migrationStatus: 'legacy' as const,
        tags: [],
      };

      const mockLogRef = { id: 'log_2' };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTemplateDoc),
            }),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockSenderDoc),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [mockSenderDoc],
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ forEach: vi.fn() }),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockResolvedValue(mockLogRef),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Call sendMessage with entityId only
      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: '+1234567890',
        variables: {},
        entityId: 'school_1',
      });

      // Verify success
      expect(result.success).toBe(true);
      expect(result.logId).toBe('log_2');

      // Verify Contact Adapter was called with entityId
      expect(resolveContact).toHaveBeenCalledWith('school_1', expect.any(String));
    });
  });

  describe('Message Log Creation with Dual-Write (Requirement 15.2)', () => {
    it('should create message log with both entityId and entityId for migrated contact', async () => {
      // Setup mocks
      const mockTemplateDoc = {
        exists: true,
        id: 'template_1',
        data: () => ({
          id: 'template_1',
          name: 'Test Template',
          channel: 'email',
          subject: 'Test Subject',
          body: 'Test body',
          workspaceIds: ['workspace_1'],
        }),
      };

      const mockSenderDoc = {
        exists: true,
        id: 'sender_1',
        data: () => ({
          id: 'sender_1',
          name: 'Test Sender',
          identifier: 'sender@example.com',
          channel: 'email',
          isDefault: true,
          isActive: true,
        }),
      };

      // Migrated contact has both entityId and entityId
      const mockContact = {
        id: 'entity_123',
        name: 'Test Institution',
        contacts: [],
        entityId: 'entity_123',
        entityType: 'institution' as const,
        schoolData: {
          id: 'school_1',
          name: 'Test Institution',
          slug: 'test-institution',
          workspaceIds: ['workspace_1'],
          status: 'Active' as const,
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        migrationStatus: 'migrated' as const,
        tags: [],
      };

      let capturedLogData: any = null;
      const mockLogRef = { id: 'log_dual' };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTemplateDoc),
            }),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockSenderDoc),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [mockSenderDoc],
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ forEach: vi.fn() }),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockImplementation((data) => {
              capturedLogData = data;
              return Promise.resolve(mockLogRef);
            }),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Call sendMessage
      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'recipient@example.com',
        variables: {},
        entityId: 'entity_123',
        entityType: 'institution',
        workspaceId: 'workspace_1',
      });

      // Verify success
      expect(result.success).toBe(true);

      // Verify dual-write: both entityId and entityId are populated
      expect(capturedLogData).toBeDefined();
      expect(capturedLogData.entityId).toBe('school_1');
      expect(capturedLogData.entityId).toBe('entity_123');
      expect(capturedLogData.entityType).toBe('institution');
      expect(capturedLogData.workspaceId).toBe('workspace_1');
    });

    it('should create message log with entityId only for legacy contact', async () => {
      // Setup mocks
      const mockTemplateDoc = {
        exists: true,
        id: 'template_1',
        data: () => ({
          id: 'template_1',
          name: 'Test Template',
          channel: 'email',
          subject: 'Test Subject',
          body: 'Test body',
          workspaceIds: ['workspace_1'],
        }),
      };

      const mockSenderDoc = {
        exists: true,
        id: 'sender_1',
        data: () => ({
          id: 'sender_1',
          name: 'Test Sender',
          identifier: 'sender@example.com',
          channel: 'email',
          isDefault: true,
          isActive: true,
        }),
      };

      // Legacy contact has only entityId
      const mockContact = {
        id: 'school_1',
        name: 'Test School',
        contacts: [],
        schoolData: {
          id: 'school_1',
          name: 'Test School',
          slug: 'test-school',
          workspaceIds: ['workspace_1'],
          status: 'Active' as const,
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        migrationStatus: 'legacy' as const,
        tags: [],
      };

      let capturedLogData: any = null;
      const mockLogRef = { id: 'log_legacy' };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTemplateDoc),
            }),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockSenderDoc),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [mockSenderDoc],
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ forEach: vi.fn() }),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockImplementation((data) => {
              capturedLogData = data;
              return Promise.resolve(mockLogRef);
            }),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Call sendMessage
      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'recipient@example.com',
        variables: {},
        entityId: 'school_1',
      });

      // Verify success
      expect(result.success).toBe(true);

      // Verify legacy: entityId populated, entityId is null
      expect(capturedLogData).toBeDefined();
      expect(capturedLogData.entityId).toBe('school_1');
      expect(capturedLogData.entityId).toBeNull();
    });

    it('should create message log with entityId only for new entity contact', async () => {
      // Setup mocks
      const mockTemplateDoc = {
        exists: true,
        id: 'template_1',
        data: () => ({
          id: 'template_1',
          name: 'Test Template',
          channel: 'email',
          subject: 'Test Subject',
          body: 'Test body',
          workspaceIds: ['workspace_1'],
        }),
      };

      const mockSenderDoc = {
        exists: true,
        id: 'sender_1',
        data: () => ({
          id: 'sender_1',
          name: 'Test Sender',
          identifier: 'sender@example.com',
          channel: 'email',
          isDefault: true,
          isActive: true,
        }),
      };

      // New entity contact has only entityId (no legacy entityId)
      const mockContact = {
        id: 'entity_456',
        name: 'New Family',
        contacts: [],
        entityId: 'entity_456',
        entityType: 'family' as const,
        migrationStatus: 'migrated' as const,
        tags: [],
      };

      let capturedLogData: any = null;
      const mockLogRef = { id: 'log_new' };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTemplateDoc),
            }),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockSenderDoc),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [mockSenderDoc],
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ forEach: vi.fn() }),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockImplementation((data) => {
              capturedLogData = data;
              return Promise.resolve(mockLogRef);
            }),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Call sendMessage
      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'recipient@example.com',
        variables: {},
        entityId: 'entity_456',
        entityType: 'family',
        workspaceId: 'workspace_1',
      });

      // Verify success
      expect(result.success).toBe(true);

      // Verify new entity: entityId populated, entityId is null
      expect(capturedLogData).toBeDefined();
      expect(capturedLogData.entityId).toBeNull();
      expect(capturedLogData.entityId).toBe('entity_456');
      expect(capturedLogData.entityType).toBe('family');
    });
  });

  describe('Message Queries by EntityId and SchoolId (Requirement 15.5, 22.1)', () => {
    it('should query messages by entityId', async () => {
      const mockMessages: MessageLog[] = [
        {
          id: 'log_1',
          title: 'Message 1',
          templateId: 'template_1',
          templateName: 'Template 1',
          senderProfileId: 'sender_1',
          senderName: 'Sender 1',
          channel: 'email',
          recipient: 'test@example.com',
          body: 'Test body',
          status: 'sent',
          sentAt: '2024-01-01T00:00:00Z',
          variables: {},
          workspaceIds: ['workspace_1'],
          workspaceId: 'workspace_1',
          entityId: 'entity_123',
          entityType: 'institution',
          providerId: 'provider_1',
          providerStatus: 'sent',
        },
        {
          id: 'log_2',
          title: 'Message 2',
          templateId: 'template_1',
          templateName: 'Template 1',
          senderProfileId: 'sender_1',
          senderName: 'Sender 1',
          channel: 'sms',
          recipient: '+1234567890',
          body: 'Test SMS',
          status: 'sent',
          sentAt: '2024-01-02T00:00:00Z',
          variables: {},
          workspaceIds: ['workspace_1'],
          workspaceId: 'workspace_1',
          entityId: 'entity_123',
          entityType: 'institution',
          providerId: 'provider_2',
          providerStatus: 'sent',
        },
      ];

      const mockSnapshot = {
        docs: mockMessages.map(msg => ({
          id: msg.id,
          data: () => msg,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Query by entityId
      const messages = await getMessagesForContact({
        entityId: 'entity_123',
        workspaceId: 'workspace_1',
        limit: 50,
      });

      // Verify results
      expect(messages).toHaveLength(2);
      expect(messages[0].entityId).toBe('entity_123');
      expect(messages[1].entityId).toBe('entity_123');

      // Verify query used entityId
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'entity_123');
    });

    it('should query messages by entityId (fallback)', async () => {
      const mockMessages: MessageLog[] = [
        {
          id: 'log_3',
          title: 'Legacy Message',
          templateId: 'template_1',
          templateName: 'Template 1',
          senderProfileId: 'sender_1',
          senderName: 'Sender 1',
          channel: 'email',
          recipient: 'test@example.com',
          body: 'Test body',
          status: 'sent',
          sentAt: '2024-01-03T00:00:00Z',
          variables: {},
          workspaceIds: ['workspace_1'],
          workspaceId: 'workspace_1',
          entityId: null,
          providerId: 'provider_3',
          providerStatus: 'sent',
        },
      ];

      const mockSnapshot = {
        docs: mockMessages.map(msg => ({
          id: msg.id,
          data: () => msg,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Query by entityId (fallback)
      const messages = await getMessagesForContact({
        entityId: 'school_1',
        workspaceId: 'workspace_1',
        limit: 50,
      });

      // Verify results
      expect(messages).toHaveLength(1);
      expect(messages[0].entityId).toBe('school_1');

      // Verify query used entityId
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'school_1');
    });

    it('should prefer entityId when both entityId and entityId are provided', async () => {
      const mockMessages: MessageLog[] = [
        {
          id: 'log_4',
          title: 'Dual Message',
          templateId: 'template_1',
          templateName: 'Template 1',
          senderProfileId: 'sender_1',
          senderName: 'Sender 1',
          channel: 'email',
          recipient: 'test@example.com',
          body: 'Test body',
          status: 'sent',
          sentAt: '2024-01-04T00:00:00Z',
          variables: {},
          workspaceIds: ['workspace_1'],
          workspaceId: 'workspace_1',
          entityId: 'entity_123',
          entityType: 'institution',
          providerId: 'provider_4',
          providerStatus: 'sent',
        },
      ];

      const mockSnapshot = {
        docs: mockMessages.map(msg => ({
          id: msg.id,
          data: () => msg,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Query with both identifiers
      const messages = await getMessagesForContact({
        entityId: 'school_1',
        workspaceId: 'workspace_1',
        limit: 50,
      });

      // Verify results
      expect(messages).toHaveLength(1);

      // Verify query preferred entityId over entityId
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'entity_123');
      expect(mockCollection.where).not.toHaveBeenCalledWith('entityId', '==', 'school_1');
    });

    it('should throw error when neither entityId nor entityId is provided', async () => {
      // Attempt to query without identifiers
      await expect(
        getMessagesForContact({
          workspaceId: 'workspace_1',
          limit: 50,
        })
      ).rejects.toThrow('Either entityId or entityId must be provided');
    });

    it('should query messages for multiple entities', async () => {
      const mockMessages: MessageLog[] = [
        {
          id: 'log_5',
          title: 'Message for Entity 1',
          templateId: 'template_1',
          templateName: 'Template 1',
          senderProfileId: 'sender_1',
          senderName: 'Sender 1',
          channel: 'email',
          recipient: 'test1@example.com',
          body: 'Test body 1',
          status: 'sent',
          sentAt: '2024-01-05T00:00:00Z',
          variables: {},
          workspaceIds: ['workspace_1'],
          workspaceId: 'workspace_1',
          entityId: 'entity_1',
          entityType: 'institution',
          providerId: 'provider_5',
          providerStatus: 'sent',
        },
        {
          id: 'log_6',
          title: 'Message for Entity 2',
          templateId: 'template_1',
          templateName: 'Template 1',
          senderProfileId: 'sender_1',
          senderName: 'Sender 1',
          channel: 'email',
          recipient: 'test2@example.com',
          body: 'Test body 2',
          status: 'sent',
          sentAt: '2024-01-06T00:00:00Z',
          variables: {},
          workspaceIds: ['workspace_1'],
          workspaceId: 'workspace_1',
          entityId: 'entity_2',
          entityType: 'family',
          providerId: 'provider_6',
          providerStatus: 'sent',
        },
      ];

      const mockSnapshot = {
        docs: mockMessages.map(msg => ({
          id: msg.id,
          data: () => msg,
        })),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      });

      // Query for multiple entities
      const messages = await getMessagesForEntities({
        entityIds: ['entity_1', 'entity_2'],
        workspaceId: 'workspace_1',
        limit: 100,
      });

      // Verify results
      expect(messages).toHaveLength(2);
      expect(messages.some(m => m.entityId === 'entity_1')).toBe(true);
      expect(messages.some(m => m.entityId === 'entity_2')).toBe(true);
    });

    it('should count messages by entityId', async () => {
      const mockCountSnapshot = {
        data: () => ({ count: 5 }),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        count: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockCountSnapshot),
        }),
      });

      // Count messages by entityId
      const count = await countMessagesForContact({
        entityId: 'entity_123',
        workspaceId: 'workspace_1',
      });

      // Verify count
      expect(count).toBe(5);

      // Verify query used entityId
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'entity_123');
    });

    it('should count messages by entityId (fallback)', async () => {
      const mockCountSnapshot = {
        data: () => ({ count: 3 }),
      };

      (adminDb.collection as any).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        count: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockCountSnapshot),
        }),
      });

      // Count messages by entityId
      const count = await countMessagesForContact({
        entityId: 'school_1',
        workspaceId: 'workspace_1',
      });

      // Verify count
      expect(count).toBe(3);

      // Verify query used entityId
      const mockCollection = (adminDb.collection as any)();
      expect(mockCollection.where).toHaveBeenCalledWith('workspaceId', '==', 'workspace_1');
      expect(mockCollection.where).toHaveBeenCalledWith('entityId', '==', 'school_1');
    });
  });

  describe('Contact Adapter Integration (Requirement 23.1)', () => {
    it('should use Contact Adapter to resolve contact information', async () => {
      // Setup mocks
      const mockTemplateDoc = {
        exists: true,
        id: 'template_1',
        data: () => ({
          id: 'template_1',
          name: 'Test Template',
          channel: 'email',
          subject: 'Hello {{contact_name}}',
          body: 'Message for {{school_name}}',
          workspaceIds: ['workspace_1'],
        }),
      };

      const mockSenderDoc = {
        exists: true,
        id: 'sender_1',
        data: () => ({
          id: 'sender_1',
          name: 'Test Sender',
          identifier: 'sender@example.com',
          channel: 'email',
          isDefault: true,
          isActive: true,
        }),
      };

      const mockContact = {
        id: 'entity_123',
        name: 'Test Institution',
        contacts: [],
        entityId: 'entity_123',
        entityType: 'institution' as const,
        schoolData: {
          id: 'school_1',
          name: 'Test Institution',
          slug: 'test-institution',
          workspaceIds: ['workspace_1'],
          status: 'Active' as const,
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          initials: 'TI',
          location: 'Test City',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        migrationStatus: 'migrated' as const,
        tags: ['VIP', 'Hot Lead'],
      };

      const mockLogRef = { id: 'log_adapter' };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTemplateDoc),
            }),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockSenderDoc),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [mockSenderDoc],
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ forEach: vi.fn() }),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockResolvedValue(mockLogRef),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Call sendMessage
      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'recipient@example.com',
        variables: {},
        entityId: 'entity_123',
        entityType: 'institution',
        workspaceId: 'workspace_1',
      });

      // Verify success
      expect(result.success).toBe(true);

      // Verify Contact Adapter was called
      expect(resolveContact).toHaveBeenCalledWith('entity_123', 'workspace_1');
      expect(resolveContact).toHaveBeenCalledTimes(1);
    });

    it('should handle Contact Adapter returning null gracefully', async () => {
      // Setup mocks
      const mockTemplateDoc = {
        exists: true,
        id: 'template_1',
        data: () => ({
          id: 'template_1',
          name: 'Test Template',
          channel: 'email',
          subject: 'Test Subject',
          body: 'Test body',
          workspaceIds: ['workspace_1'],
        }),
      };

      const mockSenderDoc = {
        exists: true,
        id: 'sender_1',
        data: () => ({
          id: 'sender_1',
          name: 'Test Sender',
          identifier: 'sender@example.com',
          channel: 'email',
          isDefault: true,
          isActive: true,
        }),
      };

      const mockLogRef = { id: 'log_null' };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTemplateDoc),
            }),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockSenderDoc),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [mockSenderDoc],
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ forEach: vi.fn() }),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockResolvedValue(mockLogRef),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      // Contact Adapter returns null (contact not found)
      vi.mocked(resolveContact).mockResolvedValue(null);

      // Call sendMessage
      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'recipient@example.com',
        variables: {},
        entityId: 'entity_nonexistent',
        entityType: 'institution',
        workspaceId: 'workspace_1',
      });

      // Verify success (message should still send even if contact not found)
      expect(result.success).toBe(true);

      // Verify Contact Adapter was called
      expect(resolveContact).toHaveBeenCalledWith('entity_nonexistent', 'workspace_1');
    });

    it('should resolve contact variables from adapter for both legacy and migrated contacts', async () => {
      // Setup mocks
      const mockTemplateDoc = {
        exists: true,
        id: 'template_1',
        data: () => ({
          id: 'template_1',
          name: 'Test Template',
          channel: 'email',
          subject: 'Hello {{contact_name}}',
          body: 'Email: {{contact_email}}, Phone: {{contact_phone}}',
          workspaceIds: ['workspace_1'],
        }),
      };

      const mockSenderDoc = {
        exists: true,
        id: 'sender_1',
        data: () => ({
          id: 'sender_1',
          name: 'Test Sender',
          identifier: 'sender@example.com',
          channel: 'email',
          isDefault: true,
          isActive: true,
        }),
      };

      const mockContact = {
        id: 'entity_123',
        name: 'Test Institution',
        contacts: [],
        entityId: 'entity_123',
        entityType: 'institution' as const,
        schoolData: {
          id: 'school_1',
          name: 'Test Institution',
          slug: 'test-institution',
          workspaceIds: ['workspace_1'],
          status: 'Active' as const,
          schoolStatus: 'Active',
          pipelineId: 'pipeline-1',
          focalPersons: [],
          initials: 'TI',
          location: 'Test City',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        migrationStatus: 'migrated' as const,
        tags: [],
      };

      const mockLogRef = { id: 'log_vars' };

      (adminDb.collection as any).mockImplementation((collectionName: string) => {
        if (collectionName === 'message_templates') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTemplateDoc),
            }),
          };
        }
        if (collectionName === 'sender_profiles') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockSenderDoc),
            }),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [mockSenderDoc],
            }),
          };
        }
        if (collectionName === 'contracts') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true }),
          };
        }
        if (collectionName === 'messaging_variables') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ forEach: vi.fn() }),
          };
        }
        if (collectionName === 'message_logs') {
          return {
            add: vi.fn().mockResolvedValue(mockLogRef),
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true }),
        };
      });

      vi.mocked(resolveContact).mockResolvedValue(mockContact);

      // Call sendMessage
      const result = await sendMessage({
        templateId: 'template_1',
        senderProfileId: 'sender_1',
        recipient: 'recipient@example.com',
        variables: {},
        entityId: 'entity_123',
        entityType: 'institution',
        workspaceId: 'workspace_1',
      });

      // Verify success
      expect(result.success).toBe(true);

      // Verify Contact Adapter was used to resolve contact
      expect(resolveContact).toHaveBeenCalledWith('entity_123', 'workspace_1');
    });
  });
});
