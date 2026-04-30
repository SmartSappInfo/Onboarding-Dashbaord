'use server';

import { adminDb } from './firebase-admin';
import crypto from 'crypto';

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  workspaceId: string;
  organizationId: string;
  createdAt: string;
  lastUsedAt: string | null;
  createdBy: string;
}

export async function generateApiKey(
  workspaceId: string,
  organizationId: string,
  name: string,
  userId: string
): Promise<{ success: boolean; error?: string; key?: string; record?: ApiKeyRecord }> {
  try {
    // Generate a secure random string
    const rawKey = crypto.randomBytes(32).toString('hex');
    const fullKey = `sk_live_${rawKey}`;
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const keyPrefix = `sk_live_...${rawKey.substring(rawKey.length - 4)}`;
    
    const id = `apikey_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const record = {
      id,
      name,
      keyPrefix,
      keyHash,
      workspaceId,
      organizationId,
      createdAt: timestamp,
      lastUsedAt: null,
      createdBy: userId,
      status: 'active'
    };

    await adminDb.collection('api_keys').doc(id).set(record);

    return { 
      success: true, 
      key: fullKey, 
      record: {
        id: record.id,
        name: record.name,
        keyPrefix: record.keyPrefix,
        workspaceId: record.workspaceId,
        organizationId: record.organizationId,
        createdAt: record.createdAt,
        lastUsedAt: record.lastUsedAt,
        createdBy: record.createdBy
      }
    };
  } catch (error: any) {
    console.error('[API_KEYS] generateApiKey error:', error);
    return { success: false, error: error.message };
  }
}

export async function listApiKeys(workspaceId?: string): Promise<{ success: boolean; keys?: ApiKeyRecord[]; error?: string }> {
  try {
    let query: any = adminDb.collection('api_keys').where('status', '==', 'active');
    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }
    
    const snap = await query.get();
    
    const keys: ApiKeyRecord[] = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: data.id,
        name: data.name,
        keyPrefix: data.keyPrefix,
        workspaceId: data.workspaceId,
        organizationId: data.organizationId,
        createdAt: data.createdAt,
        lastUsedAt: data.lastUsedAt || null,
        createdBy: data.createdBy
      };
    });

    // Sort by createdAt desc in memory
    keys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, keys };
  } catch (error: any) {
    console.error('[API_KEYS] listApiKeys error:', error);
    return { success: false, error: error.message };
  }
}

export async function revokeApiKey(keyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await adminDb.collection('api_keys').doc(keyId).update({
      status: 'revoked',
      revokedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error: any) {
    console.error('[API_KEYS] revokeApiKey error:', error);
    return { success: false, error: error.message };
  }
}
