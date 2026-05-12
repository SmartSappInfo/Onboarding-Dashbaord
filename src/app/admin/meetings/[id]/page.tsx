'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Meeting, ScheduledMessage } from '@/lib/types';
import { REMINDER_OFFSETS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Clock, 
  Video, 
  Edit, 
  ExternalLink, 
  Users,
  Bell,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);

  const { data: meeting, isLoading: isLoadingMeeting } = useDoc<Meeting>(meetingDocRef);

  // Task 12.5: Query scheduled reminders for this meeting
  const remindersQuery = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return query(
      collection(firestore, 'scheduled_messages'),
      where('sourceEventId', '==', meetingId),
      where('sourceEventType', '==', 'meeting'),
      orderBy('scheduledAt', 'asc')
    );
  }, [firestore, meetingId]);

  const { data: reminders, isLoading: isLoadingReminders } = useCollection<ScheduledMessage>(remindersQuery);

  const getReminderLabel = (reminderType: string) => {
    const labels: Record<string, string> = {
      'meeting_reminder_15min': '15 minutes before',
      'meeting_reminder_1hour': '1 hour before',
      'meeting_reminder_2hours': '2 hours before',
      'meeting_reminder_1day': '1 day before',
      'meeting_time_up': 'At meeting time',
    };
    return labels[reminderType] || reminderType;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; label: string }> = {
      pending: { variant: 'outline', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
      sent: { variant: 'default', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Sent' },
      failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3" />, label: 'Failed' },
      cancelled: { variant: 'secondary', icon: <AlertCircle className="h-3 w-3" />, label: 'Cancelled' },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="gap-1.5">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  if (isLoadingMeeting) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <Skeleton className="h-12 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Meeting not found</h2>
          <Button onClick={() => router.push('/admin/meetings')}>Back to Meetings</Button>
        </div>
      </div>
    );
  }

  const publicUrl = `/meetings/${meeting.type.slug}/${meeting.meetingSlug || meeting.entitySlug}`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground leading-none mb-1">
              {meeting.entityName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {meeting.type.name} • {format(new Date(meeting.meetingTime), 'PPP p')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="rounded-full gap-2">
              <Link href={publicUrl} target="_blank">
                <ExternalLink className="h-4 w-4" /> View Public Page
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-full gap-2">
              <Link href={`/admin/meetings/${meetingId}/edit`}>
                <Edit className="h-4 w-4" /> Edit
              </Link>
            </Button>
          </div>
        </div>

        {/* Meeting Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Meeting Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Date & Time</p>
                    <p className="text-sm font-medium">{format(new Date(meeting.meetingTime), 'PPP p')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Type</p>
                    <Badge variant="outline">{meeting.type.name}</Badge>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Meeting Link</p>
                  <a 
                    href={meeting.meetingLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-2"
                  >
                    <Video className="h-4 w-4" />
                    {meeting.meetingLink}
                  </a>
                </div>

                {meeting.registrationEnabled && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Registration</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="gap-1.5">
                          <Users className="h-3 w-3" />
                          Enabled
                        </Badge>
                        {meeting.capacityLimit && meeting.capacityLimit > 0 && (
                          <span className="text-sm text-muted-foreground">
                            Capacity: {meeting.capacityLimit}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Task 12.5: Scheduled Reminders Display */}
            {meeting.enabledReminders && meeting.enabledReminders.length > 0 && (
              <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    <Bell className="h-5 w-5 text-blue-600" />
                    Scheduled Reminders
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Automatic reminders configured for this meeting
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {isLoadingReminders ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : reminders && reminders.length > 0 ? (
                    <div className="space-y-3">
                      {reminders.map((reminder) => (
                        <div 
                          key={reminder.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <p className="text-sm font-semibold">
                                {getReminderLabel(reminder.reminderType || '')}
                              </p>
                              {getStatusBadge(reminder.status)}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Scheduled: {format(new Date(reminder.scheduledAt), 'PPp')}
                              </span>
                              {reminder.sentAt && (
                                <span className="flex items-center gap-1">
                                  <Send className="h-3 w-3" />
                                  Sent: {format(new Date(reminder.sentAt), 'PPp')}
                                </span>
                              )}
                            </div>
                            {reminder.error && (
                              <p className="text-xs text-destructive mt-1">Error: {reminder.error}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="ml-4">
                            {reminder.channel}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">No reminders scheduled yet</p>
                      <p className="text-xs">Reminders will appear here once they are created</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {meeting.heroImageUrl && (
              <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
                <img 
                  src={meeting.heroImageUrl} 
                  alt="Meeting hero" 
                  className="w-full h-48 object-cover"
                />
              </Card>
            )}

            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-semibold tracking-tight">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <Link href={`/admin/meetings/${meetingId}/registrants`}>
                    <Users className="h-4 w-4 mr-2" />
                    View Registrants
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <Link href={`/admin/meetings/${meetingId}/results`}>
                    <Users className="h-4 w-4 mr-2" />
                    View Results
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
