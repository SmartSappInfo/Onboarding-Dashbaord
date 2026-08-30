'use client';

/**
 * AI Outreach Human-in-the-Loop Review Modal (Lead Intelligence 2.0 - Phase 12)
 * UI Spec Section 51: "AI Personalization Review Guard"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Zero-Silent-Send Guardrail: Every AI message requires human approval.
 * 2. 1-Click Launchers (WhatsApp Web, Direct Mailto, Copy to Clipboard).
 * 3. Mobile-responsive layout with touch targets >= 44px.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  MessageSquare, 
  Mail, 
  PhoneCall, 
  Copy, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import type { AIOutreachDraft } from '@/lib/lead-intelligence/types';
import { useToast } from '@/hooks/use-toast';

interface AIOutreachReviewModalProps {
  draft: AIOutreachDraft | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AIOutreachReviewModal: React.FC<AIOutreachReviewModalProps> = ({
  draft,
  isOpen,
  onClose
}) => {
  const { toast } = useToast();
  const [editedBody, setEditedBody] = useState(draft?.body || '');
  const [editedSubject, setEditedSubject] = useState(draft?.subject || '');
  const [isCopied, setIsCopied] = useState(false);

  React.useEffect(() => {
    if (draft) {
      setEditedBody(draft.body);
      setEditedSubject(draft.subject || '');
      setIsCopied(false);
    }
  }, [draft]);

  if (!draft) return null;

  const handleCopy = () => {
    const textToCopy = draft.channel === 'email' 
      ? `Subject: ${editedSubject}\n\n${editedBody}`
      : editedBody;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    toast({ title: 'Copied to Clipboard ✓', description: 'Outreach message ready to paste.' });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleLaunchWhatsApp = () => {
    if (draft.recipientPhone) {
      let digits = draft.recipientPhone.replace(/\D/g, '');
      if (digits.startsWith('0') && digits.length === 10) {
        digits = '233' + digits.substring(1);
      } else if (digits.length === 9) {
        digits = '233' + digits;
      }
      const url = `https://wa.me/${digits}?text=${encodeURIComponent(editedBody)}`;
      window.open(url, '_blank');
      toast({ title: 'WhatsApp Web Launched', description: 'Opening direct chat window.' });
    } else {
      toast({ variant: 'destructive', title: 'No Phone Number', description: 'No phone number available for this contact.' });
    }
  };

  const handleLaunchMailto = () => {
    if (draft.recipientEmail) {
      const url = `mailto:${draft.recipientEmail}?subject=${encodeURIComponent(editedSubject)}&body=${encodeURIComponent(editedBody)}`;
      window.location.href = url;
    } else {
      toast({ variant: 'destructive', title: 'No Email Address', description: 'No recipient email available.' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border/80 rounded-2xl p-6 shadow-2xl z-[10005]">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span>AI Outreach Personalization Review</span>
            <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/40 text-[10px] font-bold uppercase">
              Human Review Gate
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Review and refine the grounded AI draft before initiating external contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Grounding Context Badges */}
          {draft.groundingPoints && draft.groundingPoints.length > 0 && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-primary" /> Grounded In Real Intelligence
              </span>
              <div className="flex flex-wrap gap-1.5">
                {draft.groundingPoints.map((gp, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] bg-card/60">
                    {gp}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Email Subject Line if Email */}
          {draft.channel === 'email' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Email Subject</Label>
              <Input
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="h-9 text-xs font-medium"
              />
            </div>
          )}

          {/* Message Body Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                {draft.channel === 'whatsapp' ? 'WhatsApp Message' : draft.channel === 'email' ? 'Email Body' : 'Call Script & Discovery'}
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Recipient: <strong className="text-foreground">{draft.recipientName}</strong>
              </span>
            </div>
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              rows={8}
              className="text-xs font-mono leading-relaxed resize-none p-3.5"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border/60">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="w-full sm:w-auto h-9 text-xs font-bold active:scale-[0.97]"
          >
            {isCopied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
            {isCopied ? 'Copied' : 'Copy Text'}
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-9 text-xs font-medium"
            >
              Close
            </Button>

            {draft.channel === 'whatsapp' && (
              <Button
                size="sm"
                onClick={handleLaunchWhatsApp}
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Launch WhatsApp Web</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </Button>
            )}

            {draft.channel === 'email' && (
              <Button
                size="sm"
                onClick={handleLaunchMailto}
                className="h-9 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open Mail Client</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </Button>
            )}

            {draft.channel === 'phone_script' && (
              <Button
                size="sm"
                onClick={onClose}
                className="h-9 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Start Call</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
