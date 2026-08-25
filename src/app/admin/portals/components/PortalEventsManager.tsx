'use client';

/**
 * {{Org_name}} Experience Platform — Admin Live Events & Cohorts Studio
 *
 * Visual studio management component for scheduling webinars, workshops,
 * live coaching clinics, Zoom/Meet credentials, and student cohorts.
 */

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  createLiveEventAction,
  updateLiveEventAction,
  deleteLiveEventAction,
  publishEventReplayAction,
  createCohortAction,
  deleteCohortAction,
} from '@/app/actions/event-actions';
import type {
  LiveEvent,
  CourseCohort,
  EventType,
  MeetingProvider,
  EventStatus,
} from '@/lib/types/events';
import {
  Calendar,
  Video,
  Users,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  Sparkles,
  PlayCircle,
  FileText,
  Loader2,
  Radio,
  Layers,
} from 'lucide-react';

interface PortalEventsManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds?: string[];
}

export function PortalEventsManager({
  portalId,
  portalSlug,
  organizationId,
  workspaceIds = ['events'],
}: PortalEventsManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState('events');

  // 1. Query Live Events
  const eventsQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'live_events'),
            where('portalId', '==', portalId),
            orderBy('scheduledStartTime', 'desc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: events, isLoading: isLoadingEvents } = useCollection<LiveEvent>(eventsQuery);

  // 2. Query Cohorts
  const cohortsQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'course_cohorts'),
            where('portalId', '==', portalId),
            orderBy('startDate', 'asc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: cohorts, isLoading: isLoadingCohorts } = useCollection<CourseCohort>(cohortsQuery);

  // Modal States
  const [isCreateEventOpen, setIsCreateEventOpen] = React.useState(false);
  const [isReplayModalOpen, setIsReplayModalOpen] = React.useState(false);
  const [selectedEventForReplay, setSelectedEventForReplay] = React.useState<LiveEvent | null>(null);
  const [isCreateCohortOpen, setIsCreateCohortOpen] = React.useState(false);

  // Create Event Form State
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState<EventType>('webinar');
  const [instructorName, setInstructorName] = React.useState('');
  const [instructorTitle, setInstructorTitle] = React.useState('');
  const [meetingProvider, setMeetingProvider] = React.useState<MeetingProvider>('zoom');
  const [meetingUrl, setMeetingUrl] = React.useState('');
  const [meetingId, setMeetingId] = React.useState('');
  const [meetingPasscode, setMeetingPasscode] = React.useState('');
  const [scheduledStartTime, setScheduledStartTime] = React.useState('');
  const [scheduledEndTime, setScheduledEndTime] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [maxAttendees, setMaxAttendees] = React.useState<number | ''>('');
  const [isSubmittingEvent, setIsSubmittingEvent] = React.useState(false);

  // Replay Form State
  const [recordingUrl, setRecordingUrl] = React.useState('');
  const [aiSummary, setAiSummary] = React.useState('');
  const [keyTakeaways, setKeyTakeaways] = React.useState('');
  const [isSubmittingReplay, setIsSubmittingReplay] = React.useState(false);

  // Create Cohort Form State
  const [cohortName, setCohortName] = React.useState('');
  const [cohortStartDate, setCohortStartDate] = React.useState('');
  const [cohortEndDate, setCohortEndDate] = React.useState('');
  const [cohortCapacity, setCohortCapacity] = React.useState<number | ''>(50);
  const [isSubmittingCohort, setIsSubmittingCohort] = React.useState(false);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !meetingUrl.trim() || !scheduledStartTime || !scheduledEndTime) {
      toast({ title: 'Missing Details', description: 'Please fill in all required event details.' });
      return;
    }

    setIsSubmittingEvent(true);
    try {
      const res = await createLiveEventAction(
        {
          organizationId,
          portalId,
          workspaceIds,
          title: title.trim(),
          type,
          instructorName: instructorName.trim() || 'Head Instructor',
          instructorTitle: instructorTitle.trim() || undefined,
          meetingProvider,
          meetingUrl: meetingUrl.trim(),
          meetingId: meetingId.trim() || undefined,
          meetingPasscode: meetingPasscode.trim() || undefined,
          scheduledStartTime: new Date(scheduledStartTime).toISOString(),
          scheduledEndTime: new Date(scheduledEndTime).toISOString(),
          description: description.trim() || undefined,
          maxAttendees: maxAttendees ? Number(maxAttendees) : undefined,
          isPublic: true,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Event Scheduled! 🎟️', description: `Created "${res.data?.title}".` });

      // Reset form
      setTitle('');
      setMeetingUrl('');
      setMeetingId('');
      setMeetingPasscode('');
      setDescription('');
      setIsCreateEventOpen(false);
    } catch (err: any) {
      toast({ title: 'Scheduling Error', description: err?.message });
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this live event?')) return;
    try {
      await deleteLiveEventAction(eventId, portalId, portalSlug);
      toast({ title: 'Event Removed', description: 'Session cancelled and removed.' });
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err?.message });
    }
  };

  const handleOpenReplay = (event: LiveEvent) => {
    setSelectedEventForReplay(event);
    setRecordingUrl(event.recordingUrl || '');
    setAiSummary(event.aiSummary || '');
    setKeyTakeaways(event.keyTakeaways?.join('\n') || '');
    setIsReplayModalOpen(true);
  };

  const handleSaveReplay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForReplay || !recordingUrl.trim()) return;

    setIsSubmittingReplay(true);
    try {
      const takeawaysList = keyTakeaways
        .split('\n')
        .map(t => t.trim().replace(/^[-•*]\s*/, ''))
        .filter(Boolean);

      const res = await publishEventReplayAction(
        {
          portalId,
          eventId: selectedEventForReplay.id,
          recordingUrl: recordingUrl.trim(),
          aiSummary: aiSummary.trim() || undefined,
          keyTakeaways: takeawaysList.length > 0 ? takeawaysList : undefined,
        },
        portalSlug,
        selectedEventForReplay.slug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Replay Published! 🎥', description: 'Session replay & AI summary live for students.' });
      setIsReplayModalOpen(false);
    } catch (err: any) {
      toast({ title: 'Publish Error', description: err?.message });
    } finally {
      setIsSubmittingReplay(false);
    }
  };

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortName.trim() || !cohortStartDate || !cohortEndDate) return;

    setIsSubmittingCohort(true);
    try {
      const res = await createCohortAction(
        {
          organizationId,
          portalId,
          courseId: 'all',
          workspaceIds,
          name: cohortName.trim(),
          startDate: new Date(cohortStartDate).toISOString(),
          endDate: new Date(cohortEndDate).toISOString(),
          maxCapacity: cohortCapacity ? Number(cohortCapacity) : undefined,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Cohort Created! 🎓', description: `Created "${res.data?.name}".` });
      setCohortName('');
      setIsCreateCohortOpen(false);
    } catch (err: any) {
      toast({ title: 'Cohort Error', description: err?.message });
    } finally {
      setIsSubmittingCohort(false);
    }
  };

  const handleDeleteCohort = async (cohortId: string) => {
    if (!confirm('Are you sure you want to delete this cohort?')) return;
    try {
      await deleteCohortAction(cohortId, portalId, portalSlug);
      toast({ title: 'Cohort Deleted', description: 'Cohort group removed.' });
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err?.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="h-10 p-1 bg-muted/60 rounded-2xl">
            <TabsTrigger value="events" className="rounded-xl text-xs font-bold gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Live Sessions & Events ({events?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="cohorts" className="rounded-xl text-xs font-bold gap-1.5">
              <Users className="w-3.5 h-3.5" /> Student Cohorts ({cohorts?.length || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'events' ? (
          <Button
            onClick={() => setIsCreateEventOpen(true)}
            className="h-10 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Schedule Live Event
          </Button>
        ) : (
          <Button
            onClick={() => setIsCreateCohortOpen(true)}
            className="h-10 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Student Cohort
          </Button>
        )}
      </div>

      {/* ── Tab 1: Live Events Table ──────────────────────────────────── */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {isLoadingEvents ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading scheduled events...</div>
          ) : (!events || events.length === 0) ? (
            <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <Video className="w-12 h-12 mx-auto text-primary/60" />
              <h4 className="font-bold text-base text-foreground">No Live Sessions Scheduled</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Schedule live webinars, workshops, coaching clinics, or office hours for your members.
              </p>
              <Button
                onClick={() => setIsCreateEventOpen(true)}
                className="rounded-xl font-bold text-xs bg-primary text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Schedule First Session
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map(event => (
                <Card
                  key={event.id}
                  className="rounded-3xl border-2 border-border p-5 space-y-4 hover:border-primary/40 transition-all flex flex-col justify-between bg-card shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[9px] font-bold uppercase capitalize bg-primary/10 text-primary"
                      >
                        {event.type.replace('_', ' ')}
                      </Badge>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenReplay(event)}
                          title="Manage Replay & AI Summary"
                          className="h-7 w-7 rounded-xl text-muted-foreground hover:text-primary"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="h-7 w-7 rounded-xl text-muted-foreground hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground line-clamp-1">{event.title}</h4>
                      <p className="text-xs text-muted-foreground">with {event.instructorName}</p>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span>{new Date(event.scheduledStartTime).toLocaleDateString()} at {new Date(event.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>{event.durationMinutes} minutes • {event.meetingProvider.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span>{event.registeredCount} Registered {event.maxAttendees ? `(Max ${event.maxAttendees})` : ''}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                    {event.recordingUrl ? (
                      <Badge className="bg-emerald-500 text-white font-bold text-[9px] gap-1 py-0.5">
                        <PlayCircle className="w-2.5 h-2.5" /> Replay Active
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Upcoming Live</span>
                    )}

                    <a href={event.meetingUrl} target="_blank" rel="noreferrer" className="text-primary font-bold text-[11px] flex items-center gap-1 hover:underline">
                      Host Room <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Cohorts Manager ────────────────────────────────────── */}
      {activeTab === 'cohorts' && (
        <div className="space-y-4">
          {isLoadingCohorts ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading student cohorts...</div>
          ) : (!cohorts || cohorts.length === 0) ? (
            <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <Users className="w-12 h-12 mx-auto text-primary/60" />
              <h4 className="font-bold text-base text-foreground">No Student Cohorts</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Group members into structured cohorts with scheduled release dates and private discussion.
              </p>
              <Button
                onClick={() => setIsCreateCohortOpen(true)}
                className="rounded-xl font-bold text-xs bg-primary text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Create First Cohort
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cohorts.map(cohort => (
                <Card
                  key={cohort.id}
                  className="rounded-3xl border-2 border-border p-5 space-y-3 hover:border-primary/40 transition-all flex flex-col justify-between bg-card shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[9px] font-bold uppercase capitalize">
                        {cohort.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCohort(cohort.id)}
                        className="h-7 w-7 rounded-xl text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <h4 className="font-bold text-sm text-foreground">{cohort.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {new Date(cohort.startDate).toLocaleDateString()} → {new Date(cohort.endDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>{cohort.enrolledCount} Students Enrolled</span>
                    <span className="font-bold text-primary text-[11px]">
                      Cap: {cohort.maxCapacity || 'Unlimited'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Schedule Event Modal ──────────────────────────────────────── */}
      <Dialog open={isCreateEventOpen} onOpenChange={setIsCreateEventOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Calendar className="w-4 h-4" /> Live Events Scheduler
            </div>
            <DialogTitle className="text-xl font-bold">Schedule Live Session</DialogTitle>
            <DialogDescription className="text-xs">
              Configure video room links, schedule, and registration capacities.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateEvent} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Session Title</Label>
              <Input
                placeholder="e.g. Masterclass: Term 1 Fee Collection Strategies"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-10 text-xs rounded-xl font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Event Type</Label>
                <Select value={type} onValueChange={(val: EventType) => setType(val)}>
                  <SelectTrigger className="h-10 text-xs rounded-xl capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="webinar">🎥 Live Webinar</SelectItem>
                    <SelectItem value="workshop">🛠️ Practical Workshop</SelectItem>
                    <SelectItem value="coaching">💼 1-on-1 Coaching</SelectItem>
                    <SelectItem value="office_hours">☕ Office Hours / AMA</SelectItem>
                    <SelectItem value="masterclass">🎓 Masterclass</SelectItem>
                    <SelectItem value="cohort_session">👥 Cohort Session</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Platform</Label>
                <Select value={meetingProvider} onValueChange={(val: MeetingProvider) => setMeetingProvider(val)}>
                  <SelectTrigger className="h-10 text-xs rounded-xl uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="zoom">Zoom Meeting</SelectItem>
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                    <SelectItem value="custom">Custom Stream / RTMP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Meeting URL / Room Link</Label>
              <Input
                placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                value={meetingUrl}
                onChange={e => setMeetingUrl(e.target.value)}
                className="h-10 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Meeting ID (Optional)</Label>
                <Input
                  placeholder="e.g. 849 2049 1928"
                  value={meetingId}
                  onChange={e => setMeetingId(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Passcode (Optional)</Label>
                <Input
                  placeholder="e.g. 123456"
                  value={meetingPasscode}
                  onChange={e => setMeetingPasscode(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Start Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledStartTime}
                  onChange={e => setScheduledStartTime(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">End Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledEndTime}
                  onChange={e => setScheduledEndTime(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Instructor / Host</Label>
                <Input
                  placeholder="e.g. Dr. Kwame Mensah"
                  value={instructorName}
                  onChange={e => setInstructorName(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Max Attendees (Optional)</Label>
                <Input
                  type="number"
                  placeholder="Leave empty for unlimited"
                  value={maxAttendees}
                  onChange={e => setMaxAttendees(e.target.value === '' ? '' : Number(e.target.value))}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Description & Agenda</Label>
              <Textarea
                placeholder="What will members master during this live session?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="text-xs rounded-xl resize-none"
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateEventOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingEvent}
                className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                {isSubmittingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish Event'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Replay & AI Summary Modal ─────────────────────────────────── */}
      <Dialog open={isReplayModalOpen} onOpenChange={setIsReplayModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8 space-y-4">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" /> AI Replay Studio
            </div>
            <DialogTitle className="text-xl font-bold">Publish Replay & Takeaways</DialogTitle>
            <DialogDescription className="text-xs">
              Add recording video URL and AI-generated summary bullet takeaways.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveReplay} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Recording Video URL / Embed</Label>
              <Input
                placeholder="https://vimeo.com/... or https://youtube.com/watch?v=..."
                value={recordingUrl}
                onChange={e => setRecordingUrl(e.target.value)}
                className="h-10 text-xs rounded-xl font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">AI Executive Summary</Label>
              <Textarea
                placeholder="Executive overview of the masterclass..."
                value={aiSummary}
                onChange={e => setAiSummary(e.target.value)}
                rows={3}
                className="text-xs rounded-xl resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Key Takeaways (1 per line)</Label>
              <Textarea
                placeholder="• Step 1: Export aged billing ledger&#10;• Step 2: Configure 3-touch WhatsApp templates"
                value={keyTakeaways}
                onChange={e => setKeyTakeaways(e.target.value)}
                rows={4}
                className="text-xs rounded-xl font-mono resize-none"
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReplayModalOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingReplay}
                className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                {isSubmittingReplay ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish Replay'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Cohort Modal ───────────────────────────────────────── */}
      <Dialog open={isCreateCohortOpen} onOpenChange={setIsCreateCohortOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 space-y-4">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Users className="w-4 h-4" /> Cohort Builder
            </div>
            <DialogTitle className="text-xl font-bold">Create Student Cohort</DialogTitle>
            <DialogDescription className="text-xs">
              Structure synchronous learning cohorts with date windows.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCohort} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Cohort Name</Label>
              <Input
                placeholder="e.g. Term 1 School Leaders Intensive"
                value={cohortName}
                onChange={e => setCohortName(e.target.value)}
                className="h-10 text-xs rounded-xl font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Start Date</Label>
                <Input
                  type="date"
                  value={cohortStartDate}
                  onChange={e => setCohortStartDate(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">End Date</Label>
                <Input
                  type="date"
                  value={cohortEndDate}
                  onChange={e => setCohortEndDate(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Capacity Cap (Optional)</Label>
              <Input
                type="number"
                value={cohortCapacity}
                onChange={e => setCohortCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateCohortOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingCohort}
                className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                {isSubmittingCohort ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Cohort'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
