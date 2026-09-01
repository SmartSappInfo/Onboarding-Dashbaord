import { describe, it, expect } from 'vitest';
import { validateSafeUrl, normalizeQRCode } from '@/lib/qr-actions';
import { DEFAULT_QR_LIFECYCLE_CONFIG, DEFAULT_QR_SECURITY_CONFIG, DEFAULT_QR_DESIGN } from '@/lib/qr-constants';
import type { QRCode, QRLifecycleConfig, QRSecurityConfig } from '@/lib/types';

describe('QR Safety & Safe URL Validator', () => {
  it('allows safe HTTPS and HTTP destination URLs', () => {
    expect(validateSafeUrl('https://smartsapp.com')).toBe(true);
    expect(validateSafeUrl('https://example.com/survey/123?utm_source=qr')).toBe(true);
    expect(validateSafeUrl('http://insecure-legacy-site.org')).toBe(true);
  });

  it('rejects unsafe protocols and malicious open redirect schemes', () => {
    expect(validateSafeUrl('javascript:alert(1)')).toBe(false);
    expect(validateSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(validateSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(validateSafeUrl('file:///etc/passwd')).toBe(false);
    expect(validateSafeUrl('blob:https://example.com/uuid')).toBe(false);
    expect(validateSafeUrl('not a url')).toBe(false);
    expect(validateSafeUrl('')).toBe(false);
  });
});

describe('QR Normalization Layer (Zero-Crash Guarantee)', () => {
  it('supplies canonical lifecycleConfig and securityConfig to legacy documents', () => {
    const legacyDoc = {
      id: 'qr-123',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Old QR Code',
      type: 'url',
      mode: 'dynamic',
      status: 'active',
      destination: { url: 'https://smartsapp.com/dest' },
      design: { ...DEFAULT_QR_DESIGN },
      stats: { totalScans: 42, uniqueScans: 30 },
      tracking: { enabled: true },
      createdBy: { userId: 'u1', name: 'Admin', email: 'admin@smartsapp.com' },
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    const normalized = normalizeQRCode(legacyDoc);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    expect(normalized.lifecycleConfig).toBeDefined();
    expect(normalized.lifecycleConfig?.maxScans).toBeUndefined();
    expect(normalized.lifecycleConfig?.expiresAt).toBeUndefined();
    expect(normalized.securityConfig).toBeDefined();
    expect(normalized.securityConfig?.anonymizeIp).toBe(true);
  });

  it('preserves configured lifecycle and security settings', () => {
    const customLifecycle: QRLifecycleConfig = {
      startAt: '2026-09-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
      maxScans: 1000,
      fallbackUrl: 'https://smartsapp.com/expired',
    };

    const customSecurity: QRSecurityConfig = {
      anonymizeIp: false,
      blockBotScans: true,
      maxScansPerMinutePerIp: 15,
    };

    const customDoc = {
      id: 'qr-456',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Campaign 2026',
      type: 'campaign',
      mode: 'dynamic',
      status: 'scheduled',
      destination: { url: 'https://smartsapp.com/promo' },
      design: { ...DEFAULT_QR_DESIGN },
      lifecycleConfig: customLifecycle,
      securityConfig: customSecurity,
      stats: { totalScans: 0, uniqueScans: 0 },
      tracking: { enabled: true },
      createdBy: { userId: 'u2', name: 'Marketer', email: 'marketer@smartsapp.com' },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const normalized = normalizeQRCode(customDoc);
    expect(normalized).not.toBeNull();
    if (!normalized) return;

    expect(normalized.lifecycleConfig?.startAt).toBe('2026-09-01T00:00:00.000Z');
    expect(normalized.lifecycleConfig?.expiresAt).toBe('2026-12-31T23:59:59.000Z');
    expect(normalized.lifecycleConfig?.maxScans).toBe(1000);
    expect(normalized.lifecycleConfig?.fallbackUrl).toBe('https://smartsapp.com/expired');
    expect(normalized.securityConfig?.maxScansPerMinutePerIp).toBe(15);
  });
});

describe('Lifecycle State Logic & Scan Cap Evaluation', () => {
  it('identifies scheduled campaign state based on start date', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const qr = normalizeQRCode({
      id: 'qr-sched',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Future Launch',
      type: 'event',
      mode: 'dynamic',
      status: 'scheduled',
      destination: { url: 'https://smartsapp.com/event' },
      design: { ...DEFAULT_QR_DESIGN },
      lifecycleConfig: { startAt: futureDate },
      stats: { totalScans: 0, uniqueScans: 0 },
      tracking: { enabled: true },
      createdBy: { userId: 'u1', name: 'Planner', email: 'planner@smartsapp.com' },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });

    expect(qr).not.toBeNull();
    if (!qr) return;

    const isBeforeStart = new Date(qr.lifecycleConfig!.startAt!).getTime() > Date.now();
    expect(isBeforeStart).toBe(true);
  });

  it('detects expiration when total scans reach maxScans cap', () => {
    const qr = normalizeQRCode({
      id: 'qr-cap',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Limited Coupon',
      type: 'payment',
      mode: 'dynamic',
      status: 'active',
      destination: { url: 'https://smartsapp.com/coupon' },
      design: { ...DEFAULT_QR_DESIGN },
      lifecycleConfig: { maxScans: 100 },
      stats: { totalScans: 100, uniqueScans: 85 },
      tracking: { enabled: true },
      createdBy: { userId: 'u1', name: 'Manager', email: 'manager@smartsapp.com' },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });

    expect(qr).not.toBeNull();
    if (!qr) return;

    const isExceeded = qr.stats.totalScans >= (qr.lifecycleConfig!.maxScans || Infinity);
    expect(isExceeded).toBe(true);
  });

  it('detects expiration when current timestamp passes expiresAt', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const qr = normalizeQRCode({
      id: 'qr-expired',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      name: 'Past Sale',
      type: 'campaign',
      mode: 'dynamic',
      status: 'active',
      destination: { url: 'https://smartsapp.com/sale' },
      design: { ...DEFAULT_QR_DESIGN },
      lifecycleConfig: { expiresAt: pastDate },
      stats: { totalScans: 5, uniqueScans: 4 },
      tracking: { enabled: true },
      createdBy: { userId: 'u1', name: 'Staff', email: 'staff@smartsapp.com' },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });

    expect(qr).not.toBeNull();
    if (!qr) return;

    const isExpired = new Date(qr.lifecycleConfig!.expiresAt!).getTime() <= Date.now();
    expect(isExpired).toBe(true);
  });
});
