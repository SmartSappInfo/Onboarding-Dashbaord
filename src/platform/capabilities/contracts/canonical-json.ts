/**
 * @fileOverview Canonical JSON + hashing for capability payloads.
 *
 * Used wherever two parties must agree on "the same request": approval binding (Rule 22) and
 * derived idempotency keys (Rule 19). Keys are sorted recursively so property order never
 * changes the hash.
 *
 * CAUTION: changing this encoding invalidates every stored payloadHash (outstanding approvals
 * would stop verifying). Version it instead of editing it.
 */

import { createHash } from 'node:crypto';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function sha256Hex(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
