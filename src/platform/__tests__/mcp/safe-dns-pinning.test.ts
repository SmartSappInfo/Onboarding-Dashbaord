/**
 * @fileOverview Unit & Integration Tests for Socket-Level DNS Pinning & Anti-Rebinding Guard (Phase 5 Milestone 5 Task 3)
 *
 * Implements Milestone 3 Review Recommendation #2, Rule 15, Rule 34, and Rule 50.
 * Verifies that outbound connections cannot be weaponized via TOCTOU DNS rebinding
 * targeting GCP metadata (169.254.169.254), loopback (127.0.0.1), or private subnets.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveAndValidateIp,
  safeFetchWithDnsPinning,
  clearDnsPinCache,
  DNS_PINNING_ERROR_CODES,
  DnsPinningError,
} from '@/platform/mcp/security/safe-dns-pinning';
import {
  ServerAllowlistService,
  createMemoryServerAllowlistStore,
} from '@/platform/mcp/security';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('Socket-Level DNS Pinning & Anti-Rebinding Guard', () => {
  beforeEach(() => {
    clearDnsPinCache();
    setGovernanceDeadManStateForTests(false);
    vi.restoreAllMocks();
  });

  describe('resolveAndValidateIp', () => {
    it('resolves valid public hostnames and returns a pinned record', async () => {
      const mockLookup = vi.fn().mockResolvedValue([
        { address: '93.184.215.14', family: 4 },
      ]);

      const record = await resolveAndValidateIp('api.example.com', {
        lookupFn: mockLookup,
      });

      expect(record.hostname).toBe('api.example.com');
      expect(record.ipAddress).toBe('93.184.215.14');
      expect(record.family).toBe(4);
      expect(record.expiresAt).toBeGreaterThan(Date.now());
      expect(mockLookup).toHaveBeenCalledTimes(1);

      // Verify cached retrieval avoids second lookup
      const cached = await resolveAndValidateIp('api.example.com');
      expect(cached.ipAddress).toBe('93.184.215.14');
      expect(mockLookup).toHaveBeenCalledTimes(1); // Still 1 call
    });

    it('rejects hostnames resolving to GCP metadata 169.254.169.254 (Rule 34)', async () => {
      const mockLookup = vi.fn().mockResolvedValue([
        { address: '169.254.169.254', family: 4 },
      ]);

      await expect(
        resolveAndValidateIp('malicious-rebinding-domain.com', {
          lookupFn: mockLookup,
        })
      ).rejects.toThrow(DNS_PINNING_ERROR_CODES.FORBIDDEN_IP);
    });

    it('rejects hostnames resolving to loopback 127.0.0.1 (Rule 34)', async () => {
      const mockLookup = vi.fn().mockResolvedValue([
        { address: '127.0.0.1', family: 4 },
      ]);

      await expect(
        resolveAndValidateIp('local-spoof.com', {
          lookupFn: mockLookup,
        })
      ).rejects.toThrow(DNS_PINNING_ERROR_CODES.FORBIDDEN_IP);
    });

    it('rejects hostnames resolving to RFC-1918 private subnets (10.0.0.1, 192.168.1.1)', async () => {
      const mockLookup = vi.fn().mockResolvedValue([
        { address: '192.168.1.100', family: 4 },
      ]);

      await expect(
        resolveAndValidateIp('router-probe.internal', {
          lookupFn: mockLookup,
        })
      ).rejects.toThrow(DNS_PINNING_ERROR_CODES.FORBIDDEN_IP);
    });

    it('rejects dual-homed DNS responses containing ANY forbidden IP (Anti-Rebinding Check)', async () => {
      // Adversarial DNS server returns both a benign public IP and a cloud metadata IP
      const mockLookup = vi.fn().mockResolvedValue([
        { address: '93.184.215.14', family: 4 }, // Benign
        { address: '169.254.169.254', family: 4 }, // Toxic metadata
      ]);

      await expect(
        resolveAndValidateIp('dual-homed-attack.com', {
          lookupFn: mockLookup,
        })
      ).rejects.toThrow(DNS_PINNING_ERROR_CODES.FORBIDDEN_IP);
    });

    it('blocks explicit forbidden hostnames (metadata.google.internal, localhost) without DNS lookup', async () => {
      const mockLookup = vi.fn();

      await expect(
        resolveAndValidateIp('metadata.google.internal', {
          lookupFn: mockLookup,
        })
      ).rejects.toThrow(DNS_PINNING_ERROR_CODES.FORBIDDEN_IP);

      expect(mockLookup).not.toHaveBeenCalled();
    });

    it('handles IP literals safely without DNS query', async () => {
      const record = await resolveAndValidateIp('8.8.8.8');
      expect(record.ipAddress).toBe('8.8.8.8');
      expect(record.family).toBe(4);

      await expect(resolveAndValidateIp('127.0.0.1')).rejects.toThrow(
        DNS_PINNING_ERROR_CODES.FORBIDDEN_IP
      );
    });
  });

  describe('safeFetchWithDnsPinning', () => {
    it('pins the socket connection and maintains Host header', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const mockLookup = vi.fn().mockResolvedValue([
        { address: '93.184.215.14', family: 4 },
      ]);

      const res = await safeFetchWithDnsPinning('https://api.external-partner.com/v1/mcp', {
        lookupFn: mockLookup,
        fetchFn: mockFetch,
      });

      expect(res.status).toBe(200);
      expect(mockLookup).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const callArgs = mockFetch.mock.calls[0];
      const targetUrl = callArgs[0] as URL;
      expect(targetUrl.hostname).toBe('api.external-partner.com');
      expect(callArgs[1].pinnedRecord.ipAddress).toBe('93.184.215.14');
    });

    it('blocks outbound requests attempting SSRF to cloud metadata', async () => {
      await expect(
        safeFetchWithDnsPinning('http://169.254.169.254/computeMetadata/v1/')
      ).rejects.toThrow(DNS_PINNING_ERROR_CODES.HOSTNAME_INVALID);
    });

    it('enforces redirect security and rejects redirects to private addresses', async () => {
      const mockFetch = vi.fn().mockImplementation((url: URL) => {
        if (url.hostname === 'legitimate-server.com') {
          return Promise.resolve(
            new Response(null, {
              status: 302,
              headers: { location: 'http://169.254.169.254/metadata' },
            })
          );
        }
        return Promise.resolve(new Response('ok', { status: 200 }));
      });

      const mockLookup = vi.fn().mockResolvedValue([
        { address: '93.184.215.14', family: 4 },
      ]);

      await expect(
        safeFetchWithDnsPinning('https://legitimate-server.com/redirect', {
          lookupFn: mockLookup,
          fetchFn: mockFetch,
        })
      ).rejects.toThrow(DnsPinningError);
    });
  });

  describe('ServerAllowlistService.fetchServer integration', () => {
    it('executes safe fetch to approved server using pinned DNS', async () => {
      const store = createMemoryServerAllowlistStore();
      const service = new ServerAllowlistService({ store });

      const tenant = { organizationId: 'org_test', workspaceId: 'ws_test' };

      // Register server and transition to approved
      await service.registerServer(
        {
          serverId: 'srv_external_hub',
          serverUrl: 'https://hub.partner-service.com/mcp',
          transportType: 'sse',
          allowedDomains: ['crm'],
          allowedTools: [],
        },
        tenant,
        'user_admin'
      );

      await service.transitionStatus('srv_external_hub', 'reviewed', tenant, 'user_reviewer');
      await service.transitionStatus('srv_external_hub', 'tested', tenant, 'user_tester');
      await service.transitionStatus('srv_external_hub', 'approved', tenant, 'user_approver');

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'connected' }), { status: 200 })
      );
      const mockLookup = vi.fn().mockResolvedValue([
        { address: '198.51.100.25', family: 4 },
      ]);

      const res = await service.fetchServer('srv_external_hub', tenant, 'tools/list', {
        lookupFn: mockLookup,
        fetchFn: mockFetch,
      });

      expect(res.status).toBe(200);
      expect(mockLookup).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      const store = createMemoryServerAllowlistStore();
      const service = new ServerAllowlistService({ store });
      const tenant = { organizationId: 'org_test', workspaceId: 'ws_test' };

      await service.registerServer(
        {
          serverId: 'srv_external_2',
          serverUrl: 'https://hub.partner-service.com/mcp',
          transportType: 'sse',
          allowedDomains: ['crm'],
          allowedTools: [],
        },
        tenant,
        'user_admin'
      );
      await service.transitionStatus('srv_external_2', 'reviewed', tenant, 'user_reviewer');
      await service.transitionStatus('srv_external_2', 'tested', tenant, 'user_tester');
      await service.transitionStatus('srv_external_2', 'approved', tenant, 'user_approver');

      // Trip dead-man switch
      setGovernanceDeadManStateForTests(true);

      await expect(
        service.fetchServer('srv_external_2', tenant, 'tools/list')
      ).rejects.toThrow('MCP_EXECUTION_PAUSED');
    });
  });
});
