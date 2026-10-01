'use client';

/**
 * SmartSapp Finance 2.0 - Send Reminder Modal
 * Dispatches an on-demand payment reminder via WhatsApp, Email, or SMS with live message preview.
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
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Loader2, Send, MessageSquare, Mail, Smartphone, CheckCircle2 } from 'lucide-react';
import { Invoice, ReminderChannel } from '@/lib/types';
import { sendInvoiceReminderAction } from '@/lib/finance-automation-actions';
import { formatReminderMessage } from '@/lib/services/finance-reminder-utils';

export interface SendReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onSuccess?: () => void;
}

export function SendReminderModal({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}: SendReminderModalProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [channel, setChannel] = React.useState<ReminderChannel>('whatsapp');
  const [customMessage, setCustomMessage] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  const entityName = invoice.entityName || 'Customer';

  React.useEffect(() => {
    if (isOpen) {
      const defaultCopy = formatReminderMessage(invoice, 'manual', entityName);
      setCustomMessage(defaultCopy);
    }
  }, [isOpen, invoice, entityName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeWorkspaceId) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'Please sign in.' });
      return;
    }

    setIsSubmitting(true);
    const res = await sendInvoiceReminderAction(
      {
        invoiceId: invoice.id,
        channel,
        customMessage,
      },
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Finance Officer'
    );

    setIsSubmitting(false);

    if (res.success) {
      toast({
        title: 'Reminder Dispatched',
        description: `Notification queued for delivery to ${entityName} via ${channel.toUpperCase()}.`,
      });
      if (onSuccess) onSuccess();
      onClose();
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to send reminder',
        description: res.error || 'Please try again.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base sm:text-lg font-bold">Send Payment Reminder</DialogTitle>
            <CardInfoTooltip text={`Dispatches formatted reminder for ${invoice.invoiceNumber} (${invoice.currency || 'GHS'} ${Number(invoice.balanceDue ?? invoice.totalPayable ?? 0).toLocaleString()}) to ${entityName}.`} />
          </div>
          <DialogDescription className="sr-only">
            Dispatches formatted reminder for {invoice.invoiceNumber} to {entityName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Delivery Channel *</Label>
              <Select value={channel} onValueChange={(val) => setChannel(val as ReminderChannel)}>
                <SelectTrigger className="rounded-xl h-11 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-emerald-600" />
                      <span>WhatsApp Message ({invoice.customerPhone || 'Phone unlisted'})</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-indigo-600" />
                      <span>Email ({invoice.customerEmail || 'Email unlisted'})</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-sky-600" />
                      <span>SMS Alert ({invoice.customerPhone || 'Phone unlisted'})</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Message Copy Preview *</Label>
              <Textarea
                rows={4}
                required
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="rounded-xl resize-none text-xs font-mono"
              />
            </div>

            <div className="p-3 border border-border/80 rounded-xl bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Delivery will be recorded in <strong className="text-foreground">Finance Delivery Logs</strong> and mirrored into the customer timeline.</span>
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl h-10 min-h-[44px] text-xs font-bold px-6 shadow-sm active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" />
                  Dispatch Now
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
