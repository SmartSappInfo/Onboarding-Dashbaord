'use client';

/**
 * @fileOverview Context Rail Context & State Management (Phase 8 Milestone 4)
 *
 * Implements Rule 4 (Zero any), Rule 7 (Mobile-first accessibility),
 * Rule 10 (Inline architectural documentation), and Rule 68/§81 (No dead ends).
 *
 * Provides global state for the adaptive right Context Rail:
 * - Controls rail open/collapse state.
 * - Manages active entity binding (`activeEntity`).
 * - Listens for global keyboard shortcut `⌥C` (Option+C / Alt+C).
 * - Tracks active module tab & prompt pre-population.
 * - Fetches live contextual intelligence data (`EntityContextRailData`).
 * - Exposes live badge counts for pending approvals & active runs.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import type { EntityContextRailData, WorkspaceContextRailData } from '@/platform/ui/context-rail';
import {
  getEntityContextRailDataAction,
  getWorkspaceContextRailDataAction,
} from '@/app/actions/context-rail-actions';

export interface ContextRailEntity {
  id: string;
  type: string;
  name: string;
}

export interface ContextRailContextValue {
  isOpen: boolean;
  toggleRail: () => void;
  toggle: () => void;
  openRail: (entityOrId?: string | ContextRailEntity, entityType?: string, entityName?: string) => void;
  closeRail: () => void;
  close: () => void;
  activeEntity: ContextRailEntity | null;
  activeEntityId?: string;
  activeEntityType?: string;
  setActiveEntity: (entity: ContextRailEntity | null) => void;
  data: EntityContextRailData | null;
  workspaceData: WorkspaceContextRailData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  pendingApprovalsCount: number;
  activeRunsCount: number;
  activeModuleTab: string;
  setActiveModuleTab: (tab: string) => void;
  activePromptQuery: string;
  setActivePromptQuery: (query: string) => void;
}

const ContextRailContext = React.createContext<ContextRailContextValue | null>(null);

export interface ContextRailProviderProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  initialEntityId?: string;
  initialEntityType?: string;
  initialEntityName?: string;
}

export function ContextRailProvider({
  children,
  defaultOpen = false,
  initialEntityId,
  initialEntityType = 'contact',
  initialEntityName,
}: ContextRailProviderProps): React.JSX.Element {
  const pathname = usePathname();
  const tenant = useTenant();
  const activeOrgId = tenant?.activeOrganizationId || undefined;
  const activeWsId = tenant?.activeWorkspaceId || undefined;

  const [isOpen, setIsOpen] = React.useState<boolean>(defaultOpen);
  const [activeEntity, setActiveEntity] = React.useState<ContextRailEntity | null>(
    initialEntityId
      ? {
          id: initialEntityId,
          type: initialEntityType,
          name: initialEntityName || initialEntityId,
        }
      : null
  );
  const [activeModuleTab, setActiveModuleTab] = React.useState<string>('all');
  const [activePromptQuery, setActivePromptQuery] = React.useState<string>('');

  const [data, setData] = React.useState<EntityContextRailData | null>(null);
  const [workspaceData, setWorkspaceData] = React.useState<WorkspaceContextRailData | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Route-based entity resolution
  React.useEffect(() => {
    if (!pathname) return;

    // 1. /admin/entities/:id
    const entityMatch = pathname.match(/\/admin\/entities\/([^/?#]+)/);
    if (entityMatch && entityMatch[1]) {
      const subroutes = ['upload', 'lead-scoring', 'imports', 'new', 'components'];
      if (!subroutes.includes(entityMatch[1])) {
        const id = entityMatch[1];
        setActiveEntity((prev) => {
          if (prev?.id === id) return prev;
          return {
            id,
            type: 'entity',
            name: id.replace(/^[^_]+_/, '').replace(/[_-]/g, ' '),
          };
        });
        return;
      }
    }

    // 2. /admin/contacts/:id
    const contactMatch = pathname.match(/\/admin\/contacts\/([^/?#]+)/);
    if (contactMatch && contactMatch[1]) {
      const subroutes = ['upload', 'new', 'imports'];
      if (!subroutes.includes(contactMatch[1])) {
        const id = contactMatch[1];
        setActiveEntity((prev) => {
          if (prev?.id === id) return prev;
          return {
            id,
            type: 'contact',
            name: id.replace(/^[^_]+_/, '').replace(/[_-]/g, ' '),
          };
        });
        return;
      }
    }

    // 3. /admin/finance/invoices/:id
    const invoiceMatch = pathname.match(/\/admin\/finance\/invoices\/([^/?#]+)/);
    if (invoiceMatch && invoiceMatch[1]) {
      if (invoiceMatch[1] !== 'new') {
        const id = invoiceMatch[1];
        setActiveEntity((prev) => {
          if (prev?.id === id) return prev;
          return {
            id,
            type: 'invoice',
            name: `Invoice ${id}`,
          };
        });
        return;
      }
    }

    // On non-entity route, clear entity to allow workspace standby mode (unless initialEntityId was explicitly set)
    if (!initialEntityId) {
      setActiveEntity(null);
    }
  }, [pathname, initialEntityId]);

  const fetchContextData = React.useCallback(async (entityId: string, entityType: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getEntityContextRailDataAction(
        entityId,
        entityType as 'contact' | 'lead' | 'deal' | 'company' | 'ticket' | 'task',
        {
          organizationId: activeOrgId,
          workspaceId: activeWsId,
        }
      );
      if (res.success && res.data) {
        setData(res.data);
        if (res.data.entityName) {
          setActiveEntity((prev) => prev ? { ...prev, name: res.data!.entityName } : prev);
        }
      } else {
        setError(res.error?.message || 'Failed to fetch contextual intelligence');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Context intelligence fetch failed');
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, activeWsId]);

  const fetchWorkspaceData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getWorkspaceContextRailDataAction({
        organizationId: activeOrgId,
        workspaceId: activeWsId,
      });
      if (res.success && res.data) {
        setWorkspaceData(res.data);
      } else {
        setError(res.error?.message || 'Failed to fetch workspace contextual intelligence');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Workspace intelligence fetch failed');
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, activeWsId]);

  // Fetch when active entity changes or when drawer opens
  React.useEffect(() => {
    if (activeEntity?.id && activeEntity?.type) {
      fetchContextData(activeEntity.id, activeEntity.type);
    } else if (isOpen) {
      fetchWorkspaceData();
    }
  }, [activeEntity?.id, activeEntity?.type, isOpen, fetchContextData, fetchWorkspaceData]);

  const toggleRail = React.useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const openRail = React.useCallback(
    (entityOrId?: string | ContextRailEntity, entityType?: string, entityName?: string) => {
      if (typeof entityOrId === 'string') {
        const ent: ContextRailEntity = {
          id: entityOrId,
          type: entityType || 'contact',
          name: entityName || entityOrId,
        };
        setActiveEntity(ent);
      } else if (entityOrId && typeof entityOrId === 'object') {
        setActiveEntity(entityOrId);
      }
      setIsOpen(true);
    },
    []
  );

  const closeRail = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const refresh = React.useCallback(async () => {
    if (activeEntity?.id && activeEntity?.type) {
      await fetchContextData(activeEntity.id, activeEntity.type);
    } else {
      await fetchWorkspaceData();
    }
  }, [activeEntity?.id, activeEntity?.type, fetchContextData, fetchWorkspaceData]);

  // Keyboard shortcut listener for Option/Alt + C (Agentic Architecture Suite Document 13 §2)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'c' && !e.shiftKey && !e.ctrlKey) {
        // Prevent collision if user is pressing Command+C (Copy) on Mac
        if (e.metaKey && !e.altKey) {
          return;
        }
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pendingApprovalsCount = activeEntity
    ? (data?.pendingApprovals?.length ?? 0)
    : (workspaceData?.pendingApprovals?.length ?? 0);
  const activeRunsCount = activeEntity
    ? (data?.activeRuns?.length ?? 0)
    : (workspaceData?.activeRuns?.length ?? 0);

  const value = React.useMemo<ContextRailContextValue>(
    () => ({
      isOpen,
      toggleRail,
      toggle: toggleRail,
      openRail,
      closeRail,
      close: closeRail,
      activeEntity,
      activeEntityId: activeEntity?.id,
      activeEntityType: activeEntity?.type,
      setActiveEntity,
      data,
      workspaceData,
      isLoading,
      error,
      refresh,
      pendingApprovalsCount,
      activeRunsCount,
      activeModuleTab,
      setActiveModuleTab,
      activePromptQuery,
      setActivePromptQuery,
    }),
    [
      isOpen,
      toggleRail,
      openRail,
      closeRail,
      activeEntity,
      data,
      workspaceData,
      isLoading,
      error,
      refresh,
      pendingApprovalsCount,
      activeRunsCount,
      activeModuleTab,
      activePromptQuery,
    ]
  );

  return (
    <ContextRailContext.Provider value={value}>
      {children}
    </ContextRailContext.Provider>
  );
}

export function useContextRail(): ContextRailContextValue {
  const context = React.useContext(ContextRailContext);
  if (!context) {
    throw new Error('useContextRail must be used within a ContextRailProvider');
  }
  return context;
}
