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
      <DialogContent className="sm:max-w-lg rounded-2xl p-6">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Send className="h-4 w-4" />
            Outreach Dispatcher
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Send Payment Reminder</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Dispatches formatted reminder for <span className="font-semibold text-foreground">{invoice.invoiceNumber}</span> ({invoice.currency || 'GHS'} {Number(invoice.balanceDue ?? invoice.totalPayable ?? 0).toLocaleString()}) to <span className="font-semibold text-foreground">{entityName}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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

          <div className="p-3 border rounded-xl bg-card text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span>Delivery will be recorded in <strong className="text-foreground">Finance Delivery Logs</strong> and mirrored into the customer timeline.</span>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl h-11 min-h-[44px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl h-11 min-h-[44px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Send className="h-4 w-4" />
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
