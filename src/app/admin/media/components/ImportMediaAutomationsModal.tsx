'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * 
 * ImportMediaAutomationsModal Component
 * --------------------------------------
 * 1. Purpose:
 *    Allows workspace admins to select a single pre-configured media page in the workspace
 *    and import all of its configured automation rules INTO the active page currently being edited.
 * 
 * 2. Candidate Filtering & Parallel Resolution:
 *    - Queries `media_shares` for `workspaceId == activeWorkspaceId`.
 *    - Filters candidates in-memory to include only pages with at least 1 active rule (`ruleCount > 0`).
 *    - Excludes the current page (`currentShareId` / `currentAsset.id`).
 *    - Queries workspace `media` assets in parallel (`Promise.all`) to resolve internal asset reference names.
 * 
 * 3. Deep-Cloning & ID Disambiguation:
 *    - Every imported action is deep-cloned with a fresh, unique action ID (`import_${Date.now()}_${randomId}`)
 *      to ensure 100% memory reference isolation between media pages.
 * 
 * 4. Import Modes:
 *    - `replace`: Overwrites all current rules with rules from the source page.
 *    - `merge`: Appends imported rules into current trigger arrays without deleting existing actions.
 * 
 * 5. Mobile Responsiveness & Accessibility:
 *    - Touch-friendly `min-h-[44px]` bounds for candidate cards, radio toggles, and buttons.
 *    - Strict TypeScript interfaces with zero `any` / `any[]`.
 */

import * as React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { CallOutcomeAutomation, MediaAsset } from '@/lib/types';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, Search, Loader2, Zap, CheckCircle2 
} from 'lucide-react';

export interface CandidateMediaShare {
  shareId: string;
  assetId: string;
  internalName: string;
  publicTitle: string;
  ruleCount: number;
  triggerCounts: Record<string, number>;
  automationRules: Record<string, CallOutcomeAutomation[]>;
}

export type ImportMode = 'merge' | 'replace';

interface ImportMediaAutomationsModalProps {
  currentAsset: MediaAsset;
  currentShareId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportRules: (
    importedRules: Record<string, CallOutcomeAutomation[]>,
    mode: ImportMode,
    sourceTitle: string
  ) => void;
}

/**
 * Deep-clones imported automation rules and re-assigns fresh unique action IDs
 * to prevent object reference mutation between media pages.
 */

export default function ImportMediaAutomationsModal({
  currentAsset,
  currentShareId,
  open,
  onOpenChange,
  onImportRules,
}: ImportMediaAutomationsModalProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [candidates, setCandidates] = React.useState<CandidateMediaShare[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedShareId, setSelectedShareId] = React.useState<string | null>(null);
  const [importMode, setImportMode] = React.useState<ImportMode>('merge');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch pre-configured media shares in active workspace
  const loadCandidates = React.useCallback(async () => {
    if (!open || !activeWorkspaceId || !firestore) return;
    setIsLoadingCandidates(true);
    try {
      // Execute parallel queries for media_shares and workspace media assets
      const [sharesSnap, mediaSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'media_shares'), where('workspaceId', '==', activeWorkspaceId))),
        getDocs(query(collection(firestore, 'media'), where('workspaceIds', 'array-contains', activeWorkspaceId))),
      ]);

      const mediaNameMap = new Map<string, string>();
      mediaSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const assetName = (data.name as string) || (data.title as string);
        if (assetName) {
          mediaNameMap.set(docSnap.id, assetName);
        }
      });

      const list: CandidateMediaShare[] = [];

      sharesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const shareId = docSnap.id;
        const assetId = (data.assetId as string) || '';

        // Exclude current page
        if (shareId === currentShareId || assetId === currentAsset.id) {
          return;
        }

        const rawRules = (data.automationRules as Record<string, CallOutcomeAutomation[]>) || {};
        let totalCount = 0;
        const triggerCounts: Record<string, number> = {};

        for (const [triggerKey, actions] of Object.entries(rawRules)) {
          if (Array.isArray(actions) && actions.length > 0) {
            triggerCounts[triggerKey] = actions.length;
            totalCount += actions.length;
          }
        }

        // Only include candidates that have at least 1 active rule
        if (totalCount > 0) {
          const resolvedAssetName = (data.assetName as string) || mediaNameMap.get(assetId) || (data.internalName as string) || (data.name as string);
          const publicTitle = (data.title as string)?.trim() || 'Untitled Media Share';
          const internalName = resolvedAssetName || publicTitle;

          list.push({
            shareId,
            assetId,
            internalName,
            publicTitle,
            ruleCount: totalCount,
            triggerCounts,
            automationRules: rawRules,
          });
        }
      });

      setCandidates(list);
      setSelectedShareId(null);
    } catch (err: unknown) {
      console.error('[ImportMediaAutomationsModal] Error loading candidates:', err);
      toast({
        variant: 'destructive',
        title: 'Error Loading Candidates',
        description: err instanceof Error ? err.message : 'Failed to fetch candidate media pages for rule import.',
      });
    } finally {
      setIsLoadingCandidates(false);
    }
  }, [open, activeWorkspaceId, firestore, currentShareId, currentAsset.id, toast]);

  React.useEffect(() => {
    if (open) {
      loadCandidates();
    }
  }, [open, loadCandidates]);

  // Filter candidates by search term
  const filteredCandidates = React.useMemo(() => {
    if (!searchTerm.trim()) return candidates;
    const term = searchTerm.toLowerCase().trim();
    return candidates.filter(
      (c) =>
        c.internalName.toLowerCase().includes(term) ||
        c.publicTitle.toLowerCase().includes(term) ||
        c.shareId.toLowerCase().includes(term)
    );
  }, [candidates, searchTerm]);

  // Selected candidate object
  const selectedCandidate = React.useMemo(() => {
    if (!selectedShareId) return null;
    return candidates.find((c) => c.shareId === selectedShareId) || null;
  }, [candidates, selectedShareId]);

  // Execute import
  const handleExecuteImport = () => {
    if (!selectedCandidate) {
      toast({
        variant: 'destructive',
        title: 'No Source Selected',
        description: 'Please select a pre-configured media page to import automation rules from.',
      });
      return;
    }

    setIsSubmitting(true);
    try {

      // Deep clone rules and assign fresh unique IDs
      const clonedRules: Record<string, CallOutcomeAutomation[]> = {};
      for (const [triggerKey, actions] of Object.entries(selectedCandidate.automationRules)) {
        if (Array.isArray(actions) && actions.length > 0) {
          clonedRules[triggerKey] = actions.map((action) => ({
            ...JSON.parse(JSON.stringify(action)),
            id: `import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          }));
        }
      }

      onImportRules(clonedRules, importMode, selectedCandidate.internalName);
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: err instanceof Error ? err.message : 'Failed to process rule import.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-[95vw] rounded-3xl p-0 gap-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 text-left border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2.5 rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-200 dark:shadow-none">
              <Download className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold text-foreground tracking-tight">
                Import CRM Automations
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-medium">
                Pull pre-configured automation rules from another media page into <span className="font-bold text-foreground">{currentAsset.name}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Import Mode Selector */}
        <div className="p-4 bg-muted/30 border-b border-border/60 text-left space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Import Mode</label>
          <Tabs value={importMode} onValueChange={(val) => setImportMode(val as ImportMode)} className="w-full">
            <TabsList className="grid grid-cols-2 h-12 p-1 bg-muted/60 rounded-xl">
              <TabsTrigger value="merge" className="rounded-lg text-xs font-bold transition-all min-h-[44px] data-[state=active]:bg-background data-[state=active]:text-foreground active:scale-[0.97]">
                Merge & Append Rules
              </TabsTrigger>
              <TabsTrigger value="replace" className="rounded-lg text-xs font-bold transition-all min-h-[44px] data-[state=active]:bg-background data-[state=active]:text-foreground active:scale-[0.97]">
                Overwrite Current Rules
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-[10px] text-muted-foreground font-medium ml-1">
            {importMode === 'merge'
              ? 'Appends the imported rules to your current trigger actions without removing existing rules.'
              : 'Replaces all current automation rules on this page with the rules from the selected source page.'}
          </p>
        </div>

        {/* Candidate List Body */}
        <div className="p-5 space-y-3 text-left">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
            <Input
              placeholder="Search pre-configured media pages by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-11 rounded-xl text-xs bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-purple-500/30 font-bold"
            />
          </div>

          {isLoadingCandidates ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-600" />
              <p className="text-xs font-bold text-muted-foreground">Scanning workspace for configured media pages...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-12 text-center space-y-2 bg-muted/10 rounded-2xl border border-dashed border-border/60">
              <Zap className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-xs font-bold text-muted-foreground">No pre-configured media pages found in this workspace.</p>
              <p className="text-[10px] text-muted-foreground/60 max-w-xs mx-auto">
                Set up automation rules on at least one media landing page to enable cross-page rule imports.
              </p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground font-semibold">
              No matching configured media pages found for &quot;{searchTerm}&quot;.
            </div>
          ) : (
            <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-2">
              {filteredCandidates.map((candidate) => {
                const isSelected = selectedShareId === candidate.shareId;
                return (
                  <div
                    key={candidate.shareId}
                    onClick={() => setSelectedShareId(candidate.shareId)}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer text-left min-h-[44px] touch-manipulation flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 ring-2 ring-purple-600/20 shadow-md'
                        : 'border-border/60 bg-card hover:bg-muted/30'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs text-foreground truncate">{candidate.internalName}</span>
                        {candidate.publicTitle !== candidate.internalName && (
                          <Badge variant="outline" className="text-[9px] font-semibold text-muted-foreground border-border/60 truncate max-w-[200px]">
                            {candidate.publicTitle}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold flex-wrap">
                        {Object.entries(candidate.triggerCounts).map(([trig, count]) => (
                          <span key={trig} className="bg-muted/50 px-1.5 py-0.5 rounded-md text-[9px]">
                            {trig.replace('on_', '')}: {count}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge className="bg-purple-600 text-white font-black text-[9px] px-2 py-0.5 rounded-lg">
                        {candidate.ruleCount} Rule{candidate.ruleCount === 1 ? '' : 's'}
                      </Badge>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/20 border-t border-border/60 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl font-bold h-11 min-h-[44px] px-6 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExecuteImport}
            disabled={isSubmitting || !selectedCandidate}
            className="rounded-xl font-bold h-11 min-h-[44px] px-8 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200 dark:shadow-none cursor-pointer transition-all active:scale-[0.97] gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Import {selectedCandidate ? `${selectedCandidate.ruleCount} Rules` : 'Automations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
