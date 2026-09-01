'use client';

/**
 * @fileOverview Access Review Campaign Creation Modal (Governance 2.0)
 *
 * Dialog for launching periodic and on-demand access certification reviews.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Dialogs with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { ShieldCheck, Play, Loader2 } from 'lucide-react';
import type { AccessReviewFrequency } from '@/lib/types';
import { createAccessReviewCampaignAction } from '@/app/actions/governance-actions';

interface AccessReviewCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AccessReviewCampaignModal({
  isOpen,
  onClose,
  onCreated,
}: AccessReviewCampaignModalProps) {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [frequency, setFrequency] = React.useState<AccessReviewFrequency>('quarterly');
  const [dueDate, setDueDate] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setDueDate(d.toISOString().split('T')[0]);
      setTitle(`Q${Math.floor(d.getMonth() / 3) + 1} Access Certification Campaign`);
      setDescription('Routine access certification review for all organization members and assigned roles.');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId) return;

    if (!title.trim() || !dueDate) {
      toast({ title: 'Validation Error', description: 'Campaign title and due date are required.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await createAccessReviewCampaignAction({
        idToken,
        organizationId: activeOrganizationId,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          frequency,
          dueDate,
        },
      });

      if (res.success) {
        toast({
          title: 'Access Review Launched',
          description: `Campaign '${res.campaign?.title}' created with ${res.campaign?.totalItems} items.`,
        });
        onCreated();
        onClose();
      } else {
        throw new Error(res.error || 'Failed to create campaign');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Launch failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base font-bold">Launch Access Certification</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Initiate a formal compliance campaign to certify or revoke user access
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Campaign Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 Security & Access Review"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Cadence / Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as AccessReviewFrequency)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarterly" className="text-xs">Quarterly (90 Days)</SelectItem>
                    <SelectItem value="biannual" className="text-xs">Bi-Annual (180 Days)</SelectItem>
                    <SelectItem value="annual" className="text-xs">Annual (365 Days)</SelectItem>
                    <SelectItem value="on_demand" className="text-xs">On-Demand / Ad-Hoc</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Description / Purpose</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Audit scope and compliance objectives..."
                className="text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating Items...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Launch Campaign
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AccessReviewCampaignModal;
