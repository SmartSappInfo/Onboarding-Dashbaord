import { describe, it, expect } from 'vitest';
import { hashPasscode, verifyPasscode, evaluateAccess } from '../access-service';
import type { Document, AccessPolicy } from '@/lib/types/document-types';

describe('Access Service & Cryptographic Passcode Verification', () => {
  it('hashes passcode with salt and verifies successfully', () => {
    const rawPass = 'SecretSchoolPass2026';
    const { hash, salt } = hashPasscode(rawPass);

    expect(hash).toBeDefined();
    expect(salt).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 hex length

    // Correct passcode verifies true
    expect(verifyPasscode(rawPass, hash, salt)).toBe(true);

    // Incorrect passcode verifies false
    expect(verifyPasscode('WrongPassword', hash, salt)).toBe(false);
    expect(verifyPasscode('', hash, salt)).toBe(false);
  });

  it('evaluates public published document access', () => {
    const doc: Document = {
      id: 'doc_1',
      workspaceId: 'ws_1',
      title: 'Public Guide',
      slug: 'public-guide',
      status: 'published',
      documentType: 'brochure',
      activeVersionId: 'v_1',
      defaultViewerMode: 'flipbook',
      createdBy: 'user_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const policy: AccessPolicy = {
      documentId: 'doc_1',
      workspaceId: 'ws_1',
      visibility: 'public',
      downloadPolicy: 'allowed',
      printPolicy: 'allowed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = evaluateAccess(doc, policy);
    expect(result.allowed).toBe(true);
  });

  it('evaluates protected document requiring passcode', () => {
    const { hash, salt } = hashPasscode('123456');

    const doc: Document = {
      id: 'doc_2',
      workspaceId: 'ws_1',
      title: 'Protected Handbook',
      slug: 'protected-handbook',
      status: 'published',
      documentType: 'handbook',
      activeVersionId: 'v_1',
      defaultViewerMode: 'flipbook',
      createdBy: 'user_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const policy: AccessPolicy = {
      documentId: 'doc_2',
      workspaceId: 'ws_1',
      visibility: 'protected',
      passwordHash: hash,
      salt: salt,
      downloadPolicy: 'allowed',
      printPolicy: 'allowed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Without passcode -> prompts for passcode
    const unauth = evaluateAccess(doc, policy);
    expect(unauth.allowed).toBe(false);
    expect(unauth.requiresPassword).toBe(true);

    // With wrong passcode -> rejects
    const wrong = evaluateAccess(doc, policy, { providedPasscode: 'wrong' });
    expect(wrong.allowed).toBe(false);
    expect(wrong.requiresPassword).toBe(true);

    // With correct passcode -> allows
    const correct = evaluateAccess(doc, policy, { providedPasscode: '123456' });
    expect(correct.allowed).toBe(true);
  });

  it('blocks draft documents from unauthenticated public access', () => {
    const doc: Document = {
      id: 'doc_3',
      workspaceId: 'ws_1',
      title: 'Draft Report',
      slug: 'draft-report',
      status: 'draft',
      documentType: 'report',
      activeVersionId: 'v_1',
      defaultViewerMode: 'flipbook',
      createdBy: 'user_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = evaluateAccess(doc);
    expect(result.allowed).toBe(false);

    const authResult = evaluateAccess(doc, null, { callerIsAuthenticated: true });
    expect(authResult.allowed).toBe(true);
  });
});
