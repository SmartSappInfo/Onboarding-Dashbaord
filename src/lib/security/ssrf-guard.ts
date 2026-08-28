/**
 * @fileOverview SSRF & Ingress Protection Guard
 *
 * Provides robust validation for external URLs before server-side fetch requests,
 * preventing Server-Side Request Forgery (SSRF), internal port scanning, and cloud
 * metadata service extraction (e.g. Google Cloud Metadata at 169.254.169.254 or AWS/Azure equivalents).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Why this exists: Server endpoints that fetch user-supplied URLs (e.g. webhooks, website brand scrapers)
 *   could be weaponized to query internal microservices or cloud instance metadata.
 * - Caution Areas: Do not disable IPv4 private range checks or cloud metadata blocks in production.
 *   If custom internal webhook targets are needed in enterprise VPCs in the future, introduce a strictly
 *   authenticated allowlist mechanism rather than weakening this baseline guard.
 * - Testability: Pure functional module without side effects. Comprehensive unit tests live in
 *   `src/lib/security/__tests__/ssrf-guard.test.ts`.
 */

export interface SsrfValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

/**
 * Checks whether an IPv4 address string falls into a forbidden private or local range.
 */
function isForbiddenIpV4(ip: string): boolean {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
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
 * Checks whether a hostname or IP indicates a loopback or private host.
 */
function isForbiddenHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();

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

  // IPv6 Loopback / Link-Local checks
  if (
    normalized === '::1' ||
    normalized === '[::1]' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized.startsWith('fe80:') || // IPv6 Link-Local
    normalized.startsWith('fc00:') || // IPv6 Unique Local Address
    normalized.startsWith('fd00:')
  ) {
    return true;
  }

  // Check IPv4 pattern
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(normalized)) {
    return isForbiddenIpV4(normalized);
  }

  return false;
}

/**
 * Validates a user-supplied external URL to prevent SSRF vulnerabilities.
 *
 * @param rawUrl The URL string to validate.
 * @returns Result object indicating validity, sanitized URL, or failure reason.
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

  // 2. Disallow embedded credentials (e.g. http://user:pass@example.com)
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

  // 4. Port validation: Allow standard ports or custom high ports (prevent binding to dangerous service ports)
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      return { isValid: false, error: 'Invalid port number specified.' };
    }
    // Block common internal administrative ports if needed (e.g. 22 SSH, 25 SMTP, 2375 Docker daemon)
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
