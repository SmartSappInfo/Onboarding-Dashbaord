/**
 * @fileoverview SmartSapp QR Platform 2.0 Server Actions
 *
 * ARCHITECTURAL GUIDANCE & CAUTION FOR FUTURE MAINTAINERS:
 * ────────────────────────────────────────────────────────
 * 1. Multi-Tenant Isolation:
 *    - All operational QR assets (`qr_codes`, `qr_code_templates`, `qr_scan_events`) reside strictly within
 *      `organizations/{orgId}/workspaces/{wsId}/...` collections.
 *    - The root collection `short_paths/{shortPath}` is a global index used exclusively for fast O(1)
 *      redirect lookup without needing slow cross-workspace `collectionGroup` queries.
 *
 * 2. Normalization Guarantee (`normalizeQRCode`):
 *    - Legacy documents in Firestore may lack new lifecycle, security, or typed statistical attributes.
 *    - ALWAYS pass raw Firestore documents through `normalizeQRCode()` before returning to callers.
 *
 * 3. Atomic Collision Safety:
 *    - Dynamic shortlink reservations write to both the workspace document and the global `short_paths`
 *      document. When renaming or replacing shortlinks, use Firestore `batch` or transactions.
 *
 * 4. Zero `any` Policy:
 *    - All inputs, return types, and utility functions must remain strictly typed.
 *
 * @testability Exported server actions verified in unit and integration test suites.
 */

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
  QRLifecycleConfig,
  QRSecurityConfig,
  QRCodeTemplate,
  BatchQRItem,
} from '@/lib/types';
import {
  DEFAULT_QR_DESIGN,
  DEFAULT_QR_LIFECYCLE_CONFIG,
  DEFAULT_QR_SECURITY_CONFIG,
} from '@/lib/qr-constants';

// ─────────────────────────────────────────────────
// Helpers & Data Normalization
// ─────────────────────────────────────────────────

/**
 * Recursively strips `undefined` values from an object so Firestore
 * does not reject the document. Nested objects are cleaned recursively.
 * Arrays are preserved but their elements are also cleaned.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      cleaned[key] = stripUndefined(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? stripUndefined(item as Record<string, unknown>)
          : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

/**
 * Normalizes raw Firestore document data into a canonical, strictly-typed `QRCode`.
 * Provides 100% backward compatibility for legacy records created prior to Platform 2.0.
 */
export function normalizeQRCode(raw: Record<string, unknown> | undefined): QRCode | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;

  const rawStats = (raw.stats as Record<string, unknown>) || {};
  const rawDestination = (raw.destination as Record<string, unknown>) || {};
  const rawDesign = (raw.design as Record<string, unknown>) || {};
  const rawTracking = (raw.tracking as Record<string, unknown>) || {};
  const rawLifecycle = (raw.lifecycleConfig as Record<string, unknown>) || {};
  const rawSecurity = (raw.securityConfig as Record<string, unknown>) || {};
  const rawCreatedBy = (raw.createdBy as Record<string, unknown>) || {};

  const status = (raw.status as QRStatus) || 'active';
  const mode = (raw.mode as QRCodeMode) || 'static';
  const type = (raw.type as QRCodeType) || 'url';

  const destination: QRDestination = {
    url: typeof rawDestination.url === 'string' ? rawDestination.url : undefined,
    resourceType: typeof rawDestination.resourceType === 'string' ? rawDestination.resourceType : undefined,
    resourceId: typeof rawDestination.resourceId === 'string' ? rawDestination.resourceId : undefined,
    resourceName: typeof rawDestination.resourceName === 'string' ? rawDestination.resourceName : undefined,
    title: typeof rawDestination.title === 'string' ? rawDestination.title : undefined,
    fallbackUrl: typeof rawDestination.fallbackUrl === 'string' ? rawDestination.fallbackUrl : undefined,
    metadata: typeof rawDestination.metadata === 'object' && rawDestination.metadata !== null
      ? (rawDestination.metadata as Record<string, unknown>)
      : undefined,
  };

  const design: QRDesign = {
    ...DEFAULT_QR_DESIGN,
    ...(rawDesign as unknown as Partial<QRDesign>),
  };

  const tracking: QRTracking = {
    enabled: typeof rawTracking.enabled === 'boolean' ? rawTracking.enabled : mode === 'dynamic',
    utmSource: typeof rawTracking.utmSource === 'string' ? rawTracking.utmSource : undefined,
    utmMedium: typeof rawTracking.utmMedium === 'string' ? rawTracking.utmMedium : undefined,
    utmCampaign: typeof rawTracking.utmCampaign === 'string' ? rawTracking.utmCampaign : undefined,
    campaignName: typeof rawTracking.campaignName === 'string' ? rawTracking.campaignName : undefined,
    sourceLabel: typeof rawTracking.sourceLabel === 'string' ? rawTracking.sourceLabel : undefined,
  };

  const lifecycleConfig: QRLifecycleConfig = {
    ...DEFAULT_QR_LIFECYCLE_CONFIG,
    startAt: typeof rawLifecycle.startAt === 'string' ? rawLifecycle.startAt : undefined,
    expiresAt: typeof rawLifecycle.expiresAt === 'string' ? rawLifecycle.expiresAt : undefined,
    maxScans: typeof rawLifecycle.maxScans === 'number' ? rawLifecycle.maxScans : undefined,
    fallbackUrl: typeof rawLifecycle.fallbackUrl === 'string' ? rawLifecycle.fallbackUrl : destination.fallbackUrl,
    timezone: typeof rawLifecycle.timezone === 'string' ? rawLifecycle.timezone : undefined,
  };

  const securityConfig: QRSecurityConfig = {
    ...DEFAULT_QR_SECURITY_CONFIG,
    passwordProtected: typeof rawSecurity.passwordProtected === 'boolean' ? rawSecurity.passwordProtected : false,
    passwordHash: typeof rawSecurity.passwordHash === 'string' ? rawSecurity.passwordHash : undefined,
    restrictDomain: typeof rawSecurity.restrictDomain === 'boolean' ? rawSecurity.restrictDomain : false,
    allowedDomains: Array.isArray(rawSecurity.allowedDomains) ? (rawSecurity.allowedDomains as string[]) : [],
    anonymizeIp: typeof rawSecurity.anonymizeIp === 'boolean' ? rawSecurity.anonymizeIp : (DEFAULT_QR_SECURITY_CONFIG.anonymizeIp ?? true),
    blockBotScans: typeof rawSecurity.blockBotScans === 'boolean' ? rawSecurity.blockBotScans : (DEFAULT_QR_SECURITY_CONFIG.blockBotScans ?? true),
    maxScansPerMinutePerIp: typeof rawSecurity.maxScansPerMinutePerIp === 'number' ? rawSecurity.maxScansPerMinutePerIp : DEFAULT_QR_SECURITY_CONFIG.maxScansPerMinutePerIp,
  };

  return {
    id: String(raw.id),
    organizationId: String(raw.organizationId || ''),
    workspaceId: String(raw.workspaceId || ''),
    name: String(raw.name || 'Untitled QR Code'),
    slug: String(raw.slug || generateSlug(String(raw.name || 'qr'))),
    description: typeof raw.description === 'string' ? raw.description : '',
    mode,
    type,
    destination,
    shortPath: typeof raw.shortPath === 'string' ? raw.shortPath : undefined,
    redirectUrl: typeof raw.redirectUrl === 'string' ? raw.redirectUrl : undefined,
    design,
    tracking,
    status,
    lifecycleConfig,
    securityConfig,
    campaignId: typeof raw.campaignId === 'string' ? raw.campaignId : undefined,
    collectionId: typeof raw.collectionId === 'string' ? raw.collectionId : undefined,
    notifications: raw.notifications ? (raw.notifications as QRCode['notifications']) : undefined,
    stats: {
      totalScans: typeof rawStats.totalScans === 'number' ? rawStats.totalScans : 0,
      uniqueScans: typeof rawStats.uniqueScans === 'number' ? rawStats.uniqueScans : 0,
      uniqueVisitors: typeof rawStats.uniqueVisitors === 'number' ? rawStats.uniqueVisitors : 0,
      scanCountToday: typeof rawStats.scanCountToday === 'number' ? rawStats.scanCountToday : 0,
      lastScannedAt: typeof rawStats.lastScannedAt === 'string' ? rawStats.lastScannedAt : undefined,
    },
    createdBy: {
      userId: String(rawCreatedBy.userId || ''),
      name: String(rawCreatedBy.name || ''),
      email: String(rawCreatedBy.email || ''),
    },
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
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
 * Validates destination URLs against common phishing vectors, raw IP malware hosts,
 * direct executable downloads, and restricted spam TLDs.
 * Returns true if valid, false if invalid, or throws if throwOnInvalid is true.
 */
export function validateSafeUrl(url: string | undefined, throwOnInvalid = false): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) {
    if (throwOnInvalid) throw new Error('A valid destination URL is required.');
    return false;
  }

  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol.toLowerCase())) {
      if (throwOnInvalid) throw new Error('Only HTTP and HTTPS URLs are permitted.');
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // 1. Block raw IPs (often used for malware hosting)
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipPattern.test(hostname)) {
      if (throwOnInvalid) throw new Error('Raw IP addresses are not permitted for security reasons.');
      return false;
    }

    // 2. Block sketchy TLDs commonly used for spam
    const suspiciousTLDs = ['.zip', '.xxx', '.ru', '.cn', '.tk', '.ml', '.ga', '.cf', '.gq'];
    if (suspiciousTLDs.some((tld) => hostname.endsWith(tld))) {
      if (throwOnInvalid) throw new Error('This domain extension is currently restricted.');
      return false;
    }

    // 3. Block malicious file extensions in path
    const suspiciousExts = ['.exe', '.apk', '.bat', '.cmd', '.sh', '.vbs', '.msi'];
    if (suspiciousExts.some((ext) => parsed.pathname.toLowerCase().endsWith(ext))) {
      if (throwOnInvalid) throw new Error('Linking directly to executable files is restricted.');
      return false;
    }

    return true;
  } catch (err: unknown) {
    if (throwOnInvalid) {
      if (err instanceof Error) throw err;
      throw new Error('Invalid destination URL.');
    }
    return false;
  }
}

/**
 * Generates a unique shortPath for dynamic QR codes.
 * Checks Firestore for collisions and retries up to 3 times before expanding character space.
 */
async function generateUniqueShortPath(maxAttempts = 3): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = nanoid(8);
    const existing = await adminDb.collection('short_paths').doc(candidate).get();
    if (!existing.exists) return candidate;
    console.warn(`[QR] shortPath collision on "${candidate}", retrying (${attempt + 1}/${maxAttempts})`);
  }
  return nanoid(12);
}

// ─────────────────────────────────────────────────
// Create Operations
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
  lifecycleConfig?: Partial<QRLifecycleConfig>;
  securityConfig?: Partial<QRSecurityConfig>;
  status?: QRStatus;
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
      const existing = await adminDb.collection('short_paths').doc(sanitized).get();
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
  const lifecycleConfig: QRLifecycleConfig = { ...DEFAULT_QR_LIFECYCLE_CONFIG, ...input.lifecycleConfig };
  const securityConfig: QRSecurityConfig = { ...DEFAULT_QR_SECURITY_CONFIG, ...input.securityConfig };

  const redirectUrl = shortPath ? `/q/${shortPath}` : undefined;

  const initialStatus: QRStatus = input.status || (lifecycleConfig.startAt && new Date(lifecycleConfig.startAt) > new Date() ? 'scheduled' : 'active');

  const qrCode: QRCode = {
    id,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    name: input.name,
    slug: generateSlug(input.name),
    description: input.description || '',
    mode: input.mode,
    type: input.type,
    destination: input.destination,
    shortPath,
    redirectUrl,
    design,
    tracking,
    status: initialStatus,
    lifecycleConfig,
    securityConfig,
    stats: {
      totalScans: 0,
      uniqueScans: 0,
      uniqueVisitors: 0,
      scanCountToday: 0,
    },
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const batch = adminDb.batch();
  batch.set(col.doc(id), stripUndefined(qrCode as unknown as Record<string, unknown>));

  if (shortPath) {
    batch.set(adminDb.collection('short_paths').doc(shortPath), {
      orgId: input.organizationId,
      wsId: input.workspaceId,
      qrId: id,
      createdAt: now,
    });
  }

  await batch.commit();

  return { id, shortPath };
}

export async function batchCreateQRCodes(
  orgId: string,
  wsId: string,
  baseDesign: Partial<QRDesign>,
  items: BatchQRItem[],
  createdBy: { userId: string; name: string; email: string },
  jobName?: string
): Promise<{ count: number; batchJobId: string }> {
  // Bounded chunk size to stay safely within Firestore 500-op limits (25 items = 50 writes)
  const CHUNK_SIZE = 25;
  const col = qrCodesCollection(orgId, wsId);
  const now = new Date().toISOString();
  const batchJobId = nanoid(14);
  const createdIds: string[] = [];
  let count = 0;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();

    for (const item of chunk) {
      const id = nanoid(12);
      const shortPath = await generateUniqueShortPath();
      createdIds.push(id);

      const tracking: QRTracking = {
        enabled: true,
        utmSource: item.utmSource || undefined,
        utmMedium: item.utmMedium || undefined,
        utmCampaign: item.utmCampaign || undefined,
      };

      const lifecycleConfig: QRLifecycleConfig = {
        ...DEFAULT_QR_LIFECYCLE_CONFIG,
        startAt: item.startAt || undefined,
        expiresAt: item.expiresAt || undefined,
        maxScans: item.maxScans || undefined,
        fallbackUrl: item.fallbackUrl || undefined,
      };

      const qrCode: QRCode = {
        id,
        organizationId: orgId,
        workspaceId: wsId,
        name: item.name,
        slug: generateSlug(item.name),
        description: item.customData ? JSON.stringify(item.customData) : '',
        mode: 'dynamic',
        type: item.type || 'url',
        destination: { url: item.destinationUrl },
        shortPath,
        redirectUrl: `/q/${shortPath}`,
        design: { ...DEFAULT_QR_DESIGN, ...baseDesign },
        tracking,
        lifecycleConfig,
        status: lifecycleConfig.startAt && new Date(lifecycleConfig.startAt) > new Date() ? 'scheduled' : 'active',
        stats: {
          totalScans: 0,
          uniqueScans: 0,
          uniqueVisitors: 0,
          scanCountToday: 0,
        },
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(col.doc(id), stripUndefined(qrCode as unknown as Record<string, unknown>));
      batch.set(adminDb.collection('short_paths').doc(shortPath), {
        orgId,
        wsId,
        qrId: id,
        createdAt: now,
      });

      count++;
    }

    await batch.commit();
    // Inter-batch pause to prevent Firestore rate limit pressure
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  // Record batch job metadata for audit history
  try {
    const jobDoc = adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('workspaces')
      .doc(wsId)
      .collection('qr_batch_jobs')
      .doc(batchJobId);

    await jobDoc.set({
      id: batchJobId,
      organizationId: orgId,
      workspaceId: wsId,
      name: jobName || `Batch Import (${count} codes)`,
      totalCount: count,
      successfulCount: count,
      failedCount: 0,
      status: 'completed',
      itemIds: createdIds,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    console.error('Failed to log batch job metadata:', err);
  }

  return { count, batchJobId };
}

/**
 * Generates personalized dynamic QR codes in bulk for targeted CRM contacts.
 */
export async function generateQRsForAudienceAction(
  orgId: string,
  wsId: string,
  contacts: { id: string; name: string; email?: string; destinationUrl: string }[],
  baseDesign: Partial<QRDesign>,
  createdBy: { userId: string; name: string; email: string },
  campaignName?: string
): Promise<{ count: number; batchJobId: string }> {
  const items: BatchQRItem[] = contacts.map((contact) => ({
    name: contact.name,
    destinationUrl: contact.destinationUrl,
    contactId: contact.id,
    utmSource: 'crm_batch',
    utmCampaign: campaignName || 'cohort_outreach',
    customData: {
      contactId: contact.id,
      email: contact.email || '',
    },
  }));

  return batchCreateQRCodes(orgId, wsId, baseDesign, items, createdBy, campaignName || 'CRM Audience Batch');
}

/**
 * Bulk updates workspace contact tags on selected QR codes.
 */
export async function bulkTagQRCodesAction(
  orgId: string,
  wsId: string,
  qrIds: string[],
  tags: string[]
): Promise<{ success: boolean; updatedCount: number }> {
  const col = qrCodesCollection(orgId, wsId);
  const CHUNK_SIZE = 25;
  let updatedCount = 0;

  for (let i = 0; i < qrIds.length; i += CHUNK_SIZE) {
    const chunk = qrIds.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();

    for (const qrId of chunk) {
      batch.update(col.doc(qrId), {
        tags,
        updatedAt: new Date().toISOString(),
      });
      updatedCount++;
    }

    await batch.commit();
  }

  return { success: true, updatedCount };
}

// ─────────────────────────────────────────────────
// Read Operations (Strictly Normalized)
// ─────────────────────────────────────────────────

export async function getQRCode(
  orgId: string,
  wsId: string,
  qrId: string
): Promise<QRCode | null> {
  const doc = await qrCodesCollection(orgId, wsId).doc(qrId).get();
  if (!doc.exists) return null;
  return normalizeQRCode(doc.data() as Record<string, unknown>);
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
  return normalizeQRCode(snapshot.docs[0].data() as Record<string, unknown>);
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
  return snapshot.docs
    .map((doc) => normalizeQRCode(doc.data() as Record<string, unknown>))
    .filter((item): item is QRCode => item !== null);
}

// ─────────────────────────────────────────────────
// Update Operations & Lifecycle Mutations
// ─────────────────────────────────────────────────

export async function updateQRCode(
  orgId: string,
  wsId: string,
  qrId: string,
  updates: Partial<
    Pick<
      QRCode,
      | 'name'
      | 'description'
      | 'destination'
      | 'design'
      | 'tracking'
      | 'status'
      | 'lifecycleConfig'
      | 'securityConfig'
      | 'notifications'
      | 'campaignId'
      | 'collectionId'
    >
  >
): Promise<void> {
  if (updates.destination?.url) {
    validateSafeUrl(updates.destination.url);
  }

  const col = qrCodesCollection(orgId, wsId);
  await col.doc(qrId).update(
    stripUndefined({
      ...updates,
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)
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

export async function updateQRLifecycle(
  orgId: string,
  wsId: string,
  qrId: string,
  lifecycleConfig: QRLifecycleConfig
): Promise<void> {
  const current = await getQRCode(orgId, wsId, qrId);
  if (!current) throw new Error('QR Code not found');

  let newStatus: QRStatus = current.status;
  if (lifecycleConfig.startAt && new Date(lifecycleConfig.startAt) > new Date() && current.status === 'active') {
    newStatus = 'scheduled';
  } else if (lifecycleConfig.expiresAt && new Date(lifecycleConfig.expiresAt) < new Date()) {
    newStatus = 'expired';
  } else if (current.status === 'scheduled' && (!lifecycleConfig.startAt || new Date(lifecycleConfig.startAt) <= new Date())) {
    newStatus = 'active';
  }

  await updateQRCode(orgId, wsId, qrId, {
    lifecycleConfig,
    status: newStatus,
  });
}

export async function updateQRSecurity(
  orgId: string,
  wsId: string,
  qrId: string,
  securityConfig: QRSecurityConfig
): Promise<void> {
  await updateQRCode(orgId, wsId, qrId, { securityConfig });
}

export async function scheduleQRCode(
  orgId: string,
  wsId: string,
  qrId: string,
  startAt: string,
  expiresAt?: string,
  fallbackUrl?: string
): Promise<void> {
  const lifecycleConfig: QRLifecycleConfig = {
    startAt,
    expiresAt,
    fallbackUrl,
  };
  await updateQRLifecycle(orgId, wsId, qrId, lifecycleConfig);
}

export async function expireQRCode(orgId: string, wsId: string, qrId: string): Promise<void> {
  await updateQRCode(orgId, wsId, qrId, { status: 'expired' });
}

export async function pauseQRCode(orgId: string, wsId: string, qrId: string): Promise<void> {
  await updateQRCode(orgId, wsId, qrId, { status: 'paused' });
}

export async function resumeQRCode(orgId: string, wsId: string, qrId: string): Promise<void> {
  const current = await getQRCode(orgId, wsId, qrId);
  const isScheduled = current?.lifecycleConfig?.startAt && new Date(current.lifecycleConfig.startAt) > new Date();
  await updateQRCode(orgId, wsId, qrId, { status: isScheduled ? 'scheduled' : 'active' });
}

export async function archiveQRCode(orgId: string, wsId: string, qrId: string): Promise<void> {
  await updateQRCode(orgId, wsId, qrId, { status: 'archived' });
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

    const existing = await adminDb.collection('short_paths').doc(sanitized).get();
    if (existing.exists) {
      if (existing.data()?.qrId !== qrId) {
        return { success: false, error: 'This custom shortlink is already in use. Please choose another one.' };
      }
    }

    const col = qrCodesCollection(orgId, wsId);
    const qrDoc = await col.doc(qrId).get();
    if (!qrDoc.exists) {
      return { success: false, error: 'QR Code not found.' };
    }
    const oldShortPath = qrDoc.data()?.shortPath;

    const batch = adminDb.batch();
    batch.update(col.doc(qrId), {
      shortPath: sanitized,
      redirectUrl: `/q/${sanitized}`,
      updatedAt: new Date().toISOString(),
    });

    if (oldShortPath && oldShortPath !== sanitized) {
      batch.delete(adminDb.collection('short_paths').doc(oldShortPath));
    }

    batch.set(adminDb.collection('short_paths').doc(sanitized), {
      orgId,
      wsId,
      qrId,
      updatedAt: new Date().toISOString(),
    });

    await batch.commit();
    return { success: true };
  } catch (error: unknown) {
    console.error('Failed to update short path:', error);
    return { success: false, error: 'Internal Server Error: Could not save shortlink.' };
  }
}

export async function bulkQRAction(
  orgId: string,
  wsId: string,
  qrIds: string[],
  action: 'pause' | 'resume' | 'archive' | 'delete' | 'expire'
): Promise<void> {
  const col = qrCodesCollection(orgId, wsId);
  const CHUNK_SIZE = 500;

  for (let i = 0; i < qrIds.length; i += CHUNK_SIZE) {
    const chunk = qrIds.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();

    for (const id of chunk) {
      const docRef = col.doc(id);
      if (action === 'delete') {
        batch.delete(docRef);
      } else {
        const nextStatus: QRStatus =
          action === 'resume' ? 'active' : action === 'expire' ? 'expired' : (action as QRStatus);
        batch.update(docRef, {
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    await batch.commit();
  }
}

export async function duplicateQRCode(
  orgId: string,
  wsId: string,
  qrId: string,
  user: { userId: string; name: string; email: string }
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
    lifecycleConfig: original.lifecycleConfig,
    securityConfig: original.securityConfig,
    createdBy: user,
  });

  return { id: result.id };
}

export async function deleteQRCode(orgId: string, wsId: string, qrId: string): Promise<void> {
  const col = qrCodesCollection(orgId, wsId);
  const doc = await col.doc(qrId).get();
  if (doc.exists) {
    const shortPath = doc.data()?.shortPath;
    const batch = adminDb.batch();
    batch.delete(col.doc(qrId));
    if (shortPath) {
      batch.delete(adminDb.collection('short_paths').doc(shortPath));
    }
    await batch.commit();
  }
}

// ─────────────────────────────────────────────────
// Template Management
// ─────────────────────────────────────────────────

export async function saveQRTemplate(
  orgId: string,
  wsId: string,
  data: { name: string; category: string; design: QRDesign; createdBy: string; sourceTemplateId?: string }
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
    sourceTemplateId: data.sourceTemplateId,
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await col.doc(id).set(stripUndefined(template as unknown as Record<string, unknown>));
  return { id };
}

export async function updateQRTemplate(
  orgId: string,
  wsId: string,
  templateId: string,
  updates: { name?: string; category?: string; design?: QRDesign }
): Promise<void> {
  const col = qrTemplatesCollection(orgId, wsId);
  await col.doc(templateId).update(
    stripUndefined({
      ...updates,
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)
  );
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
  const pathDoc = await adminDb.collection('short_paths').doc(shortPath).get();
  if (!pathDoc.exists) return null;

  const { orgId, wsId, qrId } = pathDoc.data() as { orgId: string; wsId: string; qrId: string };
  return getQRCode(orgId, wsId, qrId);
}

// ─────────────────────────────────────────────────
// Aggregated Stats Helper
// ─────────────────────────────────────────────────

export async function getQRStudioStats(
  orgId: string,
  wsId: string
): Promise<{
  totalCodes: number;
  activeDynamic: number;
  scheduledCount: number;
  pausedCount: number;
  expiredCount: number;
  totalScans: number;
}> {
  const col = qrCodesCollection(orgId, wsId);

  const [totalSnap, activeDynamicSnap, scheduledSnap, pausedSnap, expiredSnap, allCodes] = await Promise.all([
    col.count().get(),
    col.where('mode', '==', 'dynamic').where('status', '==', 'active').count().get(),
    col.where('status', '==', 'scheduled').count().get(),
    col.where('status', '==', 'paused').count().get(),
    col.where('status', '==', 'expired').count().get(),
    col.select('stats.totalScans').get(),
  ]);

  const totalCodes = totalSnap.data().count;
  const activeDynamic = activeDynamicSnap.data().count;
  const scheduledCount = scheduledSnap.data().count;
  const pausedCount = pausedSnap.data().count;
  const expiredCount = expiredSnap.data().count;
  const totalScans = allCodes.docs.reduce(
    (sum, doc) => sum + (Number(doc.data()?.stats?.totalScans) || 0),
    0
  );

  return {
    totalCodes,
    activeDynamic,
    scheduledCount,
    pausedCount,
    expiredCount,
    totalScans,
  };
}
