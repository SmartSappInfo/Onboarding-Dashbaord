'use client';

/**
 * @fileOverview Capability Availability Pre-flight Hook (Phase 1 / PR-9)
 *
 * Implements Rule 12 (Risk Visibility), Rule 64 (Flag Hierarchy), and PRD §53.
 *
 * Checks whether a capability is enabled and permitted for the current workspace
 * before invocation, allowing UI elements to render disabled states or warnings pre-click.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  checkCapabilityAvailabilityAction,
  type CapabilityAvailability,
} from './invoke-capability-action';

export interface UseCapabilityAvailabilityReturn extends CapabilityAvailability {
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useCapabilityAvailability(
  capabilityId: string,
  workspaceId?: string
): UseCapabilityAvailabilityReturn {
  const [availability, setAvailability] = useState<CapabilityAvailability>({
    available: false,
    enabled: false,
    authorized: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(workspaceId && capabilityId));

  const checkAvailability = useCallback(async () => {
    if (!capabilityId || !workspaceId) {
      setAvailability({
        available: false,
        enabled: false,
        authorized: false,
        reason: 'Capability ID and Workspace ID are required.',
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await checkCapabilityAvailabilityAction(capabilityId, workspaceId);
      setAvailability(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to check capability availability.';
      setAvailability({
        available: false,
        enabled: false,
        authorized: false,
        reason: message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [capabilityId, workspaceId]);

  useEffect(() => {
    void checkAvailability();
  }, [checkAvailability]);

  return {
    ...availability,
    isLoading,
    refetch: checkAvailability,
  };
}
