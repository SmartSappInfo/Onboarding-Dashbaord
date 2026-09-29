/**
 * Embedded Signing Service & Iframe Security Engine
 *
 * Provides partner origin validation, frame-ancestors Content Security Policy generation,
 * type-safe postMessage exchange verification, and debounced height clamp protection (FM-P8-05, FM-P8-06).
 *
 * Security Invariants:
 * 1. Rejects wildcards ('*') and invalid schemes (javascript:, data:) in embed origins.
 * 2. Injects restrictive frame-ancestors CSP directive to eliminate clickjacking.
 * 3. Enforces an 8px deadband and [500px, 2400px] height bounds to avoid infinite resize loops.
 * 4. Zero `any` or `any[]` typing.
 *
 * @maintainer Antigravity Pair Programming
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  EmbedMessageSchema,
  type EmbedMessage,
} from '@/lib/types/document-signing';

export const MIN_EMBED_HEIGHT = 500;
export const MAX_EMBED_HEIGHT = 2400;
export const RESIZE_DEADBAND_PX = 8;

/**
 * Validates whether an origin string is a well-formed http(s) origin without path or wildcard.
 */
export function isValidEmbedOrigin(origin: string): boolean {
  if (!origin || typeof origin !== 'string') return false;
  if (origin === '*' || origin.includes('*')) return false;

  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    // Origin must have no pathname or query
    const reconstructed = `${parsed.protocol}//${parsed.host}`;
    return origin.replace(/\/+$/, '') === reconstructed;
  } catch {
    return false;
  }
}

export interface EmbedOriginValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates if the requesting parent origin is registered in workspace embed settings.
 */
export async function validateEmbedOrigin(
  workspaceId: string,
  origin: string
): Promise<EmbedOriginValidationResult> {
  if (!isValidEmbedOrigin(origin)) {
    return {
      allowed: false,
      reason: 'Invalid origin format. Must be a valid http(s) origin without paths or wildcards.',
    };
  }

  const normalizedOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();

  const settingsDoc = await adminDb
    .doc(`workspaces/${workspaceId}/settings/embedded_signing`)
    .get();

  if (!settingsDoc.exists) {
    return {
      allowed: false,
      reason: 'Embedded signing origins not configured for workspace.',
    };
  }

  const data = settingsDoc.data();
  const allowedOrigins: unknown = data?.allowedEmbedOrigins;

  if (!Array.isArray(allowedOrigins)) {
    return {
      allowed: false,
      reason: 'Embedded signing origins not configured for workspace.',
    };
  }

  const isWhitelisted = allowedOrigins.some((allowed) => {
    if (typeof allowed !== 'string') return false;
    return allowed.trim().replace(/\/+$/, '').toLowerCase() === normalizedOrigin;
  });

  if (!isWhitelisted) {
    return {
      allowed: false,
      reason: `Origin '${origin}' is not whitelisted for workspace iframe embedding.`,
    };
  }

  return { allowed: true };
}

/**
 * Generates the Content-Security-Policy frame-ancestors directive based on whitelisted origins.
 */
export function generateEmbedCspHeader(allowedOrigins: string[]): string {
  const validOrigins = allowedOrigins
    .map((o) => (typeof o === 'string' ? o.trim().replace(/\/+$/, '') : ''))
    .filter((o) => isValidEmbedOrigin(o));

  if (validOrigins.length === 0) {
    return "frame-ancestors 'self';";
  }

  return `frame-ancestors 'self' ${validOrigins.join(' ')};`;
}

/**
 * Safely parses and validates incoming/outgoing postMessage payloads against domain schemas.
 */
export function parseEmbedMessage(data: unknown): EmbedMessage | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const result = EmbedMessageSchema.safeParse(data);
  if (!result.success) {
    return null;
  }

  return result.data;
}

export interface ClampedHeightResult {
  height: number;
  shouldUpdate: boolean;
}

/**
 * Clamps iframe height to [500px, 2400px] and checks against deadband threshold.
 */
export function calculateClampedEmbedHeight(
  rawHeight: number,
  prevHeight?: number
): ClampedHeightResult {
  const clamped = Math.max(
    MIN_EMBED_HEIGHT,
    Math.min(MAX_EMBED_HEIGHT, Math.round(rawHeight))
  );

  if (prevHeight !== undefined) {
    const diff = Math.abs(clamped - prevHeight);
    if (diff < RESIZE_DEADBAND_PX) {
      return { height: clamped, shouldUpdate: false };
    }
  }

  return { height: clamped, shouldUpdate: true };
}
