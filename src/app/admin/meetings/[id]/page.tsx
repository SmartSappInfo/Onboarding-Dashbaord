'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, collection, query, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { endMeetingAction } from '@/app/actions/meeting-post-event-action';
import type { Meeting, ScheduledMessage, QRCode, MeetingFacilitator, MeetingReminderSlot } from '@/lib/types';
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
  Link as LinkIcon,
  Eye,
  Mail,
  MessageSquare,
  Loader2,
  ChevronLeft,
  X,
  Check,
  Edit3
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { renderScheduledMessageAction, sendTestMessageAction } from '@/app/actions/scheduled-message-actions';
import { useUser } from '@/firebase';
import { RecipientLogDrawer } from './components/RecipientLogDrawer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
  const { user } = useUser();
  const [previewModalOpen, setPreviewModalOpen] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState<any>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [testRecipient, setTestRecipient] = React.useState('');
  const [isTesting, setIsTesting] = React.useState(false);
  const [logDrawerOpen, setLogDrawerOpen] = React.useState(false);
  const [selectedReminderType, setSelectedReminderType] = React.useState<string | null>(null);
  const [isTogglingRegistration, setIsTogglingRegistration] = React.useState(false);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [editingName, setEditingName] = React.useState('');
  const [isSavingName, setIsSavingName] = React.useState(false);

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

  const handleOpenPreview = async (messageId: string) => {
    setPreviewModalOpen(true);
    setIsPreviewLoading(true);
    setPreviewContent(null);
    setTestRecipient(user?.email || user?.phoneNumber || '');
    try {
      const res = await renderScheduledMessageAction(messageId);
      if (res.success) {
        setPreviewContent(res);
      } else {
        toast({ variant: 'destructive', title: 'Preview Error', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleTestSend = async () => {
    if (!testRecipient) {
      toast({ variant: 'destructive', title: 'Required', description: 'Please enter a test recipient' });
      return;
    }
    if (!previewContent) return;
    setIsTesting(true);
    try {
      const res = await sendTestMessageAction(
        previewContent.channel,
        testRecipient,
        previewContent.body,
        previewContent.subject,
        activeWorkspaceId ? [activeWorkspaceId] : ['onboarding']
      );
      if (res.success) {
        toast({ title: 'Success', description: res.message });
      } else {
        toast({ variant: 'destructive', title: 'Test Failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const meetingDocRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return doc(firestore, 'meetings', meetingId);
  }, [firestore, meetingId]);

  const { data: meeting, isLoading: isLoadingMeeting } = useDoc<Meeting>(meetingDocRef);

  // Fetch registrants for real-time count
  const registrantsColRef = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return collection(firestore, `meetings/${meetingId}/registrants`);
  }, [firestore, meetingId]);

  const { data: registrants } = useCollection<any>(registrantsColRef);

  // Derive count safely in render (zero-effect derivation)
  const registrantsCount = registrants?.filter(r => r.status === 'registered' || r.status === 'approved' || r.status === 'attended').length ?? 0;

  // Toggle registration status with race-condition protection
  const handleToggleRegistration = async () => {
    if (!meeting || !meetingDocRef || isTogglingRegistration) return;
    setIsTogglingRegistration(true);
    const newStatus = !(meeting.registrationEnabled ?? false);
    try {
      await updateDoc(meetingDocRef, { registrationEnabled: newStatus });
      toast({
        title: newStatus ? 'Registration Enabled' : 'Registration Disabled',
        description: newStatus
          ? 'Participants can now register for this meeting.'
          : 'Registration has been turned off for this meeting.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsTogglingRegistration(false);
    }
  };

  const handleSaveName = async () => {
    if (!firestore || !meetingDocRef || !editingName.trim()) return;
    setIsSavingName(true);
    try {
      await updateDoc(meetingDocRef, { entityName: editingName.trim() });
      toast({
        title: 'Meeting updated',
        description: 'Meeting internal name has been successfully updated.',
      });
      setIsEditingName(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err.message || 'An error occurred.',
      });
    } finally {
      setIsSavingName(false);
    }
  };

  interface ActiveSlot {
    id: string;
    type: string;
    label: string;
    channel: string;
    description: string;
  }

  const getReminderOffsetLabel = (offset: number) => {
    if (offset === 0) return 'At meeting start';
    const absOffset = Math.abs(offset);
    const days = Math.floor(absOffset / 1440);
    const hours = Math.floor((absOffset % 1440) / 60);
    const mins = absOffset % 60;
    const timeParts = [];
    if (days > 0) timeParts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) timeParts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (mins > 0) timeParts.push(`${mins} min${mins > 1 ? 's' : ''}`);
    return `${timeParts.join(' ')} ${offset > 0 ? 'before' : 'after'}`;
  };

  const activeSlots = React.useMemo<ActiveSlot[]>(() => {
    if (!meeting) return [];
    const slots: ActiveSlot[] = [];
    const config = meeting.messagingConfig;

    // 1. Registration Ack
    if (config?.registrationAckEnabled) {
      slots.push({
        id: 'registration_ack',
        type: 'registration_ack',
        label: 'Registration Confirmation',
        channel: config.registrationAckChannels?.join(', ') || 'email',
        description: 'Sent immediately to participants upon registration.'
      });
    }

    // 2. Custom Scheduler Slots
    if (config?.reminders) {
      config.reminders
        .filter((slot: MeetingReminderSlot) => slot.enabled)
        .forEach((slot: MeetingReminderSlot) => {
          slots.push({
            id: `messaging_slot_${slot.id}`,
            type: `messaging_slot_${slot.id}`,
            label: `Reminder (${getReminderOffsetLabel(slot.offsetMinutes)})`,
            channel: slot.channels?.join(', ') || 'email',
            description: `Sent to all registered participants.`
          });
        });
    }

    // 3. Facilitator Alerts
    slots.push({
      id: 'facilitator_pre_event',
      type: 'facilitator_pre_event',
      label: 'Facilitator Pre-Event Alert',
      channel: 'email',
      description: 'Sent 1 hour before to assigned facilitators.'
    });

    slots.push({
      id: 'facilitator_post_event',
      type: 'facilitator_post_event',
      label: 'Facilitator Post-Event Checklist',
      channel: 'email',
      description: 'Sent at meeting end to facilitators to close out the session.'
    });

    // 4. Post-event participant follow-ups
    slots.push({
      id: 'post_event_thankyou',
      type: 'post_event_thankyou',
      label: 'Attendee Thank You',
      channel: 'email',
      description: 'Sent post-event to all participants who attended.'
    });

    slots.push({
      id: 'post_event_absentee',
      type: 'post_event_absentee',
      label: 'Absentee Follow-up',
      channel: 'email',
      description: 'Sent post-event to registered participants who did not join.'
    });

    return slots;
  }, [meeting]);

  const participantSlots = React.useMemo(() => {
    return activeSlots.filter(s => 
      s.type === 'registration_ack' || 
      s.type.startsWith('messaging_slot_') || 
      s.type === 'post_event_thankyou' || 
      s.type === 'post_event_absentee'
    );
  }, [activeSlots]);

  const facilitatorSlots = React.useMemo(() => {
    return activeSlots.filter(s => 
      s.type === 'facilitator_pre_event' || 
      s.type === 'facilitator_post_event'
    );
  }, [activeSlots]);

  // Parallel Query for QR Codes
  const qrQuery = useMemoFirebase(() => {
    if (!firestore || !meetingId || !activeOrganizationId || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'organizations', activeOrganizationId, 'workspaces', activeWorkspaceId, 'qr_codes'),
      where('destination.resourceId', '==', meetingId),
      where('type', '==', 'meeting'),
      limit(1)
    );
  }, [firestore, meetingId, activeOrganizationId, activeWorkspaceId]);

  const { data: qrCodes, isLoading: isLoadingQR } = useCollection<QRCode>(qrQuery);
  const qrCode = qrCodes && qrCodes.length > 0 ? qrCodes[0] : null;



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
    <div className="h-full w-full overflow-y-auto bg-background p-8">
      <div className="w-full space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0">
              <Link href="/admin/meetings">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-10 px-3 border rounded-xl text-lg font-semibold w-72 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    disabled={isSavingName}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl shrink-0"
                    onClick={handleSaveName}
                    disabled={isSavingName}
                  >
                    {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />}
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-9 w-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl shrink-0"
                    onClick={() => setIsEditingName(false)}
                    disabled={isSavingName}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1 group/title">
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground leading-none">
                    {meeting.entityName}
                  </h1>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover/title:opacity-100 transition-opacity rounded-xl hover:bg-muted"
                    onClick={() => {
                      setIsEditingName(true);
                      setEditingName(meeting.entityName || '');
                    }}
                  >
                    <Edit3 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {meeting.type.name} • {format(new Date(meeting.meetingTime), 'PPP p')}
              </p>
            </div>
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

                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Registration</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleRegistration}
                      disabled={isTogglingRegistration}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ring-1 ${
                        (meeting.registrationEnabled ?? false)
                          ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 ring-blue-500/20 hover:bg-blue-600/20'
                          : 'bg-muted/80 text-muted-foreground ring-border/60 hover:bg-muted'
                      }`}
                    >
                      {isTogglingRegistration ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Users className="h-3 w-3" />
                      )}
                      {(meeting.registrationEnabled ?? false) ? 'Enabled' : 'Disabled'}
                    </button>

                    <Link
                      href={`/admin/meetings/${meetingId}/invitations?tab=registrants`}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground hover:text-primary transition-colors duration-150 hover:underline underline-offset-4"
                    >
                      {registrantsCount}
                      <span className="text-xs font-medium text-muted-foreground">registrants</span>
                    </Link>

                    {meeting.capacityLimit && meeting.capacityLimit > 0 ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        / {meeting.capacityLimit} capacity
                      </span>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Task 12.5: Scheduled Reminders Display */}
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl">
              <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-600" />
                  Scheduled Messages
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs defaultValue="participants" className="w-full">
                  <TabsList className="grid grid-cols-3 mb-6 bg-muted/50 rounded-xl p-1">
                    <TabsTrigger value="participants" className="rounded-lg text-xs font-bold py-2">
                      Participants ({participantSlots.length})
                    </TabsTrigger>
                    <TabsTrigger value="facilitators" className="rounded-lg text-xs font-bold py-2">
                      Facilitators ({facilitatorSlots.length})
                    </TabsTrigger>
                    <TabsTrigger value="invitations" className="rounded-lg text-xs font-bold py-2">
                      Invitations ({meeting?.messagingConfig?.invitationsEnabled ? (
                        meeting?.messagingConfig?.invitationSeries?.some(s => s.enabled) ? (
                          meeting.messagingConfig.invitationSeries.filter(s => s.enabled).length
                        ) : 1
                      ) : 0})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="participants" className="space-y-3 focus-visible:outline-none">
                    {participantSlots.length > 0 ? (
                      <div className="space-y-3">
                        {participantSlots.map((slot) => (
                          <div 
                            key={slot.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border hover:bg-muted/30 transition-all cursor-pointer group"
                            onClick={() => {
                              setSelectedReminderType(slot.type);
                              setLogDrawerOpen(true);
                            }}
                          >
                            <div className="flex-1 text-left">
                              <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                                {slot.label}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {slot.description}
                              </p>
                            </div>
                            <Badge variant="secondary" className="ml-4 uppercase text-[10px]">
                              {slot.channel}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">No active participant messages</p>
                        <p className="text-xs">Reminders will appear here once configured in settings</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="facilitators" className="space-y-3 focus-visible:outline-none">
                    {facilitatorSlots.length > 0 ? (
                      <div className="space-y-3">
                        {facilitatorSlots.map((slot) => (
                          <div 
                            key={slot.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border hover:bg-muted/30 transition-all cursor-pointer group"
                            onClick={() => {
                              setSelectedReminderType(slot.type);
                              setLogDrawerOpen(true);
                            }}
                          >
                            <div className="flex-1 text-left">
                              <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                                {slot.label}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {slot.description}
                              </p>
                            </div>
                            <Badge variant="secondary" className="ml-4 uppercase text-[10px]">
                              {slot.channel}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">No active facilitator messages</p>
                        <p className="text-xs">Facilitator alerts will appear here once configured</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="invitations" className="space-y-3 focus-visible:outline-none">
                    {meeting?.messagingConfig?.invitationsEnabled ? (
                      meeting?.messagingConfig?.invitationSeries?.some(s => s.enabled) ? (
                        <div className="space-y-3">
                          {meeting.messagingConfig.invitationSeries
                            .filter(s => s.enabled)
                            .map((slot) => (
                              <div 
                                key={slot.id}
                                className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border hover:bg-muted/30 transition-all cursor-pointer group"
                                onClick={() => {
                                  setSelectedReminderType(`meeting_invitation_${slot.id}`);
                                  setLogDrawerOpen(true);
                                }}
                              >
                                <div className="flex-1 text-left">
                                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                                    {slot.label}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Automated invitation messages sent to the invited guest roster.
                                  </p>
                                </div>
                                <Badge variant="secondary" className="ml-4 uppercase text-[10px]">
                                  {slot.channels?.join(', ') || 'email'}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border hover:bg-muted/30 transition-all cursor-pointer group"
                          onClick={() => {
                            setSelectedReminderType('meeting_invitation');
                            setLogDrawerOpen(true);
                          }}
                        >
                          <div className="flex-1 text-left">
                            <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                              Guest Invitation Blast
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Automated and manual invitation blasts sent to the invited guest roster.
                            </p>
                          </div>
                          <Badge variant="secondary" className="ml-4 uppercase text-[10px]">
                            email, sms
                          </Badge>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Mail className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">No active scheduled invitations</p>
                        <p className="text-xs">Configure invitations in the session setup page to enable scheduling</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-semibold tracking-tight">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-xl">
                  <Link href={`/admin/meetings/${meetingId}/invitations`}>
                    <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                    Invitations & Registrants
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
              <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  Distribution & Access
                </CardTitle>
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
                            {typeof window !== 'undefined' ? window.location.host : 'go.smartsapp.com'}/q/{qrCode.shortPath}
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-lg shrink-0 transition-all hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : 'https://go.smartsapp.com'}/q/${qrCode.shortPath}`, 'short')}
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
              <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between py-4">
                <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Meeting Facilitators
                </CardTitle>
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


          </div>
        </div>
      </div>
      
      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="sm:max-w-[700px] gap-0 p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Eye className="h-5 w-5 text-primary" />
              Message Preview
            </DialogTitle>
          </DialogHeader>
          <div className="p-0">
            {isPreviewLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Generating preview...</p>
              </div>
            ) : previewContent ? (
              <div className="flex flex-col h-full max-h-[70vh]">
                <div className="flex-1 overflow-y-auto bg-muted/10 p-6">
                  {previewContent.channel === 'email' ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1.5 p-4 rounded-xl border bg-white shadow-sm">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span className="font-semibold">Subject:</span>
                        </div>
                        <p className="font-medium">{previewContent.subject || 'No Subject'}</p>
                      </div>
                      <div className="border rounded-xl overflow-hidden bg-white shadow-sm min-h-[400px]">
                        <iframe 
                          srcDoc={previewContent.body} 
                          title="Message Preview"
                          className="w-full h-full min-h-[400px] border-0"
                          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center py-8">
                      <div className="max-w-[320px] w-full border-[6px] border-slate-800 rounded-[32px] overflow-hidden shadow-2xl bg-slate-50 relative">
                        <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 rounded-b-xl mx-auto w-[120px] z-10" />
                        <div className="bg-white p-4 pb-2 border-b flex items-center justify-center pt-8">
                          <p className="text-xs font-semibold text-center text-slate-500 flex items-center gap-1.5">
                            <MessageSquare className="h-3 w-3" />
                            SMS Preview
                          </p>
                        </div>
                        <div className="p-4 bg-slate-100 min-h-[400px] flex flex-col justify-end">
                          <div className="bg-[#007AFF] text-white p-3.5 rounded-2xl rounded-br-sm text-[15px] leading-snug shadow-sm whitespace-pre-wrap">
                            {previewContent.body}
                          </div>
                          <p className="text-[10px] text-slate-400 text-right mt-1.5 mr-1">Delivered via SmartSapp</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t bg-muted/30">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex-1 w-full">
                      <Label htmlFor="test-recipient" className="sr-only">Test Recipient</Label>
                      <Input 
                        id="test-recipient"
                        type={previewContent.channel === 'email' ? "email" : "tel"}
                        placeholder={previewContent.channel === 'email' ? "Enter email address for test" : "Enter phone number for test"}
                        value={testRecipient}
                        onChange={(e) => setTestRecipient(e.target.value)}
                        className="bg-background shadow-sm"
                      />
                    </div>
                    <Button 
                      onClick={handleTestSend} 
                      disabled={isTesting || !testRecipient}
                      className="w-full sm:w-auto shadow-sm gap-2"
                    >
                      {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {isTesting ? 'Sending...' : 'Test Dispatch'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                <p>Failed to load preview content.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipient Log Drawer */}
      {selectedReminderType && (
        <RecipientLogDrawer 
          isOpen={logDrawerOpen}
          onClose={() => {
            setLogDrawerOpen(false);
            setSelectedReminderType(null);
          }}
          meetingId={meetingId}
          reminderType={selectedReminderType}
          onPreviewMessage={handleOpenPreview}
          meeting={meeting}
        />
      )}
    </div>
  );
}
