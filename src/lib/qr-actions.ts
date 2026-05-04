'use server';

import { adminDb } from '@/lib/firebase-admin';
import { nanoid } from 'nanoid';
import type {
  QRCode,
  QRCodeMode,
  QRCodeType,
  QRDesign,
  QRDestination,
  QRTracking,
  QRStatus,
  QRCodeTemplate,
} from '@/lib/types';
import { DEFAULT_QR_DESIGN } from '@/lib/qr-constants';

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

/**
 * Recursively strips `undefined` values from an object so Firestore
 * does not reject the document. Nested objects are cleaned recursively.
 * Arrays are preserved but their elements are also cleaned.
 */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      cleaned[key] = stripUndefined(value);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? stripUndefined(item)
          : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

function qrCodesCollection(orgId: string, wsId: string) {
  return adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('workspaces')
    .doc(wsId)
    .collection('qr_codes');
}

function qrTemplatesCollection(orgId: string, wsId: string) {
  return adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('workspaces')
    .doc(wsId)
    .collection('qr_code_templates');
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

/**
 * Basic heuristic check to prevent generation of QR codes for known bad patterns.
 * This checks for common phishing keywords, sketchy TLDs, or raw IPs which
 * are often used in malicious links.
 */
function validateSafeUrl(url: string | undefined) {
  if (!url) return;
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // 1. Block raw IPs (often used for malware hosting)
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipPattern.test(hostname)) {
      throw new Error('Raw IP addresses are not permitted for security reasons.');
    }
    
    // 2. Block sketchy TLDs commonly used for spam
    const suspiciousTLDs = ['.zip', '.xxx', '.ru', '.cn', '.tk', '.ml', '.ga', '.cf', '.gq'];
    if (suspiciousTLDs.some(tld => hostname.endsWith(tld))) {
      throw new Error('This domain extension is currently restricted.');
    }

    // 3. Block malicious file extensions in path
    const suspiciousExts = ['.exe', '.apk', '.bat', '.cmd', '.sh', '.vbs'];
    if (suspiciousExts.some(ext => parsed.pathname.toLowerCase().endsWith(ext))) {
      throw new Error('Linking directly to executable files is restricted.');
    }
  } catch (err: any) {
    if (err.message.includes('restricted') || err.message.includes('security')) {
      throw err;
    }
    // If it's just an invalid URL parse error, we let it pass or fail elsewhere
  }
}

/**
 * Generates a unique shortPath for dynamic QR codes.
 * Checks Firestore for collisions and retries up to 3 times.
 */
async function generateUniqueShortPath(maxAttempts = 3): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = nanoid(8);
    // Check root 'short_paths' collection instead of collectionGroup
    const existing = await adminDb
      .collection('short_paths')
      .doc(candidate)
      .get();
      
    if (!existing.exists) return candidate;
    console.warn(`[QR] shortPath collision on "${candidate}", retrying (${attempt + 1}/${maxAttempts})`);
  }
  // Fallback: use longer ID to virtually eliminate collision
  return nanoid(12);
}

// ─────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────

export interface CreateQRCodeInput {
  organizationId: string;
  workspaceId: string;
  name: string;
  description?: string;
  mode: QRCodeMode;
  type: QRCodeType;
  destination: QRDestination;
  design?: Partial<QRDesign>;
  tracking?: Partial<QRTracking>;
  createdBy: { userId: string; name: string; email: string };
  customShortPath?: string;
}

export async function createQRCode(input: CreateQRCodeInput): Promise<{ id: string; shortPath?: string }> {
  // Validate destination safety
  if (input.type === 'url' && input.destination?.url) {
    validateSafeUrl(input.destination.url);
  }

  const col = qrCodesCollection(input.organizationId, input.workspaceId);
  const id = nanoid(12);
  
  let shortPath: string | undefined = undefined;
  if (input.mode === 'dynamic') {
    if (input.customShortPath) {
      const sanitized = input.customShortPath.trim();
      if (!/^[a-zA-Z0-9-]+$/.test(sanitized)) {
        throw new Error('Custom shortlink can only contain letters, numbers, and hyphens.');
      }
      const existing = await adminDb
        .collection('short_paths')
        .doc(sanitized)
        .get();
      if (existing.exists) {
        throw new Error('This custom shortlink is already in use. Please choose another one.');
      }
      shortPath = sanitized;
    } else {
      shortPath = await generateUniqueShortPath();
    }
  }

  const now = new Date().toISOString();

  const design: QRDesign = { ...DEFAULT_QR_DESIGN, ...input.design };
  const tracking: QRTracking = { enabled: input.mode === 'dynamic', ...input.tracking };

  // For dynamic QR codes, the redirect URL is through our domain
  const redirectUrl = shortPath ? `/q/${shortPath}` : undefined;

  const qrCode = {
    id,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    name: input.name,
    slug: generateSlug(input.name),
    description: input.description || '',
    mode: input.mode,
    type: input.type,
    destination: input.destination,
    shortPath: shortPath || null,
    redirectUrl: redirectUrl || null,
    design,
    tracking,
    status: 'active' as const,
    stats: { totalScans: 0 },
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await col.doc(id).set(stripUndefined(qrCode));
  
  // Register the short path globally for fast lookup and uniqueness
  if (shortPath) {
    await adminDb.collection('short_paths').doc(shortPath).set({
      orgId: input.organizationId,
      wsId: input.workspaceId,
      qrId: id,
      createdAt: now,
    });
  }

  return { id, shortPath: shortPath || undefined };
}

export interface BatchQRItem {
  name: string;
  destinationUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export async function batchCreateQRCodes(
  orgId: string,
  wsId: string,
  baseDesign: Partial<QRDesign>,
  items: BatchQRItem[],
  createdBy: { userId: string; name: string; email: string }
): Promise<{ count: number }> {
  const CHUNK_SIZE = 100;
  const col = qrCodesCollection(orgId, wsId);
  const now = new Date().toISOString();
  let count = 0;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();

    for (const item of chunk) {
      const id = nanoid(12);
      const shortPath = await generateUniqueShortPath();

      const tracking: QRTracking = {
        enabled: true,
        utmSource: item.utmSource || undefined,
        utmMedium: item.utmMedium || undefined,
        utmCampaign: item.utmCampaign || undefined,
      };

      const qrCode: QRCode = {
        id,
        organizationId: orgId,
        workspaceId: wsId,
        name: item.name,
        slug: generateSlug(item.name),
        description: '',
        mode: 'dynamic',
        type: 'url',
        destination: {
          url: item.destinationUrl,
        },
        shortPath,
        redirectUrl: `/q/${shortPath}`,
        design: { ...DEFAULT_QR_DESIGN, ...baseDesign },
        tracking,
        status: 'active',
        stats: { totalScans: 0 },
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(col.doc(id), stripUndefined(qrCode));
      
      // Register the short path globally
      batch.set(adminDb.collection('short_paths').doc(shortPath), {
        orgId,
        wsId,
        qrId: id,
        createdAt: now,
      });

      count++;
    }

    await batch.commit();
  }

  return { count };
}

// ─────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────

export async function getQRCode(
  orgId: string,
  wsId: string,
  qrId: string
): Promise<QRCode | null> {
  const doc = await qrCodesCollection(orgId, wsId).doc(qrId).get();
  if (!doc.exists) return null;
  return doc.data() as QRCode;
}

export async function getQRCodeByUrl(
  orgId: string,
  wsId: string,
  url: string
): Promise<QRCode | null> {
  const snapshot = await qrCodesCollection(orgId, wsId)
    .where('destination.url', '==', url)
    .limit(1)
    .get();
    
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as QRCode;
}

export interface ListQRCodesFilter {
  status?: QRStatus;
  mode?: QRCodeMode;
  type?: QRCodeType;
  limit?: number;
}

export async function listQRCodes(
  orgId: string,
  wsId: string,
  filters?: ListQRCodesFilter
): Promise<QRCode[]> {
  let query: FirebaseFirestore.Query = qrCodesCollection(orgId, wsId);

  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  }
  if (filters?.mode) {
    query = query.where('mode', '==', filters.mode);
  }
  if (filters?.type) {
    query = query.where('type', '==', filters.type);
  }

  query = query.orderBy('createdAt', 'desc');

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data() as QRCode);
}

// ─────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────

export async function updateQRCode(
  orgId: string,
  wsId: string,
  qrId: string,
  updates: Partial<Pick<QRCode, 'name' | 'description' | 'destination' | 'design' | 'tracking' | 'status' | 'notifications'>>
): Promise<void> {
  // Validate destination safety on update
  if (updates.destination?.url) {
    validateSafeUrl(updates.destination.url);
  }

  const col = qrCodesCollection(orgId, wsId);
  await col.doc(qrId).update(
    stripUndefined({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  );
}

export async function updateQRDesign(
  orgId: string,
  wsId: string,
  qrId: string,
  design: QRDesign
): Promise<void> {
  await updateQRCode(orgId, wsId, qrId, { design });
}

export async function updateQRDestination(
  orgId: string,
  wsId: string,
  qrId: string,
  destination: QRDestination
): Promise<void> {
  await updateQRCode(orgId, wsId, qrId, { destination });
}

export async function updateQRShortPath(
  orgId: string,
  wsId: string,
  qrId: string,
  newShortPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sanitized = newShortPath.trim();
    if (!/^[a-zA-Z0-9-]+$/.test(sanitized)) {
      return { success: false, error: 'Custom shortlink can only contain letters, numbers, and hyphens.' };
    }

    const existing = await adminDb
      .collection('short_paths')
      .doc(sanitized)
      .get();

    if (existing.exists) {
      if (existing.data()?.qrId !== qrId) {
        return { success: false, error: 'This custom shortlink is already in use. Please choose another one.' };
      }
    }

    const col = qrCodesCollection(orgId, wsId);
    
    // Check if the QR code exists and get its current shortPath
    const qrDoc = await col.doc(qrId).get();
    if (!qrDoc.exists) {
      return { success: false, error: 'QR Code not found.' };
    }
    const oldShortPath = qrDoc.data()?.shortPath;

    // Run as batch to update both qr_code and short_paths safely
    const batch = adminDb.batch();
    
    batch.update(col.doc(qrId), {
      shortPath: sanitized,
      redirectUrl: `/q/${sanitized}`,
      updatedAt: new Date().toISOString(),
    });

    // Remove old short_path document if it changed
    if (oldShortPath && oldShortPath !== sanitized) {
      batch.delete(adminDb.collection('short_paths').doc(oldShortPath));
    }

    // Set new short_path document
    batch.set(adminDb.collection('short_paths').doc(sanitized), {
      orgId,
      wsId,
      qrId,
      updatedAt: new Date().toISOString(),
    });

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update short path:', error);
    return { success: false, error: 'Internal Server Error: Could not save shortlink.' };
  }
}

// ─────────────────────────────────────────────────
// Status management
// ─────────────────────────────────────────────────

export async function pauseQRCode(orgId: string, wsId: string, qrId: string): Promise<void> {
  await updateQRCode(orgId, wsId, qrId, { status: 'paused' });
}

export async function resumeQRCode(orgId: string, wsId: string, qrId: string): Promise<void> {
  await updateQRCode(orgId, wsId, qrId, { status: 'active' });
}

export async function archiveQRCode(orgId: string, wsId: string, qrId: string): Promise<void> {
  await updateQRCode(orgId, wsId, qrId, { status: 'archived' });
}

export async function bulkQRAction(
  orgId: string,
  wsId: string,
  qrIds: string[],
  action: 'pause' | 'resume' | 'archive' | 'delete'
): Promise<void> {
  const col = qrCodesCollection(orgId, wsId);
  // Break into chunks of 500 for batch limits
  const CHUNK_SIZE = 500;
  
  for (let i = 0; i < qrIds.length; i += CHUNK_SIZE) {
    const chunk = qrIds.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();

    for (const id of chunk) {
      const docRef = col.doc(id);
      if (action === 'delete') {
        batch.delete(docRef);
      } else {
        batch.update(docRef, { 
          status: action === 'resume' ? 'active' : action,
          updatedAt: new Date().toISOString()
        });
      }
    }
    await batch.commit();
  }
}

// ─────────────────────────────────────────────────
// Duplicate
// ─────────────────────────────────────────────────

export async function duplicateQRCode(
  orgId: string,
  wsId: string,
  qrId: string,
  userId: { userId: string; name: string; email: string }
): Promise<{ id: string }> {
  const original = await getQRCode(orgId, wsId, qrId);
  if (!original) throw new Error('QR code not found');

  const result = await createQRCode({
    organizationId: orgId,
    workspaceId: wsId,
    name: `${original.name} (Copy)`,
    description: original.description,
    mode: original.mode,
    type: original.type,
    destination: original.destination,
    design: original.design,
    tracking: original.tracking,
    createdBy: userId,
  });

  return { id: result.id };
}

// ─────────────────────────────────────────────────
// Delete (hard delete for workspace cleanup)
// ─────────────────────────────────────────────────

export async function deleteQRCode(orgId: string, wsId: string, qrId: string): Promise<void> {
  await qrCodesCollection(orgId, wsId).doc(qrId).delete();
}

// ─────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────

export async function saveQRTemplate(
  orgId: string,
  wsId: string,
  data: { name: string; category: string; design: QRDesign; createdBy: string }
): Promise<{ id: string }> {
  const col = qrTemplatesCollection(orgId, wsId);
  const id = nanoid(12);
  const now = new Date().toISOString();

  const template: QRCodeTemplate = {
    id,
    organizationId: orgId,
    workspaceId: wsId,
    scope: 'workspace',
    name: data.name,
    category: data.category,
    design: data.design,
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await col.doc(id).set(stripUndefined(template));
  return { id };
}

export async function listQRTemplates(
  orgId: string,
  wsId: string
): Promise<QRCodeTemplate[]> {
  const snapshot = await qrTemplatesCollection(orgId, wsId)
    .orderBy('createdAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => doc.data() as QRCodeTemplate);
}

export async function deleteQRTemplate(
  orgId: string,
  wsId: string,
  templateId: string
): Promise<void> {
  await qrTemplatesCollection(orgId, wsId).doc(templateId).delete();
}

// ─────────────────────────────────────────────────
// Lookup by shortPath (for redirect handler)
// ─────────────────────────────────────────────────

export async function getQRCodeByShortPath(
  shortPath: string
): Promise<QRCode | null> {
  // Direct lookup in root 'short_paths' collection
  const pathDoc = await adminDb.collection('short_paths').doc(shortPath).get();
  if (!pathDoc.exists) return null;

  const { orgId, wsId, qrId } = pathDoc.data() as { orgId: string; wsId: string; qrId: string };
  return getQRCode(orgId, wsId, qrId);
}

// ─────────────────────────────────────────────────
// Stats helpers (uses count() aggregation)
// ─────────────────────────────────────────────────

export async function getQRStudioStats(
  orgId: string,
  wsId: string
): Promise<{
  totalCodes: number;
  activeDynamic: number;
  totalScans: number;
}> {
  const col = qrCodesCollection(orgId, wsId);

  // Run counts in parallel using Firestore count() aggregation
  const [totalSnap, activeDynamicSnap, allCodes] = await Promise.all([
    col.count().get(),
    col.where('mode', '==', 'dynamic').where('status', '==', 'active').count().get(),
    // We still need scan totals — but use select() to only fetch the stats field
    col.select('stats.totalScans').get(),
  ]);

  const totalCodes = totalSnap.data().count;
  const activeDynamic = activeDynamicSnap.data().count;
  const totalScans = allCodes.docs.reduce(
    (sum, doc) => sum + (doc.data()?.stats?.totalScans || 0),
    0
  );

  return { totalCodes, activeDynamic, totalScans };
}
