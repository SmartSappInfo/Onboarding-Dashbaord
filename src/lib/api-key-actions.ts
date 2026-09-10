'use server';

import { adminDb } from './firebase-admin';
import crypto from 'crypto';
import { requireAuth, requireSystemAdmin } from './auth/require-auth';
import { authorizeWorkspaceOrBackoffice, authorizeBackofficeSession } from './backoffice/backoffice-auth';

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
  name: string
): Promise<{ success: boolean; error?: string; key?: string; record?: ApiKeyRecord }> {
  try {
    // SECURITY (audit F2): this mints a live `sk_live_` credential. It previously took
    // the creating userId as an argument and checked nothing, so any caller could mint
    // a working API key for any workspace and attribute it to anyone.
    // Reachable from the tenant admin UI and from the backoffice developer page, which
    // mints keys for workspaces its operators do not belong to.
    const { uid: userId } = await authorizeWorkspaceOrBackoffice(workspaceId, 'settings', 'create');

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
    // SECURITY (audit F2): with no workspaceId this returns every active key on the
    // platform, so that form is restricted to system admins. A scoped call only needs
    // membership of the workspace being listed.
    if (workspaceId) {
      await authorizeWorkspaceOrBackoffice(workspaceId, 'settings', 'view');
    } else {
      // The unscoped form returns every active key on the platform. The backoffice
      // developer page uses it deliberately; nobody else should reach it.
      try {
        await requireSystemAdmin();
      } catch (adminError) {
        try {
          await authorizeBackofficeSession('settings', 'view');
        } catch {
          throw adminError;
        }
      }
    }

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
    // SECURITY (audit F2): this accepted a bare key id and revoked it with no check, so
    // anyone could disable another tenant's integrations. Resolve the key first, then
    // require membership of the workspace that owns it.
    await requireAuth();

    const keySnap = await adminDb.collection('api_keys').doc(keyId).get();
    if (!keySnap.exists) {
      return { success: false, error: 'API key not found.' };
    }
    const owningWorkspaceId = keySnap.data()?.workspaceId;
    if (!owningWorkspaceId) {
      return { success: false, error: 'API key is not attached to a workspace.' };
    }
    await authorizeWorkspaceOrBackoffice(owningWorkspaceId, 'settings', 'delete');

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
