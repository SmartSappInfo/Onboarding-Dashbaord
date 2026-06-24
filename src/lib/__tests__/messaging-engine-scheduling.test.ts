import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock firebase-admin database maps
const mockCollection = new Map<string, any>();
let docIdCounter = 0;

vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: (name: string) => {
        // Return structured mocks for templates, profiles, and scheduled queue
        if (name === 'message_templates') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: true,
                id,
                data: () => ({
                  channel: 'email',
                  scope: 'organization',
                  organizationId: 'org-x',
                  category: 'general',
                  name: 'Test Template',
                  body: 'Hello {{name}}',
                  subject: 'Welcome {{name}}',
                  contentMode: 'plain_text',
                })
              })
            })
          };
        }
        // Org-scoped sender resolution: profiles are looked up by id, and the org
        // doc carries the default sender pointer per channel.
        if (name === 'sender_profiles') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: true,
                id,
                data: () => ({
                  organizationId: 'org-x',
                  name: 'SmartSapp',
                  channel: 'email',
                  identifier: 'no-reply@smartsapp.com',
                  isDefault: true,
                  isActive: true
                })
              })
            })
          };
        }
        if (name === 'organizations') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: true,
                id,
                data: () => ({
                  name: 'Org X',
                  defaultSenderProfileIds: { email: 'default-profile' },
                })
              })
            })
          };
        }
        if (name === 'message_styles') {
          return {
            where: () => ({
              where: () => ({
                limit: () => ({
                  get: async () => ({
                    empty: true,
                    docs: []
                  })
                })
              })
            })
          };
        }
        return {
          add: async (data: any) => {
            const docId = `doc-${++docIdCounter}`;
            mockCollection.set(docId, data);
            return { id: docId };
          },
          doc: (id?: string) => {
            const docId = id || `doc-${++docIdCounter}`;
            return {
              id: docId,
              get: async () => {
                const data = mockCollection.get(docId);
                return {
                  exists: !!data,
                  data: () => data
                };
              },
              set: async (data: any) => {
                mockCollection.set(docId, data);
              },
              update: async (data: any) => {
                const existing = mockCollection.get(docId);
                if (existing) {
                  Object.assign(existing, data);
                }
              }
            };
          }
        };
      }
    }
  };
});

// Mock Resend & mNotify gateway services
vi.mock('../resend-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'resend-123' })
}));
vi.mock('../mnotify-service', () => ({
  sendSms: vi.fn().mockResolvedValue({ summary: { _id: 'mnotify-123' }, status: 'success' })
}));
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../suppression-service', () => ({
  isSuppressed: vi.fn().mockResolvedValue(false)
}));

import { sendMessage } from '../messaging-engine';
import { sendEmail } from '../resend-service';
import * as activityLogger from '../activity-logger';

describe('Messaging Engine Unified Scheduling', () => {
  beforeEach(() => {
    mockCollection.clear();
    docIdCounter = 0;
    vi.clearAllMocks();
  });

  it('should intercept sendMessage with scheduledAt and write a pending scheduled_messages document', async () => {
    const result = await sendMessage({
      templateId: 'test-template',
      senderProfileId: 'default',
      recipient: 'test@example.com',
      variables: { name: 'Alice' },
      scheduledAt: '2026-06-10T10:00:00Z',
      workspaceId: 'workspace-123'
    });

    expect(result.success).toBe(true);
    
    // Verify that sendEmail was NOT called
    expect(sendEmail).not.toHaveBeenCalled();

    // Verify scheduled_messages collection has the pending document
    const messages = Array.from(mockCollection.values()).filter((doc: any) => doc.status === 'pending');
    expect(messages.length).toBe(1);
    
    const scheduledDoc = messages[0];
    expect(scheduledDoc.status).toBe('pending');
    expect(scheduledDoc.scheduledAt).toBe('2026-06-10T10:00:00Z');
    expect(scheduledDoc.customSubject).toBe('Welcome Alice');
    expect(scheduledDoc.customBody).toContain('Hello Alice');
    expect(scheduledDoc.workspaceId).toBe('workspace-123');

    // Verify activity logger logged notification_scheduled event
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notification_scheduled',
        workspaceId: 'workspace-123'
      })
    );
  });

  it('should dispatch immediately when scheduledAt is not provided', async () => {
    const result = await sendMessage({
      templateId: 'test-template',
      senderProfileId: 'default',
      recipient: 'test@example.com',
      variables: { name: 'Bob' },
      workspaceId: 'workspace-123'
    });

    expect(result.success).toBe(true);
    
    // Verify sendEmail was called for immediate dispatch
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // Verify scheduled_messages collection has NO pending documents
    const messages = Array.from(mockCollection.values()).filter((doc: any) => doc.status === 'pending');
    expect(messages.length).toBe(0);
  });
});
