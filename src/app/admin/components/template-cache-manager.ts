import { getFilteredTemplatesAction } from '@/app/actions/get-filtered-templates-action';
import type { MessageTemplate, MessageChannel } from '@/lib/types';

export interface CacheEntry {
    data: MessageTemplate[];
    promise: Promise<MessageTemplate[]> | null;
    timestamp: number;
}

// Memory-based cache scoped by channel, workspace, and organization.
// Key format: `${channel}_${workspaceId || 'none'}_${organizationId || 'none'}`
const templatesCache: Record<string, CacheEntry> = {};

const CACHE_TTL = 30000; // 30 seconds TTL

function getCacheKey(
    channel: MessageChannel | 'all',
    workspaceId?: string,
    organizationId?: string
): string {
    return `${channel}_${workspaceId || 'none'}_${organizationId || 'none'}`;
}

/**
 * Fetches message templates with request-deduplication (collapsing concurrent fetches)
 * and an in-memory cache TTL of 30 seconds.
 */
export async function fetchTemplatesCached(
    channel: MessageChannel | 'all',
    workspaceId?: string,
    organizationId?: string,
    forceRefresh = false
): Promise<MessageTemplate[]> {
    const key = getCacheKey(channel, workspaceId, organizationId);
    const now = Date.now();

    if (forceRefresh) {
        delete templatesCache[key];
    }

    const cached = templatesCache[key];

    // 1. Return fresh cached data if valid
    if (cached && cached.data.length > 0 && (now - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    // 2. Return pending promise if a request is already in progress
    if (cached && cached.promise) {
        return cached.promise;
    }

    // 3. Kick off a new request and deduplicate concurrent callers
    const promise = getFilteredTemplatesAction({
        category: 'all',
        recipientType: 'all',
        channel: channel as any,
        workspaceId,
        organizationId,
    })
        .then((result) => {
            templatesCache[key] = {
                data: result,
                promise: null,
                timestamp: Date.now(),
            };
            return result;
        })
        .catch((err) => {
            // Remove promise from cache on failure so future attempts can retry
            if (templatesCache[key]) {
                templatesCache[key].promise = null;
            }
            throw err;
        });

    templatesCache[key] = {
        data: cached?.data || [],
        promise,
        timestamp: now,
    };

    return promise;
}

/**
 * Synchronously retrieves cached templates if they are valid.
 */
export function getTemplatesCachedSync(
    channel: MessageChannel | 'all',
    workspaceId?: string,
    organizationId?: string
): MessageTemplate[] | null {
    const key = getCacheKey(channel, workspaceId, organizationId);
    const cached = templatesCache[key];
    const now = Date.now();
    if (cached && cached.data.length > 0 && (now - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    return null;
}

/**
 * Explicitly invalidates the cache for all channel/workspace contexts.
 * Useful when templates are created, edited, or deleted anywhere.
 */
export function invalidateAllTemplatesCache() {
    Object.keys(templatesCache).forEach(key => {
        delete templatesCache[key];
    });
}
