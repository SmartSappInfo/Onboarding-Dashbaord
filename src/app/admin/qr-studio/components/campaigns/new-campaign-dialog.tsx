/**
 * @fileoverview New QR Campaign Creation Wizard Modal
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Employs micro-animations and active press states (active:scale-[0.97]).
 * - Tag selector strictly uses TagSelector component if tags are added.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  FolderPlus,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  Tag,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import { createQRCampaign } from '@/lib/qr-campaign-actions';
import type { QRCampaignObjective, QRCode } from '@/lib/types';

interface NewCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableQRCodes: QRCode[];
  onSuccess?: () => void;
}

const OBJECTIVE_OPTIONS: { value: QRCampaignObjective; label: string; icon: string; desc: string }[] = [
  { value: 'awareness', label: 'Brand Awareness', icon: '📢', desc: 'Maximize scan reach and impressions' },
  { value: 'lead_generation', label: 'Lead Generation', icon: '🎯', desc: 'Capture prospective customer contacts' },
  { value: 'registration', label: 'Event Registration', icon: '🎟️', desc: 'Sign up attendees for events or webinars' },
  { value: 'payment', label: 'Sales & Checkout', icon: '💳', desc: 'Drive instant mobile payments and orders' },
  { value: 'engagement', label: 'Content Engagement', icon: '✨', desc: 'Deliver digital assets, videos, or menus' },
  { value: 'feedback', label: 'Customer Reviews', icon: '⭐', desc: 'Collect NPS scores and survey feedback' },
];

export default function NewCampaignDialog({
  open,
  onOpenChange,
  availableQRCodes,
  onSuccess,
}: NewCampaignDialogProps) {
  const { toast } = useToast();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { user } = useUser();

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [objective, setObjective] = React.useState<QRCampaignObjective>('awareness');
  const [startAt, setStartAt] = React.useState('');
  const [endAt, setEndAt] = React.useState('');
  const [selectedQrIds, setSelectedQrIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setObjective('awareness');
      setStartAt('');
      setEndAt('');
      setSelectedQrIds([]);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Name Required', description: 'Please enter a campaign title.' });
      return;
    }
    if (!activeOrganizationId || !activeWorkspaceId || !user) return;

    setIsSubmitting(true);
    try {
      await createQRCampaign({
        organizationId: activeOrganizationId,
        workspaceId: activeWorkspaceId,
        name,
        description: description.trim() || undefined,
        objective,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        qrCodeIds: selectedQrIds,
        createdBy: {
          userId: user.uid,
          name: user.displayName || 'Admin',
          email: user.email || '',
        },
      });

      toast({
        title: 'Campaign Created',
        description: `"${name}" campaign is now active and ready for tracking.`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Creation Failed', description: 'Could not create campaign.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleQR = (qrId: string) => {
    setSelectedQrIds((prev) =>
      prev.includes(qrId) ? prev.filter((id) => id !== qrId) : [...prev, qrId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Create New QR Campaign
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Group multiple physical QR touchpoints to measure aggregate conversions and ROI.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Campaign Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Campaign Name *
            </Label>
            <Input
              placeholder="e.g. Fall 2026 Admissions Open Day"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-xl text-sm font-semibold"
              required
            />
          </div>

          {/* Objective Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Campaign Objective
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {OBJECTIVE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setObjective(opt.value)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                    objective === opt.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-foreground">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Start Date (Optional)
              </Label>
              <Input
                type="date"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                End Date (Optional)
              </Label>
              <Input
                type="date"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Description / Notes
            </Label>
            <Textarea
              placeholder="Brief context regarding campaign goals, target audience, or distribution channels..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[70px] rounded-xl text-xs resize-none"
            />
          </div>

          {/* Assign Initial QR Codes */}
          {availableQRCodes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Assign Member QR Codes ({selectedQrIds.length} selected)
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedQrIds(
                      selectedQrIds.length === availableQRCodes.length
                        ? []
                        : availableQRCodes.map((q) => q.id)
                    )
                  }
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {selectedQrIds.length === availableQRCodes.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="max-h-[140px] overflow-y-auto space-y-1.5 p-2 rounded-xl border border-border bg-muted/10">
                {availableQRCodes.map((qr) => {
                  const isSelected = selectedQrIds.includes(qr.id);
                  return (
                    <button
                      key={qr.id}
                      type="button"
                      onClick={() => toggleQR(qr.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all ${
                        isSelected ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-xs truncate max-w-[340px]">{qr.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground capitalize">{qr.type}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-10 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="rounded-xl h-10 px-6 text-xs font-semibold shadow-lg shadow-primary/20 active:scale-[0.97]"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Create Campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
