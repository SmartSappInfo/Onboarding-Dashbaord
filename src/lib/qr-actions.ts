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
 * Generates a unique shortPath for dynamic QR codes.
 * Checks Firestore for collisions and retries up to 3 times.
 */
async function generateUniqueShortPath(maxAttempts = 3): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = nanoid(8);
    const existing = await adminDb
      .collectionGroup('qr_codes')
      .where('shortPath', '==', candidate)
      .limit(1)
      .get();
    if (existing.empty) return candidate;
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
}

export async function createQRCode(input: CreateQRCodeInput): Promise<{ id: string; shortPath?: string }> {
  const col = qrCodesCollection(input.organizationId, input.workspaceId);
  const id = nanoid(12);
  const shortPath = input.mode === 'dynamic' ? await generateUniqueShortPath() : undefined;
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
  return { id, shortPath: shortPath || undefined };
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
  updates: Partial<Pick<QRCode, 'name' | 'description' | 'destination' | 'design' | 'tracking' | 'status'>>
): Promise<void> {
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
  const snapshot = await adminDb
    .collectionGroup('qr_codes')
    .where('shortPath', '==', shortPath)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as QRCode;
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
