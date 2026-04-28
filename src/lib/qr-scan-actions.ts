'use server';

import { adminDb } from '@/lib/firebase-admin';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { QRScanEvent } from '@/lib/types';

// ─────────────────────────────────────────────────
// Collection helpers
// ─────────────────────────────────────────────────

function scanEventsCollection(orgId: string, wsId: string) {
  return adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('workspaces')
    .doc(wsId)
    .collection('qr_scan_events');
}

function qrCodeDoc(orgId: string, wsId: string, qrId: string) {
  return adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('workspaces')
    .doc(wsId)
    .collection('qr_codes')
    .doc(qrId);
}

// ─────────────────────────────────────────────────
// Device/Browser parsing
// ─────────────────────────────────────────────────

function parseUserAgent(ua: string): { deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown'; browser: string; os: string } {
  const lowerUA = ua.toLowerCase();

  // Device type
  let deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' = 'unknown';
  if (/ipad|tablet|kindle|playbook/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/windows|macintosh|linux|cros/i.test(ua)) {
    deviceType = 'desktop';
  }

  // Browser
  let browser = 'Unknown';
  if (lowerUA.includes('edg/')) browser = 'Edge';
  else if (lowerUA.includes('opr/') || lowerUA.includes('opera')) browser = 'Opera';
  else if (lowerUA.includes('chrome') && !lowerUA.includes('edg/')) browser = 'Chrome';
  else if (lowerUA.includes('safari') && !lowerUA.includes('chrome')) browser = 'Safari';
  else if (lowerUA.includes('firefox')) browser = 'Firefox';

  // OS
  let os = 'Unknown';
  if (lowerUA.includes('windows')) os = 'Windows';
  else if (lowerUA.includes('mac os') || lowerUA.includes('macintosh')) os = 'macOS';
  else if (lowerUA.includes('android')) os = 'Android';
  else if (lowerUA.includes('iphone') || lowerUA.includes('ipad')) os = 'iOS';
  else if (lowerUA.includes('linux')) os = 'Linux';
  else if (lowerUA.includes('cros')) os = 'Chrome OS';

  return { deviceType, browser, os };
}

function hashIP(ip: string): string {
  return createHash('sha256').update(ip + 'smartsapp-qr-salt').digest('hex').slice(0, 16);
}

// ─────────────────────────────────────────────────
// Record Scan Event
// ─────────────────────────────────────────────────

export interface RecordScanInput {
  organizationId: string;
  workspaceId: string;
  qrCodeId: string;
  destinationUrl: string;
  resourceType?: string;
  resourceId?: string;
  userAgent: string;
  ipRaw: string;
}

export async function recordScanEvent(input: RecordScanInput): Promise<void> {
  const {
    organizationId,
    workspaceId,
    qrCodeId,
    destinationUrl,
    resourceType,
    resourceId,
    userAgent,
    ipRaw,
  } = input;

  const { deviceType, browser, os } = parseUserAgent(userAgent);
  const ipHash = hashIP(ipRaw);
  const now = new Date().toISOString();
  const id = nanoid(16);

  const event: QRScanEvent = {
    id,
    organizationId,
    workspaceId,
    qrCodeId,
    scannedAt: now,
    sessionId: nanoid(8),
    deviceType,
    browser,
    os,
    ipHash,
    destinationUrl,
    resourceType,
    resourceId,
  };

  // Write scan event and increment counter in parallel
  await Promise.all([
    scanEventsCollection(organizationId, workspaceId).doc(id).set(event),
    qrCodeDoc(organizationId, workspaceId, qrCodeId).update({
      'stats.totalScans': FieldValue.increment(1),
      'stats.lastScannedAt': now,
    }),
  ]);
}

// ─────────────────────────────────────────────────
// Analytics Queries
// ─────────────────────────────────────────────────

export interface ScanAnalytics {
  totalScans: number;
  deviceBreakdown: Record<string, number>;
  browserBreakdown: Record<string, number>;
  osBreakdown: Record<string, number>;
  recentScans: QRScanEvent[];
  scansByDay: { date: string; count: number }[];
}

export async function getQRAnalytics(
  orgId: string,
  wsId: string,
  qrCodeId: string,
  days: number = 30
): Promise<ScanAnalytics> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const snapshot = await scanEventsCollection(orgId, wsId)
    .where('qrCodeId', '==', qrCodeId)
    .where('scannedAt', '>=', cutoff.toISOString())
    .orderBy('scannedAt', 'desc')
    .get();

  const events = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data() as QRScanEvent);

  // Compute breakdowns
  const deviceBreakdown: Record<string, number> = {};
  const browserBreakdown: Record<string, number> = {};
  const osBreakdown: Record<string, number> = {};
  const dailyCounts: Record<string, number> = {};

  events.forEach((e) => {
    const device = e.deviceType || 'unknown';
    deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;

    const browser = e.browser || 'Unknown';
    browserBreakdown[browser] = (browserBreakdown[browser] || 0) + 1;

    const os = e.os || 'Unknown';
    osBreakdown[os] = (osBreakdown[os] || 0) + 1;

    const day = e.scannedAt.split('T')[0];
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });

  const scansByDay = Object.entries(dailyCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalScans: events.length,
    deviceBreakdown,
    browserBreakdown,
    osBreakdown,
    recentScans: events.slice(0, 20),
    scansByDay,
  };
}
