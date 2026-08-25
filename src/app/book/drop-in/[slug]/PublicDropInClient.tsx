'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Users,
  Video,
  Clock,
  Radio,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogIn,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  joinOfficeHoursQueueAction,
  pingQueueHeartbeatAction,
  leaveOfficeHoursQueueAction,
} from '@/app/actions/office-hours-actions';
import type { OfficeHoursRoom, OfficeHoursQueueEntry } from '@/lib/meetings/types/polls';
import { estimateWaitTimeMinutes } from '@/lib/meetings/queue-state-service';

interface PublicDropInClientProps {
  room: OfficeHoursRoom;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function PublicDropInClient({ room }: PublicDropInClientProps) {
  const { toast } = useToast();

  const [visitorName, setVisitorName] = React.useState('');
  const [visitorEmail, setVoterEmail] = React.useState('');
  const [visitorPhone, setVisitorPhone] = React.useState('');
  const [topic, setTopic] = React.useState('');

  const [isJoining, setIsJoining] = React.useState(false);
  const [queueEntryId, setQueueEntryId] = React.useState<string | null>(null);
  const [position, setPosition] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<OfficeHoursQueueEntry['status'] | null>(null);
  const [admittedJoinUrl, setAdmittedJoinUrl] = React.useState<string | null>(null);

  // Heartbeat ping interval when inside queue
  React.useEffect(() => {
    if (!queueEntryId || status === 'completed' || status === 'abandoned') return;

    const interval = setInterval(async () => {
      try {
        const res = await pingQueueHeartbeatAction(queueEntryId);
        if (res.success) {
          if (res.status) setStatus(res.status);
          if (res.position !== undefined) setPosition(res.position);
          if (res.status === 'admitted' && res.joinUrl) {
            setAdmittedJoinUrl(res.joinUrl);
            toast({
              title: "You're admitted!",
              description: 'Redirecting to your video consultation now...',
            });
            // Auto redirect
            window.location.href = res.joinUrl;
          }
        }
      } catch (err) {
        console.warn('[heartbeat error]', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [queueEntryId, status, toast]);

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!visitorName.trim() || !visitorEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name & Email required',
        description: 'Please provide your name and email to line up in the waiting room.',
      });
      return;
    }

    setIsJoining(true);
    try {
      const res = await joinOfficeHoursQueueAction({
        slug: room.slug,
        visitorName: visitorName.trim(),
        visitorEmail: visitorEmail.trim(),
        visitorPhone: visitorPhone.trim() || undefined,
        topic: topic.trim() || undefined,
      });

      if (res.success && res.queueEntryId) {
        setQueueEntryId(res.queueEntryId);
        setPosition(res.position || 1);
        setStatus('waiting');
        toast({
          title: "You're in line!",
          description: `You are currently #${res.position} in the queue.`,
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Queue Join Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!queueEntryId) return;
    try {
      await leaveOfficeHoursQueueAction(queueEntryId);
      setQueueEntryId(null);
      setPosition(null);
      setStatus(null);
      toast({ title: 'You left the waiting room.' });
    } catch (err) {
      console.warn('[leave queue]', err);
    }
  };

  const estimatedWait = estimateWaitTimeMinutes(position || 1, room.averageCallDurationMinutes || 15);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto w-full space-y-6">
        {/* Host Banner */}
        <Card className="rounded-3xl border shadow-sm overflow-hidden">
          <CardHeader className="p-6 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  {room.status === 'available' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      room.status === 'available'
                        ? 'bg-emerald-500'
                        : room.status === 'busy'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />
                </span>
                <div>
                  <CardTitle className="text-base font-bold">{room.title}</CardTitle>
                  <CardDescription className="text-xs">
                    Hosted by <strong>{room.hostName}</strong>
                  </CardDescription>
                </div>
              </div>

              <Badge
                variant="secondary"
                className={`text-[10px] uppercase font-bold ${
                  room.status === 'available'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : room.status === 'busy'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {room.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {room.status === 'offline' ? (
              <div className="text-center py-8 space-y-3">
                <Clock className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                <h3 className="text-sm font-bold text-foreground">Host is currently offline</h3>
                <p className="text-xs text-muted-foreground">
                  {room.hostName}'s drop-in office hours are closed right now. Please check back during open hours.
                </p>
              </div>
            ) : status === 'waiting' ? (
              /* Waiting in Line Screen */
              <div className="text-center py-6 space-y-5">
                <div className="relative inline-flex">
                  <div className="h-20 w-20 rounded-3xl bg-primary/10 text-primary font-extrabold text-3xl flex items-center justify-center mx-auto shadow-inner">
                    #{position}
                  </div>
                  <span className="animate-ping absolute top-0 right-0 h-4 w-4 rounded-full bg-primary opacity-75" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">You are in the waiting room!</h3>
                  <p className="text-xs text-muted-foreground">
                    {position === 1
                      ? "You're next in line! Stay on this screen; you'll be admitted in a moment."
                      : `There are ${Number(position) - 1} visitor(s) ahead of you.`}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/40 border text-xs space-y-2 text-left">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Est. Wait Time:</span>
                    <strong className="text-foreground">
                      {estimatedWait === 0 ? '< 2 minutes' : `~${estimatedWait} mins`}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Visitor:</span>
                    <strong className="text-foreground">{visitorName}</strong>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Connection:</span>
                    <span className="flex items-center gap-1.5 text-emerald-600 font-semibold text-[11px]">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live Heartbeat Active
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLeaveQueue}
                  className="rounded-xl text-xs gap-1.5 text-rose-600 hover:text-rose-700 min-h-[40px] active:scale-[0.97]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Leave Waiting Room
                </Button>
              </div>
            ) : status === 'admitted' && admittedJoinUrl ? (
              /* Admitted Screen */
              <div className="text-center py-6 space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-base font-bold text-foreground">You've been admitted!</h3>
                <p className="text-xs text-muted-foreground">
                  Click the button below if your browser did not automatically open the meeting room.
                </p>
                <a href={admittedJoinUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full rounded-2xl min-h-[48px] text-sm font-bold gap-2 active:scale-[0.97]">
                    <Video className="h-4 w-4" />
                    Enter Meeting Now
                  </Button>
                </a>
              </div>
            ) : (
              /* Join Waiting Room Form */
              <form onSubmit={handleJoinQueue} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Your Name *</Label>
                  <Input
                    required
                    value={visitorName}
                    onChange={e => setVisitorName(e.target.value)}
                    placeholder="Jane Doe"
                    className="rounded-xl min-h-[44px] text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Your Email *</Label>
                  <Input
                    type="email"
                    required
                    value={visitorEmail}
                    onChange={e => setVoterEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="rounded-xl min-h-[44px] text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Topic / Question (Optional)</Label>
                  <Textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Briefly describe what you'd like to discuss..."
                    className="rounded-xl min-h-[60px] text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isJoining}
                  className="w-full rounded-2xl min-h-[48px] text-sm font-bold gap-2 shadow-sm active:scale-[0.97]"
                >
                  <LogIn className="h-4 w-4" />
                  {isJoining ? 'Joining Line...' : 'Join Waiting Room'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
