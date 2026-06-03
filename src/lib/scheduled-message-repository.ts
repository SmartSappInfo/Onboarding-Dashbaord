import { adminDb } from '@/lib/firebase-admin';
import type { ScheduledMessage } from '@/lib/types';

/**
 * Repository layer for the scheduled_messages Firestore collection.
 * Conforms to workspace security isolation and handles all operations.
 */
export class ScheduledMessageRepository {
  /**
   * Fetches all scheduled messages scoped to a workspace and optional filters.
   */
  static async getScheduledQueue(
    workspaceId: string,
    filters?: {
      channel?: string;
      source?: string;
      status?: string;
    }
  ): Promise<ScheduledMessage[]> {
    try {
      let q: FirebaseFirestore.Query = adminDb.collection('scheduled_messages')
        .where('workspaceId', '==', workspaceId);

      if (filters?.channel && filters.channel !== 'all') {
        q = q.where('channel', '==', filters.channel);
      }

      if (filters?.status && filters.status !== 'all') {
        q = q.where('status', '==', filters.status);
      }

      if (filters?.source && filters.source !== 'all') {
        q = q.where('sourceEventType', '==', filters.source);
      }

      const snap = await q.orderBy('scheduledAt', 'asc').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ScheduledMessage);
    } catch (err: any) {
      console.error('[ScheduledMessageRepo] Failed to fetch scheduled queue:', err.message);
      throw err;
    }
  }

  /**
   * Creates a new scheduled message in the database.
   */
  static async create(msg: Omit<ScheduledMessage, 'id'>): Promise<string> {
    const docRef = await adminDb.collection('scheduled_messages').add(msg);
    return docRef.id;
  }

  /**
   * Reschedules an existing message by updating the scheduledAt timestamp.
   */
  static async updateSchedule(id: string, scheduledAt: Date): Promise<void> {
    await adminDb.collection('scheduled_messages').doc(id).update({
      scheduledAt: scheduledAt.toISOString(),
      status: 'pending', // Re-queue if it failed or was in a different status
      error: null
    });
  }

  /**
   * Updates the subject and body of an existing scheduled message.
   */
  static async updateContent(id: string, subject?: string | null, body?: string | null): Promise<void> {
    await adminDb.collection('scheduled_messages').doc(id).update({
      customSubject: subject || null,
      customBody: body || null,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Cancels a scheduled message by setting status to 'cancelled'.
   */
  static async cancel(id: string): Promise<void> {
    const docRef = adminDb.collection('scheduled_messages').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      throw new Error(`Scheduled message with ID ${id} not found.`);
    }

    const data = docSnap.data() as ScheduledMessage;

    // Trigger provider cancellation if it was pushed to Resend/mNotify (legacy compatibility)
    if (data.providerId) {
      try {
        if (data.channel === 'email') {
          const { cancelScheduledEmailAction } = await import('@/lib/resend-actions');
          await cancelScheduledEmailAction(data.providerId);
        } else if (data.channel === 'sms') {
          const { deleteScheduledMessageAction } = await import('@/lib/mnotify-actions');
          await deleteScheduledMessageAction(data.providerId);
        }
      } catch (err: any) {
        console.warn(`[ScheduledMessageRepo] Provider cancellation failed for ${id}:`, err.message);
      }
    }

    await docRef.update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });
  }

  /**
   * Immediately dispatches a scheduled message.
   */
  static async sendNow(id: string): Promise<{ success: boolean; error?: string }> {
    const docRef = adminDb.collection('scheduled_messages').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: 'Scheduled message not found' };
    }

    const msg = { id: docSnap.id, ...docSnap.data() } as ScheduledMessage;
    
    // Dynamically import sendMessage to prevent circular dependencies
    const { sendMessage } = await import('@/lib/messaging-engine');
    
    const result = await sendMessage({
      templateId: msg.templateId,
      senderProfileId: msg.senderProfileId || 'default',
      recipient: msg.recipientContact,
      variables: msg.variables || {},
      entityId: msg.recipientEntityId || null,
      workspaceId: msg.workspaceId,
      body: msg.customBody || undefined,
      subject: msg.customSubject || undefined,
    });

    if (result.success) {
      await docRef.update({
        status: 'sent',
        sentAt: new Date().toISOString(),
        error: null
      });
      return { success: true };
    } else {
      await docRef.update({
        status: 'failed',
        error: result.error || 'Immediate send failed'
      });
      return { success: false, error: result.error };
    }
  }
}
