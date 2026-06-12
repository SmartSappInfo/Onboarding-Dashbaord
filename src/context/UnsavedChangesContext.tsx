'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface UnsavedChangesContextType {
  registerUnsavedChanges: (id: string, hasChanges: boolean, onSave?: () => Promise<boolean>) => void;
  unregisterUnsavedChanges: (id: string) => void;
  hasUnsavedChanges: boolean;
  safePush: (href: string) => void;
  safeReplace: (href: string) => void;
}

const UnsavedChangesContext = React.createContext<UnsavedChangesContextType | undefined>(undefined);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [registries, setRegistries] = React.useState<Record<string, { hasChanges: boolean; onSave?: () => Promise<boolean> }>>({});
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [pendingUrl, setPendingUrl] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const registerUnsavedChanges = React.useCallback((id: string, hasChanges: boolean, onSave?: () => Promise<boolean>) => {
    setRegistries(prev => ({ ...prev, [id]: { hasChanges, onSave } }));
  }, []);

  const unregisterUnsavedChanges = React.useCallback((id: string) => {
    setRegistries(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const hasUnsavedChanges = React.useMemo(() => {
    return Object.values(registries).some(r => r.hasChanges);
  }, [registries]);

  // Push navigation wrapper
  const safePush = React.useCallback((href: string) => {
    if (hasUnsavedChanges) {
      setPendingUrl(href);
      setIsModalOpen(true);
    } else {
      router.push(href);
    }
  }, [hasUnsavedChanges, router]);

  // Replace navigation wrapper
  const safeReplace = React.useCallback((href: string) => {
    if (hasUnsavedChanges) {
      setPendingUrl(href);
      setIsModalOpen(true);
    } else {
      router.replace(href);
    }
  }, [hasUnsavedChanges, router]);

  // Browser close / refresh reload guard
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // SPA-level click link interception
  React.useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (!hasUnsavedChanges) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      // Skip target open in new tab or download buttons
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      if (href === pathname) return;

      e.preventDefault();
      e.stopPropagation();

      setPendingUrl(href);
      setIsModalOpen(true);
    };

    document.addEventListener('click', handleAnchorClick, true);
    return () => document.removeEventListener('click', handleAnchorClick, true);
  }, [hasUnsavedChanges, pathname]);

  // Intercept back / forward buttons (popstate)
  React.useEffect(() => {
    const handlePopState = () => {
      if (hasUnsavedChanges) {
        // Push current state back to restore URL
        window.history.pushState(null, '', pathname);
        setPendingUrl(window.location.pathname);
        setIsModalOpen(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasUnsavedChanges, pathname]);

  const handleDiscard = () => {
    setIsModalOpen(false);
    setRegistries({});
    if (pendingUrl) {
      router.push(pendingUrl);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const activeStudio = Object.entries(registries).find(([_, r]) => r.hasChanges);
      if (activeStudio && activeStudio[1].onSave) {
        const success = await activeStudio[1].onSave();
        if (success) {
          setIsModalOpen(false);
          setRegistries({});
          if (pendingUrl) {
            router.push(pendingUrl);
          }
        }
      } else {
        handleDiscard();
      }
    } catch (err) {
      console.error('[UNSAVED_CHANGES_SERVICE] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setPendingUrl(null);
  };

  const value = React.useMemo(() => ({
    registerUnsavedChanges,
    unregisterUnsavedChanges,
    hasUnsavedChanges,
    safePush,
    safeReplace
  }), [registerUnsavedChanges, unregisterUnsavedChanges, hasUnsavedChanges, safePush, safeReplace]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open && !isSaving) handleCancel(); }}>
        <DialogContent className="sm:max-w-md rounded-2xl overflow-hidden p-0 border shadow-2xl bg-card">
          <DialogHeader className="p-8 bg-card/20 border-b shrink-0 text-left">
            <div className="flex items-center gap-4 text-left">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-xl">
                <AlertTriangle className="h-6 w-6 animate-pulse" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-xl font-semibold tracking-tight">Unsaved Changes</DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground">You have unsaved changes in this studio workspace.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-8 text-left text-sm font-semibold text-muted-foreground">
            Do you want to save your progress before navigating away? Unsaved progress will be lost.
          </div>
          <DialogFooter className="p-4 bg-card/50 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="ghost" onClick={handleCancel} disabled={isSaving} className="rounded-xl font-bold h-11">
              Keep Editing
            </Button>
            <Button variant="outline" onClick={handleDiscard} disabled={isSaving} className="rounded-xl font-bold h-11 text-rose-500 border-rose-200/50 hover:bg-rose-50/50">
              Discard Changes
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-bold h-11 bg-primary text-white flex items-center gap-1.5 shadow-md">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save & Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = React.useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  }
  return context;
}
