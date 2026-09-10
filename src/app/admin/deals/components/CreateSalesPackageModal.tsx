'use client';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Create Sales Package Modal
 *
 * Allows sales reps to bundle multiple media assets into a personalized deal package,
 * generate a single 1-click tracked link, and log the dispatch on the CRM Deal timeline.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Single Source of Truth: Generates `DealMediaPackage` and persists tracked 11-char Feistel link.
 * 2. Mobile Accessibility: All touch targets satisfy `min-h-[44px] min-w-[44px]`.
 * 3. Tactile Micro-Animations: `active:scale-[0.97]` applied to all buttons.
 * 4. Strict Typing Standard: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD & UX REFERENCES:
 * - PRD Sec 109 (Sales Enablement Package) & UX Sec 164 (Journey B — Salesperson → Deal).
 */

import React, { useState, useEffect, useTransition } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Package,
  Copy,
  Check,
  Share2,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/lib/firestore-context';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { createDealMediaPackageAction } from '@/lib/media/sales-enablement-service';
import type { DealMediaPackage } from '@/lib/types/media-2.0';

export interface CreateSalesPackageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  workspaceId: string;
  contactId?: string;
  contactName?: string;
  onPackageCreated?: (pkg: DealMediaPackage) => void;
}

interface SelectableAsset {
  id: string;
  title: string;
  type: string;
  thumbnailUrl?: string;
  duration?: string;
}

export function CreateSalesPackageModal({
  open,
  onOpenChange,
  dealId,
  workspaceId,
  contactId,
  contactName = 'Prospect',
  onPackageCreated,
}: CreateSalesPackageModalProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [availableAssets, setAvailableAssets] = useState<SelectableAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [packageTitle, setPackageTitle] = useState(`Curated Media for ${contactName}`);
  const [recipientNote, setRecipientNote] = useState(
    `Hi ${contactName}, here is the curated overview video and fee schedule we discussed.`
  );
  const [createdPackage, setCreatedPackage] = useState<DealMediaPackage | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Load available assets
  useEffect(() => {
    if (!open || !firestore || !workspaceId) return;

    async function fetchAssets() {
      try {
        const q = query(
          collection(firestore, 'media'),
          where('workspaceId', '==', workspaceId),
          limit(20)
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: (data.title || data.name || 'Untitled Asset') as string,
            type: (data.type || 'video') as string,
            thumbnailUrl: (data.thumbnailUrl as string) || undefined,
            duration: (data.duration as string) || '02:30',
          };
        });
        setAvailableAssets(items);
        if (items.length > 0 && selectedAssetIds.length === 0) {
          setSelectedAssetIds([items[0].id]);
        }
      } catch (err) {
        console.error('[CreateSalesPackageModal] Error fetching assets:', err);
      }
    }

    fetchAssets();
  }, [open, firestore, workspaceId]);

  const handleToggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  };

  const handleCreatePackage = () => {
    if (!firestore || !workspaceId || selectedAssetIds.length === 0) return;

    startTransition(async () => {
      try {
        const newPkg = await createDealMediaPackageAction(firestore, workspaceId, {
          dealId,
          contactId: contactId || 'unknown',
          title: packageTitle,
          assetIds: selectedAssetIds,
          recipientName: contactName,
          personalizedNote: recipientNote,
        });

        setCreatedPackage(newPkg);
        onPackageCreated?.(newPkg);

        toast({
          title: 'Sales Package Ready',
          description: `Tracked package link generated for ${contactName}.`,
        });
      } catch (err) {
        console.error('[CreateSalesPackageModal] Error creating package:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to create sales package.',
        });
      }
    });
  };

  const handleCopyLink = () => {
    if (!createdPackage) return;
    const fullUrl = `${window.location.origin}${createdPackage.trackedUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
    toast({
      title: 'Link Copied',
      description: 'Tracked sales package link copied to clipboard.',
    });
  };

  const resetAndClose = () => {
    setCreatedPackage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Package className="h-5 w-5 text-blue-600" />
            Create Sales Enablement Package
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Bundle personalized media collateral for this deal. Recipient views will automatically sync back to this CRM deal timeline.
          </DialogDescription>
        </DialogHeader>

        {createdPackage ? (
          /* Package Created Success View */
          <div className="space-y-4 py-3">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2 text-center">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 mx-auto">
                <Check className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                Tracked Package Ready to Share
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Personalized for <span className="font-semibold">{createdPackage.recipientName}</span> ({createdPackage.assetIds.length} assets included).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tracked Short Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}${createdPackage.trackedUrl}` : createdPackage.trackedUrl}
                  className="min-h-[44px] text-xs font-mono bg-slate-50 dark:bg-slate-900"
                />
                <Button
                  onClick={handleCopyLink}
                  className="min-h-[44px] px-3 bg-blue-600 hover:bg-blue-700 text-white shrink-0 active:scale-[0.97]"
                >
                  {hasCopied ? <Check className="h-4 w-4 mr-1 text-green-300" /> : <Copy className="h-4 w-4 mr-1" />}
                  {hasCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button onClick={resetAndClose} className="w-full min-h-[44px] active:scale-[0.97]">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Package Builder Form */
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Package Title</Label>
              <Input
                value={packageTitle}
                onChange={(e) => setPackageTitle(e.target.value)}
                placeholder="e.g. Curated Admissions Overview"
                className="min-h-[44px] text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Personalized Prospect Note</Label>
              <Textarea
                value={recipientNote}
                onChange={(e) => setRecipientNote(e.target.value)}
                placeholder="Message displayed to recipient on package landing page..."
                className="min-h-[70px] text-xs"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Select Assets to Bundle ({selectedAssetIds.length} selected)</Label>
                <span className="text-[11px] text-slate-400">Multi-select</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                {availableAssets.length > 0 ? (
                  availableAssets.map((asset) => {
                    const isSelected = selectedAssetIds.includes(asset.id);
                    return (
                      <div
                        key={asset.id}
                        onClick={() => handleToggleAsset(asset.id)}
                        className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer border text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleAsset(asset.id)}
                            className="min-h-[20px] min-w-[20px]"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {asset.title}
                            </p>
                            <p className="text-[11px] text-slate-400 uppercase">
                              {asset.type} • {asset.duration}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {asset.type}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No published media assets available in this workspace.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={resetAndClose}
                className="min-h-[44px] text-xs active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePackage}
                disabled={isPending || selectedAssetIds.length === 0}
                className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs active:scale-[0.97]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Generating Tracked Package...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-1.5" />
                    Create Tracked Package
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
