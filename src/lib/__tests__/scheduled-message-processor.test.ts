// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processScheduledMessages } from '../reminder-actions';
import * as messagingEngine from '../messaging-engine';

// Mock the messaging engine
vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn(),
}));

// In-memory storage for scheduled messages
const mockScheduledMessages = new Map<string, any>();
let docIdCounter = 0;

// Mock firebase-admin with a simpler implementation
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: (name: string) => {
        if (name === 'scheduled_messages') {
          return {
            where: (field: string, op: string, value: any) => {
              // Return a query object that can be chained
              const query = {
                _filters: [{ field, op, value }],
                where(field2: string, op2: string, value2: any) {
                  query._filters.push({ field: field2, op: op2, value: value2 });
                  return query;
                },
                async get() {
                  // Apply all filters
                  const docs: any[] = [];
                  
                  for (const [id, data] of mockScheduledMessages.entries()) {
                    let matches = true;
                    
                    for (const filter of query._filters) {
                      if (filter.field === 'status' && filter.op === '==' && data.status !== filter.value) {
                        matches = false;
                        break;
                      }
                      if (filter.field === 'scheduledAt' && filter.op === '<=' && new Date(data.scheduledAt) > new Date(filter.value)) {
                        matches = false;
                        break;
                      }
                    }
                    
                    if (matches) {
                      docs.push({
                        id,
                        data: () => ({ ...data }),
                        ref: {
                          async update(updates: any) {
                            Object.assign(data, updates);
                          },
                        },
                      });
                    }
                  }
                  
                  return { docs, empty: docs.length === 0 };
                },
              };
              
              return query;
            },
            doc: (id?: string) => {
              const docId = id || `doc-${++docIdCounter}`;
              return {
                id: docId,
                async set(data: any) {
                  mockScheduledMessages.set(docId, { ...data });
                },
                async get() {
                  const data = mockScheduledMessages.get(docId);
                  return {
                    exists: !!data,
                    data: () => (data ? { ...data } : undefined),
                  };
                },
                async update(updates: any) {
                  const existing = mockScheduledMessages.get(docId);
                  if (existing) {
                    Object.assign(existing, updates);
                  }
                },
                async delete() {
                  mockScheduledMessages.delete(docId);
                },
              };
            },
          };
        }
        return {
          doc: vi.fn(),
          where: vi.fn(),
        };
      },
    },
  };
});

describe('Scheduled Message Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScheduledMessages.clear();
    docIdCounter = 0;
  });

  const createScheduledMessage = async (data: {
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    scheduledAt: string;
    templateId?: string;
    recipientContact?: string;
    retryCount?: number;
  }) => {
    const { adminDb } = await import('../firebase-admin');
    const docRef = adminDb.collection('scheduled_messages').doc();
    await docRef.set({
      organizationId: 'test-org',
      templateId: data.templateId || 'test-template-id',
      channel: 'email',
      recipientContact: data.recipientContact || 'test@example.com',
      recipientEntityId: 'test-entity-id',
      variables: { test: 'value' },
      scheduledAt: data.scheduledAt,
      status: data.status,
      retryCount: data.retryCount || 0,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  };

  describe('Message Selection', () => {
    it('should only process messages where scheduledAt <= now and status === pending', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour from now

      // Create test messages
      const pastPendingId = await createScheduledMessage({
        status: 'pending',
        scheduledAt: past,
      });

      await createScheduledMessage({
        status: 'pending',
        scheduledAt: future,
      });

      await createScheduledMessage({
        status: 'sent',
        scheduledAt: past,
      });

      await createScheduledMessage({
        status: 'cancelled',
        scheduledAt: past,
      });

      // Mock successful send
      vi.mocked(messagingEngine.sendMessage).mockResolvedValue({
        success: true,
        logId: 'test-log-id',
      });

      // Process messages
      const result = await processScheduledMessages();

      // Should only process the past pending message
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);

      // Verify sendMessage was called exactly once
      expect(messagingEngine.sendMessage).toHaveBeenCalledTimes(1);
      expect(messagingEngine.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'test-template-id',
          recipient: 'test@example.com',
        })
      );

      // Verify status updates
      const { adminDb } = await import('../firebase-admin');
      const pastPendingDoc = await adminDb.collection('scheduled_messages').doc(pastPendingId).get();
      expect(pastPendingDoc.data()?.status).toBe('sent');
      expect(pastPendingDoc.data()?.sentAt).toBeDefined();
    });

    it('should not process future messages', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 1 day from now

      await createScheduledMessage({
        status: 'pending',
        scheduledAt: future,
      });

      const result = await processScheduledMessages();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(messagingEngine.sendMessage).not.toHaveBeenCalled();
    });

    it('should not process already sent messages', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      await createScheduledMessage({
        status: 'sent',
        scheduledAt: past,
      });

      const result = await processScheduledMessages();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(messagingEngine.sendMessage).not.toHaveBeenCalled();
    });

    it('should not process cancelled messages', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      await createScheduledMessage({
        status: 'cancelled',
        scheduledAt: past,
      });

      const result = await processScheduledMessages();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(messagingEngine.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed messages up to 3 times before marking as failed', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const messageId = await createScheduledMessage({
        status: 'pending',
        scheduledAt: past,
        retryCount: 0,
      });

      const { adminDb } = await import('../firebase-admin');

      // Mock first failure
      vi.mocked(messagingEngine.sendMessage).mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

      // First attempt - should increment retry count and reschedule
      let result = await processScheduledMessages();
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);

      let doc = await adminDb.collection('scheduled_messages').doc(messageId).get();
      let data = doc.data();
      expect(data?.status).toBe('pending');
      expect(data?.retryCount).toBe(1);
      expect(data?.error).toBe('Network error');
      expect(new Date(data?.scheduledAt).getTime()).toBeGreaterThan(Date.now());

      // Update scheduledAt to past for second attempt
      await adminDb.collection('scheduled_messages').doc(messageId).update({
        scheduledAt: past,
      });

      // Mock second failure
      vi.mocked(messagingEngine.sendMessage).mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

      // Second attempt
      result = await processScheduledMessages();
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);

      doc = await adminDb.collection('scheduled_messages').doc(messageId).get();
      data = doc.data();
      expect(data?.status).toBe('pending');
      expect(data?.retryCount).toBe(2);

      // Update scheduledAt to past for third attempt
      await adminDb.collection('scheduled_messages').doc(messageId).update({
        scheduledAt: past,
      });

      // Mock third failure - should mark as failed
      vi.mocked(messagingEngine.sendMessage).mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

      // Third attempt - should mark as failed
      result = await processScheduledMessages();
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);

      doc = await adminDb.collection('scheduled_messages').doc(messageId).get();
      data = doc.data();
      expect(data?.status).toBe('failed');
      expect(data?.retryCount).toBe(3);
      expect(data?.error).toBe('Network error');
    });

    it('should successfully send message after retry', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const messageId = await createScheduledMessage({
        status: 'pending',
        scheduledAt: past,
        retryCount: 1, // Already retried once
      });

      // Mock successful send on retry
      vi.mocked(messagingEngine.sendMessage).mockResolvedValueOnce({
        success: true,
        logId: 'test-log-id',
      });

      const result = await processScheduledMessages();
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);

      const { adminDb } = await import('../firebase-admin');
      const doc = await adminDb.collection('scheduled_messages').doc(messageId).get();
      const data = doc.data();
      expect(data?.status).toBe('sent');
      expect(data?.sentAt).toBeDefined();
    });

    it('should apply exponential backoff for retries', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const messageId = await createScheduledMessage({
        status: 'pending',
        scheduledAt: past,
        retryCount: 0,
      });

      // Mock failure
      vi.mocked(messagingEngine.sendMessage).mockResolvedValueOnce({
        success: false,
        error: 'Temporary error',
      });

      const beforeProcess = Date.now();
      await processScheduledMessages();
      const afterProcess = Date.now();

      const { adminDb } = await import('../firebase-admin');
      const doc = await adminDb.collection('scheduled_messages').doc(messageId).get();
      const data = doc.data();
      
      // Should be rescheduled 5 minutes in the future (retryCount * 5 minutes)
      const rescheduledTime = new Date(data?.scheduledAt).getTime();
      const expectedMinDelay = 5 * 60 * 1000; // 5 minutes in ms
      const expectedMaxDelay = 6 * 60 * 1000; // 6 minutes in ms (with buffer)

      expect(rescheduledTime).toBeGreaterThanOrEqual(beforeProcess + expectedMinDelay);
      expect(rescheduledTime).toBeLessThanOrEqual(afterProcess + expectedMaxDelay);
    });
  });

  describe('Error Handling', () => {
    it('should handle sendMessage exceptions gracefully', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      await createScheduledMessage({
        status: 'pending',
        scheduledAt: past,
      });

      // Mock exception
      vi.mocked(messagingEngine.sendMessage).mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      const result = await processScheduledMessages();

      // Should not throw, should handle gracefully
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0); // Not failed yet, will retry
    });

    it('should store error message in failed messages', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const messageId = await createScheduledMessage({
        status: 'pending',
        scheduledAt: past,
        retryCount: 2, // Already retried twice
      });

      const errorMessage = 'Template not found';
      vi.mocked(messagingEngine.sendMessage).mockResolvedValueOnce({
        success: false,
        error: errorMessage,
      });

      await processScheduledMessages();

      const { adminDb } = await import('../firebase-admin');
      const doc = await adminDb.collection('scheduled_messages').doc(messageId).get();
      const data = doc.data();
      expect(data?.status).toBe('failed');
      expect(data?.error).toBe(errorMessage);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple messages in a single run', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Create 5 pending messages
      for (let i = 0; i < 5; i++) {
        await createScheduledMessage({
          status: 'pending',
          scheduledAt: past,
          recipientContact: `test${i}@example.com`,
        });
      }

      // Mock all successful
      vi.mocked(messagingEngine.sendMessage).mockResolvedValue({
        success: true,
        logId: 'test-log-id',
      });

      const result = await processScheduledMessages();

      expect(result.sent).toBe(5);
      expect(result.failed).toBe(0);
      expect(messagingEngine.sendMessage).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed success and failure in batch', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Create 3 messages
      await createScheduledMessage({
        status: 'pending',
        scheduledAt: past,
        recipientContact: 'success@example.com',
      });

      await createScheduledMessage({
        status: 'pending',
        scheduledAt: past,
        recipientContact: 'fail@example.com',
        retryCount: 2, // Will fail on next attempt
      });

      await createScheduledMessage({
        status: 'pending',
        scheduledAt: past,
        recipientContact: 'success2@example.com',
      });

      // Mock mixed results
      vi.mocked(messagingEngine.sendMessage)
        .mockResolvedValueOnce({ success: true, logId: 'log-1' })
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: true, logId: 'log-3' });

      const result = await processScheduledMessages();

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });
  });
});
