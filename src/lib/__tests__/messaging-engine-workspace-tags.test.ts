/**
 * Unit Tests for Messaging Engine - Workspace Tag Resolution
 * 
 * Tests that the messaging engine correctly resolves workspace-scoped tags
 * when sending messages to schools.
 * 
 * Requirements:
 * - Requirement 7: Global vs. Workspace Tag Separation
 * - Requirement 11: Workspace-Aware Messaging Engine
 * 
 * Key test scenarios:
 * - sendMessage passes workspaceId to resolveTagVariables
 * - Tag variables are resolved from workspace_entities.workspaceTags
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendMessage } from '../messaging-engine';
import { resolveTagVariables } from '../messaging-actions';
import { adminDb } from '../firebase-admin';
import { getPrimaryWorkspaceId } from '../workspace-helpers';

// Mock dependencies
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

vi.mock('../messaging-actions', () => ({
  resolveTagVariables: vi.fn(),
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

vi.mock('../workspace-helpers', () => ({
  getPrimaryWorkspaceId: vi.fn(),
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../mnotify-service', () => ({
  sendSms: vi.fn(),
}));

vi.mock('../resend-service', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('../school-helpers', () => ({
  getSchoolEmail: vi.fn(() => 'school@example.com'),
  getSchoolPhone: vi.fn(() => '+1234567890'),
  getSignatory: vi.fn(() => ({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    type: 'Principal',
  })),
}));

vi.mock('../messaging-utils', () => ({
  resolveVariables: vi.fn((template, vars) => template),
  renderBlocksToHtml: vi.fn(() => '<p>Test content</p>'),
}));

vi.mock('../migration-status-utils', () => ({
  getContactEmail: vi.fn(() => 'school@example.com'),
  getContactPhone: vi.fn(() => '+1234567890'),
  getContactSignatory: vi.fn(() => ({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    type: 'Principal',
  })),
}));

describe('sendMessage - Workspace Tag Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass workspaceId to resolveTagVariables when sending message to school', async () => {
    // Mock template
    const mockTemplateDoc = {
      exists: true,
      id: 'template_1',
      data: () => ({
        id: 'template_1',
        name: 'Test Template',
        channel: 'email',
        subject: 'Test Subject',
        body: 'Test body with {{contact_tags}}',
        workspaceIds: ['workspace_1'],
      }),
    };

    // Mock sender profile
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

    // Mock contact from adapter
    const mockContact = {
      id: 'school_1',
      name: 'Test School',
      schoolData: {
        id: 'school_1',
        name: 'Test School',
        workspaceIds: ['workspace_1'],
        initials: 'TS',
        location: 'Test City',
      },
      migrationStatus: 'legacy' as const,
      tags: [],
    };

    // Mock message log
    const mockLogRef = {
      id: 'log_1',
    };

    // Setup mock collection responses
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

    // Mock resolveContact to return the contact
    const { resolveContact } = await import('../contact-adapter');
    vi.mocked(resolveContact).mockResolvedValue(mockContact);

    // Mock resolveTagVariables to return tag data
    (resolveTagVariables as any).mockResolvedValue({
      contact_tags: 'VIP, Hot Lead',
      tag_count: 2,
      tag_list: '["VIP", "Hot Lead"]',
      has_tag: '{"vip": true, "hot lead": true}',
    });

    // Call sendMessage
    const result = await sendMessage({
      templateId: 'template_1',
      senderProfileId: 'sender_1',
      recipient: 'recipient@example.com',
      variables: {},
      schoolId: 'school_1',
    });

    // Verify success
    expect(result.success).toBe(true);

    // Verify resolveTagVariables was called with workspaceId
    expect(resolveTagVariables).toHaveBeenCalledWith(
      'school_1',
      'school',
      'workspace_1' // This is the key assertion - workspaceId should be passed
    );
  });

  it('should handle school without workspaceIds gracefully', async () => {
    // Mock template
    const mockTemplateDoc = {
      exists: true,
      id: 'template_1',
      data: () => ({
        id: 'template_1',
        name: 'Test Template',
        channel: 'email',
        subject: 'Test Subject',
        body: 'Test body',
        workspaceIds: ['onboarding'],
      }),
    };

    // Mock sender profile
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

    // Mock contact without workspaceIds
    const mockContact = {
      id: 'school_1',
      name: 'Test School',
      schoolData: {
        id: 'school_1',
        name: 'Test School',
        // No workspaceIds
        initials: 'TS',
        location: 'Test City',
      },
      migrationStatus: 'legacy' as const,
      tags: [],
    };

    // Mock message log
    const mockLogRef = {
      id: 'log_1',
    };

    // Setup mock collection responses
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

    // Mock resolveContact to return the contact
    const { resolveContact } = await import('../contact-adapter');
    vi.mocked(resolveContact).mockResolvedValue(mockContact);

    // Mock resolveTagVariables
    (resolveTagVariables as any).mockResolvedValue({
      contact_tags: '',
      tag_count: 0,
      tag_list: '[]',
      has_tag: '{}',
    });

    // Call sendMessage
    const result = await sendMessage({
      templateId: 'template_1',
      senderProfileId: 'sender_1',
      recipient: 'recipient@example.com',
      variables: {},
      schoolId: 'school_1',
    });

    // Verify success
    expect(result.success).toBe(true);

    // Verify resolveTagVariables was called with 'onboarding' as fallback
    expect(resolveTagVariables).toHaveBeenCalledWith(
      'school_1',
      'school',
      'onboarding'
    );
  });
});
