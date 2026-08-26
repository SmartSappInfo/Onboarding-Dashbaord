'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Vote,
  Plus,
  Copy,
  Check,
  Calendar,
  Clock,
  ExternalLink,
  Users,
  CheckCircle2,
  Trash2,
  BarChart3,
  Award,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import {
  getMeetingPollsAction,
  createMeetingPollAction,
  finalizeMeetingPollAction,
} from '@/app/actions/meeting-poll-actions';
import type { MeetingPoll } from '@/lib/meetings/types/polls';
import { format } from 'date-fns';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function PollsClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [polls, setPolls] = React.useState<MeetingPoll[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Modal State
  const [createModalOpen, setCreateModalOpen] = React.useState(false);

  // Auto-open create modal if create=true in URL query params
  React.useEffect(() => {
    if (searchParams?.get('create') === 'true') {
      setCreateModalOpen(true);
    }
  }, [searchParams]);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [durationMinutes, setDurationMinutes] = React.useState('30');
  const [slotDate, setSlotDate] = React.useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'));
  const [slotStartTime, setSlotStartTime] = React.useState('10:00');
  const [slotEndTime, setSlotEndTime] = React.useState('10:30');
  const [proposedSlots, setProposedSlots] = React.useState<Array<{ startAt: string; endAt: string }>>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Finalize state
  const [finalizingPollId, setFinalizingPollId] = React.useState<string | null>(null);

  const fetchPolls = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getMeetingPollsAction(activeWorkspaceId);
      if (res.success && res.polls) {
        setPolls(res.polls);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to load polls',
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handleAddSlot = () => {
    if (!slotDate || !slotStartTime || !slotEndTime) return;
    const startAt = new Date(`${slotDate}T${slotStartTime}:00Z`).toISOString();
    const endAt = new Date(`${slotDate}T${slotEndTime}:00Z`).toISOString();

    setProposedSlots(prev => [...prev, { startAt, endAt }]);
  };

  const handleRemoveSlot = (index: number) => {
    setProposedSlots(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePoll = async () => {
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title required', description: 'Please enter a poll title.' });
      return;
    }
    if (proposedSlots.length === 0) {
      toast({ variant: 'destructive', title: 'Slots required', description: 'Please add at least one proposed time slot.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createMeetingPollAction({
        workspaceId: activeWorkspaceId || '',
        organizationId: activeOrganizationId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        hostUserId: user?.uid || 'user',
        hostName: user?.displayName || user?.email || 'Host',
        hostEmail: user?.email || undefined,
        durationMinutes: parseInt(durationMinutes, 10) || 30,
        proposedSlots,
      });

      if (res.success) {
        toast({ title: 'Meeting Poll Created!', description: 'Invitees can now vote on proposed times.' });
        setCreateModalOpen(false);
        setTitle('');
        setDescription('');
        setProposedSlots([]);
        fetchPolls();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalize = async (pollId: string, winningSlotId: string) => {
    setFinalizingPollId(pollId);
    try {
      const res = await finalizeMeetingPollAction(pollId, activeWorkspaceId || '', winningSlotId);
      if (res.success) {
        toast({
          title: 'Poll Finalized!',
          description: 'The winning time slot has been confirmed as an active meeting.',
        });
        fetchPolls();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Finalization Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setFinalizingPollId(null);
    }
  };

  const handleCopyLink = (slug: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/book/poll/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: 'Poll link copied to clipboard!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" />
            Meeting Polls
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Find times that work for everyone with 1:many voting and consensus heat maps.
          </p>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          className="rounded-xl min-h-[44px] gap-2 font-semibold shadow-sm active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          Create Meeting Poll
        </Button>
      </div>

      {/* Polls Grid */}
      {polls.length === 0 ? (
        <Card className="rounded-3xl border-dashed p-12 text-center space-y-3">
          <Vote className="h-12 w-12 mx-auto text-primary opacity-30 animate-pulse" />
          <h3 className="text-base font-semibold text-foreground">No meeting polls created yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create your first meeting poll to let multiple participants vote on candidate time slots.
          </p>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-xl min-h-[44px] text-xs gap-2 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Create Your First Poll
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {polls.map(poll => (
            <Card key={poll.id} className="rounded-2xl border shadow-sm flex flex-col justify-between overflow-hidden">
              <div>
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-foreground">{poll.title}</CardTitle>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-bold uppercase ${
                        poll.status === 'open'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : poll.status === 'finalized'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {poll.status}
                    </Badge>
                  </div>
                  {poll.description && (
                    <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                      {poll.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {poll.durationMinutes} mins
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      {poll.totalVotersCount} voter(s)
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <BarChart3 className="h-3.5 w-3.5 text-primary" />
                      {poll.proposedSlots.length} candidate slots
                    </span>
                  </div>

                  {/* Candidate Slots Summary */}
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                      Proposed Slots
                    </Label>
                    <div className="space-y-1.5">
                      {poll.proposedSlots.map(slot => (
                        <div
                          key={slot.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                            poll.winningSlotId === slot.id
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {poll.winningSlotId === slot.id && (
                              <Award className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            )}
                            <span className="font-medium text-foreground">
                              {format(new Date(slot.startAt), 'EEE, MMM d, p')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-600">✓ {slot.votesYes}</span>
                            <span className="text-[10px] font-bold text-amber-600">? {slot.votesMaybe}</span>
                            <span className="text-[10px] font-bold text-rose-600">× {slot.votesNo}</span>

                            {poll.status === 'open' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleFinalize(poll.id, slot.id)}
                                disabled={finalizingPollId === poll.id}
                                className="h-7 text-[10px] px-2 rounded-lg ml-2 active:scale-[0.97]"
                              >
                                {finalizingPollId === poll.id ? 'Booking...' : 'Choose'}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </div>

              {/* Bottom Card Actions */}
              <div className="p-4 bg-muted/20 border-t flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(poll.slug, poll.id)}
                  className="rounded-xl h-9 text-xs gap-1.5 active:scale-[0.97]"
                >
                  {copiedId === poll.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  Share Voting Link
                </Button>

                <Link href={`/book/poll/${poll.slug}`} target="_blank">
                  <Button variant="ghost" size="sm" className="rounded-xl h-9 text-xs gap-1">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Public View
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Poll Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create Meeting Poll</DialogTitle>
            <DialogDescription className="text-xs">
              Propose candidate times and share a single link for everyone to vote.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Meeting Title *</Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Q4 Strategy Alignment"
                className="rounded-xl min-h-[44px] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Description</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief agenda or context for attendees..."
                className="rounded-xl min-h-[70px] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Meeting Duration (minutes)</Label>
              <Input
                type="number"
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
                className="rounded-xl min-h-[44px] text-xs"
              />
            </div>

            {/* Candidate Slots Builder */}
            <div className="pt-2 border-t space-y-3">
              <Label className="font-semibold text-foreground">Add Candidate Time Slots</Label>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Date</Label>
                  <Input
                    type="date"
                    value={slotDate}
                    onChange={e => setSlotDate(e.target.value)}
                    className="rounded-xl text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Start</Label>
                  <Input
                    type="time"
                    value={slotStartTime}
                    onChange={e => setSlotStartTime(e.target.value)}
                    className="rounded-xl text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">End</Label>
                  <Input
                    type="time"
                    value={slotEndTime}
                    onChange={e => setSlotEndTime(e.target.value)}
                    className="rounded-xl text-xs h-9"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleAddSlot}
                className="w-full rounded-xl min-h-[38px] text-xs gap-1.5 active:scale-[0.97]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Slot to Poll
              </Button>

              {proposedSlots.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
                  {proposedSlots.map((slot, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-xl bg-muted/40 border flex items-center justify-between text-xs"
                    >
                      <span>{format(new Date(slot.startAt), 'EEE, MMM d, p')} – {format(new Date(slot.endAt), 'p')}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSlot(i)}
                        className="h-6 w-6 text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePoll}
              disabled={isSubmitting || proposedSlots.length === 0}
              className="rounded-xl min-h-[44px] px-5 active:scale-[0.97]"
            >
              {isSubmitting ? 'Creating...' : 'Create & Share Poll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
