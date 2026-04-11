'use client';

import { useWorkspace } from '@/context/WorkspaceContext';
import { resolveTerminologyFromWorkspace } from '@/lib/terminology';

/**
 * Hook to provide dynamic terminology based on workspace settings.
 */
export function useTerminology() {
  const { activeWorkspace } = useWorkspace();
  return resolveTerminologyFromWorkspace(activeWorkspace);
}
