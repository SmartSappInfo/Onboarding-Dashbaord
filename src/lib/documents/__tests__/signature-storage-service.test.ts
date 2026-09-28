/**
 * PURPOSE: Unit tests for Signature Cloud Storage Offloading.
 * ARCHITECTURAL CONTEXT:
 * Tests that base64 signature images are cleanly detected, converted to binary buffers,
 * hashed with SHA-256, and offloaded to Cloud Storage. Prevents Firestore 1MB document bloat (T-04).
 * TESTABILITY: Runs in Vitest. Conforms to Rule 4 (Zero any).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadSignatureImage, isBase64DataUrl } from '../signature-storage-service';

const mockSave = vi.fn().mockResolvedValue(true);

vi.mock('@/lib/firebase-admin', () => ({
  adminStorage: {
    file: vi.fn().mockImplementation((path: string) => ({
      save: mockSave,
      name: path,
    })),
  },
}));

describe('P1.3 Signature Storage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects base64 data URLs accurately', () => {
    expect(isBase64DataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(true);
    expect(isBase64DataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==')).toBe(true);
    expect(isBase64DataUrl('https://storage.googleapis.com/bucket/signatures/ws1/sig.png')).toBe(false);
    expect(isBase64DataUrl('signatures/ws1/contract1/rec1.png')).toBe(false);
    expect(isBase64DataUrl('')).toBe(false);
  });

  it('uploads valid base64 signature to Cloud Storage and calculates SHA-256 digest', async () => {
    // 1x1 transparent PNG data URL
    const validBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const result = await uploadSignatureImage({
      workspaceId: 'ws_prod_01',
      contractId: 'contract_789',
      recipientId: 'rec_signer_01',
      dataUrl: validBase64,
    });

    expect(result.storagePath).toBe('signatures/ws_prod_01/contract_789/rec_signer_01.png');
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.byteSize).toBeGreaterThan(0);
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it('rejects malformed data URLs with a descriptive error', async () => {
    await expect(
      uploadSignatureImage({
        workspaceId: 'ws_prod_01',
        contractId: 'contract_789',
        recipientId: 'rec_signer_01',
        dataUrl: 'not-a-valid-data-url',
      })
    ).rejects.toThrow('Invalid base64 image data URL.');
  });
});
