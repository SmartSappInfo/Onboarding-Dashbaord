'use client';

/**
 * @fileoverview Self-Service Booking Cancellation Portal (Meetings 2.0).
 * Allows an attendee to cancel their booking with an optional reason,
 * updating the booking status and freeing up the schedule slot.
 */

import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  XCircle,
  Calendar,
  Clock,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cancelBookingAction } from '@/app/actions/booking-actions';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export default function CancelBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const slug = params.slug as string;
  const bookingId = params.bookingId as string;
  const manageToken = searchParams.get('token') || '';

  const [reason, setReason] = React.useState('');
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isCancelled, setIsCancelled] = React.useState(false);

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCancelling(true);

    try {
      const res = await cancelBookingAction({
        bookingId,
        manageToken,
        reason: reason.trim() || 'Cancelled by attendee',
      });

      if (res.success) {
        setIsCancelled(true);
        toast({ title: 'Booking Cancelled', description: 'Your reservation has been cancelled.' });
      } else {
        toast({ variant: 'destructive', title: 'Cancellation Failed', description: res.error });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 sm:p-6 lg:p-12">
      <Card className="w-full max-w-lg rounded-3xl border border-border shadow-xl overflow-hidden bg-card text-center">
        {isCancelled ? (
          <CardContent className="p-8 space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Session Cancelled</h1>
              <p className="text-xs text-muted-foreground">
                Your reservation has been cancelled and the time slot released.
              </p>
            </div>

            <div className="pt-4">
              <Link href={`/book/${slug}`}>
                <Button className="rounded-xl min-h-[44px] px-6 font-semibold">
                  Book Another Session
                </Button>
              </Link>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleCancel}>
            <CardHeader className="p-8 pb-4 border-b border-border bg-destructive/5 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                <XCircle className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl font-bold">Cancel Your Booking?</CardTitle>
              <CardDescription className="text-xs">
                Are you sure you want to cancel your session? This cannot be undone.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-6 text-left">
              <div className="space-y-2">
                <Label htmlFor="cancel-reason" className="text-xs font-semibold">
                  Reason for Cancellation (Optional)
                </Label>
                <Input
                  id="cancel-reason"
                  placeholder="e.g. Schedule conflict, no longer needed"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="rounded-xl min-h-[44px]"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Link
                  href={`/book/${slug}/confirmed?bookingId=${bookingId}${manageToken ? `&token=${manageToken}` : ''}`}
                >
                  <Button type="button" variant="outline" className="rounded-xl min-h-[44px]">
                    Keep Booking
                  </Button>
                </Link>

                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isCancelling}
                  className="rounded-xl min-h-[44px] px-6 font-semibold gap-2 shadow-sm"
                >
                  {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Confirm Cancellation
                </Button>
              </div>
            </CardContent>
          </form>
        )}
      </Card>
    </div>
  );
}
