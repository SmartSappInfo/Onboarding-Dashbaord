'use client';

import * as React from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/context/TenantContext';
import { Loader2 } from 'lucide-react';

export interface CustomPageWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageKey: string;
  currentTitle: string;
  currentWorkspaceIds: string[];
}

export function CustomPageWorkspaceDialog({
  open,
  onOpenChange,
  pageKey,
  currentTitle,
  currentWorkspaceIds,
}: CustomPageWorkspaceDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeOrganizationId, accessibleWorkspaces } = useTenant();

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [docId, setDocId] = React.useState<string | null>(null);

  // Load from Firestore
  React.useEffect(() => {
    if (!open || !firestore || !activeOrganizationId) return;

    let active = true;
    async function loadWorkspaceVisibility() {
      setIsLoading(true);
      try {
        const cleanSlug = pageKey.replace(/^\//, '') || 'homepage';
        const q = query(
          collection(firestore, 'campaign_pages'),
          where('organizationId', '==', activeOrganizationId),
          where('slug', '==', cleanSlug)
        );
        const snap = await getDocs(q);
        if (active) {
          if (!snap.empty) {
            const firstDoc = snap.docs[0];
            setDocId(firstDoc.id);
            setSelectedIds(firstDoc.data().workspaceIds || []);
          } else {
            setDocId(null);
            setSelectedIds(currentWorkspaceIds);
          }
        }
      } catch (err) {
        console.error('Error loading page workspace visibility:', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadWorkspaceVisibility();
    return () => {
      active = false;
    };
  }, [open, firestore, activeOrganizationId, pageKey, currentWorkspaceIds]);

  const handleToggleWorkspace = React.useCallback((wsId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        return [...prev, wsId];
      } else {
        return prev.filter((id) => id !== wsId);
      }
    });
  }, []);

  const handleSave = React.useCallback(async () => {
    if (!firestore || !activeOrganizationId) return;
    setIsSaving(true);
    try {
      const cleanSlug = pageKey.replace(/^\//, '') || 'homepage';
      
      if (docId) {
        // Document exists, update it
        const docRef = doc(firestore, 'campaign_pages', docId);
        await updateDoc(docRef, {
          workspaceIds: selectedIds,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new document in campaign_pages
        const newDocId = doc(collection(firestore, 'campaign_pages')).id;
        const pageData = {
          organizationId: activeOrganizationId,
          workspaceIds: selectedIds,
          name: currentTitle,
          slug: cleanSlug,
          status: 'published',
          pageGoal: 'information',
          pageType: 'custom_coded',
          trackingEnabled: true,
          seo: {
            title: currentTitle,
            description: '',
            noIndex: false,
          },
          settings: {
            customScriptsAllowed: false,
            showHeader: false,
            showFooter: false,
          },
          stats: {
            views: 0,
            uniques: 0,
            conversions: 0,
            clicks: 0,
          },
          publishedVersionId: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(firestore, 'campaign_pages', newDocId), pageData);
      }

      toast({
        title: 'Workspace Visibility Saved',
        description: `Visibility settings for "${currentTitle}" have been updated successfully.`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving page workspace visibility:', err);
      toast({
        variant: 'destructive',
        title: 'Failed to update visibility',
        description: 'An error occurred. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [firestore, activeOrganizationId, docId, pageKey, selectedIds, currentTitle, toast, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Assign Workspaces</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select which workspaces can view and access the page <strong>{currentTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-60" />
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Workspaces</p>
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {accessibleWorkspaces.map((ws) => {
                const isChecked = selectedIds.includes(ws.id);
                return (
                  <div key={ws.id} className="flex items-center space-x-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/40">
                    <Checkbox
                      id={`ws-${ws.id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => handleToggleWorkspace(ws.id, !!checked)}
                    />
                    <Label htmlFor={`ws-${ws.id}`} className="flex-1 font-semibold text-sm cursor-pointer select-none">
                      {ws.name}
                    </Label>
                  </div>
                );
              })}
              {accessibleWorkspaces.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No workspaces available.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isSaving} className="bg-primary text-primary-foreground">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
