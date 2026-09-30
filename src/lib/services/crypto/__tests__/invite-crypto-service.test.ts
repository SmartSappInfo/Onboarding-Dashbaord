/**
 * @fileOverview Unit tests for InviteCryptoService (AES-256-GCM)
 */

import { describe, it, expect } from 'vitest';
import { InviteCryptoService } from '../invite-crypto-service';
import type { EncryptedInvitePayload } from '@/lib/types';

describe('InviteCryptoService', () => {
  const samplePayload: EncryptedInvitePayload = {
    invitationId: 'inv-test-12345',
    organizationId: 'org-smartsapp-hq',
    organizationName: 'SmartSapp HQ',
    departmentId: 'dept-engineering-001',
    departmentName: 'Engineering',
    email: 'candidate@smartsapp.com',
    fullName: 'Jane Doe',
    tempPassword: 'TempPassword!2026',
    workspaceId: 'ws-main',
    workspaceName: 'Main Workspace',
    roleIds: ['role-dev'],
    roleNames: ['Developer'],
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days in future
  };

  it('encrypts payload to a URL-safe base64url string', () => {
    const token = InviteCryptoService.encryptInvitePayload(samplePayload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    // Base64url should not contain standard base64 characters: +, /, =
    expect(token).not.toContain('+');
    expect(token).not.toContain('/');
    expect(token).not.toContain('=');
  });

  it('successfully decrypts a valid token into original payload', () => {
    const token = InviteCryptoService.encryptInvitePayload(samplePayload);
    const decrypted = InviteCryptoService.decryptInvitePayload(token);

    expect(decrypted).not.toBeNull();
    expect(decrypted?.invitationId).toBe(samplePayload.invitationId);
    expect(decrypted?.organizationId).toBe(samplePayload.organizationId);
    expect(decrypted?.organizationName).toBe(samplePayload.organizationName);
    expect(decrypted?.departmentId).toBe(samplePayload.departmentId);
    expect(decrypted?.departmentName).toBe(samplePayload.departmentName);
    expect(decrypted?.email).toBe(samplePayload.email);
    expect(decrypted?.fullName).toBe(samplePayload.fullName);
    expect(decrypted?.tempPassword).toBe(samplePayload.tempPassword);
    expect(decrypted?.workspaceId).toBe(samplePayload.workspaceId);
    expect(decrypted?.exp).toBe(samplePayload.exp);
  });

  it('rejects tampered token with invalid authentication tag', () => {
    const token = InviteCryptoService.encryptInvitePayload(samplePayload);
    // Tamper with the middle of the token
    const tampered = token.slice(0, 15) + (token[15] === 'a' ? 'b' : 'a') + token.slice(16);
    const decrypted = InviteCryptoService.decryptInvitePayload(tampered);

    expect(decrypted).toBeNull();
  });

  it('rejects expired invitation tokens', () => {
    const expiredPayload: EncryptedInvitePayload = {
      ...samplePayload,
      exp: Date.now() - 1000, // Expired 1 second ago
    };

    const token = InviteCryptoService.encryptInvitePayload(expiredPayload);
    const decrypted = InviteCryptoService.decryptInvitePayload(token);

    expect(decrypted).toBeNull();
  });

  it('handles malformed or empty tokens gracefully without throwing', () => {
    expect(InviteCryptoService.decryptInvitePayload('')).toBeNull();
    expect(InviteCryptoService.decryptInvitePayload('not-a-valid-token')).toBeNull();
    expect(InviteCryptoService.decryptInvitePayload('invalid.parts.format')).toBeNull();
    expect(InviteCryptoService.decryptInvitePayload('!!!@@@###$$$')).toBeNull();
  });
});
