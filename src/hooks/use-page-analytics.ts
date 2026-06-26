
'use client';

import { useRef, useCallback, startTransition } from 'react';
import type { PageEventType, PageEventChannel } from '@/lib/types';
import { recordCustomPageEvent } from '@/lib/custom-page-analytics-actions';

// ─── Session ID ───────────────────────────────────────────────────────────────

const SESSION_KEY = 'sapp_page_session';

/**
 * Gets or creates a persistent browser session ID.
 * Stored in localStorage — survives page refreshes but not different browsers.
 * Used for uniqueViews deduplication on the server.
 *
 * Returns an empty string in SSR contexts where localStorage is unavailable.
 */
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    // Compact random ID — not a UUID, but collision-resistant enough for analytics
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // Private browsing or storage disabled — degrade gracefully
    return `ephemeral-${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePageAnalyticsReturn {
  /** Track an event. Fire-and-forget — never throws. */
  track: (type: PageEventType, channel?: PageEventChannel) => void;
  /** Set the entity ID once the ?ref= param is known. Can be called at any time. */
  setEntityId: (id: string) => void;
  /** Ref that callers can set to true after firing video_start once. */
  hasFiredVideoStart: React.MutableRefObject<boolean>;
}

/**
 * Shared analytics hook for tracked landing pages.
 *
 * Design decisions:
 * - sessionId and entityId are stored in refs, not state — no re-renders triggered
 * - All event submissions are wrapped in startTransition so they never block the UI
 * - Errors are swallowed — analytics must never break user-facing functionality
 * - The hook is stable across re-renders (useCallback with empty deps)
 *
 * Usage:
 * ```tsx
 * const { track, setEntityId, hasFiredVideoStart } = usePageAnalytics('my-page-slug');
 *
 * // In PageAnalyticsReader (inside Suspense):
 * const ref = searchParams.get('ref');
 * if (ref) setEntityId(ref);
 *
 * // On mount:
 * useEffect(() => { track('page_view'); }, [track]);
 * ```
 */
export function usePageAnalytics(slug: string): UsePageAnalyticsReturn {
  // Refs — mutations don't trigger re-renders
  const sessionId = useRef<string>(getOrCreateSessionId());
  const entityId = useRef<string | undefined>(undefined);
  const hasFiredVideoStart = useRef<boolean>(false);

  const setEntityId = useCallback((id: string) => {
    entityId.current = id;
  }, []);

  const track = useCallback(
    (type: PageEventType, channel: PageEventChannel = 'direct') => {
      startTransition(() => {
        recordCustomPageEvent({
          slug,
          type,
          entityId: entityId.current,
          sessionId: sessionId.current,
          channel,
        }).catch(() => {
          // Silently swallow — analytics failures must never surface to users
        });
      });
    },
    [slug]
  );

  return { track, setEntityId, hasFiredVideoStart };
}
