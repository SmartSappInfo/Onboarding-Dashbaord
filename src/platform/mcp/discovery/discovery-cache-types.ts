/**
 * @fileOverview Discovery Cache Types & Contracts (Phase 5 Milestone 2 Task 3)
 *
 * Implements Rule 8 (Multi-Tenancy), Rule 35 (MCP Discovery Caching with TTL & Invalidation),
 * and Rule 50 (Cache Isolation Rules).
 *
 * Strict Typing Policy: Zero `any` or `any[]` (Rule 4).
 */

import type { McpDomain } from '../transport/transport-types';
import type { EventBus } from '../../events/event-bus';

export interface DiscoveredToolItem {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface CachedDiscoveryPayload {
  tools: DiscoveredToolItem[];
}

export interface CachedDiscoveryEntry {
  cacheKey: string;
  domain: McpDomain;
  organizationId: string;
  workspaceId: string;
  effectiveRole: string;
  scopesHash: string;
  etag: string;
  payload: CachedDiscoveryPayload;
  cachedAt: number;
  expiresAt: number;
  ttlMs: number;
}

export interface DiscoveryCacheOptions {
  /** Time to live in milliseconds (default: 5 minutes / 300,000 ms) */
  ttlMs?: number;
  /** Maximum number of cached discovery entries (default: 500) */
  maxEntries?: number;
  /** Custom EventBus instance (Rule 35 / Rule 40) */
  eventBus?: EventBus;
}

export interface DiscoveryLookupResult {
  hit: boolean;
  notModified?: boolean;
  entry?: CachedDiscoveryEntry;
  paused?: boolean;
}

export interface DiscoveryCacheStats {
  size: number;
  hits: number;
  misses: number;
  invalidations: number;
}
