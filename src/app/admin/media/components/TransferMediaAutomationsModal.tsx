'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * 
 * TransferMediaAutomationsModal Component
 * ----------------------------------------
 * 1. Scope Selection & Type Isolation:
 *    Allows admins to transfer automation rules to:
 *    - All Candidate Assets (all assets matching sourceAsset.type)
 *    - Selected Assets (interactive checkbox list with live search)
 *    - Single Asset (dropdown selection mode)
 * 
 * 2. Strict Media Type Filtering:
 *    Automatically filters candidate media assets by `type === sourceAsset.type`
 *    so Video-specific triggers are never applied to Image or Audio pages.
 * 
 * 3. Mobile Responsiveness & Accessibility:
 *    Checkbox items and buttons maintain `min-h-[44px]` touch target bounds with
 *    keyboard focus outlines and responsive modal height caps (`max-h-[60vh]`).
 * 
 * 4. Zero `any` / `any[]` Mandate:
 *    Strict TypeScript interfaces for all state, candidate assets, and action responses.
 */

import * as React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { CallOutcomeAutomation, MediaAsset } from '@/lib/types';
import { transferMediaAutomationsAction } from '@/lib/media-automation-actions';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Copy, Search, Loader2, CheckCircle2, Video, Music, Image as ImageIcon, 
  Layers, CheckSquare, Square
} from 'lucide-react';

interface TransferMediaAutomationsModalProps {
  sourceAsset: MediaAsset;
  automationRules: Record<string, CallOutcomeAutomation[]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ScopeMode = 'selected' | 'all' | 'single';

export default function TransferMediaAutomationsModal({
  sourceAsset,
  automationRules,
  open,
  onOpenChange,
  onSuccess,
}: TransferMediaAutomationsModalProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [scopeMode, setScopeMode] = React.useState<ScopeMode>('selected');
  const [candidateAssets, setCandidateAssets] = React.useState<MediaAsset[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Load candidate assets of matching workspace & type
  const loadCandidates = React.useCallback(async () => {
    if (!open || !activeWorkspaceId || !firestore || !sourceAsset?.id) return;
    setIsLoadingCandidates(true);
    try {
      const sourceType = sourceAsset.type || 'video';
      const q = query(
        collection(firestore, 'media'),
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        where('type', '==', sourceType)
      );
      const snap = await getDocs(q);
      const docs: MediaAsset[] = [];
      snap.docs.forEach((docSnap) => {
        if (docSnap.id !== sourceAsset.id) {
          docs.push({ id: docSnap.id, ...docSnap.data() } as MediaAsset);
        }
      });
      setCandidateAssets(docs);
      setSelectedAssetIds([]);
    } catch (err) {
      console.error('[TransferMediaAutomationsModal] Error loading candidates:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load candidate media assets for transfer.',
      });
    } finally {
      setIsLoadingCandidates(false);
    }
  }, [open, activeWorkspaceId, firestore, sourceAsset?.id, sourceAsset?.type, toast]);

  React.useEffect(() => {
    if (open) {
      loadCandidates();
    }
  }, [open, loadCandidates]);

  // Filter candidates by search term
  const filteredCandidates = React.useMemo(() => {
    if (!searchTerm.trim()) return candidateAssets;
    const term = searchTerm.toLowerCase();
    return candidateAssets.filter(
      (a) => a.name?.toLowerCase().includes(term) || a.id.toLowerCase().includes(term)
    );
  }, [candidateAssets, searchTerm]);

  // Toggle selection
  const handleToggleAsset = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Toggle select all
  const isAllSelected = filteredCandidates.length > 0 && filteredCandidates.every((a) => selectedAssetIds.includes(a.id));
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const filteredSet = new Set(filteredCandidates.map((a) => a.id));
      setSelectedAssetIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const combined = new Set([...selectedAssetIds, ...filteredCandidates.map((a) => a.id)]);
      setSelectedAssetIds(Array.from(combined));
    }
  };

  // Compute total configured rules count
  const ruleCount = React.useMemo(() => {
    return Object.values(automationRules).reduce((sum, rules) => sum + (rules?.length || 0), 0);
  }, [automationRules]);

  // Execute transfer
  const handleExecuteTransfer = async () => {
    if (!activeWorkspaceId || !sourceAsset?.id) return;
    if (scopeMode !== 'all' && selectedAssetIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Assets Selected',
        description: 'Please select at least one candidate media asset to transfer automation rules to.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await transferMediaAutomationsAction({
        sourceAssetId: sourceAsset.id,
        targetAssetIds: selectedAssetIds,
        scopeMode,
        workspaceId: activeWorkspaceId,
        automationRules,
      });

      if (result.success) {
        toast({
          title: 'Automations Transferred',
          description: result.message,
        });
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast({
          variant: 'destructive',
          title: 'Transfer Failed',
          description: result.message,
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred during transfer.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const AssetIcon = sourceAsset.type === 'video' ? Video : sourceAsset.type === 'audio' ? Music : ImageIcon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-[95vw] rounded-2xl p-0 gap-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 text-left border-b border-border/60">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Copy className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-extrabold text-foreground tracking-tight">
              Transfer Automation Rules
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Replicate the <span className="font-bold text-foreground">{ruleCount} configured event rule{ruleCount === 1 ? '' : 's'}</span> from{' '}
            <span className="font-bold text-primary">{sourceAsset.name}</span> across matching target pages.
          </DialogDescription>

          <div className="pt-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-bold uppercase gap-1 px-2 py-0.5 rounded-lg border-primary/40 text-primary">
              <AssetIcon className="h-3 w-3" />
              {sourceAsset.type || 'video'} Assets Only
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-lg">
              {candidateAssets.length} Target Candidates Available
            </Badge>
          </div>
        </DialogHeader>

        {/* Scope Selector Tabs */}
        <div className="p-4 bg-muted/20 border-b border-border/60 text-left">
          <Tabs value={scopeMode} onValueChange={(val) => setScopeMode(val as ScopeMode)} className="w-full">
            <TabsList className="grid grid-cols-3 h-11 p-1 bg-muted/60 rounded-xl">
              <TabsTrigger value="selected" className="rounded-lg text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground active:scale-[0.97]">
                Selected Assets
              </TabsTrigger>
              <TabsTrigger value="all" className="rounded-lg text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground active:scale-[0.97]">
                All ({candidateAssets.length})
              </TabsTrigger>
              <TabsTrigger value="single" className="rounded-lg text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground active:scale-[0.97]">
                Single Pick
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Candidate Selector Body */}
        <div className="p-4 space-y-3 text-left">
          {scopeMode !== 'all' && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter candidate assets by title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 rounded-xl text-xs bg-muted/30 border-border/60"
                />
              </div>
              {scopeMode === 'selected' && filteredCandidates.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleSelectAll}
                  className="h-10 px-3 text-xs font-bold rounded-xl gap-1.5 shrink-0 min-h-[44px] active:scale-[0.97]"
                >
                  {isAllSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                  {isAllSelected ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          )}

          {/* Asset List Container */}
          {isLoadingCandidates ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-xs font-bold text-muted-foreground">Loading matching candidate assets...</p>
            </div>
          ) : candidateAssets.length === 0 ? (
            <div className="py-10 text-center space-y-2 bg-muted/10 rounded-xl border border-dashed border-border/60">
              <Layers className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="text-xs font-bold text-foreground">No matching target assets found</p>
              <p className="text-[10px] text-muted-foreground">
                There are no other {sourceAsset.type || 'video'} assets available in this workspace to receive automations.
              </p>
            </div>
          ) : scopeMode === 'all' ? (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                Targeting All {candidateAssets.length} Candidate {sourceAsset.type?.toUpperCase()} Assets
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Clicking confirm will replace or merge the configured automation rules across all hosted {sourceAsset.type} landing pages in this workspace simultaneously.
              </p>
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredCandidates.map((asset) => {
                const isSelected = selectedAssetIds.includes(asset.id);
                return (
                  <div
                    key={asset.id}
                    onClick={() => {
                      if (scopeMode === 'single') {
                        setSelectedAssetIds([asset.id]);
                      } else {
                        handleToggleAsset(asset.id);
                      }
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between min-h-[44px] select-none active:scale-[0.98] ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                        : 'border-border/60 bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {
                          if (scopeMode === 'single') {
                            setSelectedAssetIds([asset.id]);
                          } else {
                            handleToggleAsset(asset.id);
                          }
                        }}
                        className="rounded-md h-4 w-4"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{asset.name || 'Untitled Asset'}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">ID: {asset.id}</p>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-[9px] font-mono rounded-md shrink-0 uppercase">
                      {asset.type || 'video'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-muted/20 border-t border-border flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl font-bold min-h-[44px]"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleExecuteTransfer}
            disabled={isSubmitting || candidateAssets.length === 0 || (scopeMode !== 'all' && selectedAssetIds.length === 0)}
            className="rounded-xl font-bold px-6 bg-primary hover:bg-primary/90 text-white min-h-[44px] gap-2 shadow-md active:scale-[0.97]"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Confirm Transfer {scopeMode === 'all' ? `(${candidateAssets.length})` : selectedAssetIds.length > 0 ? `(${selectedAssetIds.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
