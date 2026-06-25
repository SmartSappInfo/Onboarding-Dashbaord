'use client';

import * as React from 'react';

/**
 * Lightweight context exposing the current automation id to React Flow custom
 * nodes (which only receive `data`). Used by message-step nodes to load their
 * delivery statistics without threading `automationId` through every node-data
 * mutation and undo/redo snapshot.
 */
interface AutomationMeta {
  automationId: string | undefined;
}

const AutomationMetaContext = React.createContext<AutomationMeta>({ automationId: undefined });

export function AutomationMetaProvider({
  automationId,
  children,
}: {
  automationId: string | undefined;
  children: React.ReactNode;
}): React.ReactElement {
  const value = React.useMemo<AutomationMeta>(() => ({ automationId }), [automationId]);
  return <AutomationMetaContext.Provider value={value}>{children}</AutomationMetaContext.Provider>;
}

export function useAutomationMeta(): AutomationMeta {
  return React.useContext(AutomationMetaContext);
}
