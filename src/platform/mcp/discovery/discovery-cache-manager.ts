/**
 * @fileOverview Progressive Tool Discovery Cache & Invalidation Engine (Phase 5 Milestone 2 Task 3)
 *
 * Implements Rule 8 (Multi-Tenancy), Rule 35 (MCP Discovery Caching with TTL & Invalidation),
 * Rule 40 (Domain Events), Rule 50 (Cache Isolation Rules), and Rule 60 (Dead-Man Controls).
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Cache Isolation (Rule 50): Cache keys immutably bind `organizationId`, `workspaceId`, `domain`,
 *   `effectiveRole`, and SHA-256 `scopesHash`. Tenant A and Tenant B NEVER share cache entries.
 * - ETag Validation (Rule 35): Computes deterministic SHA-256 `discoveryETag` over the tool list.
 *   Enables HTTP conditional validation (`If-None-Match`) returning 304 Not Modified.
 * - Automated EventBus Invalidation: Listens to `policy.updated`, `capability.registered`, and
 *   `governance.dead_man.tripped` to immediately purge stale cached tool definitions.
 * - Strict Typing Policy: Zero `any` or `any[]` (Rule 4).
 */

import crypto from 'node:crypto';
import type { McpDomain } from '../transport/transport-types';
import { defaultEventBus, type EventBus, type EventBusSubscription } from '../../events/event-bus';
import type {
  CachedDiscoveryEntry,
  DiscoveryCacheOptions,
  DiscoveryLookupResult,
  DiscoveryCacheStats,
} from './discovery-cache-types';

export * from './discovery-cache-types';

export interface BuildDiscoveryCacheKeyParams {
  organizationId: string;
  workspaceId: string;
  domain: McpDomain;
  effectiveRole: string;
  grantedScopes: readonly string[];
}

/**
 * Computes a deterministic SHA-256 hash of granted scopes (Rule 50).
 */
export function hashGrantedScopes(scopes: readonly string[]): string {
  const sorted = [...scopes].sort().join(',');
  return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 16);
}

/**
 * Generates an immutable, multi-tenant discovery cache key (Rule 8 & Rule 50).
 */
export function buildDiscoveryCacheKey(params: BuildDiscoveryCacheKeyParams): string {
  const { organizationId, workspaceId, domain, effectiveRole, grantedScopes } = params;
  const scopesHash = hashGrantedScopes(grantedScopes);
  return `mcp:discovery:${organizationId}:${workspaceId}:${domain}:${effectiveRole}:${scopesHash}`;
}

/**
 * Computes a deterministic SHA-256 ETag from a serialized tools array (Rule 35).
 */
export function computeDiscoveryETag(tools: unknown): string {
  const serialized = JSON.stringify(tools);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export class DiscoveryCacheManager {
  private readonly cache = new Map<string, CachedDiscoveryEntry>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;
  private readonly eventBus: EventBus;
  private subscriptions: EventBusSubscription[] = [];

  private hits = 0;
  private misses = 0;
  private invalidations = 0;

  constructor(options: DiscoveryCacheOptions = {}) {
    this.defaultTtlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.maxEntries = options.maxEntries ?? 500;
    this.eventBus = options.eventBus ?? defaultEventBus;

    // Subscribe to platform domain events for automated invalidation (Rule 35 & Rule 40)
    this.registerEventBusSubscribers();
  }

  /**
   * Sets up automated cache eviction on platform security & capability events.
   */
  private registerEventBusSubscribers(): void {
    const sub1 = this.eventBus.subscribe('policy.updated', (event) => {
      if (event.organizationId) {
        this.invalidateTenant(event.organizationId, event.workspaceId ?? undefined);
      }
    });

    const sub2 = this.eventBus.subscribe('capability.registered', (event) => {
      const domain = (event.payload as { domain?: McpDomain })?.domain;
      if (domain) {
        this.invalidateDomain(domain);
      } else {
        this.clear();
      }
    });

    const sub3 = this.eventBus.subscribe('governance.dead_man.tripped', () => {
      // Platform-wide emergency dead-man pause engagement: immediately flush discovery cache
      this.clear();
    });

    this.subscriptions.push(sub1, sub2, sub3);
  }

  /**
   * Unsubscribes all event bus subscriptions and clears cache.
   */
  public destroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
    this.clear();
  }

  /**
   * Retrieves a cached discovery entry by cacheKey with conditional ETag validation.
   */
  public get(key: string, clientEtag?: string | null): DiscoveryLookupResult {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses += 1;
      return { hit: false };
    }

    // TTL Expiration Check
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses += 1;
      return { hit: false };
    }

    this.hits += 1;

    // Conditional ETag Match (Rule 35)
    if (clientEtag && clientEtag === entry.etag) {
      return {
        hit: true,
        notModified: true,
        entry,
      };
    }

    return {
      hit: true,
      notModified: false,
      entry,
    };
  }

  /**
   * Stores a discovery entry in the multi-tenant cache.
   */
  public set(
    input: Omit<CachedDiscoveryEntry, 'cachedAt' | 'expiresAt' | 'ttlMs'> & { ttlMs?: number }
  ): void {
    // Enforce max capacity bound (LRU-like eviction: remove oldest inserted entry)
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    const effectiveTtl = input.ttlMs ?? this.defaultTtlMs;

    const fullEntry: CachedDiscoveryEntry = {
      ...input,
      ttlMs: effectiveTtl,
      cachedAt: now,
      expiresAt: now + effectiveTtl,
    };

    this.cache.set(input.cacheKey, fullEntry);
  }

  /**
   * Invalidates all cached discovery entries belonging to an organization or workspace.
   */
  public invalidateTenant(organizationId: string, workspaceId?: string): number {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.organizationId === organizationId) {
        if (!workspaceId || entry.workspaceId === workspaceId) {
          this.cache.delete(key);
          count += 1;
        }
      }
    }

    this.invalidations += count;
    return count;
  }

  /**
   * Invalidates all cached entries for a specific domain across all tenants.
   */
  public invalidateDomain(domain: McpDomain): number {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.domain === domain) {
        this.cache.delete(key);
        count += 1;
      }
    }

    this.invalidations += count;
    return count;
  }

  /**
   * Clears the entire discovery cache.
   */
  public clear(): void {
    this.invalidations += this.cache.size;
    this.cache.clear();
  }

  /**
   * Returns runtime cache telemetry and statistics.
   */
  public getStats(): DiscoveryCacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      invalidations: this.invalidations,
    };
  }
}

/**
 * Creates an isolated DiscoveryCacheManager instance.
 */
export function createDiscoveryCacheManager(
  options: DiscoveryCacheOptions = {}
): DiscoveryCacheManager {
  return new DiscoveryCacheManager(options);
}

/**
 * Global singleton DiscoveryCacheManager preserved across Next.js HMR reloads.
 */
const globalRef = globalThis as { __smartsappDiscoveryCacheManager?: DiscoveryCacheManager };

export function getGlobalDiscoveryCacheManager(): DiscoveryCacheManager {
  if (!globalRef.__smartsappDiscoveryCacheManager) {
    globalRef.__smartsappDiscoveryCacheManager = createDiscoveryCacheManager();
  }
  return globalRef.__smartsappDiscoveryCacheManager;
}

export const defaultDiscoveryCacheManager = getGlobalDiscoveryCacheManager();
