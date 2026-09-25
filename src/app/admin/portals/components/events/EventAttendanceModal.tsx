'use client';

/**
 * {{Org_name}} Experience Platform — Event Attendance & Rosters Studio Modal
 *
 * Backoffice inspector for live webinars and masterclasses.
 * Displays registered members, server-verified attendance duration, join/leave
 * timestamps, manual attendance overrides, and 1-click CSV attendance reports.
 */

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { recordEventAttendanceAction } from '@/app/actions/event-actions';
import type { LiveEvent, EventRegistration, AttendanceStatus } from '@/lib/types/events';
import { getErrorMessage } from '@/lib/errors/report-error';
import {
  Users,
  Clock,
  Download,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Calendar,
} from 'lucide-react';

interface EventAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: LiveEvent | null;
  portalId: string;
  portalSlug: string;
}

export function EventAttendanceModal({
  isOpen,
  onClose,
  event,
  portalId,
  portalSlug,
}: EventAttendanceModalProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [updatingUserId, setUpdatingUserId] = React.useState<string | null>(null);

  // Query registrations for this event
  const registrationsQuery = useMemoFirebase(
    () =>
      firestore && event?.id
        ? query(
            collection(firestore, 'event_registrations'),
            where('eventId', '==', event.id),
            orderBy('registeredAt', 'desc')
          )
        : null,
    [firestore, event?.id]
  );

  const { data: registrations, isLoading } = useCollection<EventRegistration>(registrationsQuery);

  const handleToggleAttendance = async (reg: EventRegistration) => {
    if (!event) return;
    const nextStatus: AttendanceStatus = reg.status === 'attended' ? 'no_show' : 'attended';
    const durationSeconds = nextStatus === 'attended' ? (event.durationMinutes || 60) * 60 : 0;

    setUpdatingUserId(reg.userId);
    try {
      const res = await recordEventAttendanceAction(
        {
          portalId,
          eventId: event.id,
          userId: reg.userId,
          attendedDurationSeconds: durationSeconds,
        },
        portalSlug,
        event.slug
      );

      if (!res.success) throw new Error(res.error);
      toast({
        title: 'Attendance Updated',
        description: `Marked ${reg.userName} as "${nextStatus}".`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Update Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleExportCsv = () => {
    if (!event || !registrations || registrations.length === 0) {
      toast({ title: 'No Data', description: 'No attendee records to export.' });
      return;
    }

    const headers = [
      'User Name',
      'User Email',
      'Status',
      'Duration (Mins)',
      'Registered At',
      'Joined At',
      'Left At',
    ];

    const rows = registrations.map(r => [
      `"${r.userName.replace(/"/g, '""')}"`,
      `"${r.userEmail.replace(/"/g, '""')}"`,
      r.status,
      r.attendedDurationSeconds ? Math.round(r.attendedDurationSeconds / 60) : 0,
      r.registeredAt ? new Date(r.registeredAt).toISOString() : '',
      r.joinedAt ? new Date(r.joinedAt).toISOString() : '',
      r.leftAt ? new Date(r.leftAt).toISOString() : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.slug}-attendance-roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Report Exported! 📊',
      description: `Downloaded attendance list for "${event.title}".`,
    });
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'attended':
        return (
          <Badge className="bg-emerald-500 text-white font-bold text-[10px] gap-1 px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" /> Attended
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-amber-500 text-white font-bold text-[10px] gap-1 px-2 py-0.5">
            <AlertCircle className="w-3 h-3" /> Partial
          </Badge>
        );
      case 'no_show':
        return (
          <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-[10px] font-bold gap-1 px-2 py-0.5">
            <XCircle className="w-3 h-3" /> No Show
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground border-border text-[10px] font-bold gap-1 px-2 py-0.5">
            <Calendar className="w-3 h-3" /> Registered
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl p-6 rounded-3xl border-2 border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 border-b border-border pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <DialogTitle className="font-extrabold text-xl text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Session Attendance Sheet
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {event?.title || 'Live Session'} • {event?.durationMinutes || 60}m Scheduled
              </DialogDescription>
            </div>

            <Button
              onClick={handleExportCsv}
              variant="outline"
              size="sm"
              disabled={!registrations || registrations.length === 0}
              className="min-h-[44px] rounded-xl font-bold text-xs gap-2 active:scale-[0.97]"
            >
              <Download className="w-3.5 h-3.5 text-primary" /> Export CSV Roster
            </Button>
          </div>
        </DialogHeader>

        {/* Attendance Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-muted/40 rounded-2xl border border-border space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total RSVPs</span>
            <p className="font-black text-xl text-foreground">{registrations?.length || 0}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Attended</span>
            <p className="font-black text-xl text-emerald-600 dark:text-emerald-400">
              {registrations?.filter(r => r.status === 'attended').length || 0}
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Partial</span>
            <p className="font-black text-xl text-amber-600 dark:text-amber-400">
              {registrations?.filter(r => r.status === 'partial').length || 0}
            </p>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">No Shows</span>
            <p className="font-black text-xl text-rose-600 dark:text-rose-400">
              {registrations?.filter(r => r.status === 'no_show').length || 0}
            </p>
          </div>
        </div>

        {/* Attendee Table */}
        <div className="pt-2">
          {isLoading ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : !registrations || registrations.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10 space-y-2">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/60" />
              <h4 className="font-bold text-sm text-foreground">No Registered Attendees Yet</h4>
              <p className="text-xs text-muted-foreground">
                Members will appear here automatically when they RSVP on the portal.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Learner</TableHead>
                    <TableHead className="font-bold text-xs">Status</TableHead>
                    <TableHead className="font-bold text-xs">Time Attended</TableHead>
                    <TableHead className="font-bold text-xs">Joined</TableHead>
                    <TableHead className="font-bold text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map(reg => {
                    const isUpdating = updatingUserId === reg.userId;
                    const durationMins = reg.attendedDurationSeconds
                      ? Math.round(reg.attendedDurationSeconds / 60)
                      : 0;

                    return (
                      <TableRow key={reg.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-8 h-8 border border-border">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                {reg.userName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-0.5">
                              <p className="font-bold text-xs text-foreground">{reg.userName}</p>
                              <p className="text-[10px] text-muted-foreground">{reg.userEmail}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(reg.status)}</TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-primary" /> {durationMins}m
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {reg.joinedAt
                              ? new Date(reg.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Not recorded'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleToggleAttendance(reg)}
                            className="min-h-[40px] text-xs font-semibold rounded-xl text-primary hover:bg-primary/10 active:scale-[0.97]"
                          >
                            {isUpdating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : reg.status === 'attended' ? (
                              'Mark No-Show'
                            ) : (
                              'Mark Attended'
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
