/**
 * @fileoverview Phase 6 Unit Test Suite: Custom Domains,
 * Salted Passcode Hashing, Geofencing, and IP Security Guardrails.
 */

import { describe, it, expect } from 'vitest';
import {
  hashPasscode,
  verifyPasscode,
  evaluateSecurityRules,
} from '@/lib/qr-helpers';
import type { QRCode } from '@/lib/types';

describe('QR Security — Salted Passcode Hashing & Constant-Time Verification', () => {
  it('generates consistent SHA-256 hashes for the same passcode', () => {
    const pin = '4829';
    const hash1 = hashPasscode(pin);
    const hash2 = hashPasscode(pin);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // standard 32-byte hex
  });

  it('correctly verifies valid passcode and rejects invalid passcode', () => {
    const correctPin = '1234';
    const hash = hashPasscode(correctPin);

    expect(verifyPasscode('1234', hash)).toBe(true);
    expect(verifyPasscode('9999', hash)).toBe(false);
    expect(verifyPasscode('', hash)).toBe(false);
    expect(verifyPasscode('1234', '')).toBe(false);
  });
});

describe('QR Security — Security Rule Evaluation Engine', () => {
  const baseQR: QRCode = {
    id: 'qr_test_1',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    name: 'Secure Portal QR',
    slug: 'secure-portal',
    mode: 'dynamic',
    type: 'url',
    destination: { url: 'https://myschool.com/portal' },
    design: {
      foregroundColor: '#000000',
      backgroundColor: '#ffffff',
      dotStyle: 'square',
      cornerSquareStyle: 'square',
      cornerDotStyle: 'square',
      errorCorrection: 'M',
      quietZone: 20,
    },
    tracking: { enabled: true },
    status: 'active',
    stats: { totalScans: 0, uniqueScans: 0 },
    createdBy: { userId: 'u_test', name: 'Test User', email: 'test@example.com' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('permits open access when no security rules are configured', () => {
    const res = evaluateSecurityRules(baseQR, '192.168.1.1', 'GH');
    expect(res.allowed).toBe(true);
    expect(res.requiresPasscode).toBe(false);
  });

  it('triggers passcode requirement when passcode is enabled and locked', () => {
    const protectedQR: QRCode = {
      ...baseQR,
      securityConfig: {
        passwordProtected: true,
        passwordHash: hashPasscode('5555'),
      },
    };

    // When locked
    const lockedRes = evaluateSecurityRules(protectedQR, '192.168.1.1', 'GH', false);
    expect(lockedRes.allowed).toBe(false);
    expect(lockedRes.requiresPasscode).toBe(true);
    expect(lockedRes.reason).toBe('passcode_required');

    // When unlocked via session cookie
    const unlockedRes = evaluateSecurityRules(protectedQR, '192.168.1.1', 'GH', true);
    expect(unlockedRes.allowed).toBe(true);
    expect(unlockedRes.requiresPasscode).toBe(false);
  });

  it('enforces country geofencing boundaries', () => {
    const geoQR: QRCode = {
      ...baseQR,
      securityConfig: {
        allowedCountries: ['GH', 'NG', 'KE'],
      },
    };

    // Ghana (allowed)
    const ghRes = evaluateSecurityRules(geoQR, '102.176.0.1', 'GH');
    expect(ghRes.allowed).toBe(true);

    // United States (blocked)
    const usRes = evaluateSecurityRules(geoQR, '72.14.201.1', 'US');
    expect(usRes.allowed).toBe(false);
    expect(usRes.reason).toBe('country_restricted');
  });

  it('enforces IP allowlist boundaries', () => {
    const ipQR: QRCode = {
      ...baseQR,
      securityConfig: {
        ipAllowlist: ['192.168.10.50', '10.0.0.1'],
      },
    };

    // Allowed IP
    const allowedRes = evaluateSecurityRules(ipQR, '192.168.10.50');
    expect(allowedRes.allowed).toBe(true);

    // Blocked IP
    const blockedRes = evaluateSecurityRules(ipQR, '203.0.113.195');
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.reason).toBe('ip_restricted');
  });
});
