'use client';

/**
 * @fileOverview Direct WhatsApp Outreach Launcher & Script Formulator Modal (Phase 10 Milestone 4 Task 5)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4)
 * - Zero Raw Descriptions: User guidance routed through `<CardInfoTooltip text="..." />` alongside title
 * - Screen Reader AA: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 min-h-[56px]`
 * - Tactile mechanical feedback: `active:scale-[0.97]`
 *
 * Core Governance & Security Rules:
 * - Rule 4: Zero `any` or `any[]` typing.
 * - Rule 7: Mobile touch targets >= 44px with active:scale-[0.97].
 * - Rule 13 & 30: Untrusted dynamic text wrapped inside `<untrusted-reference-data>`.
 * - Direct wa.me launch affordance with sanitized E.164 recipient phone number.
 * - 1-Click clipboard copying of outreach scripts with toast notification.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { OutreachMessageDraft } from '@/platform/agents/sales/outbound/sdr-outbound-types';
import {
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
  Phone,
  User,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function UntrustedReferenceData({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return React.createElement('untrusted-reference-data', { id, className }, children);
}

export interface WhatsAppLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: OutreachMessageDraft;
  onMarkDispatched?: (draftId: string) => void;
}

export function WhatsAppLauncherModal({
  isOpen,
  onClose,
  draft,
  onMarkDispatched,
}: WhatsAppLauncherModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isDispatched, setIsDispatched] = useState(false);

  const handleCopyScript = () => {
    if (draft?.body) {
      navigator.clipboard.writeText(draft.body);
      setCopied(true);
      toast({
        title: 'Script Copied',
        description: 'WhatsApp message script copied to clipboard. Ready to paste.',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLaunch = () => {
    if (onMarkDispatched && !isDispatched) {
      onMarkDispatched(draft.id);
      setIsDispatched(true);
    }
  };

  if (!isOpen || !draft) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl overflow-hidden font-figtree">
        {/* Header adhering to theme.md §8 */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>WhatsApp Direct Dispatch</span>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                >
                  Direct Mode
                </Badge>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Review and dispatch direct personalized WhatsApp outreach to verified decision makers.
              </DialogDescription>
            </div>
          </div>
          <CardInfoTooltip text="Direct WhatsApp operator launcher. Formulates pre-filled wa.me links with personalized ICP copy, enabling seamless human-in-the-loop transmission." />
        </DialogHeader>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Recipient Details Card */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-muted/15 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span className="font-medium">Recipient Contact:</span>
              </div>
              <span className="font-bold text-foreground">
                {draft.recipientName || 'Decision Maker'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs border-t border-border/50 pt-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span className="font-medium">E.164 Phone:</span>
              </div>
              <span className="font-mono font-bold text-foreground">
                {draft.recipientAddress}
              </span>
            </div>
          </div>

          {/* Script Preview inside <untrusted-reference-data> Container (Rules 13 & 30) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                Personalized Script
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {draft.body.length} characters
              </span>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-background text-foreground font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[180px] overflow-y-auto selection:bg-emerald-500/20">
              <UntrustedReferenceData id={`whatsapp_draft_${draft.id}`}>
                {draft.body}
              </UntrustedReferenceData>
            </div>
          </div>

          {/* Variables Used */}
          {draft.variablesUsed && draft.variablesUsed.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-muted-foreground text-[11px]">Variables:</span>
              {draft.variablesUsed.map((v) => (
                <Badge key={v} variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Demarcated Footer adhering to theme.md §8 */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 min-h-[56px]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97] min-h-[44px]"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyScript}
              className="rounded-xl text-xs font-semibold text-foreground hover:bg-muted/80 active:scale-[0.97] min-h-[44px] gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Script</span>
                </>
              )}
            </Button>

            <Button
              asChild
              className="rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.97] min-h-[44px] shadow-sm gap-1.5"
            >
              <a
                href={draft.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLaunch}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in WhatsApp</span>
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default WhatsAppLauncherModal;
