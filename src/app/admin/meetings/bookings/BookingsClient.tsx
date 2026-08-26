'use client';

/**
 * @fileoverview Redesigned Bookings Hub with Multi-View (List, Board, Calendar) & Drawer.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Implements List, Kanban Board (Confirmed, Upcoming, Completed, No-Show), and Calendar views.
 * - Integrates right-side slide-over BookingDetailDrawer for zero-friction inspection.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { PageContainerFluid } from '@/components/ui/page-container';
import { MeetingsNavigation } from '../components/MeetingsNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CalendarCheck,
  Search,
  Download,
  Copy,
  CopyCheck,
  ExternalLink,
  MoreVertical,
  XCircle,
  Clock,
  Video,
  User,
  Mail,
  Phone,
  Calendar,
  Eye,
  Loader2,
  CheckCircle2,
  AlertCircle,
  LayoutList,
  Kanban,
  CalendarDays,
  Plus,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns';
import type { Booking, BookingStatus } from '@/lib/meetings/types';
import { cancelBookingAction } from '@/app/actions/booking-actions';
import { BookingDetailDrawer } from './components/BookingDetailDrawer';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

type ViewMode = 'list' | 'board' | 'calendar';

export default function BookingsClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [viewMode, setViewMode] = React.useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [timeFilter, setTimeFilter] = React.useState<'all' | 'upcoming' | 'past'>('all');
  const [copiedBookingId, setCopiedBookingId] = React.useState<string | null>(null);

  // Selected booking for slide-over drawer
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);

  // Cancel dialog state
  const [cancellingBooking, setCancellingBooking] = React.useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = React.useState('');
  const [isCancelling, setIsCancelling] = React.useState(false);

  // Load Bookings for workspace
  const bookingsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'bookings'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('startAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: bookings, isLoading } = useCollection<Booking>(bookingsQuery);

  // Filter logic
  const now = new Date();
  const filteredBookings = React.useMemo(() => {
    if (!bookings) return [];

    return bookings.filter(booking => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        booking.eventTypeName.toLowerCase().includes(q) ||
        booking.booker.firstName.toLowerCase().includes(q) ||
        booking.booker.lastName.toLowerCase().includes(q) ||
        booking.booker.email.toLowerCase().includes(q) ||
        (booking.booker.phone && booking.booker.phone.includes(q)) ||
        (booking.booker.notes && booking.booker.notes.toLowerCase().includes(q));

      // Status filter
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;

      // Time horizon filter
      const startDate = new Date(booking.startAt);
      const matchesTime =
        timeFilter === 'all' ||
        (timeFilter === 'upcoming' && isAfter(startDate, now)) ||
        (timeFilter === 'past' && isBefore(startDate, now));

      return matchesSearch && matchesStatus && matchesTime;
    });
  }, [bookings, searchQuery, statusFilter, timeFilter, now]);

  // Handle Cancel Booking
  const handleCancelSubmit = async () => {
    if (!cancellingBooking) return;
    setIsCancelling(true);
    try {
      const res = await cancelBookingAction({
        bookingId: cancellingBooking.id,
        reason: cancelReason || 'Host cancelled via dashboard.',
        cancelledBy: 'host',
      });

      if (res.success) {
        toast({
          title: 'Booking Cancelled',
          description: `Booking for ${cancellingBooking.booker.firstName} ${cancellingBooking.booker.lastName} has been cancelled.`,
        });
        setCancellingBooking(null);
        setCancelReason('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Cancellation Failed',
          description: res.error || 'Failed to cancel booking.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: getErrorMessage(err),
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Copy Join Link
  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedBookingId(id);
    toast({ title: 'Link Copied!', description: 'Meeting link copied to clipboard.' });
    setTimeout(() => setCopiedBookingId(null), 2000);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredBookings.length) return;

    const headers = ['Event Type', 'Booker Name', 'Booker Email', 'Booker Phone', 'Start Time', 'End Time', 'Timezone', 'Status', 'Location', 'Notes'];
    const rows = filteredBookings.map(b => [
      `"${b.eventTypeName}"`,
      `"${b.booker.firstName} ${b.booker.lastName}"`,
      `"${b.booker.email}"`,
      `"${b.booker.phone || ''}"`,
      `"${b.startAt}"`,
      `"${b.endAt}"`,
      `"${b.timezone}"`,
      `"${b.status}"`,
      `"${b.locationType}"`,
      `"${b.booker.notes || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bookings_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Helper
  const renderStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-bold capitalize">Confirmed</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs font-bold capitalize">Completed</Badge>;
      case 'rescheduled':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-bold capitalize">Rescheduled</Badge>;
      case 'cancelled':
      case 'declined':
        return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-xs font-bold capitalize">{status}</Badge>;
      case 'no_show':
        return <Badge className="bg-rose-500/15 text-rose-700 border-rose-300 text-xs font-bold capitalize">No Show</Badge>;
      case 'held':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs font-bold capitalize">Held (5m)</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs font-bold capitalize">{status}</Badge>;
    }
  };

  return (
    <PageContainerFluid>
      <MeetingsNavigation />

      <div className="space-y-6 pb-16">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Bookings Hub</h1>
              <Badge variant="outline" className="text-xs font-semibold">
                {filteredBookings.length} {filteredBookings.length === 1 ? 'Booking' : 'Total Bookings'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time schedule of all customer bookings, video conferences, and participant statuses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-muted/60 rounded-2xl border border-border/80">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-xl h-8 text-xs font-bold gap-1 px-3"
              >
                <LayoutList className="w-3.5 h-3.5" /> List
              </Button>
              <Button
                variant={viewMode === 'board' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('board')}
                className="rounded-xl h-8 text-xs font-bold gap-1 px-3"
              >
                <Kanban className="w-3.5 h-3.5" /> Board
              </Button>
              <Link href="/admin/meetings/calendar">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl h-8 text-xs font-bold gap-1 px-3 text-muted-foreground"
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Calendar
                </Button>
              </Link>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filteredBookings.length === 0}
              className="rounded-2xl text-xs font-semibold gap-1.5 min-h-[40px] px-3 active:scale-[0.97]"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Search and Filters Toolbar */}
        <Card className="rounded-2xl border border-border/80 shadow-xs bg-card p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by event type, booker name, email, or notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs min-h-[40px] bg-background"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl text-xs min-h-[40px] w-[140px] bg-background">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeFilter} onValueChange={(val: 'all' | 'upcoming' | 'past') => setTimeFilter(val)}>
                <SelectTrigger className="rounded-xl text-xs min-h-[40px] w-[130px] bg-background">
                  <SelectValue placeholder="All Horizons" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* View Mode 1: List View */}
        {viewMode === 'list' && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : filteredBookings.length === 0 ? (
              <Card className="rounded-3xl border border-border/80 p-12 text-center space-y-3 bg-card/60">
                <div className="w-12 h-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground">No bookings found</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    No scheduled meetings match your current search or filter criteria.
                  </p>
                </div>
              </Card>
            ) : (
              filteredBookings.map(bkg => {
                const startDate = new Date(bkg.startAt);
                const endDate = new Date(bkg.endAt);
                const isCancelled = bkg.status === 'cancelled';
                const isCompleted = bkg.status === 'completed';

                return (
                  <Card
                    key={bkg.id}
                    className="rounded-2xl border border-border/80 shadow-xs bg-card hover:border-primary/40 transition-colors p-4 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Left: Meeting Name + Booker */}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2.5">
                          <h3
                            onClick={() => setSelectedBooking(bkg)}
                            className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer"
                          >
                            {bkg.eventTypeName || 'Scheduled Meeting'}
                          </h3>
                          {renderStatusBadge(bkg.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {bkg.booker.firstName} {bkg.booker.lastName} • <span className="font-mono">{bkg.booker.email}</span>
                        </p>
                      </div>

                      {/* Middle: Schedule Info */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium shrink-0">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          {format(startDate, 'MMM d, yyyy')} • {format(startDate, 'HH:mm')}
                        </span>
                        <span className="flex items-center gap-1.5 capitalize">
                          <Video className="w-3.5 h-3.5 text-primary" />
                          {bkg.locationType.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {bkg.joinUrl && !isCancelled && (
                          <a href={bkg.joinUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" className="rounded-xl h-8 text-xs font-bold gap-1 px-3 active:scale-[0.97]">
                              <Video className="w-3.5 h-3.5" /> Join
                            </Button>
                          </a>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBooking(bkg)}
                          className="rounded-xl h-8 text-xs font-semibold px-3"
                        >
                          View Details
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 text-muted-foreground">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/meetings/${bkg.id}`} className="gap-2">
                                <Sparkles className="w-4 h-4 text-purple-600" /> Meeting Intelligence
                              </Link>
                            </DropdownMenuItem>
                            {bkg.joinUrl && (
                              <DropdownMenuItem onClick={() => handleCopyLink(bkg.joinUrl!, bkg.id)} className="gap-2">
                                <Copy className="w-4 h-4" /> Copy Join Link
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {!isCancelled && !isCompleted && (
                              <DropdownMenuItem
                                onClick={() => setCancellingBooking(bkg)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <XCircle className="w-4 h-4" /> Cancel Booking
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* View Mode 2: Kanban Board View */}
        {viewMode === 'board' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
            {(['confirmed', 'rescheduled', 'completed', 'cancelled'] as BookingStatus[]).map(statusCol => {
              const columnBookings = filteredBookings.filter(b => b.status === statusCol);
              return (
                <div key={statusCol} className="p-4 rounded-3xl bg-muted/30 border border-border/70 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/40">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground capitalize">
                      {statusCol}
                    </h4>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {columnBookings.length}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {columnBookings.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-6">No {statusCol} bookings</p>
                    ) : (
                      columnBookings.map(bkg => (
                        <Card
                          key={bkg.id}
                          onClick={() => setSelectedBooking(bkg)}
                          className="rounded-2xl border border-border/80 p-3.5 space-y-2 bg-card hover:border-primary/40 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
                        >
                          <h5 className="text-xs font-bold text-foreground line-clamp-1">
                            {bkg.eventTypeName}
                          </h5>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {bkg.booker.firstName} {bkg.booker.lastName}
                          </p>
                          <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground border-t border-border/40">
                            <span>{format(new Date(bkg.startAt), 'MMM d, HH:mm')}</span>
                            <span className="capitalize">{bkg.locationType.replace('_', ' ')}</span>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-Over Booking Detail Drawer */}
      <BookingDetailDrawer
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={open => !open && setSelectedBooking(null)}
        onCancel={bkg => {
          setSelectedBooking(null);
          setCancellingBooking(bkg);
        }}
      />

      {/* Cancel Booking Dialog */}
      <Dialog open={!!cancellingBooking} onOpenChange={open => !open && setCancellingBooking(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Cancel Meeting
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to cancel the meeting with{' '}
              <strong>{cancellingBooking?.booker.firstName} {cancellingBooking?.booker.lastName}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Cancellation Reason (optional)</Label>
            <Input
              placeholder="e.g. Host schedule conflict, attendee requested"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="rounded-xl text-xs min-h-[40px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancellingBooking(null)}
              disabled={isCancelling}
              className="rounded-xl min-h-[40px] text-xs font-semibold"
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubmit}
              disabled={isCancelling}
              className="rounded-xl min-h-[40px] text-xs font-bold active:scale-[0.97]"
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainerFluid>
  );
}
