'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';

/**
 * FloatingNotesContext — global state for the floating Quick Note HUD.
 *
 * CAUTION: This context is mounted at the root layout level. Changes to the
 * shape of FloatingNotesContextType require updating every consumer that
 * destructures from useFloatingNotes(). Use CTRL+F "useFloatingNotes" to find all.
 *
 * TESTABILITY: Wrap components under <FloatingNotesProvider> in tests.
 */
interface FloatingNotesContextType {
  isOpen: boolean;
  isMinimized: boolean;
  draftText: string;
  /** The entity ID automatically extracted from the URL, or set by openForEntity(). */
  activeEntityId: string | null;
  /**
   * The display name of the active entity (if provided via openForEntity).
   * Used to enrich links.entityName in quick_notes writes without a secondary lookup.
   */
  activeEntityName: string | null;
  /** Open the HUD from a generic page with no entity context. */
  open: (entityId?: string | null) => void;
  /**
   * Open the HUD pre-linked to a specific entity record.
   * Prefer this over open() when calling from an entity detail page so the
   * saved quick note carries the entity name for display in the board.
   */
  openForEntity: (entityId: string, entityName: string) => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
  setDraftText: (text: string) => void;
}

const FloatingNotesContext = React.createContext<FloatingNotesContextType | undefined>(undefined);

export function FloatingNotesProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [draftText, _setDraftText] = React.useState('');
  const [activeEntityId, setActiveEntityId] = React.useState<string | null>(null);
  // Phase 3: entityName stored separately so it can be written to quick_notes links.
  const [activeEntityName, setActiveEntityName] = React.useState<string | null>(null);

  // LocalStorage Key scoped by organization/workspace
  const storageKey = React.useMemo(() => {
    return `smartsapp_floating_note_draft_${activeOrganizationId || 'default'}_${activeWorkspaceId || 'default'}`;
  }, [activeOrganizationId, activeWorkspaceId]);

  // Load draft text on mount / scope changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      _setDraftText(saved || '');
    }
  }, [storageKey]);

  // Save draft text with LocalStorage Schema rule
  const setDraftText = React.useCallback((text: string) => {
    _setDraftText(text);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, text);
    }
  }, [storageKey]);

  // Auto-extract active entity ID from URL matching route patterns (e.g. /admin/entities/[id]).
  // CAUTION: This only captures the ID. entityName must be set explicitly via openForEntity().
  React.useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/\/admin\/entities\/([^/]+)/);
    if (match && match[1]) {
      // Exclude sub-pages like /admin/entities/lead-scoring or upload
      const isSubPage = ['lead-scoring', 'upload', 'components'].includes(match[1]);
      if (!isSubPage) {
        setActiveEntityId(match[1]);
        return;
      }
    }
    // When navigating away from an entity page, clear both id and name.
    setActiveEntityId(null);
    setActiveEntityName(null);
  }, [pathname]);

  const open = React.useCallback((entityId?: string | null) => {
    if (entityId) {
      setActiveEntityId(entityId);
      // Name not provided — the note will be saved without entityName link enrichment.
    }
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  /**
   * Open the HUD pre-linked to a specific entity with its display name.
   * Saves an extra Firestore read in the HUD by carrying the name in context.
   */
  const openForEntity = React.useCallback((entityId: string, entityName: string) => {
    setActiveEntityId(entityId);
    setActiveEntityName(entityName);
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const minimize = React.useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restore = React.useCallback(() => {
    setIsMinimized(false);
  }, []);

  return (
    <FloatingNotesContext.Provider
      value={{
        isOpen,
        isMinimized,
        draftText,
        activeEntityId,
        activeEntityName,
        open,
        openForEntity,
        close,
        minimize,
        restore,
        setDraftText,
      }}
    >
      {children}
    </FloatingNotesContext.Provider>
  );
}

export function useFloatingNotes() {
  const context = React.useContext(FloatingNotesContext);
  if (context === undefined) {
    throw new Error('useFloatingNotes must be used within a FloatingNotesProvider');
  }
  return context;
}


