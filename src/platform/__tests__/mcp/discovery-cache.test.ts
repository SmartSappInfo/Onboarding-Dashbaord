/**
 * @fileOverview Unit tests for Progressive Tool Discovery Cache & Invalidation Engine (Phase 5 Milestone 2 Task 3)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DiscoveryCacheManager,
  buildDiscoveryCacheKey,
  computeDiscoveryETag,
  createDiscoveryCacheManager,
} from '../../mcp/discovery/discovery-cache-manager';
import type { AgentPrincipal } from '../../capabilities/contracts/capability-definition';
import { createEventBus, type EventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

describe('Progressive Tool Discovery Cache & Invalidation Engine (Phase 5 Milestone 2 Task 3)', () => {
  let cacheManager: DiscoveryCacheManager;
  let testBus: EventBus;

  const mockPrincipalA: AgentPrincipal = {
    actorType: 'agent',
    userId: 'user_agent_a',
    organizationId: 'org_acme',
    workspaceId: 'ws_sales',
    agentId: 'agent_a',
    agentVersion: '2.0.0',
    grantedScopes: ['app:crm_view', 'crm:read'],
    effectiveRole: 'mcp_sdr',
  };

  const mockPrincipalB: AgentPrincipal = {
    actorType: 'agent',
    userId: 'user_agent_b',
    organizationId: 'org_beta',
    workspaceId: 'ws_marketing',
    agentId: 'agent_b',
    agentVersion: '2.0.0',
    grantedScopes: ['app:crm_view', 'crm:read'],
    effectiveRole: 'mcp_sdr',
  };

  const sampleTools = [
    {
      name: 'crm_entity_get',
      description: 'Get CRM Entity profile',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
    },
  ];

  beforeEach(() => {
    testBus = createEventBus();
    cacheManager = createDiscoveryCacheManager({ ttlMs: 60000, eventBus: testBus });
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  describe('Multi-Tenant Cache Key Isolation (Rule 8, Rule 50)', () => {
    it('generates distinct cache keys for different organizations and workspaces', () => {
      const keyA = buildDiscoveryCacheKey({
        organizationId: mockPrincipalA.organizationId,
        workspaceId: mockPrincipalA.workspaceId,
        domain: 'crm',
        effectiveRole: mockPrincipalA.effectiveRole || 'agent',
        grantedScopes: mockPrincipalA.grantedScopes,
      });

      const keyB = buildDiscoveryCacheKey({
        organizationId: mockPrincipalB.organizationId,
        workspaceId: mockPrincipalB.workspaceId,
        domain: 'crm',
        effectiveRole: mockPrincipalB.effectiveRole || 'agent',
        grantedScopes: mockPrincipalB.grantedScopes,
      });

      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain('org_acme:ws_sales:crm');
      expect(keyB).toContain('org_beta:ws_marketing:crm');
    });

    it('generates distinct cache keys for different scope sets on the same workspace', () => {
      const key1 = buildDiscoveryCacheKey({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        domain: 'crm',
        effectiveRole: 'mcp_agent',
        grantedScopes: ['app:crm_view'],
      });

      const key2 = buildDiscoveryCacheKey({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        domain: 'crm',
        effectiveRole: 'mcp_agent',
        grantedScopes: ['app:crm_view', 'app:crm_manage'],
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe('Cache Set, Get & ETag Computation (Rule 35)', () => {
    it('computes deterministic SHA-256 ETag for tool payloads', () => {
      const etag1 = computeDiscoveryETag(sampleTools);
      const etag2 = computeDiscoveryETag(sampleTools);
      expect(etag1).toBe(etag2);
      expect(etag1).toMatch(/^[a-f0-9]{64}$/);

      // Modified tool yields different ETag
      const modifiedTools = [{ ...sampleTools[0], description: 'Modified description' }];
      const etag3 = computeDiscoveryETag(modifiedTools);
      expect(etag3).not.toBe(etag1);
    });

    it('stores and retrieves cached discovery payload', () => {
      const key = buildDiscoveryCacheKey({
        organizationId: mockPrincipalA.organizationId,
        workspaceId: mockPrincipalA.workspaceId,
        domain: 'crm',
        effectiveRole: mockPrincipalA.effectiveRole || 'agent',
        grantedScopes: mockPrincipalA.grantedScopes,
      });

      const etag = computeDiscoveryETag(sampleTools);

      cacheManager.set({
        cacheKey: key,
        domain: 'crm',
        organizationId: mockPrincipalA.organizationId,
        workspaceId: mockPrincipalA.workspaceId,
        effectiveRole: mockPrincipalA.effectiveRole || 'agent',
        scopesHash: 'hash_123',
        etag,
        payload: { tools: sampleTools },
        ttlMs: 60000,
      });

      // Cold request without ETag -> returns full payload
      const result = cacheManager.get(key);
      expect(result.hit).toBe(true);
      expect(result.notModified).toBe(false);
      expect(result.entry?.etag).toBe(etag);
      expect(result.entry?.payload.tools).toHaveLength(1);

      // Conditional request with matching If-None-Match ETag -> returns notModified: true
      const conditionalResult = cacheManager.get(key, etag);
      expect(conditionalResult.hit).toBe(true);
      expect(conditionalResult.notModified).toBe(true);
    });

    it('evicts expired entries on read (TTL expiration)', () => {
      const shortLivedCache = createDiscoveryCacheManager({ ttlMs: 1 }); // 1ms TTL
      const key = 'test:key:1';
      const etag = computeDiscoveryETag(sampleTools);

      shortLivedCache.set({
        cacheKey: key,
        domain: 'crm',
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        effectiveRole: 'agent',
        scopesHash: 'hash_123',
        etag,
        payload: { tools: sampleTools },
        ttlMs: 1,
      });

      // Advance time slightly
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = shortLivedCache.get(key);
          expect(result.hit).toBe(false);
          resolve();
        }, 10);
      });
    });
  });

  describe('Invalidation & EventBus Integration (Rule 35, Rule 40)', () => {
    it('invalidates cached entries by tenant', () => {
      const key = buildDiscoveryCacheKey({
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        domain: 'crm',
        effectiveRole: 'agent',
        grantedScopes: ['app:crm_view'],
      });

      cacheManager.set({
        cacheKey: key,
        domain: 'crm',
        organizationId: 'org_acme',
        workspaceId: 'ws_sales',
        effectiveRole: 'agent',
        scopesHash: 'hash_1',
        etag: 'etag_1',
        payload: { tools: sampleTools },
        ttlMs: 60000,
      });

      expect(cacheManager.get(key).hit).toBe(true);
      const invalidatedCount = cacheManager.invalidateTenant('org_acme', 'ws_sales');
      expect(invalidatedCount).toBe(1);
      expect(cacheManager.get(key).hit).toBe(false);
    });

    it('subscribes to EventBus and invalidates on policy.updated', async () => {
      const key = buildDiscoveryCacheKey({
        organizationId: 'org_event_test',
        workspaceId: 'ws_event_test',
        domain: 'crm',
        effectiveRole: 'agent',
        grantedScopes: ['app:crm_view'],
      });

      cacheManager.set({
        cacheKey: key,
        domain: 'crm',
        organizationId: 'org_event_test',
        workspaceId: 'ws_event_test',
        effectiveRole: 'agent',
        scopesHash: 'hash_event',
        etag: 'etag_event',
        payload: { tools: sampleTools },
        ttlMs: 60000,
      });

      expect(cacheManager.get(key).hit).toBe(true);

      // Publish policy.updated event
      await testBus.publish(
        createDomainEvent({
          type: 'policy.updated',
          source: 'policy-service',
          organizationId: 'org_event_test',
          workspaceId: 'ws_event_test',
          actor: { type: 'system', id: 'sys_policy' },
          entity: { type: 'policy', id: 'pol_123' },
          payload: { reason: 'permission grant revoked' },
          correlationId: 'corr_test_1',
        })
      );

      expect(cacheManager.get(key).hit).toBe(false);
    });

    it('invalidates domain entries on capability.registered', async () => {
      const crmKey = buildDiscoveryCacheKey({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        domain: 'crm',
        effectiveRole: 'agent',
        grantedScopes: ['app:crm_view'],
      });

      const messagingKey = buildDiscoveryCacheKey({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        domain: 'messaging',
        effectiveRole: 'agent',
        grantedScopes: ['app:msg_send'],
      });

      cacheManager.set({
        cacheKey: crmKey,
        domain: 'crm',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        effectiveRole: 'agent',
        scopesHash: 'hash_1',
        etag: 'etag_crm',
        payload: { tools: sampleTools },
        ttlMs: 60000,
      });

      cacheManager.set({
        cacheKey: messagingKey,
        domain: 'messaging',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        effectiveRole: 'agent',
        scopesHash: 'hash_2',
        etag: 'etag_msg',
        payload: { tools: sampleTools },
        ttlMs: 60000,
      });

      expect(cacheManager.get(crmKey).hit).toBe(true);
      expect(cacheManager.get(messagingKey).hit).toBe(true);

      // Emit capability.registered for 'crm'
      await testBus.publish(
        createDomainEvent({
          type: 'capability.registered',
          source: 'capability-registry',
          organizationId: 'org_test',
          actor: { type: 'system', id: 'sys_registry' },
          entity: { type: 'capability', id: 'crm.contact.create' },
          payload: { domain: 'crm' },
          correlationId: 'corr_test_cap',
        })
      );

      // crm cache invalidated, messaging cache preserved
      expect(cacheManager.get(crmKey).hit).toBe(false);
      expect(cacheManager.get(messagingKey).hit).toBe(true);
    });

    it('flushes entire cache when governance.dead_man.tripped fires (Rule 60)', async () => {
      const key1 = 'cache:item:1';
      const key2 = 'cache:item:2';

      cacheManager.set({
        cacheKey: key1,
        domain: 'crm',
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        effectiveRole: 'agent',
        scopesHash: 'h1',
        etag: 'e1',
        payload: { tools: sampleTools },
      });

      cacheManager.set({
        cacheKey: key2,
        domain: 'knowledge',
        organizationId: 'org_2',
        workspaceId: 'ws_2',
        effectiveRole: 'agent',
        scopesHash: 'h2',
        etag: 'e2',
        payload: { tools: sampleTools },
      });

      expect(cacheManager.get(key1).hit).toBe(true);
      expect(cacheManager.get(key2).hit).toBe(true);

      // Dead man tripped
      await testBus.publish(
        createDomainEvent({
          type: 'governance.dead_man.tripped',
          source: 'governance',
          organizationId: 'system',
          actor: { type: 'system', id: 'sys_gov' },
          entity: { type: 'dead_man', id: 'dm_main' },
          payload: { reason: 'emergency pause activated' },
          correlationId: 'corr_dm',
        })
      );

      expect(cacheManager.get(key1).hit).toBe(false);
      expect(cacheManager.get(key2).hit).toBe(false);
      expect(cacheManager.getStats().size).toBe(0);
    });
  });
});
