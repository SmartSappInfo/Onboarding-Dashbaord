'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Video,
  Copy,
  Check,
  ExternalLink,
  Play,
  Clock,
  Radio,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  UserCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import {
  getOfficeHoursRoomAction,
  updateHostOfficeHoursStatusAction,
  admitNextVisitorAction,
} from '@/app/actions/office-hours-actions';
import type {
  OfficeHoursRoom,
  OfficeHoursQueueEntry,
  OfficeHoursStatus,
} from '@/lib/meetings/types/polls';
import { format } from 'date-fns';
import Link from 'next/link';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function OfficeHoursClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const [room, setRoom] = React.useState<OfficeHoursRoom | null>(null);
  const [queue, setQueue] = React.useState<OfficeHoursQueueEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);
  const [admittingId, setAdmittingId] = React.useState<string | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);

  const fetchRoomData = React.useCallback(async () => {
    if (!activeWorkspaceId || !user?.uid) return;
    try {
      const res = await getOfficeHoursRoomAction(
        activeWorkspaceId,
        user.uid,
        user.displayName || user.email || 'Host'
      );
      if (res.success && res.room) {
        setRoom(res.room);
        setQueue(res.queue || []);
      }
    } catch (err) {
      console.warn('[fetchRoomData]', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, user]);

  React.useEffect(() => {
    fetchRoomData();
    const interval = setInterval(fetchRoomData, 5000); // 5s poll for live queue
    return () => clearInterval(interval);
  }, [fetchRoomData]);

  const handleToggleStatus = async (newStatus: OfficeHoursStatus) => {
    if (!room || !activeWorkspaceId) return;
    setIsTogglingStatus(true);
    try {
      const res = await updateHostOfficeHoursStatusAction(room.id, activeWorkspaceId, newStatus);
      if (res.success) {
        setRoom(prev => (prev ? { ...prev, status: newStatus } : null));
        toast({
          title: `Status set to ${newStatus.toUpperCase()}`,
          description:
            newStatus === 'available'
              ? 'Visitors can now enter your waiting room.'
              : 'Visitors will be shown as offline.',
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Status Update Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleAdmit = async (entry: OfficeHoursQueueEntry) => {
    if (!room || !activeWorkspaceId) return;
    setAdmittingId(entry.id);
    try {
      const res = await admitNextVisitorAction(room.id, activeWorkspaceId, entry.id);
      if (res.success) {
        toast({
          title: `Admitted ${entry.visitorName}`,
          description: 'Visitor is being redirected to your video room.',
        });
        // Open video room in new tab if available
        if (res.joinUrl) {
          window.open(res.joinUrl, '_blank');
        }
        fetchRoomData();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Admission Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setAdmittingId(null);
    }
  };

  const handleCopyLink = () => {
    if (!room) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/book/drop-in/${room.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast({ title: 'Drop-in link copied to clipboard!' });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const waitingVisitors = queue.filter(q => q.status === 'waiting');

  return (
    <div className="space-y-6">
      {/* Top Banner with Live Status Toggle */}
      <Card className="rounded-3xl border shadow-sm overflow-hidden bg-gradient-to-r from-primary/5 via-muted/30 to-transparent">
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {room?.status === 'available' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    room?.status === 'available'
                      ? 'bg-emerald-500'
                      : room?.status === 'busy'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
              </span>
              <h2 className="text-lg font-bold text-foreground">{room?.title || 'Drop-In Office Hours'}</h2>
              <Badge
                variant="secondary"
                className={`text-[10px] uppercase font-bold ${
                  room?.status === 'available'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : room?.status === 'busy'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {room?.status || 'offline'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Instant drop-in consultations. Toggle your status when ready to receive live visitors.
            </p>
          </div>

          {/* Status Controls */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={room?.status === 'available' ? 'default' : 'outline'}
              onClick={() => handleToggleStatus('available')}
              disabled={isTogglingStatus}
              className={`rounded-xl text-xs min-h-[40px] gap-1.5 active:scale-[0.97] ${
                room?.status === 'available' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              Available
            </Button>
            <Button
              size="sm"
              variant={room?.status === 'busy' ? 'default' : 'outline'}
              onClick={() => handleToggleStatus('busy')}
              disabled={isTogglingStatus}
              className={`rounded-xl text-xs min-h-[40px] gap-1.5 active:scale-[0.97] ${
                room?.status === 'busy' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Busy
            </Button>
            <Button
              size="sm"
              variant={room?.status === 'offline' ? 'default' : 'outline'}
              onClick={() => handleToggleStatus('offline')}
              disabled={isTogglingStatus}
              className="rounded-xl text-xs min-h-[40px] gap-1.5 active:scale-[0.97]"
            >
              Offline
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Live Queue + Room Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Waiting Room Queue */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Live Waiting Queue ({waitingVisitors.length})
                </CardTitle>
              </div>
              <span className="text-xs text-muted-foreground">Auto-updates every 5s</span>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              {waitingVisitors.length === 0 ? (
                <div className="text-center py-10 space-y-2 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-sm font-medium text-foreground">Waiting room is currently empty</p>
                  <p className="text-xs">
                    Share your public drop-in link below to invite visitors to line up.
                  </p>
                </div>
              ) : (
                waitingVisitors.map(entry => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                        #{entry.position}
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground">{entry.visitorName}</h4>
                        <p className="text-[11px] text-muted-foreground">{entry.visitorEmail}</p>
                        {entry.topic && (
                          <p className="text-xs text-primary font-medium italic pt-0.5">
                            "{entry.topic}"
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          Joined {format(new Date(entry.joinedQueueAt), 'p')}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleAdmit(entry)}
                      disabled={admittingId === entry.id}
                      className="rounded-xl min-h-[40px] text-xs gap-1.5 px-4 font-semibold shadow-sm active:scale-[0.97]"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {admittingId === entry.id ? 'Admitting...' : 'Admit to Call'}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Public Link & Conference Setup */}
        <div className="space-y-6">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                Drop-In Access Link
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase">Public Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/book/drop-in/${room?.slug}`
                        : `/book/drop-in/${room?.slug}`
                    }
                    className="rounded-xl font-mono text-[11px] h-9"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="h-9 w-9 rounded-xl shrink-0"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t space-y-2 text-muted-foreground">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Max Queue: <strong>{room?.maxQueueSize || 10} visitors</strong>
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Provider: <strong>{room?.conferenceProvider || 'Google Meet'}</strong>
                </p>
              </div>

              {room?.slug && (
                <Link href={`/book/drop-in/${room.slug}`} target="_blank">
                  <Button variant="secondary" className="w-full rounded-xl min-h-[40px] text-xs gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Preview Waiting Room
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
