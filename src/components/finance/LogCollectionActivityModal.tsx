'use client';

/**
 * SmartSapp Finance 2.0 - Log Collection Activity Modal
 * Logs calls, SMS, WhatsApp, emails, and meetings to the case timeline and CRM feed.
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
import { Loader2, PhoneCall, Mail, MessageSquare, Users, FileText } from 'lucide-react';
import { CollectionActivityType } from '@/lib/types';
import { logCollectionActivityAction } from '@/lib/collection-actions';

export interface LogCollectionActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  entityId: string;
  entityName: string;
  onSuccess?: () => void;
}

export function LogCollectionActivityModal({
  isOpen,
  onClose,
  caseId,
  entityId,
  entityName,
  onSuccess,
}: LogCollectionActivityModalProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [type, setType] = React.useState<CollectionActivityType>('call');
  const [summary, setSummary] = React.useState<string>('');
  const [details, setDetails] = React.useState<string>('');
  const [outcome, setOutcome] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setSummary('');
      setDetails('');
      setOutcome('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeWorkspaceId) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'Please sign in.' });
      return;
    }

    if (!summary.trim()) {
      toast({ variant: 'destructive', title: 'Missing Summary', description: 'Please enter an activity summary.' });
      return;
    }

    setIsSubmitting(true);
    const res = await logCollectionActivityAction(
      {
        caseId,
        entityId,
        type,
        summary: summary.trim(),
        details: details.trim() || undefined,
        outcome: outcome.trim() || undefined,
      },
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Collection Officer'
    );

    setIsSubmitting(false);

    if (res.success) {
      toast({
        title: 'Activity Logged',
        description: 'Interaction saved to collection case and customer timeline.',
      });
      if (onSuccess) onSuccess();
      onClose();
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to log activity',
        description: res.error || 'Please try again.',
      });
    }
  };

  const getActivityIcon = (actType: CollectionActivityType) => {
    switch (actType) {
      case 'call': return <PhoneCall className="h-4 w-4 text-sky-600" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4 text-emerald-600" />;
      case 'email': return <Mail className="h-4 w-4 text-indigo-600" />;
      case 'meeting': return <Users className="h-4 w-4 text-amber-600" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            {getActivityIcon(type)}
            Collection Activity
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Log Interaction</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Record outreach to <span className="font-semibold text-foreground">{entityName}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Channel / Type *</Label>
            <Select value={type} onValueChange={(val) => setType(val as CollectionActivityType)}>
              <SelectTrigger className="rounded-xl h-11 min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="whatsapp">WhatsApp Follow-up</SelectItem>
                <SelectItem value="email">Email Notification</SelectItem>
                <SelectItem value="sms">SMS Alert</SelectItem>
                <SelectItem value="meeting">In-Person / Virtual Meeting</SelectItem>
                <SelectItem value="note">Internal Collection Note</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Summary Headline *</Label>
            <Input
              required
              placeholder="e.g. Discussed overdue Term 2 fees with Bursar"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="rounded-xl h-11 min-h-[44px] font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Conversation Details / Notes</Label>
            <Textarea
              rows={3}
              placeholder="Bursar stated payment voucher was submitted to treasury, awaiting sign-off on Friday..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="rounded-xl resize-none text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Agreed Outcome / Next Step</Label>
            <Input
              placeholder="e.g. Follow up on Monday via WhatsApp"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="rounded-xl h-11 min-h-[44px]"
            />
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
                  Saving...
                </>
              ) : (
                'Save Activity'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
