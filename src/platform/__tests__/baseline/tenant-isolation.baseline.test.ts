// @vitest-environment node
/**
 * @fileOverview Network Isolation Baseline Regression Test (Phase 0)
 *
 * Validates Rule 34 (SSRF & Cloud Run metadata protection). Offline: DNS is stubbed so the suite
 * never depends on the network. Tenant/workspace isolation is covered by the evaluator, MCP and
 * agent-step suites.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dns from 'node:dns';
import { validateSafeEgressUrl, SsrffBlockedError } from '@/platform/security/safe-url-fetch';

beforeEach(() => {
  // Public hostnames resolve to a public documentation-free address; nothing leaves the machine.
  const publicAnswer: dns.LookupAddress[] = [{ address: '93.184.216.34', family: 4 }];
  // lookup is overloaded (single vs `all`); the guard always calls it with `all: true`.
  vi.spyOn(dns.promises, 'lookup').mockImplementation((async () => publicAnswer) as unknown as typeof dns.promises.lookup);
});
afterEach(() => vi.restoreAllMocks());

describe('Network Boundary Baseline', () => {
  describe('SSRF & Cloud Run Metadata Defense (Rule 34)', () => {
    it('blocks Google Cloud Metadata server IP (169.254.169.254)', async () => {
      await expect(
        validateSafeEgressUrl('http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token')
      ).rejects.toThrow(SsrffBlockedError);
    });

    it('blocks metadata.google.internal hostname', async () => {
      await expect(
        validateSafeEgressUrl('http://metadata.google.internal/computeMetadata/v1/')
      ).rejects.toThrow(SsrffBlockedError);
    });

    it('blocks localhost and loopback interfaces', async () => {
      await expect(validateSafeEgressUrl('http://localhost:8080/api/internal')).rejects.toThrow(SsrffBlockedError);
      await expect(validateSafeEgressUrl('http://127.0.0.1:9002/api/admin')).rejects.toThrow(SsrffBlockedError);
    });

    it('blocks private RFC-1918 subnets (10.x, 172.16.x, 192.168.x)', async () => {
      await expect(validateSafeEgressUrl('http://10.0.0.5:8080')).rejects.toThrow(SsrffBlockedError);
      await expect(validateSafeEgressUrl('http://192.168.1.1/router')).rejects.toThrow(SsrffBlockedError);
    });

    it('blocks IPv4-mapped IPv6 metadata and loopback addresses', async () => {
      await expect(
        validateSafeEgressUrl('http://[::ffff:169.254.169.254]/computeMetadata/v1/')
      ).rejects.toThrow(SsrffBlockedError);
      await expect(
        validateSafeEgressUrl('http://[::ffff:127.0.0.1]:8080/admin')
      ).rejects.toThrow(SsrffBlockedError);
    });

    it('blocks Carrier-Grade NAT (100.64.0.0/10) and IPv6 Unique Local Addresses', async () => {
      await expect(validateSafeEgressUrl('http://100.64.1.1:8080')).rejects.toThrow(SsrffBlockedError);
      await expect(validateSafeEgressUrl('http://[fc00::1]/secret')).rejects.toThrow(SsrffBlockedError);
      await expect(validateSafeEgressUrl('http://[fd12:3456::1]/internal')).rejects.toThrow(SsrffBlockedError);
    });

    it('allows valid public HTTPS endpoints', async () => {
      const validUrl = await validateSafeEgressUrl('https://api.resend.com/emails');
      expect(validUrl).toBe('https://api.resend.com/emails');
    });
  });
});
