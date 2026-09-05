/**
 * @fileOverview Server-side Workspace AI Service (WorkspaceAiService).
 * 
 * ARCHITECTURAL INVARIANTS:
 * - High-concurrency protection: Uses an in-memory bounded LRU/TTL cache (5-minute TTL)
 *   to eliminate repetitive Firestore read spikes on server actions & RSC requests.
 * - Automatic evolutionary normalization: Runs all model IDs through `AiModelRegistry.normalizeModelId()`,
 *   guaranteeing zero runtime 404s even if a workspace has stale records in Firestore.
 * - Multi-tenant isolation: Strictly reads and writes within `workspaces/{workspaceId}`.
 * 
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Never bypass `AiModelRegistry.normalizeModelId()` when reading or writing model tokens.
 * - In distributed serverless containers, cache invalidation is local per-process. A 5-minute TTL
 *   balances eventual consistency with heavy load protection.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { WorkspaceAiSettings } from '@/lib/types';
import { AiModelRegistry, type AiProviderId } from '@/lib/ai/model-registry';

interface CacheEntry {
  settings: WorkspaceAiSettings;
  expiresAt: number;
}

// Bounded in-memory cache to handle high concurrent traffic without Firestore read saturation
const workspaceAiCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500; // Prevent unbounded memory growth

function pruneCacheIfNeeded(): void {
  if (workspaceAiCache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    workspaceAiCache.forEach((entry, key) => {
      if (entry.expiresAt < now) {
        workspaceAiCache.delete(key);
      }
    });
    // If still over capacity, evict oldest entries
    while (workspaceAiCache.size >= MAX_CACHE_SIZE) {
      const firstKey = workspaceAiCache.keys().next().value;
      if (firstKey) {
        workspaceAiCache.delete(firstKey);
      } else {
        break;
      }
    }
  }
}

export class WorkspaceAiService {
  /**
   * Retrieves persistent AI settings for a workspace, applying in-memory caching
   * and fallback resolution through the central AiModelRegistry.
   */
  static async getSettings(workspaceId: string): Promise<WorkspaceAiSettings> {
    if (!workspaceId) {
      return this.getDefaultSettings();
    }

    const now = Date.now();
    const cached = workspaceAiCache.get(workspaceId);
    if (cached && cached.expiresAt > now) {
      return cached.settings;
    }

    try {
      const docRef = adminDb.collection('workspaces').doc(workspaceId);
      const snap = await docRef.get();

      if (snap.exists) {
        const data = snap.data();
        const rawSettings = data?.aiSettings as Partial<WorkspaceAiSettings> | undefined;

        if (rawSettings && rawSettings.preferredModelId) {
          const resolvedProvider: AiProviderId =
            rawSettings.preferredProvider === 'anthropic' ||
            rawSettings.preferredProvider === 'openrouter'
              ? rawSettings.preferredProvider
              : 'googleai';

          const resolvedSettings: WorkspaceAiSettings = {
            preferredProvider: resolvedProvider,
            preferredModelId: AiModelRegistry.normalizeModelId(rawSettings.preferredModelId),
            reasoningModelId: rawSettings.reasoningModelId
              ? AiModelRegistry.normalizeModelId(rawSettings.reasoningModelId)
              : undefined,
            fastModelId: rawSettings.fastModelId
              ? AiModelRegistry.normalizeModelId(rawSettings.fastModelId)
              : undefined,
            organizationId: typeof data?.organizationId === 'string' ? data.organizationId : undefined,
            updatedAt: rawSettings.updatedAt || new Date().toISOString(),
            updatedBy: rawSettings.updatedBy,
          };

          pruneCacheIfNeeded();
          workspaceAiCache.set(workspaceId, {
            settings: resolvedSettings,
            expiresAt: now + CACHE_TTL_MS,
          });

          return resolvedSettings;
        }
      }
    } catch (err) {
      console.warn(`[WorkspaceAiService] Failed to fetch settings for workspace "${workspaceId}":`, err);
    }

    // Resolve system-wide fallback settings
    const fallbackSettings = await this.resolveSystemFallbackSettings();
    pruneCacheIfNeeded();
    workspaceAiCache.set(workspaceId, {
      settings: fallbackSettings,
      expiresAt: now + CACHE_TTL_MS,
    });

    return fallbackSettings;
  }

  /**
   * Persists updated AI settings for a workspace, normalizes model IDs,
   * and synchronously refreshes the local in-memory cache.
   */
  static async saveSettings(
    workspaceId: string,
    settings: Partial<WorkspaceAiSettings>,
    actorId?: string
  ): Promise<WorkspaceAiSettings> {
    if (!workspaceId) {
      throw new Error('[WorkspaceAiService] Missing required workspaceId for saveSettings');
    }

    const current = await this.getSettings(workspaceId);
    const nowIso = new Date().toISOString();

    const provider: AiProviderId =
      settings.preferredProvider || current.preferredProvider || 'googleai';

    const normalizedModelId = settings.preferredModelId
      ? AiModelRegistry.normalizeModelId(settings.preferredModelId)
      : current.preferredModelId;

    const normalizedReasoning = settings.reasoningModelId
      ? AiModelRegistry.normalizeModelId(settings.reasoningModelId)
      : current.reasoningModelId;

    const normalizedFast = settings.fastModelId
      ? AiModelRegistry.normalizeModelId(settings.fastModelId)
      : current.fastModelId;

    const updatedSettings: WorkspaceAiSettings = {
      preferredProvider: provider,
      preferredModelId: normalizedModelId,
      ...(normalizedReasoning ? { reasoningModelId: normalizedReasoning } : {}),
      ...(normalizedFast ? { fastModelId: normalizedFast } : {}),
      updatedAt: nowIso,
      ...(actorId ? { updatedBy: actorId } : current.updatedBy ? { updatedBy: current.updatedBy } : {}),
    };

    try {
      const docRef = adminDb.collection('workspaces').doc(workspaceId);
      await docRef.set(
        {
          aiSettings: updatedSettings,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    } catch (err) {
      console.error(`[WorkspaceAiService] Failed to persist aiSettings for workspace "${workspaceId}":`, err);
      throw err;
    }

    // Optimistically update local process cache
    pruneCacheIfNeeded();
    workspaceAiCache.set(workspaceId, {
      settings: updatedSettings,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return updatedSettings;
  }

  /**
   * Invalidates local cache for a specific workspace.
   */
  static invalidateCache(workspaceId: string): void {
    workspaceAiCache.delete(workspaceId);
  }

  /**
   * Default hardcoded fallback settings using the central registry's flagship model.
   */
  private static getDefaultSettings(): WorkspaceAiSettings {
    const flagship = AiModelRegistry.getFlagshipModel();
    return {
      preferredProvider: flagship.provider,
      preferredModelId: flagship.id,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Resolves fallback settings by checking global system_settings/ai_config
   * before falling back to registry flagship. Uses in-memory TTL caching.
   */
  private static async resolveSystemFallbackSettings(): Promise<WorkspaceAiSettings> {
    const now = Date.now();
    const systemCacheKey = '__system_ai_config__';
    const cached = workspaceAiCache.get(systemCacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.settings;
    }

    try {
      const docRef = adminDb.collection('system_settings').doc('ai_config');
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data();
        if (data?.defaultModelId) {
          const provider: AiProviderId =
            data.defaultProvider === 'anthropic' || data.defaultProvider === 'openrouter'
              ? data.defaultProvider
              : 'googleai';

          const resolved: WorkspaceAiSettings = {
            preferredProvider: provider,
            preferredModelId: AiModelRegistry.normalizeModelId(data.defaultModelId),
            updatedAt: new Date().toISOString(),
          };

          workspaceAiCache.set(systemCacheKey, {
            settings: resolved,
            expiresAt: now + CACHE_TTL_MS,
          });

          return resolved;
        }
      }
    } catch {
      // Ambient failure tolerance
    }

    const defaultFallback = this.getDefaultSettings();
    workspaceAiCache.set(systemCacheKey, {
      settings: defaultFallback,
      expiresAt: now + CACHE_TTL_MS,
    });
    return defaultFallback;
  }
}
