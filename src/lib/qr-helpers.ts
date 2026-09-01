/**
 * @fileoverview Pure QR Platform Helper & Normalizer Utilities
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - This file does NOT have 'use server' directive so that functions can be
 *   synchronous and shared seamlessly between client components, server actions,
 *   API routes, and unit tests.
 * - Zero `any` or `any[]` typing.
 */

import crypto from 'crypto';
import { DEFAULT_QR_DESIGN, DEFAULT_QR_LIFECYCLE_CONFIG, DEFAULT_QR_SECURITY_CONFIG } from '@/lib/qr-constants';
import type {
  QRCode,
  QRCodeMode,
  QRCodeType,
  QRStatus,
  QRDesign,
  QRLifecycleConfig,
  QRSecurityConfig,
  QRCampaign,
  QRCampaignObjective,
  QRCampaignStatus,
  QRCustomDomain,
} from '@/lib/types';
import DOMPurify from 'isomorphic-dompurify';

const PASSCODE_SALT = process.env.QR_SECURITY_SALT || 'smartsapp_qr_salt_2026';

// ─────────────────────────────────────────────────────────────────────────────
// 1. URL Safety & Sanitization
// ─────────────────────────────────────────────────────────────────────────────

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

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Arithmetic Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function safePercent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0 || isNaN(numerator) || isNaN(denominator) || numerator <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((numerator / denominator) * 1000) / 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Passcode Hashing & Constant-Time Verification
// ─────────────────────────────────────────────────────────────────────────────

export function hashPasscode(passcode: string): string {
  const clean = passcode.trim();
  return crypto
    .createHash('sha256')
    .update(`${clean}:${PASSCODE_SALT}`)
    .digest('hex');
}

export function verifyPasscode(enteredPasscode: string, storedHash: string): boolean {
  if (!enteredPasscode || !storedHash) return false;
  try {
    const computedHash = hashPasscode(enteredPasscode);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Security Access Rule Evaluator
// ─────────────────────────────────────────────────────────────────────────────

export interface SecurityEvaluationResult {
  allowed: boolean;
  requiresPasscode: boolean;
  reason?: 'passcode_required' | 'country_restricted' | 'ip_restricted' | 'rate_limited';
  message?: string;
}

export function evaluateSecurityRules(
  qr: QRCode,
  clientIp: string,
  clientCountry?: string,
  isPasscodeUnlocked = false
): SecurityEvaluationResult {
  const sec = qr.securityConfig;
  if (!sec) {
    return { allowed: true, requiresPasscode: false };
  }

  // 1. Passcode Protection Check
  const isPasscodeEnabled = sec.passwordProtected || sec.passwordEnabled;
  if (isPasscodeEnabled && sec.passwordHash) {
    if (!isPasscodeUnlocked) {
      return {
        allowed: false,
        requiresPasscode: true,
        reason: 'passcode_required',
        message: 'This QR destination requires a security PIN to access.',
      };
    }
  }

  // 2. IP Allowlist Check
  if (sec.ipAllowlist && sec.ipAllowlist.length > 0) {
    const isAllowedIp = sec.ipAllowlist.some((allowed) => allowed.trim() === clientIp.trim());
    if (!isAllowedIp) {
      return {
        allowed: false,
        requiresPasscode: false,
        reason: 'ip_restricted',
        message: 'Your IP network does not have permission to access this internal link.',
      };
    }
  }

  // 3. Geofence Country Restrictions Check
  const allowedCountries = sec.allowedCountries || sec.geoRestrictions?.countries;
  if (allowedCountries && allowedCountries.length > 0 && clientCountry) {
    const normalizedCountry = clientCountry.toUpperCase().trim();
    const isAllowed = allowedCountries.some((c) => c.toUpperCase().trim() === normalizedCountry);
    if (!isAllowed) {
      return {
        allowed: false,
        requiresPasscode: false,
        reason: 'country_restricted',
        message: `This campaign is restricted to authorized regions and is not available in ${clientCountry}.`,
      };
    }
  }

  return { allowed: true, requiresPasscode: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Normalizers
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeQRCode(raw: Record<string, unknown> | undefined): QRCode | null {
  if (!raw) return null;

  return {
    id: String(raw.id || ''),
    organizationId: String(raw.organizationId || ''),
    workspaceId: String(raw.workspaceId || ''),
    name: String(raw.name || 'Untitled QR Code'),
    slug: String(raw.slug || ''),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    mode: (raw.mode as QRCodeMode) || 'dynamic',
    type: (raw.type as QRCodeType) || 'url',
    destination: {
      url: String((raw.destination as Record<string, unknown>)?.url || ''),
      fallbackUrl: typeof (raw.destination as Record<string, unknown>)?.fallbackUrl === 'string'
        ? String((raw.destination as Record<string, unknown>)?.fallbackUrl)
        : undefined,
      resourceType: typeof (raw.destination as Record<string, unknown>)?.resourceType === 'string'
        ? ((raw.destination as Record<string, unknown>).resourceType as QRCode['destination']['resourceType'])
        : undefined,
      resourceId: typeof (raw.destination as Record<string, unknown>)?.resourceId === 'string'
        ? String((raw.destination as Record<string, unknown>)?.resourceId)
        : undefined,
    },
    shortPath: typeof raw.shortPath === 'string' ? raw.shortPath : undefined,
    redirectUrl: typeof raw.redirectUrl === 'string' ? raw.redirectUrl : undefined,
    design: {
      foregroundColor: String((raw.design as Record<string, unknown>)?.foregroundColor || '#000000'),
      backgroundColor: String((raw.design as Record<string, unknown>)?.backgroundColor || '#ffffff'),
      dotStyle: ((raw.design as Record<string, unknown>)?.dotStyle as QRCode['design']['dotStyle']) || 'square',
      cornerSquareStyle: ((raw.design as Record<string, unknown>)?.cornerSquareStyle as QRCode['design']['cornerSquareStyle']) || 'square',
      cornerSquareColor: typeof (raw.design as Record<string, unknown>)?.cornerSquareColor === 'string'
        ? String((raw.design as Record<string, unknown>)?.cornerSquareColor)
        : undefined,
      cornerDotStyle: ((raw.design as Record<string, unknown>)?.cornerDotStyle as QRCode['design']['cornerDotStyle']) || 'square',
      cornerDotColor: typeof (raw.design as Record<string, unknown>)?.cornerDotColor === 'string'
        ? String((raw.design as Record<string, unknown>)?.cornerDotColor)
        : undefined,
      logoUrl: typeof (raw.design as Record<string, unknown>)?.logoUrl === 'string'
        ? String((raw.design as Record<string, unknown>)?.logoUrl)
        : undefined,
      logoSize: typeof (raw.design as Record<string, unknown>)?.logoSize === 'number'
        ? Number((raw.design as Record<string, unknown>)?.logoSize)
        : undefined,
      logoMargin: typeof (raw.design as Record<string, unknown>)?.logoMargin === 'number'
        ? Number((raw.design as Record<string, unknown>)?.logoMargin)
        : undefined,
      frameStyle: ((raw.design as Record<string, unknown>)?.frameStyle as QRCode['design']['frameStyle']) || 'none',
      frameText: typeof (raw.design as Record<string, unknown>)?.frameText === 'string'
        ? String((raw.design as Record<string, unknown>)?.frameText)
        : undefined,
      frameColor: typeof (raw.design as Record<string, unknown>)?.frameColor === 'string'
        ? String((raw.design as Record<string, unknown>)?.frameColor)
        : undefined,
      frameTextColor: typeof (raw.design as Record<string, unknown>)?.frameTextColor === 'string'
        ? String((raw.design as Record<string, unknown>)?.frameTextColor)
        : undefined,
      frameIcon: ((raw.design as Record<string, unknown>)?.frameIcon as QRCode['design']['frameIcon']) || 'none',
      quietZone: typeof (raw.design as Record<string, unknown>)?.quietZone === 'number'
        ? Number((raw.design as Record<string, unknown>)?.quietZone)
        : 20,
      errorCorrection: ((raw.design as Record<string, unknown>)?.errorCorrection as QRCode['design']['errorCorrection']) || 'M',
      size: typeof (raw.design as Record<string, unknown>)?.size === 'number'
        ? Number((raw.design as Record<string, unknown>)?.size)
        : 300,
      posterData: typeof (raw.design as Record<string, unknown>)?.posterData === 'object' && (raw.design as Record<string, unknown>)?.posterData !== null
        ? ((raw.design as Record<string, unknown>).posterData as QRCode['design']['posterData'])
        : undefined,
    },
    tracking: {
      enabled: Boolean((raw.tracking as Record<string, unknown>)?.enabled ?? true),
      utmSource: typeof (raw.tracking as Record<string, unknown>)?.utmSource === 'string'
        ? String((raw.tracking as Record<string, unknown>)?.utmSource)
        : undefined,
      utmMedium: typeof (raw.tracking as Record<string, unknown>)?.utmMedium === 'string'
        ? String((raw.tracking as Record<string, unknown>)?.utmMedium)
        : undefined,
      utmCampaign: typeof (raw.tracking as Record<string, unknown>)?.utmCampaign === 'string'
        ? String((raw.tracking as Record<string, unknown>)?.utmCampaign)
        : undefined,
    },
    status: (raw.status as QRStatus) || 'active',
    lifecycleConfig: {
      ...DEFAULT_QR_LIFECYCLE_CONFIG,
      ...((raw.lifecycleConfig as Partial<QRLifecycleConfig>) || {}),
    },
    securityConfig: {
      ...DEFAULT_QR_SECURITY_CONFIG,
      ...((raw.securityConfig as Partial<QRSecurityConfig>) || {}),
    },
    campaignId: typeof raw.campaignId === 'string' ? raw.campaignId : undefined,
    collectionId: typeof raw.collectionId === 'string' ? raw.collectionId : undefined,
    stats: {
      totalScans: Number((raw.stats as Record<string, unknown>)?.totalScans || 0),
      uniqueScans: Number((raw.stats as Record<string, unknown>)?.uniqueScans || 0),
      uniqueVisitors: typeof (raw.stats as Record<string, unknown>)?.uniqueVisitors === 'number'
        ? Number((raw.stats as Record<string, unknown>)?.uniqueVisitors)
        : undefined,
      lastScannedAt: typeof (raw.stats as Record<string, unknown>)?.lastScannedAt === 'string'
        ? String((raw.stats as Record<string, unknown>)?.lastScannedAt)
        : undefined,
    },
    createdBy: (raw.createdBy as { userId: string; name: string; email: string }) || {
      userId: '',
      name: 'System',
      email: '',
    },
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

export function normalizeQRCampaign(docData: Record<string, unknown>): QRCampaign {
  const metricsRaw = (docData.metrics || {}) as Record<string, unknown>;
  const totalScans = Number(metricsRaw.totalScans || 0);
  const conversions = Number(metricsRaw.conversions || 0);

  return {
    id: String(docData.id || ''),
    organizationId: String(docData.organizationId || ''),
    workspaceId: String(docData.workspaceId || ''),
    name: String(docData.name || 'Untitled Campaign'),
    description: typeof docData.description === 'string' ? docData.description : undefined,
    objective: (docData.objective as QRCampaignObjective) || 'awareness',
    status: (docData.status as QRCampaignStatus) || 'active',
    qrCodeIds: Array.isArray(docData.qrCodeIds) ? docData.qrCodeIds.map(String) : [],
    attributionConfig: {
      model: ((docData.attributionConfig as Record<string, unknown>)?.model as QRCampaign['attributionConfig']['model']) || 'last_touch',
      lookbackDays: Number((docData.attributionConfig as Record<string, unknown>)?.lookbackDays || 30),
    },
    metrics: {
      totalScans,
      uniqueVisitors: Number(metricsRaw.uniqueVisitors || totalScans),
      leads: Number(metricsRaw.leads || 0),
      conversions,
      conversionRate: safePercent(conversions, totalScans),
      revenue: typeof metricsRaw.revenue === 'number' ? metricsRaw.revenue : undefined,
      lastCalculatedAt: typeof metricsRaw.lastCalculatedAt === 'string' ? metricsRaw.lastCalculatedAt : undefined,
    },
    createdBy: (docData.createdBy as { userId: string; name: string; email: string }) || {
      userId: '',
      name: 'System',
      email: '',
    },
    createdAt: String(docData.createdAt || new Date().toISOString()),
    updatedAt: String(docData.updatedAt || new Date().toISOString()),
  };
}
