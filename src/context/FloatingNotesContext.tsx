'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';

interface FloatingNotesContextType {
  isOpen: boolean;
  isMinimized: boolean;
  draftText: string;
  activeEntityId: string | null;
  open: (entityId?: string | null) => void;
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

  // Auto-extract active entity ID from URL matching route patterns (e.g. /admin/entities/[id])
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
    setActiveEntityId(null);
  }, [pathname]);

  const open = React.useCallback((entityId?: string | null) => {
    if (entityId) {
      setActiveEntityId(entityId);
    }
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
        open,
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
