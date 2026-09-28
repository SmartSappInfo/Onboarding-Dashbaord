/**
 * PURPOSE: Cloud Storage Offloading and SHA-256 Digest Service for Signatures.
 * ARCHITECTURAL CONTEXT:
 * Addresses Vulnerability T-04 (Firestore 1MB document bloat). Strips raw base64 PNG/JPEG
 * image data from submissions and uploads them directly to Firebase Cloud Storage at
 * `signatures/{workspaceId}/{contractId}/{recipientId}.{ext}`.
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Only store the resulting storagePath and sha256 in Firestore. NEVER re-inline base64.
 * - Conforms strictly to Rule 4 (Zero any/any[]).
 */

import { adminStorage } from '@/lib/firebase-admin';
import crypto from 'crypto';

export interface SignatureUploadInput {
  workspaceId: string;
  contractId: string;
  recipientId: string;
  dataUrl: string;
}

export interface SignatureUploadResult {
  storagePath: string;
  sha256: string;
  byteSize: number;
}

/**
 * Checks whether a given string is a valid base64 data URL.
 */
export function isBase64DataUrl(str: string): boolean {
  if (typeof str !== 'string' || !str) return false;
  return str.startsWith('data:image/');
}

/**
 * Parses a base64 image data URL, calculates its cryptographic SHA-256 digest,
 * and streams it directly to Firebase Cloud Storage.
 * 
 * @param input - Signature upload configuration parameters
 * @returns Object containing storage path, SHA-256 hash, and byte size
 */
export async function uploadSignatureImage(input: SignatureUploadInput): Promise<SignatureUploadResult> {
  const { workspaceId, contractId, recipientId, dataUrl } = input;

  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!matches || matches.length < 3) {
    throw new Error('Invalid base64 image data URL.');
  }

  const rawExtension = matches[1].toLowerCase();
  const extension = rawExtension === 'jpeg' ? 'jpg' : rawExtension;
  const imageBuffer = Buffer.from(matches[2], 'base64');

  const sha256 = crypto.createHash('sha256').update(imageBuffer).digest('hex');
  const storagePath = `signatures/${workspaceId}/${contractId}/${recipientId}.${extension}`;

  const bucketFile = adminStorage.file(storagePath);
  await bucketFile.save(imageBuffer, {
    metadata: {
      contentType: `image/${extension}`,
      metadata: {
        workspaceId,
        contractId,
        recipientId,
        sha256,
      },
    },
  });

  return {
    storagePath,
    sha256,
    byteSize: imageBuffer.length,
  };
}
