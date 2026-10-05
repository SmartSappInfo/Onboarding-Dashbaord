'use client';

/**
 * @fileOverview Segment to Campaign Handoff Bridge Modal (Phase 10 Milestone 3 Task 2)
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. theme.md §8 Standardized Modal Architecture:
 *    - Surface & geometry: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl
 *    - Demarcated Header: <DialogHeader demarcated> (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4)
 *    - Zero raw descriptions: <DialogDescription className="sr-only">
 *    - Single-circle info tooltip: <CardInfoTooltip text="..." /> elevated at z-[10050]
 *    - Demarcated Footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 with rounded-xl active:scale-[0.97] buttons
 * 2. Tag Selection SSOT: Tags applied via <TagSelector> in client/draft mode.
 * 3. Two-Phase Action Model & Cryptographic Binding (Rules 21 & 22): Staged campaign binds to canonical SHA-256 payloadHash.
 * 4. Strict Typing: Zero `any` or `any[]` (Rule 4).
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { TagSelector } from '@/components/tags/TagSelector';
import {
  Send,
  Target,
  Users,
  Calendar,
  MessageSquare,
  Mail,
  Phone,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { createCampaignFromSegmentAction } from '@/app/actions/sales-agent-actions';
import type { SalesPersonaId } from '@/platform/agents/sales/personas/sales-persona-types';
import { useToast } from '@/hooks/use-toast';

export interface SegmentToCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  workspaceId: string;
  segmentName?: string;
  selectedLeadIds: string[];
  totalAvailableCount?: number;
  onCampaignCreated?: (campaignId: string) => void;
}

export function SegmentToCampaignModal({
  isOpen,
  onClose,
  organizationId,
  workspaceId,
  segmentName = 'Qualified Prospects Q4',
  selectedLeadIds,
  totalAvailableCount,
  onCampaignCreated,
}: SegmentToCampaignModalProps) {
  const { toast } = useToast();
  const [name, setName] = React.useState(segmentName);
  const [campaignGoal, setCampaignGoal] = React.useState('Book 10 Executive Product Demos');
  const [sdrPersonaId, setSdrPersonaId] = React.useState<SalesPersonaId>('lead_sdr');
  const [dailyBudget, setDailyBudget] = React.useState<number>(25);
  const [channels, setChannels] = React.useState<('email' | 'whatsapp' | 'call')[]>(['email', 'whatsapp']);
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setName(segmentName);
    }
  }, [isOpen, segmentName]);

  const leadCount = selectedLeadIds.length > 0 ? selectedLeadIds.length : (totalAvailableCount || 0);

  const toggleChannel = (channel: 'email' | 'whatsapp' | 'call') => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.length > 1
          ? prev.filter((c) => c !== channel)
          : prev
        : [...prev, channel]
    );
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (leadCount === 0) {
      toast({
        variant: 'destructive',
        title: 'Empty Segment',
        description: 'Cannot create campaign without prospects. Select rows or apply search filters.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCampaignFromSegmentAction({
        organizationId,
        workspaceId,
        segmentName: name.trim(),
        leadIds: selectedLeadIds.length > 0 ? selectedLeadIds : ['lead_sample_batch_01'],
        campaignGoal: campaignGoal.trim(),
        sdrPersonaId,
        dailyBudget,
        channels,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });

      if (!res.success || !res.data) {
        toast({
          variant: 'destructive',
          title: 'Campaign Creation Failed',
          description: res.error || 'Failed to initialize SDR campaign.',
        });
        return;
      }

      toast({
        title: 'Campaign Staged ✓',
        description: `Created campaign "${res.data.segmentName}" for ${res.data.prospectCount} prospects. Outbound drafts queued for approval.`,
        actionConfig: {
          path: '/admin/lead-intelligence?tab=inbox',
          label: 'View Queue',
        },
      });

      onCampaignCreated?.(res.data.campaignId);
      onClose();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while launching campaign.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl max-h-[90vh]">
        {/* Demarcated Header (theme.md §8) */}
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Send className="h-4 w-4" />
            </div>
            <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
              Turn Segment into Campaign
            </DialogTitle>
            <CardInfoTooltip text="Bridges current filtered prospect segment directly into an autonomous SDR outreach campaign with Two-Phase human approval gates." />
          </div>
          <DialogDescription className="sr-only">
            Handoff prospect segment to SDR outbound campaign
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <form onSubmit={handleLaunchCampaign} id="segment-campaign-form" className="overflow-y-auto p-6 space-y-5 flex-1 text-sm">
          {/* Target Leads Summary Pill */}
          <div className="p-3 rounded-xl border border-border/70 bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Selected Segment Size</span>
            </div>
            <Badge className="bg-primary text-primary-foreground font-mono text-xs px-2.5">
              {leadCount} Prospects
            </Badge>
          </div>

          {/* Campaign Name */}
          <div className="space-y-1.5">
            <Label htmlFor="camp-name" className="text-xs font-medium">
              Campaign Name *
            </Label>
            <Input
              id="camp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Private School Bursar Sequence"
              className="h-10 rounded-xl"
              required
            />
          </div>

          {/* Primary Campaign Goal */}
          <div className="space-y-1.5">
            <Label htmlFor="camp-goal" className="text-xs font-medium">
              Campaign Objective / Goal *
            </Label>
            <div className="relative">
              <Target className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="camp-goal"
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                placeholder="e.g. Schedule 10 Demo Calls with Bursars"
                className="pl-9 h-10 rounded-xl"
                required
              />
            </div>
          </div>

          {/* SDR Persona Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Assigned AI Agent Persona *</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'lead_sdr', label: 'Lead SDR', desc: 'Outbound sequences' },
                { id: 'sales_coach', label: 'Sales Coach', desc: 'Consultative angles' },
                { id: 'prospecting_agent', label: 'Prospector', desc: 'Research & verify' },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setSdrPersonaId(p.id as SalesPersonaId)}
                  className={`p-2.5 rounded-xl border text-left transition-all text-xs active:scale-[0.97] min-h-[44px] ${
                    sdrPersonaId === p.id
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-border/70 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <div className="font-semibold text-foreground">{p.label}</div>
                  <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Channels Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Active Outreach Channels</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleChannel('email')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-[0.97] min-h-[44px] ${
                  channels.includes('email')
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/70 text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                Email Outreach
              </button>

              <button
                type="button"
                onClick={() => toggleChannel('whatsapp')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-[0.97] min-h-[44px] ${
                  channels.includes('whatsapp')
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                    : 'border-border/70 text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                WhatsApp Click-to-Chat
              </button>

              <button
                type="button"
                onClick={() => toggleChannel('call')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-[0.97] min-h-[44px] ${
                  channels.includes('call')
                    ? 'border-sky-500 bg-sky-500/10 text-sky-600'
                    : 'border-border/70 text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                Rep Phone Call
              </button>
            </div>
          </div>

          {/* Daily Budget Ceiling */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="budget-slider" className="text-xs font-medium">
                Daily Outreach Budget Ceiling (Rule 23)
              </Label>
              <span className="text-xs font-mono font-bold text-primary">
                {dailyBudget} contacts / day
              </span>
            </div>
            <input
              id="budget-slider"
              type="range"
              min="5"
              max="100"
              step="5"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          {/* Contact Tag Assignment (Tag Selector SSOT) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Apply Workspace Tags</Label>
            <TagSelector
              currentTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
              placeholder="Tag contacts in this campaign..."
            />
          </div>

          {/* Safety Notice (Rule 17 & 21) */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div className="font-semibold text-foreground">Two-Phase Human Approval (Rule 21)</div>
              <div>
                Autonomous SDR generates personalized drafts. Messages are <span className="font-medium text-foreground">never sent autonomously</span> without explicit operator sign-off.
              </div>
            </div>
          </div>
        </form>

        {/* Demarcated Footer (theme.md §8) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0 min-h-[56px]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs px-4"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="segment-campaign-form"
            size="sm"
            disabled={isSubmitting || leadCount === 0 || !name.trim()}
            className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs px-5 gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Staging Campaign...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Launch Campaign
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default SegmentToCampaignModal;
