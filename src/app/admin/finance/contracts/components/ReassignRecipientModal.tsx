'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    One-Click Signatory Reassignment Modal (Phase 2, Task 9, FM-P2-04 mitigation).
 * 2. Invariants & Safety:
 *    - Replaces an unavailable or departed signatory with a new authorized individual.
 *    - Atomically revokes the old recipient's capability token and generates a fresh token for the new recipient.
 *    - Appends an immutable audit entry to `signing_evidence` noting the reassigning actor and reason.
 * 3. Mobile & Accessibility Ergonomics:
 *    - Touch targets >= 44x44px (`min-h-[44px]`).
 *    - Input typography >= 16px (`text-base`) to prevent iOS Safari auto-zoom.
 *    - Micro-interactions follow Emil Kowalski physics (`active:scale-[0.97]`).
 * 4. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { reassignRecipientAction } from '@/lib/documents/envelope-actions';
import type { EnvelopeRecipient } from '@/lib/types/document-signing';

interface ReassignRecipientModalProps {
  isOpen: boolean;
  onClose: () => void;
  envelopeId: string;
  workspaceId: string;
  targetRecipient: EnvelopeRecipient | null;
  onReassigned?: () => void;
}

export default function ReassignRecipientModal({
  isOpen,
  onClose,
  envelopeId,
  workspaceId,
  targetRecipient,
  onReassigned,
}: ReassignRecipientModalProps) {
  const { toast } = useToast();

  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [generatedUrl, setGeneratedUrl] = React.useState<string | null>(null);
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setReason('');
      setGeneratedUrl(null);
      setHasCopied(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetRecipient) return;
    if (!newName.trim() || !newEmail.trim()) {
      toast({
        title: 'Validation Error',
        description: 'New signatory name and email address are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await reassignRecipientAction({
        workspaceId,
        envelopeId,
        currentRecipientId: targetRecipient.id,
        newRecipient: {
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          phone: newPhone.trim() || undefined,
          role: targetRecipient.role,
        },
        reason: reason.trim() || 'Manual operations reassignment',
      });

      if (!res.success) {
        toast({
          title: 'Reassignment Failed',
          description: res.error || 'Failed to reassign signatory.',
          variant: 'destructive',
        });
        return;
      }

      if (res.newSigningUrl) {
        setGeneratedUrl(res.newSigningUrl);
      }

      toast({
        title: 'Signatory Reassigned',
        description: `Successfully reassigned to ${newName.trim()}. Previous capability token revoked.`,
      });

      onReassigned?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast({
        title: 'System Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setHasCopied(true);
    toast({
      title: 'Link Copied',
      description: 'Signing link copied to clipboard.',
    });
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6 border shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Reassign Signatory
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Replace an unavailable participant. A fresh capability token will be issued.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {targetRecipient && (
          <div className="p-3 bg-muted/40 rounded-2xl border text-xs space-y-1">
            <div className="font-semibold text-foreground">Current Signatory:</div>
            <div className="text-muted-foreground flex justify-between">
              <span>{targetRecipient.name} ({targetRecipient.email})</span>
              <span className="font-medium capitalize">{targetRecipient.role} • Order {targetRecipient.routingOrder}</span>
            </div>
          </div>
        )}

        {generatedUrl ? (
          <div className="space-y-4 py-3">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2 text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Check className="h-4 w-4" />
                Signatory Successfully Reassigned!
              </div>
              <p className="text-xs leading-relaxed opacity-90">
                The replacement participant is now authorized. Share this new capability link or notify them directly.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">New Capability Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={generatedUrl}
                  className="text-xs font-mono bg-muted/30 select-all"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="shrink-0 h-9 w-9 rounded-xl active:scale-[0.97] transition-transform"
                >
                  {hasCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] rounded-xl font-semibold active:scale-[0.97] transition-transform"
              >
                Close & Refresh
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="newName" className="text-xs font-semibold">
                Replacement Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Eleanor Vance"
                className="text-base sm:text-sm min-h-[44px] rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="newEmail" className="text-xs font-semibold">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="eleanor@company.com"
                  className="text-base sm:text-sm min-h-[44px] rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPhone" className="text-xs font-semibold">
                  Phone (Optional)
                </Label>
                <Input
                  id="newPhone"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="text-base sm:text-sm min-h-[44px] rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-xs font-semibold">
                Reassignment Reason
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Previous signatory is out of office; delegated to VP."
                className="text-base sm:text-sm min-h-[80px] rounded-xl resize-none"
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5 text-amber-800 dark:text-amber-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Reassigning invalidates previous links sent to {targetRecipient?.name || 'this signatory'}. All existing execution evidence is preserved in the audit log.
              </span>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-[44px] rounded-xl font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] rounded-xl font-semibold active:scale-[0.97] transition-transform"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Reassigning...
                  </>
                ) : (
                  'Confirm Reassignment'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
