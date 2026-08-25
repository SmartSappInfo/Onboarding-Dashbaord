'use client';

/**
 * @fileoverview Bookings Dashboard Client Component (Meetings 2.0).
 * Displays a centralized table of all customer bookings across the workspace,
 * with real-time status updates, CSV export, cancellation, and attendee detail inspection.
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
} from 'lucide-react';
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns';
import type { Booking, BookingStatus } from '@/lib/meetings/types';
import { cancelBookingAction } from '@/app/actions/booking-actions';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export default function BookingsClient() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [timeFilter, setTimeFilter] = React.useState<'all' | 'upcoming' | 'past'>('all');
  const [copiedBookingId, setCopiedBookingId] = React.useState<string | null>(null);

  // Selected booking for detail modal
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

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

  // Filter Bookings
  const filteredBookings = React.useMemo(() => {
    if (!bookings) return [];
    const now = new Date();

    return bookings.filter(b => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const bookerName = `${b.booker?.firstName || ''} ${b.booker?.lastName || ''}`.toLowerCase();
        const bookerEmail = (b.booker?.email || '').toLowerCase();
        const eventName = (b.eventTypeName || '').toLowerCase();
        if (!bookerName.includes(q) && !bookerEmail.includes(q) && !eventName.includes(q)) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && b.status !== statusFilter) {
        return false;
      }

      // 3. Time Filter
      if (timeFilter === 'upcoming' && isBefore(new Date(b.startAt), now)) {
        return false;
      }
      if (timeFilter === 'past' && isAfter(new Date(b.startAt), now)) {
        return false;
      }

      return true;
    });
  }, [bookings, searchQuery, statusFilter, timeFilter]);

  // Copy Meeting Join Link
  const handleCopyJoinLink = (joinUrl: string, id: string) => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedBookingId(id);
    toast({ title: 'Link Copied', description: 'Join URL saved to clipboard.' });
    setTimeout(() => setCopiedBookingId(null), 2000);
  };

  // Trigger Cancel
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setIsCancelling(true);
    try {
      const res = await cancelBookingAction({
        bookingId: cancellingBooking.id,
        reason: cancelReason.trim() || 'Cancelled by admin',
      });

      if (res.success) {
        toast({ title: 'Booking Cancelled', description: 'The booking and session have been cancelled.' });
        setCancellingBooking(null);
        setCancelReason('');
      } else {
        toast({ variant: 'destructive', title: 'Cancellation Failed', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setIsCancelling(false);
    }
  };

  // Export Bookings to CSV
  const handleExportCSV = () => {
    if (!filteredBookings.length) {
      toast({ variant: 'destructive', title: 'No Bookings to Export' });
      return;
    }

    const headers = ['Booking ID', 'Event Name', 'Attendee Name', 'Email', 'Phone', 'Start Date/Time', 'Timezone', 'Status', 'Join Link', 'Notes'];
    const rows = filteredBookings.map(b => [
      b.id,
      `"${(b.eventTypeName || '').replace(/"/g, '""')}"`,
      `"${(`${b.booker?.firstName || ''} ${b.booker?.lastName || ''}`).trim().replace(/"/g, '""')}"`,
      b.booker?.email || '',
      b.booker?.phone || '',
      b.startAt,
      b.timezone || '',
      b.status,
      b.joinUrl || '',
      `"${(b.booker?.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bookings-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: 'CSV Exported', description: `Exported ${filteredBookings.length} bookings.` });
  };

  // Render Status Badge
  const renderStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20 text-xs">Confirmed</Badge>;
      case 'rescheduled':
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20 text-xs">Rescheduled</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="text-xs">Cancelled</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="text-xs">Completed</Badge>;
      case 'no_show':
        return <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">No Show</Badge>;
      default:
        return <Badge variant="outline" className="capitalize text-xs">{status}</Badge>;
    }
  };

  return (
    <PageContainerFluid>
      {/* Shared Navigation Tab Bar */}
      <MeetingsNavigation
        actions={
          <Button
            onClick={handleExportCSV}
            variant="outline"
            disabled={!filteredBookings.length}
            className="rounded-xl min-h-[44px] gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        }
      />

      <div className="space-y-6 max-w-7xl">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor, inspect, and manage all attendee appointment reservations.
          </p>
        </div>

        {/* Filters Bar */}
        <Card className="rounded-2xl border-border shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search attendee, email, or event..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl min-h-[44px]"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl min-h-[44px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rescheduled">Rescheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>

            <Select value={timeFilter} onValueChange={(v: 'all' | 'upcoming' | 'past') => setTimeFilter(v)}>
              <SelectTrigger className="rounded-xl min-h-[44px]">
                <SelectValue placeholder="All Dates" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="upcoming">Upcoming Sessions</SelectItem>
                <SelectItem value="past">Past Sessions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Bookings Table */}
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <CalendarCheck className="w-10 h-10 text-muted-foreground mx-auto" />
              <h3 className="text-base font-semibold">No Bookings Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all' || timeFilter !== 'all'
                  ? 'No reservations match your current filter settings.'
                  : 'Customer reservations will appear here once attendees book via your public links.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold">Attendee</TableHead>
                  <TableHead className="font-semibold">Event Type</TableHead>
                  <TableHead className="font-semibold">Date & Time</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Location</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map(booking => {
                  const isCopied = copiedBookingId === booking.id;
                  const startDate = new Date(booking.startAt);

                  return (
                    <TableRow key={booking.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="font-semibold text-sm">
                            {booking.booker?.firstName} {booking.booker?.lastName}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {booking.booker?.email && <span>{booking.booker.email}</span>}
                            {booking.booker?.phone && <span>• {booking.booker.phone}</span>}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-sm font-medium">{booking.eventTypeName}</span>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium">
                            {format(startDate, 'MMM d, yyyy • h:mm a')}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(startDate, { addSuffix: true })}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>{renderStatusBadge(booking.status)}</TableCell>

                      <TableCell>
                        {booking.joinUrl ? (
                          <a
                            href={booking.joinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Join Call
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground capitalize">
                            {booking.locationType?.replace('_', ' ') || 'Online'}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="View Booking Details"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setIsDetailOpen(true);
                            }}
                            className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {booking.joinUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Copy Join Link"
                              onClick={() => handleCopyJoinLink(booking.joinUrl!, booking.id)}
                              className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              {isCopied ? (
                                <CopyCheck className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedBooking(booking);
                                  setIsDetailOpen(true);
                                }}
                                className="gap-2"
                              >
                                <Eye className="w-4 h-4" /> View Full Details
                              </DropdownMenuItem>
                              {booking.status !== 'cancelled' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setCancellingBooking(booking)}
                                    className="gap-2 text-destructive focus:text-destructive"
                                  >
                                    <XCircle className="w-4 h-4" /> Cancel Booking
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Booking Details Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
            <DialogDescription>
              Full reservation metadata and attendee form responses.
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4 py-2 text-sm">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base">{selectedBooking.eventTypeName}</span>
                  {renderStatusBadge(selectedBooking.status)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedBooking.startAt), 'EEEE, MMMM d, yyyy • h:mm a')} (
                  {selectedBooking.timezone})
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  Attendee Information
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {selectedBooking.booker?.firstName} {selectedBooking.booker?.lastName}
                    </span>
                  </div>
                  {selectedBooking.booker?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedBooking.booker.email}</span>
                    </div>
                  )}
                  {selectedBooking.booker?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedBooking.booker.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedBooking.booker?.notes && (
                <div className="space-y-1">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    Attendee Notes
                  </h4>
                  <p className="p-2.5 rounded-xl bg-card border border-border text-xs">
                    {selectedBooking.booker.notes}
                  </p>
                </div>
              )}

              {selectedBooking.booker?.customResponses &&
                Object.keys(selectedBooking.booker.customResponses).length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      Custom Form Responses
                    </h4>
                    <div className="space-y-1">
                      {Object.entries(selectedBooking.booker.customResponses).map(([k, v]) => (
                        <div key={k} className="p-2.5 rounded-xl bg-card border border-border text-xs">
                          <span className="font-semibold capitalize text-muted-foreground block">
                            {k.replace(/_/g, ' ')}
                          </span>
                          <span className="mt-0.5 block">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {selectedBooking.joinUrl && (
                <div className="space-y-1 pt-2">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    Meeting Join Link
                  </h4>
                  <a
                    href={selectedBooking.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline break-all block"
                  >
                    {selectedBooking.joinUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDetailOpen(false)}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Dialog */}
      <Dialog open={!!cancellingBooking} onOpenChange={open => !open && setCancellingBooking(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Booking?</DialogTitle>
            <DialogDescription>
              This will cancel the reservation for{' '}
              <strong>
                {cancellingBooking?.booker?.firstName} {cancellingBooking?.booker?.lastName}
              </strong>{' '}
              and release the time slot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason" className="text-sm font-semibold">
              Cancellation Reason (Optional)
            </Label>
            <Input
              id="cancel-reason"
              placeholder="e.g. Host unavailable, reschedule requested"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="rounded-xl min-h-[44px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancellingBooking(null)}
              className="rounded-xl"
            >
              Keep Booking
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isCancelling}
              onClick={handleConfirmCancel}
              className="rounded-xl gap-2"
            >
              {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainerFluid>
  );
}
