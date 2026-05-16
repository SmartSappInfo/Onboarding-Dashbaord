'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { endMeetingAction } from '@/app/actions/meeting-post-event-action';
import type { Meeting, ScheduledMessage, QRCode, MeetingFacilitator } from '@/lib/types';
import { resendFacilitatorLinksAction } from '@/app/actions/meeting-facilitator-actions';
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
  Send,
  Flag,
  QrCode,
  Download,
  CopyCheck,
  Copy,
  BarChart3,
  Link as LinkIcon
} from 'lucide-react';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';

const CreateQRButton = dynamic(() => import('@/components/qr-studio/create-qr-button'), {
  loading: () => <Skeleton className="h-10 w-full rounded-xl" />
});

const QRPreview = dynamic(() => import('@/app/admin/qr-studio/components/qr-preview'), {
  loading: () => <Skeleton className="h-[160px] w-[160px] rounded-xl mx-auto" />
});
import { cn } from '@/lib/utils';

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;
  const firestore = useFirestore();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();
  const [isEnding, startTransition] = React.useTransition();
  const [copiedLink, setCopiedLink] = React.useState<'short' | 'long' | string | null>(null);
  const [isSendingLinks, setIsSendingLinks] = React.useState(false);

  const handleCopy = (text: string, type: 'short' | 'long' | string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(type);
    toast({ title: "Link Copied!", description: "Saved to clipboard." });
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleBatchResendLinks = async (facilitators: MeetingFacilitator[]) => {
    if (!meeting) return;
    setIsSendingLinks(true);
    try {
      const result = await resendFacilitatorLinksAction(meeting.id, meeting.entityName || 'Meeting', facilitators, activeWorkspaceId || 'onboarding');
      if (result.success) {
        toast({ title: 'Emails Sent', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error sending emails', description: result.message });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSendingLinks(false);
    }
  };

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

  // Parallel Query for QR Codes
  const qrQuery = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return query(
      collection(firestore, 'qrcodes'),
      where('destination.resourceId', '==', meetingId),
      where('type', '==', 'meeting'),
      limit(1)
    );
  }, [firestore, meetingId]);

  const { data: qrCodes, isLoading: isLoadingQR } = useCollection<QRCode>(qrQuery);
  const qrCode = qrCodes && qrCodes.length > 0 ? qrCodes[0] : null;

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

  const handleEndMeeting = () => {
    if (!meeting || meeting.status === 'ended') return;
    
    if (window.confirm('Are you sure you want to end this meeting? This will schedule all post-event follow-up messages.')) {
      startTransition(async () => {
        try {
          const result = await endMeetingAction(meeting.id, activeOrganizationId);
          if (result.success) {
            toast({
              title: 'Meeting Ended',
              description: 'The meeting has been marked as ended and follow-up messages are scheduled.',
            });
          } else {
            throw new Error(result.error);
          }
        } catch (error: any) {
          toast({
            variant: 'destructive',
            title: 'Failed to end meeting',
            description: error.message || 'An unknown error occurred.',
          });
        }
      });
    }
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
            {(isLoadingReminders || (reminders && reminders.length > 0)) && (
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

            {/* Distribution & Access */}
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  Distribution & Access
                </CardTitle>
                <CardDescription className="text-xs">
                  Share this meeting using links or QR code.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 space-y-4">
                  {/* Long Link */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Public Link</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 overflow-hidden bg-muted/40 border border-border/60 rounded-xl px-3 py-2 flex items-center">
                        <span className="truncate text-xs font-mono text-muted-foreground">
                          {typeof window !== 'undefined' ? `${window.location.host}${publicUrl}` : publicUrl}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 rounded-lg shrink-0 transition-all hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleCopy(typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl, 'long')}
                      >
                        {copiedLink === 'long' ? <CopyCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Short Link (If Dynamic QR exists) */}
                  {qrCode && qrCode.mode === 'dynamic' && qrCode.shortPath && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Short Link</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 overflow-hidden bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 flex items-center">
                          <span className="truncate text-xs font-mono font-medium text-primary">
                            smartsapp.com/q/{qrCode.shortPath}
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-lg shrink-0 transition-all hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleCopy(`https://smartsapp.com/q/${qrCode.shortPath}`, 'short')}
                        >
                          {copiedLink === 'short' ? <CopyCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <Separator className="my-2" />

                  {/* QR Code Module */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">QR Code</p>
                    
                    {isLoadingQR ? (
                      <Skeleton className="h-[160px] w-full rounded-xl" />
                    ) : qrCode ? (
                      <div className="flex flex-col items-center p-5 bg-gradient-to-b from-muted/20 to-transparent border rounded-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 bg-white p-3 rounded-xl shadow-sm border mb-4">
                          <QRPreview 
                            data={typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl} 
                            design={qrCode.design} 
                            size={140} 
                          />
                        </div>
                        <div className="flex w-full gap-2 relative z-10">
                          <Button asChild variant="outline" size="sm" className="w-full text-[10px] font-bold rounded-lg">
                            <Link href={`/admin/qr-studio/${qrCode.id}`}>
                              <Edit className="h-3 w-3 mr-1.5" /> Studio
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 border border-dashed rounded-xl flex flex-col items-center justify-center text-center gap-3 bg-muted/10">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <QrCode className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">No QR Code</p>
                          <p className="text-[10px] text-muted-foreground">Generate a trackable QR code for this session.</p>
                        </div>
                        <div className="w-full mt-2">
                          <CreateQRButton 
                            resourceType="meeting"
                            resourceId={meeting.id}
                            resourceName={meeting.entityName || meeting.heroTitle || 'Meeting'}
                            destinationUrl={typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : publicUrl}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Facilitators Card */}
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b flex flex-row items-start justify-between pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Meeting Facilitators
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Team members assigned to manage this session.
                  </CardDescription>
                </div>
                {meeting.facilitators && meeting.facilitators.length > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-2 rounded-xl"
                    onClick={() => handleBatchResendLinks(meeting.facilitators!)}
                    disabled={isSendingLinks}
                  >
                    <Send className="h-4 w-4" />
                    Resend All Links
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {meeting.facilitators && meeting.facilitators.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {meeting.facilitators.map((fac) => (
                      <div key={fac.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                            {fac.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{fac.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{fac.role || 'Facilitator'}</Badge>
                              <span>{fac.email}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:self-auto self-end">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs text-primary hover:bg-primary/10"
                            onClick={() => handleCopy(fac.joinLink, 'join_' + fac.id)}
                          >
                            {copiedLink === ('join_' + fac.id) ? <CopyCheck className="h-3 w-3 mr-1.5 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1.5" />}
                            Copy Link
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1.5 text-xs font-semibold rounded-lg"
                            onClick={() => handleBatchResendLinks([fac])}
                            disabled={isSendingLinks}
                          >
                            <Send className="h-3 w-3" />
                            Send
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 opacity-20" />
                    <p className="text-sm font-medium">No facilitators assigned to this meeting.</p>
                    <p className="text-xs">Add facilitators by editing the meeting architecture.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-semibold tracking-tight">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-xl">
                  <Link href={`/admin/meetings/${meetingId}/registrants`}>
                    <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                    Manage Registrants
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-xl">
                  <Link href={`/admin/meetings/${meetingId}/results`}>
                    <BarChart3 className="h-4 w-4 mr-2 text-muted-foreground" />
                    View Intelligence
                  </Link>
                </Button>
                
                <Separator className="my-4" />
                
                <Button 
                  variant={meeting.status === 'ended' ? "secondary" : "destructive"} 
                  size="sm" 
                  className="w-full justify-start font-semibold transition-all rounded-xl shadow-sm"
                  onClick={handleEndMeeting}
                  disabled={isEnding || meeting.status === 'ended'}
                >
                  <Flag className="h-4 w-4 mr-2" />
                  {isEnding ? 'Ending...' : meeting.status === 'ended' ? 'Meeting Ended' : 'End Meeting & Follow-ups'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
