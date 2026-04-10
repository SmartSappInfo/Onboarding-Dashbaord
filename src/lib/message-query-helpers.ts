'use server';

import { adminDb } from './firebase-admin';
import type { MessageLog } from './types';

/**
 * Query message logs by contact identifier (entityId or entityId)
 * Supports fallback pattern: prefer entityId, fall back to entityId
 * 
 * Requirements: 15.5, 22.1
 */
export async function getMessagesForContact(params: {
  entityId?: string;
  entityId?: string;
  workspaceId: string;
  limit?: number;
}): Promise<MessageLog[]> {
  const { entityId, workspaceId, limit: queryLimit = 50 } = params;

  try {
    let query = adminDb
      .collection('message_logs')
      .where('workspaceId', '==', workspaceId)
      .orderBy('sentAt', 'desc')
      .limit(queryLimit);

    // Prefer entityId when available (Requirement 22.1)
    if (entityId) {
      query = query.where('entityId', '==', entityId);
    } else if (entityId) {
      // Fallback to entityId for backward compatibility (Requirement 15.5)
      query = query.where('entityId', '==', entityId);
    } else {
      throw new Error('Either entityId or entityId must be provided');
    }

    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as MessageLog[];
  } catch (error: any) {
    console.error('Error querying messages for contact:', error.message);
    throw error;
  }
}

/**
 * Query message logs by multiple entity IDs
 * Useful for bulk operations or dashboard widgets
 * 
 * Requirements: 15.5, 22.1
 */
export async function getMessagesForEntities(params: {
  entityIds: string[];
  workspaceId: string;
  limit?: number;
}): Promise<MessageLog[]> {
  const { entityIds, workspaceId, limit: queryLimit = 100 } = params;

  if (entityIds.length === 0) return [];

  try {
    // Firestore 'in' query supports up to 10 values
    const chunks: string[][] = [];
    for (let i = 0; i < entityIds.length; i += 10) {
      chunks.push(entityIds.slice(i, i + 10));
    }

    const allMessages: MessageLog[] = [];

    for (const chunk of chunks) {
      const snapshot = await adminDb
        .collection('message_logs')
        .where('workspaceId', '==', workspaceId)
        .where('entityId', 'in', chunk)
        .orderBy('sentAt', 'desc')
        .limit(queryLimit)
        .get();

      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MessageLog[];

      allMessages.push(...messages);
    }

    // Sort by sentAt descending and limit
    return allMessages
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, queryLimit);
  } catch (error: any) {
    console.error('Error querying messages for entities:', error.message);
    throw error;
  }
}

/**
 * Count messages for a contact
 * 
 * Requirements: 15.5, 22.1
 */
export async function countMessagesForContact(params: {
  entityId?: string;
  entityId?: string;
  workspaceId: string;
}): Promise<number> {
  const { entityId, workspaceId } = params;

  try {
    let query = adminDb
      .collection('message_logs')
      .where('workspaceId', '==', workspaceId);

    // Prefer entityId when available
    if (entityId) {
      query = query.where('entityId', '==', entityId);
    } else if (entityId) {
      query = query.where('entityId', '==', entityId);
    } else {
      throw new Error('Either entityId or entityId must be provided');
    }

    const snapshot = await query.count().get();
    return snapshot.data().count;
  } catch (error: any) {
    console.error('Error counting messages for contact:', error.message);
    throw error;
  }
}
