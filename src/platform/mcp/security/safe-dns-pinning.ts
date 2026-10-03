/**
 * @fileOverview Socket-Level DNS Pinning & Anti-Rebinding Guard (Phase 5 Milestone 5 Task 3)
 *
 * Implements Rule 4 (Strict Typing: Zero any/any[]), Rule 8 & 47 (Multi-Tenancy & Anti-IDOR),
 * Rule 10 (Inline Architectural Documentation), Rule 15 (Server Allowlisting & Supply Chain),
 * Rule 34 (Universal Outbound SSRF Guard), and Milestone 3 Review Recommendation #2.
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. Anti-TOCTOU DNS Rebinding Invariant:
 *    A traditional "resolve, validate, then fetch" sequence performs multiple DNS resolutions:
 *    one during the validation check and a second inside the HTTP socket connect. Adversarial DNS
 *    servers exploit this gap by returning a benign public IP with a 0-second TTL on the first query,
 *    followed by Google Cloud Metadata (`169.254.169.254`) or loopback (`127.0.0.1`) on the second.
 *    `safeFetchWithDnsPinning` resolves the IP ONCE, validates all returned A/AAAA records against
 *    forbidden ranges, and pins the socket connection directly to the pre-validated IP address.
 * 2. Strict Outbound IP Blacklist:
 *    - GCP / Cloud Run Metadata: `169.254.169.254`, `metadata.google.internal`
 *    - Loopback: `127.0.0.0/8`, `::1`, `localhost`
 *    - RFC-1918 Private Networks: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
 *    - Carrier Grade NAT: `100.64.0.0/10`
 *    - Link-Local & Multicast: `169.254.0.0/16`, `fe80::/10`, `ff00::/8`, `224.0.0.0/4`
 *    - IPv4-Mapped IPv6: `::ffff:169.254.169.254`, `::ffff:127.0.0.1`
 * 3. Preserved Host Headers & TLS SNI:
 *    The HTTP `Host` header and TLS Server Name Indication (SNI) retain the original fully-qualified
 *    domain name (e.g. `api.external-partner.com`), preserving virtual hosting, CDN routing, and TLS
 *    certificate validation while the underlying TCP socket connects to the pinned IP.
 */

import dns from 'node:dns';
import { isIP, isIPv4, type LookupFunction } from 'node:net';
import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from 'undici';
import {
  isForbiddenIp,
  isForbiddenHostname,
  validateExternalUrl,
} from '@/lib/security/ssrf-guard';

export const DNS_PINNING_ERROR_CODES = {
  HOSTNAME_INVALID: 'DNS_HOSTNAME_INVALID',
  RESOLUTION_FAILED: 'DNS_RESOLUTION_FAILED',
  FORBIDDEN_IP: 'DNS_FORBIDDEN_IP',
  REBINDING_DETECTED: 'DNS_REBINDING_DETECTED',
  TIMEOUT: 'DNS_PINNED_TIMEOUT',
  REDIRECT_LIMIT_EXCEEDED: 'DNS_REDIRECT_LIMIT_EXCEEDED',
} as const;

export type DnsPinningErrorCode =
  (typeof DNS_PINNING_ERROR_CODES)[keyof typeof DNS_PINNING_ERROR_CODES];

export class DnsPinningError extends Error {
  public readonly code: DnsPinningErrorCode;

  constructor(message: string, code: DnsPinningErrorCode) {
    super(`[DNS Pinning] ${code}: ${message}`);
    this.name = 'DnsPinningError';
    this.code = code;
  }
}

export interface PinnedDnsRecord {
  hostname: string;
  ipAddress: string;
  family: 4 | 6;
  resolvedAt: number;
  ttlMs: number;
  expiresAt: number;
}

export interface ResolveIpOptions {
  bypassCache?: boolean;
  ttlMs?: number;
  lookupFn?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
}

export interface SafeFetchPinnedOptions extends ResolveIpOptions {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | Uint8Array;
  timeoutMs?: number;
  signal?: AbortSignal;
  maxRedirects?: number;
  fetchFn?: (url: string | URL, init?: unknown) => Promise<Response>;
}

// In-memory DNS Pinning Cache with TTL
const dnsPinCache = new Map<string, PinnedDnsRecord>();
const DEFAULT_DNS_CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Clears the DNS Pinning Cache. Useful for hermetic unit and integration testing.
 */
export function clearDnsPinCache(): void {
  dnsPinCache.clear();
}

/**
 * Retrieves a currently active pinned DNS record for a given hostname.
 */
export function getPinnedDnsRecord(hostname: string): PinnedDnsRecord | null {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  const entry = dnsPinCache.get(normalized);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    dnsPinCache.delete(normalized);
    return null;
  }
  return { ...entry };
}

/**
 * Resolves a hostname, validates that NO returned IP falls within forbidden/private/metadata ranges,
 * and caches the validated IP address to eliminate TOCTOU rebinding.
 *
 * @param hostname The target hostname to resolve and validate.
 * @param options Resolution and cache options.
 * @returns A PinnedDnsRecord containing the pre-validated IP address and family.
 */
export async function resolveAndValidateIp(
  hostname: string,
  options: ResolveIpOptions = {}
): Promise<PinnedDnsRecord> {
  if (!hostname || typeof hostname !== 'string' || hostname.trim() === '') {
    throw new DnsPinningError('Invalid or empty hostname provided.', DNS_PINNING_ERROR_CODES.HOSTNAME_INVALID);
  }

  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');

  // 1. Synchronous hostname evaluation
  if (isForbiddenHostname(normalized)) {
    throw new DnsPinningError(
      `Hostname '${normalized}' is classified as a forbidden or internal cloud host.`,
      DNS_PINNING_ERROR_CODES.FORBIDDEN_IP
    );
  }

  // 2. IP Literal Check
  const literalClean = normalized.replace(/^\[/, '').replace(/\]$/, '');
  if (isIP(literalClean)) {
    if (isForbiddenIp(literalClean)) {
      throw new DnsPinningError(
        `IP literal '${literalClean}' is in a forbidden private, metadata, or loopback range.`,
        DNS_PINNING_ERROR_CODES.FORBIDDEN_IP
      );
    }
    const family: 4 | 6 = isIPv4(literalClean) ? 4 : 6;
    return {
      hostname: normalized,
      ipAddress: literalClean,
      family,
      resolvedAt: Date.now(),
      ttlMs: options.ttlMs ?? DEFAULT_DNS_CACHE_TTL_MS,
      expiresAt: Date.now() + (options.ttlMs ?? DEFAULT_DNS_CACHE_TTL_MS),
    };
  }

  // 3. Cache Evaluation
  const now = Date.now();
  if (!options.bypassCache) {
    const cached = dnsPinCache.get(normalized);
    if (cached && now < cached.expiresAt) {
      return { ...cached };
    }
  }

  // 4. Resolve A and AAAA records
  let addresses: Array<{ address: string; family: number }>;

  try {
    if (options.lookupFn) {
      addresses = await options.lookupFn(normalized);
    } else {
      const raw = await dns.promises.lookup(normalized, { all: true });
      addresses = raw.map((r) => ({ address: r.address, family: r.family }));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DnsPinningError(
      `DNS resolution failed for host '${normalized}': ${msg}`,
      DNS_PINNING_ERROR_CODES.RESOLUTION_FAILED
    );
  }

  if (!addresses || addresses.length === 0) {
    throw new DnsPinningError(
      `Host '${normalized}' did not resolve to any IP addresses.`,
      DNS_PINNING_ERROR_CODES.RESOLUTION_FAILED
    );
  }

  // 5. Strict IP Verification across ALL returned addresses (Anti-Rebinding Check)
  for (const entry of addresses) {
    if (isForbiddenIp(entry.address)) {
      throw new DnsPinningError(
        `Host '${normalized}' resolved to forbidden address '${entry.address}' (Cloud metadata, loopback, or private range). Execution halted to prevent SSRF DNS rebinding.`,
        DNS_PINNING_ERROR_CODES.FORBIDDEN_IP
      );
    }
  }

  // 6. Select primary pinned IP and cache
  const primary = addresses[0];
  const family: 4 | 6 = primary.family === 6 ? 6 : 4;
  const ttlMs = options.ttlMs ?? DEFAULT_DNS_CACHE_TTL_MS;

  const record: PinnedDnsRecord = {
    hostname: normalized,
    ipAddress: primary.address,
    family,
    resolvedAt: now,
    ttlMs,
    expiresAt: now + ttlMs,
  };

  dnsPinCache.set(normalized, record);
  return record;
}

/**
 * Executes an HTTP/HTTPS fetch request with socket-level DNS pinning.
 * Forces the socket connection to use the pre-validated pinned IP address while
 * preserving original Host headers and TLS SNI server names.
 *
 * @param targetUrl The target URL to fetch safely.
 * @param options Fetch and DNS pinning configuration options.
 * @returns Web-standard Response object.
 */
export async function safeFetchWithDnsPinning(
  targetUrl: string | URL,
  options: SafeFetchPinnedOptions = {}
): Promise<Response> {
  const urlString = typeof targetUrl === 'string' ? targetUrl : targetUrl.href;

  // 1. Advisory URL syntax and scheme validation
  const validation = validateExternalUrl(urlString);
  if (!validation.isValid || !validation.sanitizedUrl) {
    throw new DnsPinningError(
      validation.error || 'Invalid or forbidden URL.',
      DNS_PINNING_ERROR_CODES.HOSTNAME_INVALID
    );
  }

  let currentUrl = new URL(validation.sanitizedUrl);
  let redirectCount = 0;
  const maxRedirects = options.maxRedirects ?? 5;

  while (redirectCount <= maxRedirects) {
    // 2. Resolve and pin target host IP
    const pinnedRecord = await resolveAndValidateIp(currentUrl.hostname, options);

    // 3. Dispatch HTTP request (either via custom fetchFn or Undici Agent with pinned lookup)
    let response: Response | UndiciResponse;

    try {
      if (options.fetchFn) {
        response = await options.fetchFn(currentUrl, {
          ...options,
          pinnedRecord,
        });
      } else {
      const pinnedLookup: LookupFunction = (_hostname, lookupOptions, callback) => {
        if (lookupOptions.all) {
          callback(null, [{ address: pinnedRecord.ipAddress, family: pinnedRecord.family }]);
        } else {
          callback(null, pinnedRecord.ipAddress, pinnedRecord.family);
        }
      };

      const agent = new Agent({
        connect: {
          lookup: pinnedLookup,
          timeout: options.timeoutMs ?? 15000,
        },
      });

      const headersRecord: Record<string, string> = {};
      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.forEach((val, key) => {
            headersRecord[key] = val;
          });
        } else {
          Object.assign(headersRecord, options.headers);
        }
      }

      response = await undiciFetch(currentUrl.href, {
        method: options.method || 'GET',
        headers: headersRecord,
        body: options.body,
        signal: options.signal,
        dispatcher: agent,
        redirect: 'manual',
      });
    }

      // Handle redirects with DNS-pinning re-validation
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          // No location header; return response as-is
          const fallbackHeaders = new Headers();
          if (response.headers && typeof response.headers.forEach === 'function') {
            response.headers.forEach((val, key) => fallbackHeaders.set(key, val));
          }
          const bodyText = await response.text();
          return new Response(bodyText, {
            status: response.status,
            statusText: response.statusText,
            headers: fallbackHeaders,
          });
        }

        redirectCount += 1;
        if (redirectCount > maxRedirects) {
          throw new DnsPinningError(
            `Maximum redirect limit (${maxRedirects}) exceeded.`,
            DNS_PINNING_ERROR_CODES.REDIRECT_LIMIT_EXCEEDED
          );
        }

        const nextUrl = new URL(location, currentUrl);
        const nextValidation = validateExternalUrl(nextUrl.href);
        if (!nextValidation.isValid || !nextValidation.sanitizedUrl) {
          throw new DnsPinningError(
            `Redirect target URL '${nextUrl.href}' is invalid or forbidden: ${nextValidation.error}`,
            DNS_PINNING_ERROR_CODES.FORBIDDEN_IP
          );
        }

        currentUrl = new URL(nextValidation.sanitizedUrl);
        continue;
      }

      // Convert UndiciResponse to standard Web Response
      const responseHeaders = new Headers();
      if (response.headers && typeof response.headers.forEach === 'function') {
        response.headers.forEach((val, key) => responseHeaders.set(key, val));
      }
      const finalBodyText = await response.text();
      return new Response(finalBodyText, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err: unknown) {
      if (err instanceof DnsPinningError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new DnsPinningError(
        `Pinned HTTP connection to '${currentUrl.hostname}' (${pinnedRecord.ipAddress}) failed: ${msg}`,
        DNS_PINNING_ERROR_CODES.TIMEOUT
      );
    }
  }

  throw new DnsPinningError(
    `Maximum redirect limit (${maxRedirects}) exceeded.`,
    DNS_PINNING_ERROR_CODES.REDIRECT_LIMIT_EXCEEDED
  );
}
