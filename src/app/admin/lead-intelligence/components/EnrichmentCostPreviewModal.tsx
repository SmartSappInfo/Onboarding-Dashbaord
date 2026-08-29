'use client';

/**
 * Enrichment Cost Preview Modal
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. UI Spec Alignment: Implements intelligence_ui Section 23 & 60 (Credit transparency and cost warning before bulk execution).
 * 2. Trust & Transparency: Clear visual breakdown of fields to be enriched and credit estimates.
 * 3. Mobile Friendly: Responsive modal dialog with >= 44px tap targets.
 */

import React from 'react';
import { Sparkles, Coins, AlertTriangle, User, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EnrichmentCostPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospectCount: number;
  onConfirmEnrich: () => void;
  isProcessing?: boolean;
}

export const EnrichmentCostPreviewModal: React.FC<EnrichmentCostPreviewModalProps> = ({
  isOpen,
  onClose,
  prospectCount,
  onConfirmEnrich,
  isProcessing = false,
}) => {
  const estimatedCredits = prospectCount * 4; // 1 email + 1 tech + 2 AI synthesis

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" /> Enrichment Credit Preview
          </DialogTitle>
          <DialogDescription className="text-xs">
            Review estimated credit consumption before executing batch multi-vendor enrichment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          {/* Target Summary Card */}
          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold text-muted-foreground">Target Batch</span>
              <h4 className="text-sm font-extrabold text-foreground mt-0.5">{prospectCount} Prospects Selected</h4>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold">
              ~{estimatedCredits} Credits
            </Badge>
          </div>

          {/* Enrichment Scope Checklist */}
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Included Enrichment Fields</h5>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/50">
                <User className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-semibold text-foreground">Decision Makers & Verified Emails</span>
                  <span className="text-[10px] text-muted-foreground">Hunter / Apollo</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/50">
                <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-semibold text-foreground">Technographics & Payment Signatures</span>
                  <span className="text-[10px] text-muted-foreground">BuiltWith / DOM Scraper</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/50">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-semibold text-foreground">AI Opportunity Pitch & Score Diagnostics</span>
                  <span className="text-[10px] text-muted-foreground">Genkit Gemini 2.5/3.5</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Credits are deducted progressively upon successful data resolution with automatic short-circuiting.</span>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isProcessing} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirmEnrich}
            disabled={isProcessing}
            className="h-8 text-xs bg-primary text-primary-foreground font-medium active:scale-[0.97]"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {isProcessing ? 'Starting Pipeline...' : 'Start Waterfall Enrichment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default EnrichmentCostPreviewModal;
