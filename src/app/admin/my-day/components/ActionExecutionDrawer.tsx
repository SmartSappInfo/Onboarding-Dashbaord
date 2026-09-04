'use client';

/**
 * @fileoverview Action Execution Drawer for "Action from the surface" (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 30 & UI Section 17:
 * - Side sheet on desktop, responsive bottom sheet on mobile (100dvh).
 * - Direct execution of Calls, Follow-ups, Notes, and Meeting Prep without navigating away.
 * - Invokes executeQuickActionAction which automatically triggers evaluateEffortEvent.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Minimum 44px touch targets on all mobile controls.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Phone,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Sparkles,
  Loader2,
  Flame,
} from 'lucide-react';
import type { WorkQueueItem, QuickActionResult } from '@/lib/seller-workspace/types';
import { executeQuickActionAction } from '@/app/actions/seller-workspace-actions';

interface ActionExecutionDrawerProps {
  item: WorkQueueItem | null;
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  organizationId: string;
  actorId: string;
  onActionComplete: (itemId: string, pointsEarned: number) => void;
}

export function ActionExecutionDrawer({
  item,
  isOpen,
  onClose,
  workspaceId,
  organizationId,
  actorId,
  onActionComplete,
}: ActionExecutionDrawerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<'call' | 'note' | 'prep'>('call');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form states
  const [callDurationMinutes, setCallDurationMinutes] = React.useState('3');
  const [callOutcome, setCallOutcome] = React.useState('connected');
  const [noteText, setNoteText] = React.useState('');

  React.useEffect(() => {
    if (item) {
      if (item.type === 'call') setActiveTab('call');
      else if (item.type === 'meeting_prep') setActiveTab('prep');
      else setActiveTab('note');

      setNoteText('');
    }
  }, [item]);

  if (!item) return null;

  const handleSubmitAction = async (actionType: 'call' | 'note' | 'task_complete') => {
    setIsSubmitting(true);
    try {
      const durationSeconds = (Number(callDurationMinutes) || 2) * 60;

      const res: QuickActionResult = await executeQuickActionAction({
        itemId: item.id,
        actionType,
        workspaceId,
        organizationId,
        actorId,
        callDurationSeconds: actionType === 'call' ? durationSeconds : undefined,
        callOutcome: actionType === 'call' ? callOutcome : undefined,
        noteText: noteText.trim() || undefined,
      });

      if (res.success) {
        const points = res.pointsEarned || 0;
        toast({
          title: 'Action Completed',
          description: points > 0 ? `${res.message || 'Points awarded!'} (+${points} pts)` : 'Task completed.',
        });
        onActionComplete(item.id, points);
        onClose();
      } else {
        throw new Error(res.error || 'Failed to complete action');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-6 overflow-y-auto">
        <SheetHeader className="text-left border-b pb-4 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/30">
              {item.type.replace('_', ' ')}
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground font-mono">
              Score: {item.priorityScore}/100
            </span>
          </div>
          <SheetTitle className="text-base font-extrabold text-foreground">
            {item.title}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {item.entityName || item.dealName || 'Target CRM Record'}
          </SheetDescription>
        </SheetHeader>

        {/* Context & Suggested Talking Points */}
        <div className="py-4 space-y-4 text-left">
          {item.suggestedTalkingPoint && (
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <Sparkles className="h-3.5 w-3.5 fill-current" /> Suggested Talking Point
              </div>
              <p className="text-xs text-foreground/90 italic leading-relaxed">
                {item.suggestedTalkingPoint}
              </p>
            </div>
          )}

          {/* Quick Action Tabs */}
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'call' | 'note' | 'prep')}>
            <TabsList className="grid grid-cols-3 w-full rounded-xl bg-muted/40 p-1">
              <TabsTrigger value="call" className="rounded-lg text-xs font-bold py-2 min-h-[40px] flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Call
              </TabsTrigger>
              <TabsTrigger value="note" className="rounded-lg text-xs font-bold py-2 min-h-[40px] flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> Note
              </TabsTrigger>
              <TabsTrigger value="prep" className="rounded-lg text-xs font-bold py-2 min-h-[40px] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Brief
              </TabsTrigger>
            </TabsList>

            {/* Tab: Call Logging */}
            <TabsContent value="call" className="space-y-4 pt-3">
              {item.contactPhone && (
                <div className="p-3 rounded-xl border bg-muted/10 flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground">
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Phone</span>
                    {item.contactPhone}
                  </div>
                  <Button asChild size="sm" className="rounded-lg text-xs font-bold min-h-[36px]">
                    <a href={`tel:${item.contactPhone}`}>
                      <Phone className="h-3.5 w-3.5 mr-1" /> Call Now
                    </a>
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Call Duration (mins)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="180"
                    value={callDurationMinutes}
                    onChange={(e) => setCallDurationMinutes(e.target.value)}
                    className="rounded-xl h-10 text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Outcome</Label>
                  <Select value={callOutcome} onValueChange={setCallOutcome}>
                    <SelectTrigger className="rounded-xl text-xs font-semibold h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="connected">Connected & Discussed</SelectItem>
                      <SelectItem value="meeting_booked">Meeting Booked</SelectItem>
                      <SelectItem value="left_voicemail">Left Voicemail</SelectItem>
                      <SelectItem value="no_answer">No Answer / Busy</SelectItem>
                      <SelectItem value="gatekeeper">Gatekeeper Block</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Call Notes & Next Steps</Label>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Summary of conversation, objections addressed, agreed follow-up..."
                  className="rounded-xl text-xs min-h-[90px] resize-none"
                />
              </div>

              <Button
                type="button"
                onClick={() => handleSubmitAction('call')}
                disabled={isSubmitting}
                className="w-full rounded-xl text-xs font-bold min-h-[44px] active:scale-[0.97]"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Flame className="h-4 w-4 mr-1.5 text-orange-400" />}
                Log Call & Earn Effort Points
              </Button>
            </TabsContent>

            {/* Tab: Follow-up Note */}
            <TabsContent value="note" className="space-y-4 pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Activity / Follow-up Note</Label>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Record summary of action taken or next scheduled follow-up..."
                  className="rounded-xl text-xs min-h-[110px] resize-none"
                />
              </div>

              <Button
                type="button"
                onClick={() => handleSubmitAction('task_complete')}
                disabled={isSubmitting || !noteText.trim()}
                className="w-full rounded-xl text-xs font-bold min-h-[44px] active:scale-[0.97]"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-400" />}
                Complete Task & Log Points
              </Button>
            </TabsContent>

            {/* Tab: Meeting Brief */}
            <TabsContent value="prep" className="space-y-4 pt-3">
              <div className="p-3.5 rounded-xl border bg-muted/10 space-y-2 text-xs">
                <div className="font-extrabold text-foreground flex items-center justify-between">
                  <span>Session Preparation Context</span>
                  <Badge variant="outline" className="text-[10px]">Brief</Badge>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
                {item.dealValue && (
                  <div className="pt-2 border-t text-[11px] font-mono text-muted-foreground">
                    Deal Value: <strong className="text-foreground">{item.dealValue.toLocaleString()} GHS</strong>
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={() => handleSubmitAction('task_complete')}
                disabled={isSubmitting}
                className="w-full rounded-xl text-xs font-bold min-h-[44px] active:scale-[0.97]"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-400" />}
                Mark Meeting Prep Completed
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
