/**
 * @fileOverview SSRF & Ingress Protection Guard (Single Source of Truth)
 *
 * Implements Rule 34 of SmartSapp Agentic Development Rules and Cloud Run Security Blueprint.
 * Provides robust validation for external URLs before server-side fetch requests,
 * preventing Server-Side Request Forgery (SSRF), internal port scanning, DNS rebinding,
 * redirect chaining, and cloud metadata service extraction (Google Cloud Metadata at
 * 169.254.169.254, AWS/Azure equivalents, IPv4-mapped IPv6, CGNAT, and RFC-1918 subnets).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Why this exists: Server endpoints that fetch user-supplied URLs (e.g. webhooks, website brand scrapers,
 *   agent tools) could be weaponized to query internal microservices or cloud instance metadata.
 * - Single Source of Truth: All platform code, agents, and client libraries must route through this guard.
 * - Testability: Comprehensive unit tests in `src/lib/security/__tests__/ssrf-guard.test.ts` and
 *   `src/platform/__tests__/baseline/tenant-isolation.baseline.test.ts`.
 */

import dns from 'node:dns';
import { isIP, isIPv4, isIPv6, type LookupFunction } from 'node:net';
import { Agent, fetch as undiciFetch, type Dispatcher, type Response as UndiciResponse } from 'undici';

export interface SsrfValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

export class SsrffBlockedError extends Error {
  constructor(message: string) {
    super(`SSRF Blocked: ${message}`);
    this.name = 'SsrffBlockedError';
  }
}

/**
 * Checks whether an IPv4 address string falls into a forbidden private, local, or reserved range.
 */
export function isForbiddenIpV4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP
  }

  const [a, b, c] = parts;

  // 1. Loopback (127.0.0.0/8)
  if (a === 127) return true;

  // 2. Local Identification & "This Host" (0.0.0.0/8)
  if (a === 0) return true;

  // 3. Link-Local & Cloud Instance Metadata (169.254.0.0/16, e.g. 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 4. RFC 1918 Private Networks:
  //    - 10.0.0.0/8
  //    - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  //    - 192.168.0.0/16
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  // 5. Shared Address Space / Carrier Grade NAT (100.64.0.0/10: 100.64.0.0 to 100.127.255.255)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 6. IETF Protocol Assignments (192.0.0.0/24) & Benchmark (198.18.0.0/15)
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 7. Multicast (224.0.0.0/4) and Broadcast / Reserved (240.0.0.0/4, 255.255.255.255)
  if (a >= 224) return true;

  return false;
}

/**
 * Expands an IPv6 literal to its 8 16-bit groups (handles `::`, embedded dotted IPv4 and zone ids).
 * Returns null when the string is not a valid IPv6 address.
 */
function parseIPv6(address: string): number[] | null {
  const withoutZone = address.split('%')[0];
  if (!isIPv6(withoutZone)) return null;

  let text = withoutZone.toLowerCase();
  let embedded: number[] = [];
  const dotted = text.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const octets = dotted[2].split('.').map(Number);
    embedded = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
    text = `${dotted[1]}0:0`;
  }

  const [head, tail] = text.includes('::') ? text.split('::') : [text, undefined];
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  const groups = [...headGroups, ...(tail !== undefined ? Array<string>(missing).fill('0') : []), ...tailGroups].map((g) =>
    parseInt(g, 16)
  );
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g))) return null;
  if (embedded.length === 2) {
    groups[6] = embedded[0];
    groups[7] = embedded[1];
  }
  return groups;
}

function ipv4FromGroups(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/**
 * IPv6 special-purpose ranges. Anything that can carry or route to an IPv4 address
 * (mapped, NAT64, 6to4) is judged by that embedded IPv4 address, so
 * `[::ffff:a9fe:a9fe]` and `[64:ff9b::a9fe:a9fe]` are treated as 169.254.169.254.
 */
function isForbiddenIPv6Groups(g: number[]): boolean {
  const zeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (zeroUpTo(8)) return true; // :: unspecified
  if (zeroUpTo(7) && g[7] === 1) return true; // ::1 loopback
  if (zeroUpTo(5) && g[5] === 0xffff) return isForbiddenIpV4(ipv4FromGroups(g[6], g[7])); // ::ffff:0:0/96 mapped
  if (zeroUpTo(6)) return true; // ::/96 deprecated IPv4-compatible
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isForbiddenIpV4(ipv4FromGroups(g[6], g[7])); // 64:ff9b::/96 NAT64
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return true; // 64:ff9b:1::/48 local NAT64
  if (g[0] === 0x2002) return isForbiddenIpV4(ipv4FromGroups(g[1], g[2])); // 2002::/16 6to4
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 documentation
  if (g[0] === 0x2001 && g[1] < 0x0200) return true; // 2001::/23 IETF special (incl. Teredo)
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // 100::/64 discard
  return false;
}

/**
 * Checks whether an IP literal (v4, v6, bracketed v6, v6 with zone id) is private, metadata,
 * loopback or otherwise reserved. Non-IP strings return false (hostnames are resolved separately).
 */
export function isForbiddenIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (isIPv4(normalized)) return isForbiddenIpV4(normalized);
  const groups = parseIPv6(normalized);
  return groups ? isForbiddenIPv6Groups(groups) : false;
}

/**
 * Checks whether a hostname or IP string indicates a loopback, cloud metadata, or private host.
 */
export function isForbiddenHostname(hostname: string): boolean {
  // A trailing dot is a valid fully-qualified form (`localhost.`) and must not bypass the name checks.
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');

  // Explicit loopback and local names
  if (
    normalized === 'localhost' ||
    normalized === 'localhost.localdomain' ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.localhost')
  ) {
    return true;
  }

  // Cloud metadata domain aliases
  if (
    normalized === 'metadata.google.internal' ||
    normalized === 'metadata' ||
    normalized === 'instance-data'
  ) {
    return true;
  }

  // Check IP pattern
  if (isForbiddenIp(normalized)) {
    return true;
  }

  return false;
}

/**
 * Validates a user-supplied external URL synchronously (protocol and syntax checks).
 */
export function validateExternalUrl(rawUrl: string): SsrfValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'URL must be a non-empty string.' };
  }

  let parsed: URL;
  const trimmed = rawUrl.trim();
  try {
    if (trimmed.includes('://') || trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
      parsed = new URL(trimmed);
    } else {
      parsed = new URL(`https://${trimmed}`);
    }
  } catch {
    return { isValid: false, error: 'Invalid URL format.' };
  }

  // 1. Protocol validation: Only http and https permitted
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: `Unsupported URL protocol: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
    };
  }

  // 2. Disallow embedded credentials
  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      error: 'URLs with embedded authentication credentials are not permitted.',
    };
  }

  // 3. Hostname validation
  if (!parsed.hostname || isForbiddenHostname(parsed.hostname)) {
    return {
      isValid: false,
      error: 'The requested host is private, loopback, or cloud-internal and cannot be accessed.',
    };
  }

  // 4. Port validation
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      return { isValid: false, error: 'Invalid port number specified.' };
    }
    const dangerousPorts = new Set([22, 25, 111, 2375, 2376, 3306, 5432, 6379, 27017]);
    if (dangerousPorts.has(portNum)) {
      return { isValid: false, error: `Connections to port ${portNum} are restricted.` };
    }
  }

  return {
    isValid: true,
    sanitizedUrl: parsed.href,
  };
}

/**
 * DNS lookup used for EVERY outbound connection made by `safeUrlFetch`.
 *
 * This is the actual DNS-rebinding defence: the addresses checked here are the addresses the socket
 * connects to, because the check runs inside the connection's own lookup. A separate
 * "resolve, check, then fetch" sequence resolves twice and can be raced by a short-TTL record.
 * Note: IP-literal hosts skip lookup entirely, so they are covered by `validateExternalUrl`.
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err, '', 0);
      return;
    }
    const list = Array.isArray(addresses) ? addresses : [];
    const forbidden = list.find((entry) => isForbiddenIp(entry.address));
    if (list.length === 0 || forbidden) {
      const reason = forbidden
        ? `Host '${hostname}' resolved to forbidden address '${forbidden.address}'.`
        : `Host '${hostname}' did not resolve to any address.`;
      callback(new SsrffBlockedError(reason), '', 0);
      return;
    }
    if (options.all) {
      callback(null, list);
    } else {
      callback(null, list[0].address, list[0].family);
    }
  });
};

/** One pooled agent; every new connection goes through `guardedLookup`. */
const safeEgressAgent = new Agent({ connect: { lookup: guardedLookup } });

/**
 * Advisory pre-check (syntax + one DNS resolution) for callers that want to reject a URL early,
 * e.g. when saving a webhook target. It does NOT protect a later plain `fetch`; always send the
 * request itself with `safeUrlFetch`.
 */
export async function validateSafeEgressUrl(targetUrl: string): Promise<string> {
  const syncCheck = validateExternalUrl(targetUrl);
  if (!syncCheck.isValid || !syncCheck.sanitizedUrl) {
    throw new SsrffBlockedError(syncCheck.error ?? 'Invalid URL format or forbidden host.');
  }

  const parsed = new URL(syncCheck.sanitizedUrl);
  const hostname = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (isIP(hostname)) {
    return parsed.href; // IP literals were fully classified by validateExternalUrl.
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch (err: unknown) {
    throw new SsrffBlockedError(`Failed to resolve host '${hostname}': ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  if (addresses.length === 0) {
    throw new SsrffBlockedError(`Host '${hostname}' did not resolve to any IP addresses.`);
  }
  const forbidden = addresses.find((addr) => isForbiddenIp(addr.address));
  if (forbidden) {
    throw new SsrffBlockedError(`Target host '${hostname}' resolved to forbidden address '${forbidden.address}'.`);
  }
  return parsed.href;
}

export interface SafeFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** Headers that must never follow a redirect to a different origin. */
const CREDENTIAL_HEADERS = ['authorization', 'cookie', 'proxy-authorization'];

/**
 * Executes an outbound request with SSRF protection:
 * - every hop's URL is checked by `validateExternalUrl` (protocol, credentials, IP literals, ports);
 * - every connection's DNS answer is checked inside the connection itself (`guardedLookup`);
 * - redirects are followed manually (max `maxRedirects`), dropping credential headers when the
 *   origin changes and switching to GET without a body where HTTP semantics require it (303, or
 *   301/302 after a non-GET).
 */
export async function safeUrlFetch(
  targetUrl: string,
  init: SafeFetchInit = {},
  maxRedirects: number = 3,
  /** TESTS ONLY: inject an undici MockAgent. Production callers must never pass this. */
  testing?: { dispatcher: Dispatcher }
): Promise<UndiciResponse> {
  let currentUrl = targetUrl;
  let method = (init.method ?? 'GET').toUpperCase();
  let body = init.body;
  let headers: Record<string, string> = { ...(init.headers ?? {}) };

  for (let hop = 0; ; hop += 1) {
    const check = validateExternalUrl(currentUrl);
    if (!check.isValid || !check.sanitizedUrl) {
      throw new SsrffBlockedError(check.error ?? 'Invalid URL format or forbidden host.');
    }

    const response = await undiciFetch(check.sanitizedUrl, {
      method,
      headers,
      body,
      signal: init.signal,
      redirect: 'manual',
      dispatcher: testing?.dispatcher ?? safeEgressAgent,
    });

    const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
    if (!location) {
      return response;
    }
    if (hop >= maxRedirects) {
      throw new SsrffBlockedError('Too many redirects encountered during safe fetch.');
    }
    await response.body?.cancel();

    const nextUrl = new URL(location, check.sanitizedUrl);
    if (nextUrl.origin !== new URL(check.sanitizedUrl).origin) {
      headers = Object.fromEntries(
        Object.entries(headers).filter(([name]) => !CREDENTIAL_HEADERS.includes(name.toLowerCase()))
      );
    }
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method !== 'GET' && method !== 'HEAD')) {
      method = 'GET';
      body = undefined;
      headers = Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'content-type'));
    }
    currentUrl = nextUrl.href;
  }
}

/**
 * True when an error came from the SSRF guard — either thrown directly or wrapped by undici as the
 * `cause` of a `fetch failed` TypeError (blocked DNS answers surface that way).
 */
export function isSsrfBlockedError(err: unknown): boolean {
  if (err instanceof SsrffBlockedError) return true;
  return err instanceof Error && err.cause instanceof SsrffBlockedError;
}
