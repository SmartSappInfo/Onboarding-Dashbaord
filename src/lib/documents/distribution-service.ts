/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Distribution Services:
 *    Handles HMAC-SHA256 cryptographic token signing, expiration validation, QR code rendering,
 *    and responsive embed snippet generation (PRD Sections 20, 54–58 & 86).
 * 2. Cryptographic Security & Anti-Tampering:
 *    Uses constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks on signed tokens.
 * 3. Pure TypeScript / Node QR Generation:
 *    Uses the verified `qrcode` dependency to generate PNG Data URIs and SVG formats with configurable error correction.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import crypto from 'crypto';
import QRCode from 'qrcode';
import type { DistributionType } from '@/lib/types/document-types';

export interface DistributionTokenPayload {
  workspaceId: string;
  documentId: string;
  versionId: string;
  distributionId: string;
  type: DistributionType;
  contactId?: string;
  campaignId?: string;
  expiresAt?: string; // ISO string
}

const TOKEN_SECRET = process.env.DISTRIBUTION_TOKEN_SECRET || 'smartsapp-distribution-hmac-secret-v1';

/**
 * Creates a signed distribution token embedding channel metadata and expiration.
 */
export function createSignedDistributionToken(payload: DistributionTokenPayload): string {
  const json = JSON.stringify(payload);
  const base64Data = Buffer.from(json, 'utf8').toString('base64url');
  
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
  hmac.update(base64Data);
  const signature = hmac.digest('base64url');

  return `${base64Data}.${signature}`;
}

/**
 * Verifies and decodes a signed distribution token with expiration and signature check.
 */
export function verifySignedDistributionToken(token: string): {
  valid: boolean;
  expired?: boolean;
  payload?: DistributionTokenPayload;
  error?: string;
} {
  try {
    if (!token || !token.includes('.')) {
      return { valid: false, error: 'Invalid token format.' };
    }

    const [base64Data, signature] = token.split('.');
    if (!base64Data || !signature) {
      return { valid: false, error: 'Malformed token parts.' };
    }

    // Verify HMAC Signature in constant time
    const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
    hmac.update(base64Data);
    const expectedSig = hmac.digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { valid: false, error: 'Invalid signature. Token has been tampered with.' };
    }

    // Decode Payload
    const json = Buffer.from(base64Data, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as DistributionTokenPayload;

    // Validate Expiration
    if (payload.expiresAt) {
      const expTime = new Date(payload.expiresAt).getTime();
      if (!isNaN(expTime) && Date.now() > expTime) {
        return { valid: false, expired: true, payload, error: 'Distribution token has expired.' };
      }
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Failed to decode token payload.' };
  }
}

/**
 * Generates a high-resolution QR code PNG Data URL for a target distribution link.
 */
export async function generateDistributionQRCode(
  url: string,
  options?: {
    size?: number;
    darkColor?: string;
    lightColor?: string;
  }
): Promise<string> {
  const size = options?.size || 512;
  const dark = options?.darkColor || '#000000';
  const light = options?.lightColor || '#FFFFFF';

  return QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark,
      light,
    },
  });
}

/**
 * Generates an embeddable HTML iframe snippet for a publication.
 */
export function generateEmbedIframeSnippet(options: {
  url: string;
  title: string;
  width?: string;
  height?: string;
  allowFullscreen?: boolean;
}): string {
  const width = options.width || '100%';
  const height = options.height || '600px';
  const fs = options.allowFullscreen !== false ? 'allow="fullscreen; autoplay"' : 'allow="autoplay"';

  return `<iframe src="${options.url}" title="${options.title}" width="${width}" height="${height}" frameborder="0" ${fs} style="border: 0; border-radius: 16px; overflow: hidden; width: 100%; min-height: 480px;"></iframe>`;
}
