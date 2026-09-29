/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Test Suite for Cryptographic e-Discovery Archival Service (Phase 9):
 * 1. Purpose:
 *    Guarantees court-admissible electronic discovery packaging,
 *    deterministic SHA-256 digests, and Merkle tree root verification.
 * 2. Invariants Checked:
 *    - FM-P9-06: Manifest hash tampering / divergence detection.
 *    - Standalone POSIX verification script generation.
 *    - Zip bundle decompression and round-trip verification.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import {
  computeFileSha256,
  computeMerkleRootSha256,
  generateVerifyManifestScript,
  assembleEDiscoveryZipBundle,
  verifyManifestIntegrity,
} from '../ediscovery-archival-service';

// Mock in-memory Firestore contracts store
const mockContracts = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: (coll: string) => {
        if (coll === 'contracts') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: mockContracts.has(id),
                data: () => mockContracts.get(id),
              }),
            }),
          };
        }

        if (coll === 'signing_evidence') {
          return {
            where: () => ({
              get: async () => ({
                docs: [
                  {
                    data: () => ({
                      action: 'sent',
                      timestamp: '2026-09-29T10:00:00Z',
                      recipientEmail: 'vendor@corp.com',
                    }),
                  },
                ],
              }),
            }),
          };
        }

        throw new Error(`Unexpected collection in test: ${coll}`);
      },
    },
    adminStorage: {
      file: () => ({
        save: async () => {},
        getSignedUrl: async () => ['https://storage.googleapis.com/test-bucket/download-url'],
      }),
    },
  };
});

describe('Cryptographic e-Discovery Archival Service', () => {
  const workspaceId = 'ws-compliance-1';
  const contractId = 'ctr-audit-2026';

  beforeEach(() => {
    mockContracts.clear();
    mockContracts.set(contractId, {
      id: contractId,
      workspaceId,
      title: 'Commercial Lease Agreement 2026',
      status: 'signed',
      envelopeId: 'env-audit-2026',
      isUnderLegalHold: true,
      legalHoldDetails: {
        isUnderLegalHold: true,
        matterId: 'CASE-009',
        reason: 'Commercial arbitration discovery',
      },
    });
  });

  describe('computeFileSha256 & computeMerkleRootSha256 (FM-P9-06)', () => {
    it('computes deterministic 64-char hex SHA-256 digest', () => {
      const digest = computeFileSha256('Hello World Document');
      expect(digest.length).toBe(64);
      expect(digest).toBe(computeFileSha256('Hello World Document'));
      expect(digest).not.toBe(computeFileSha256('Hello World Document 2'));
    });

    it('computes Merkle root and detects leaf divergence', () => {
      const leaf1 = computeFileSha256('file1.pdf');
      const leaf2 = computeFileSha256('file2.pdf');
      const leaf3 = computeFileSha256('file3.pdf');

      const root1 = computeMerkleRootSha256([leaf1, leaf2, leaf3]);
      expect(root1.length).toBe(64);

      // Order invariance
      const root2 = computeMerkleRootSha256([leaf3, leaf1, leaf2]);
      expect(root1).toBe(root2);

      // Divergence detection
      const alteredLeaf2 = computeFileSha256('file2_tampered.pdf');
      const rootAltered = computeMerkleRootSha256([leaf1, alteredLeaf2, leaf3]);
      expect(rootAltered).not.toBe(root1);
    });

    it('handles edge cases (empty array and single item)', () => {
      expect(computeMerkleRootSha256([])).toBe('0'.repeat(64));
      const single = computeFileSha256('single');
      expect(computeMerkleRootSha256([single])).toBe(single);
    });
  });

  describe('generateVerifyManifestScript', () => {
    it('generates a POSIX-compliant verification shell script', () => {
      const manifest = {
        manifestVersion: '1.0.0' as const,
        contractId: 'ctr-1',
        envelopeId: 'env-1',
        workspaceId: 'ws-1',
        title: 'Test',
        exportedAt: '2026-09-29T12:00:00Z',
        exportedByUserId: 'usr-1',
        files: [
          {
            path: 'completed-contract.pdf',
            description: 'Main contract',
            sha256: 'a'.repeat(64),
            sizeBytes: 1024,
            mimeType: 'application/pdf',
          },
        ],
        merkleRootSha256: 'a'.repeat(64),
        legalHoldActive: false,
      };

      const script = generateVerifyManifestScript(manifest);
      expect(script.startsWith('#!/bin/sh')).toBe(true);
      expect(script).toContain('completed-contract.pdf');
      expect(script).toContain('sha256sum');
      expect(script).toContain('VERIFICATION SUCCESS');
    });
  });

  describe('assembleEDiscoveryZipBundle & verifyManifestIntegrity', () => {
    it('assembles a court-admissible ZIP bundle and verifies round-trip integrity', async () => {
      const bundle = await assembleEDiscoveryZipBundle(workspaceId, contractId, 'usr-compliance-1');

      expect(bundle.zipBuffer.length).toBeGreaterThan(0);
      expect(bundle.manifest.contractId).toBe(contractId);
      expect(bundle.manifest.legalHoldActive).toBe(true);
      expect(bundle.manifest.files.length).toBeGreaterThanOrEqual(4);

      // Verify unzipping
      const unzipped = await JSZip.loadAsync(bundle.zipBuffer);
      expect(unzipped.file('manifest.json')).toBeDefined();
      expect(unzipped.file('verify-manifest.sh')).toBeDefined();
      expect(unzipped.file('completed-contract.pdf')).toBeDefined();
      expect(unzipped.file('certificate-of-completion.pdf')).toBeDefined();

      // Collect buffers and verify manifest integrity
      const fileBuffers = new Map<string, Buffer>();
      for (const entry of bundle.manifest.files) {
        const fileInZip = unzipped.file(entry.path);
        expect(fileInZip).toBeDefined();
        if (fileInZip) {
          const buf = await fileInZip.async('nodebuffer');
          fileBuffers.set(entry.path, buf);
        }
      }

      const verification = verifyManifestIntegrity(bundle.manifest, fileBuffers);
      expect(verification.isValid).toBe(true);
      expect(verification.discrepancies.length).toBe(0);
    });

    it('detects tampering when an artifact has been altered (FM-P9-06)', async () => {
      const bundle = await assembleEDiscoveryZipBundle(workspaceId, contractId, 'usr-compliance-1');

      const unzipped = await JSZip.loadAsync(bundle.zipBuffer);
      const fileBuffers = new Map<string, Buffer>();

      for (const entry of bundle.manifest.files) {
        const fileInZip = unzipped.file(entry.path);
        if (fileInZip) {
          const buf = await fileInZip.async('nodebuffer');
          fileBuffers.set(entry.path, buf);
        }
      }

      // Tamper with completed-contract.pdf
      fileBuffers.set(
        'completed-contract.pdf',
        Buffer.from('Malicious altered contract bytes!')
      );

      const verification = verifyManifestIntegrity(bundle.manifest, fileBuffers);
      expect(verification.isValid).toBe(false);
      expect(verification.discrepancies.length).toBeGreaterThan(0);
      expect(
        verification.discrepancies.some((d) => d.includes('Hash divergence on completed-contract.pdf'))
      ).toBe(true);
    });
  });
});
