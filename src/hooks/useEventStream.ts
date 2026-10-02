'use client';

/**
 * @fileOverview React Hook for Real-Time Event Streaming (Phase 2 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing), Rule 9 (Connection Teardown),
 * Rule 10 (Inline Architectural Guidance), and Rule 24 (Resilient Reconnect).
 *
 * Connects to `/api/events/stream` via browser Server-Sent Events (SSE).
 * Handles automatic reconnect with exponential backoff and delivers typed
 * ActivityRecordV2 events directly to client components.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import type { ActivityRecordV2 } from '@/platform/events/contracts/activity-record.contract';

export type EventStreamStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseEventStreamOptions {
  workspaceId?: string | null;
  entityId?: string | null;
  actorType?: string | null;
  onActivity?: (activity: ActivityRecordV2) => void;
  enabled?: boolean;
}

export interface UseEventStreamResult {
  status: EventStreamStatus;
  lastActivity: ActivityRecordV2 | null;
  error: string | null;
  reconnect: () => void;
}

export function useEventStream(options: UseEventStreamOptions = {}): UseEventStreamResult {
  const { workspaceId, entityId, actorType, onActivity, enabled = true } = options;

  const [status, setStatus] = useState<EventStreamStatus>('disconnected');
  const [lastActivity, setLastActivity] = useState<ActivityRecordV2 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const onActivityRef = useRef(onActivity);

  // Keep latest onActivity reference
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setStatus('connecting');
    setError(null);

    // Build URL with query params
    const params = new URLSearchParams();
    if (workspaceId) params.set('workspaceId', workspaceId);
    if (entityId) params.set('entityId', entityId);
    if (actorType) params.set('actorType', actorType);

    const queryString = params.toString();
    const url = `/api/events/stream${queryString ? `?${queryString}` : ''}`;

    try {
      const es = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        setStatus('connected');
        retryCountRef.current = 0;
        setError(null);
      });

      es.addEventListener('activity', (event: MessageEvent) => {
        try {
          const record = JSON.parse(event.data) as ActivityRecordV2;
          setLastActivity(record);
          if (onActivityRef.current) {
            onActivityRef.current(record);
          }
        } catch (err: unknown) {
          console.warn('[useEventStream] Failed to parse activity event:', err);
        }
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setStatus('disconnected');

        // Exponential backoff reconnect: 1s, 2s, 4s, up to 16s
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000);
        retryCountRef.current += 1;
        setError(`Connection lost. Retrying in ${Math.round(delay / 1000)}s...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err: unknown) {
      setStatus('disconnected');
      setError(err instanceof Error ? err.message : 'Failed to establish event stream');
    }
  }, [enabled, workspaceId, entityId, actorType]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus('disconnected');
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  return {
    status,
    lastActivity,
    error,
    reconnect,
  };
}
