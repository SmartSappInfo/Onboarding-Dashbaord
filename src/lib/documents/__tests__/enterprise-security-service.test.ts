import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifyDocumentPermission,
  sanitizeDocumentInputPayload,
  checkEventRateLimit,
  resetRateLimitRegistry,
} from '../enterprise-security-service';

describe('Enterprise Security & RBAC Service (Phase 13)', () => {
  beforeEach(() => {
    resetRateLimitRegistry();
  });

  describe('verifyDocumentPermission (RBAC Matrix)', () => {
    it('grants workspace_admin full administrative access across all permissions', () => {
      expect(verifyDocumentPermission('workspace_admin', 'documents.view')).toBe(true);
      expect(verifyDocumentPermission('workspace_admin', 'documents.create')).toBe(true);
      expect(verifyDocumentPermission('workspace_admin', 'documents.delete')).toBe(true);
      expect(verifyDocumentPermission('workspace_admin', 'documents.manage_access')).toBe(true);
      expect(verifyDocumentPermission('workspace_admin', 'documents.manage_integrations')).toBe(true);
    });

    it('enforces content_manager boundaries: can create/edit/publish, cannot delete or manage access', () => {
      expect(verifyDocumentPermission('content_manager', 'documents.create')).toBe(true);
      expect(verifyDocumentPermission('content_manager', 'documents.publish')).toBe(true);
      expect(verifyDocumentPermission('content_manager', 'documents.delete')).toBe(false);
      expect(verifyDocumentPermission('content_manager', 'documents.manage_access')).toBe(false);
    });

    it('enforces marketing_user boundaries: can view/share/analyze, cannot edit or delete', () => {
      expect(verifyDocumentPermission('marketing_user', 'documents.view')).toBe(true);
      expect(verifyDocumentPermission('marketing_user', 'documents.share')).toBe(true);
      expect(verifyDocumentPermission('marketing_user', 'documents.analytics')).toBe(true);
      expect(verifyDocumentPermission('marketing_user', 'documents.edit')).toBe(false);
      expect(verifyDocumentPermission('marketing_user', 'documents.delete')).toBe(false);
    });

    it('enforces viewer boundaries: read-only access', () => {
      expect(verifyDocumentPermission('viewer', 'documents.view')).toBe(true);
      expect(verifyDocumentPermission('viewer', 'documents.create')).toBe(false);
      expect(verifyDocumentPermission('viewer', 'documents.share')).toBe(false);
    });
  });

  describe('sanitizeDocumentInputPayload', () => {
    it('strips script tags, on* event handlers, and javascript: protocols from input fields', () => {
      const maliciousPayload = {
        title: 'Safe Title <script>alert("hacked")</script>',
        description: 'Image <img src="x" onerror="stealData()" /> description',
        actionUrl: 'javascript:alert(document.cookie)',
        nested: {
          note: 'Nested <script>evil()</script>',
        },
      };

      const clean = sanitizeDocumentInputPayload(maliciousPayload);

      expect(clean.title).toBe('Safe Title ');
      expect(clean.description).not.toContain('onerror=');
      expect(clean.actionUrl).toBe('alert(document.cookie)');
      expect(clean.nested.note).toBe('Nested ');
    });
  });

  describe('checkEventRateLimit (Sliding Window Rate Limiter)', () => {
    it('allows requests within threshold and blocks requests exceeding threshold', () => {
      const clientId = 'ip_192.168.1.100';

      // 5 requests with limit 5
      for (let i = 0; i < 5; i++) {
        const res = checkEventRateLimit(clientId, 5, 1000);
        expect(res.allowed).toBe(true);
      }

      // 6th request should be blocked
      const blockedRes = checkEventRateLimit(clientId, 5, 1000);
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.remaining).toBe(0);
    });
  });
});
