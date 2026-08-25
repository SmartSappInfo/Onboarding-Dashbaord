'use client';

/**
 * @fileoverview Canvas-Style Multi-Tab Event Type Editor (Meetings 2.0).
 * Implements persistent side-nav layout with Overview, Availability, Location,
 * Custom Questions, CRM & Auto-tags, and Notifications configuration.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ExternalLink,
  Save,
  Loader2,
  Info,
  Clock,
  Layers,
  MapPin,
  HelpCircle,
  Tag as TagIcon,
  Bell,
  Zap,
  Plus,
  Trash2,
  Check,
  Globe,
  Video,
  Phone,
  Users,
  type LucideIcon,
} from 'lucide-react';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}
import type {
  EventType,
  AvailabilityProfile,
  BookingField,
  MeetingLocationType,
  EventTypeFormat,
  TeamHostMember,
  HostAssignmentStrategy,
  RoundRobinDistribution,
  MeetingWorkflowRule,
} from '@/lib/meetings/types';
import { updateEventTypeAction } from '@/app/actions/event-type-actions';
import {
  getEventTypeWorkflowsAction,
  saveEventTypeWorkflowsAction,
} from '@/app/actions/meeting-workflow-actions';
import { TagSelector } from '@/components/tags/TagSelector';
import { cn } from '@/lib/utils';

interface EventTypeEditorClientProps {
  eventTypeId: string;
}

type EditorTab = 'overview' | 'availability' | 'team' | 'location' | 'questions' | 'crm' | 'notifications' | 'workflows';

const COLOR_OPTIONS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate
];

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90, 120];

export default function EventTypeEditorClient({ eventTypeId }: EventTypeEditorClientProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<EditorTab>('overview');
  const [isSaving, setIsSaving] = React.useState(false);

  // Load Event Type document
  const eventDocRef = useMemoFirebase(() => {
    if (!firestore || !eventTypeId) return null;
    return doc(firestore, 'event_types', eventTypeId);
  }, [firestore, eventTypeId]);

  const { data: eventType, isLoading } = useDoc<EventType>(eventDocRef);

  // Load Availability Profiles for selection
  const availProfilesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'availability_profiles'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);

  const { data: availabilityProfiles } = useCollection<AvailabilityProfile>(availProfilesQuery);

  // Form State
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [durationMinutes, setDurationMinutes] = React.useState(30);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = React.useState(30);
  const [format, setFormat] = React.useState<EventTypeFormat>('one_to_one');
  const [color, setColor] = React.useState('#3b82f6');
  const [status, setStatus] = React.useState<'active' | 'draft' | 'archived'>('active');

  // Availability Settings
  const [availabilityProfileId, setAvailabilityProfileId] = React.useState('');
  const [minimumNoticeHours, setMinimumNoticeHours] = React.useState('2');
  const [maximumBookingHorizonDays, setMaximumBookingHorizonDays] = React.useState('30');
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = React.useState('0');
  const [bufferAfterMinutes, setBufferAfterMinutes] = React.useState('0');

  // Location Settings
  const [locationType, setLocationType] = React.useState<MeetingLocationType>('google_meet');
  const [locationDetails, setLocationDetails] = React.useState('');

  // Questions Settings
  const [customQuestions, setCustomQuestions] = React.useState<BookingField[]>([]);
  const [questionModalOpen, setQuestionModalOpen] = React.useState(false);
  const [newQuestionLabel, setNewQuestionLabel] = React.useState('');
  const [newQuestionType, setNewQuestionType] = React.useState<BookingField['type']>('text');
  const [newQuestionRequired, setNewQuestionRequired] = React.useState(false);
  const [newQuestionPlaceholder, setNewQuestionPlaceholder] = React.useState('');

  // CRM Settings
  const [autoTags, setAutoTags] = React.useState<string[]>([]);
  const [crmPrefillEnabled, setCrmPrefillEnabled] = React.useState(true);

  // Team & Multi-Host Settings
  const [hostStrategy, setHostStrategy] = React.useState<HostAssignmentStrategy>('single');
  const [teamHosts, setTeamHosts] = React.useState<TeamHostMember[]>([]);
  const [roundRobinDistribution, setRoundRobinDistribution] = React.useState<RoundRobinDistribution>('availability');

  // Notifications Settings
  const [confirmationMessage, setConfirmationMessage] = React.useState('');

  // Populate state when eventType loads
  React.useEffect(() => {
    if (eventType) {
      setName(eventType.name || '');
      setSlug(eventType.slug || '');
      setDescription(eventType.description || '');
      setDurationMinutes(eventType.durationMinutes || 30);
      setSlotIntervalMinutes(eventType.slotIntervalMinutes || eventType.durationMinutes || 30);
      setFormat(eventType.format || 'one_to_one');
      setColor(eventType.color || '#3b82f6');
      setStatus(eventType.status || 'active');

      setAvailabilityProfileId(eventType.availabilityProfileId || '');
      setMinimumNoticeHours(String((eventType.minimumNoticeMinutes || 120) / 60));
      setMaximumBookingHorizonDays(String(eventType.maximumBookingHorizonDays || 30));
      setBufferBeforeMinutes(String(eventType.bufferBeforeMinutes || 0));
      setBufferAfterMinutes(String(eventType.bufferAfterMinutes || 0));

      setHostStrategy(eventType.teamConfig?.strategy || 'single');
      setTeamHosts(eventType.teamConfig?.hosts || []);
      setRoundRobinDistribution(eventType.teamConfig?.roundRobinDistribution || 'availability');

      setLocationType(eventType.locationType || 'google_meet');
      setLocationDetails(eventType.locationDetails || '');

      setCustomQuestions(eventType.customQuestions || []);
      setAutoTags(eventType.autoTags || []);
      setCrmPrefillEnabled(eventType.crmPrefillEnabled ?? true);
      setConfirmationMessage(eventType.confirmationMessage || 'Your booking is confirmed! See you then.');
    }
  }, [eventType]);

  // Handle Add Custom Question
  const handleAddQuestion = () => {
    if (!newQuestionLabel.trim()) {
      toast({ variant: 'destructive', title: 'Question label required' });
      return;
    }

    const key = newQuestionLabel.toLowerCase().replace(/[^\w]/g, '_');
    const newField: BookingField = {
      id: `q_${Date.now()}`,
      label: newQuestionLabel.trim(),
      key,
      type: newQuestionType,
      required: newQuestionRequired,
      placeholder: newQuestionPlaceholder.trim() || undefined,
    };

    setCustomQuestions(prev => [...prev, newField]);
    setQuestionModalOpen(false);
    setNewQuestionLabel('');
    setNewQuestionPlaceholder('');
    setNewQuestionRequired(false);
  };

  // Handle Remove Custom Question
  const handleRemoveQuestion = (id: string) => {
    setCustomQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Workflows state
  const [workflows, setWorkflows] = React.useState<MeetingWorkflowRule[]>([]);

  // Load Workflows
  React.useEffect(() => {
    if (!eventTypeId || !activeWorkspaceId) return;
    getEventTypeWorkflowsAction(eventTypeId, activeWorkspaceId).then(res => {
      if (res.success && res.rules) {
        setWorkflows(res.rules);
      }
    });
  }, [eventTypeId, activeWorkspaceId]);

  // Handle Add Workflow Rule
  const handleAddWorkflow = (trigger: MeetingWorkflowRule['trigger'], actionType: MeetingWorkflowRule['actionType']) => {
    const newRule: MeetingWorkflowRule = {
      id: `wf_${Date.now()}`,
      workspaceId: activeWorkspaceId || '',
      eventTypeId,
      trigger,
      actionType,
      config: {
        taskTitle: actionType === 'create_crm_task' ? 'Meeting follow-up' : undefined,
        scoreDelta: actionType === 'update_lead_score' ? 10 : undefined,
        customMessage: actionType.startsWith('send_') ? 'Hello {{contact.fullName}}, thank you for booking!' : undefined,
      },
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWorkflows(prev => [...prev, newRule]);
  };

  const handleRemoveWorkflow = (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
  };

  const handleToggleWorkflow = (id: string, enabled: boolean) => {
    setWorkflows(prev => prev.map(w => (w.id === id ? { ...w, enabled } : w)));
  };

  // Save Event Type
  const handleSave = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Name required', description: 'Please enter an event type name.' });
      return;
    }

    setIsSaving(true);
    try {
      const noticeMins = Math.max(0, parseFloat(minimumNoticeHours || '2') * 60);
      const horizonDays = Math.max(1, parseInt(maximumBookingHorizonDays || '30', 10));
      const bufBefore = Math.max(0, parseInt(bufferBeforeMinutes || '0', 10));
      const bufAfter = Math.max(0, parseInt(bufferAfterMinutes || '0', 10));

      const res = await updateEventTypeAction(eventTypeId, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        durationMinutes,
        slotIntervalMinutes,
        format,
        color,
        status,
        availabilityProfileId: availabilityProfileId || undefined,
        minimumNoticeMinutes: noticeMins,
        maximumBookingHorizonDays: horizonDays,
        bufferBeforeMinutes: bufBefore,
        bufferAfterMinutes: bufAfter,
        teamConfig: {
          strategy: hostStrategy,
          hosts: teamHosts,
          roundRobinDistribution,
        },
        locationType,
        locationDetails: locationDetails.trim() || undefined,
        customQuestions,
        autoTags,
        crmPrefillEnabled,
        confirmationMessage: confirmationMessage.trim(),
      });

      if (res.success) {
        if (activeWorkspaceId) {
          await saveEventTypeWorkflowsAction(eventTypeId, activeWorkspaceId, workflows);
        }
        toast({ title: 'Event Type Saved', description: 'Changes saved successfully.' });
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: res.error || 'Failed to save.' });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainerFluid>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </PageContainerFluid>
    );
  }

  const tabs: { id: EditorTab; label: string; icon: LucideIcon }[] = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'availability', label: 'Availability', icon: Clock },
    { id: 'team', label: 'Team & Hosts', icon: Users },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'questions', label: 'Questions & Form', icon: HelpCircle },
    { id: 'crm', label: 'CRM & Tags', icon: TagIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'workflows', label: 'Automated Workflows', icon: Zap },
  ];

  return (
    <PageContainerFluid>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/meetings/event-types">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{name || 'Edit Event Type'}</h1>
              <Badge variant={status === 'active' ? 'default' : 'secondary'} className="capitalize text-xs">
                {status}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-mono">/book/{slug}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {slug && (
            <Link href={`/book/${slug}`} target="_blank">
              <Button variant="outline" className="rounded-xl min-h-[44px] gap-2">
                <ExternalLink className="w-4 h-4" />
                Preview Booking Page
              </Button>
            </Link>
          )}

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl min-h-[44px] px-5 font-semibold gap-2 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Editor Layout: Persistent Left Nav + Canvas */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 max-w-6xl">
        {/* Left Navigation Tabs */}
        <aside className="md:col-span-3 space-y-1">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full min-h-[44px] shrink-0',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Canvas Content */}
        <main className="md:col-span-9 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Event Overview</CardTitle>
                <CardDescription>Configure title, URL backhalf, duration, and session format.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="event-name" className="text-sm font-semibold">
                    Event Name *
                  </Label>
                  <Input
                    id="event-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. 30-Minute Enrollment Consultation"
                    className="rounded-xl min-h-[44px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-slug" className="text-sm font-semibold">
                    Public Booking URL Slug *
                  </Label>
                  <div className="flex items-center">
                    <span className="bg-muted px-3.5 py-2.5 border border-r-0 border-border rounded-l-xl text-sm text-muted-foreground font-mono shrink-0">
                      /book/
                    </span>
                    <Input
                      id="event-slug"
                      value={slug}
                      onChange={e => setSlug(e.target.value)}
                      placeholder="consultation-30"
                      className="rounded-r-xl rounded-l-none min-h-[44px] font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-desc" className="text-sm font-semibold">
                    Description / Instructions
                  </Label>
                  <Textarea
                    id="event-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Provide details about what will be covered in this session..."
                    rows={4}
                    className="rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="duration-select" className="text-sm font-semibold">
                      Session Duration
                    </Label>
                    <Select
                      value={String(durationMinutes)}
                      onValueChange={v => setDurationMinutes(parseInt(v, 10))}
                    >
                      <SelectTrigger id="duration-select" className="rounded-xl min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {DURATION_OPTIONS.map(d => (
                          <SelectItem key={d} value={String(d)}>
                            {d} minutes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="format-select" className="text-sm font-semibold">
                      Meeting Format
                    </Label>
                    <Select
                      value={format}
                      onValueChange={(v: EventTypeFormat) => setFormat(v)}
                    >
                      <SelectTrigger id="format-select" className="rounded-xl min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="one_to_one">One-on-One (1:1)</SelectItem>
                        <SelectItem value="group">Group Session</SelectItem>
                        <SelectItem value="round_robin">Round Robin (Team)</SelectItem>
                        <SelectItem value="collective">Collective (Multiple Hosts)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Theme Color</Label>
                  <div className="flex items-center gap-3">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={cn(
                          'w-8 h-8 rounded-full transition-transform flex items-center justify-center',
                          color === c ? 'scale-110 ring-2 ring-offset-2 ring-primary' : 'opacity-80 hover:opacity-100'
                        )}
                      >
                        {color === c && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: AVAILABILITY */}
          {activeTab === 'availability' && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Availability & Scheduling Rules</CardTitle>
                <CardDescription>Select which schedule governs this event and configure buffers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="avail-profile-select" className="text-sm font-semibold">
                    Availability Schedule
                  </Label>
                  <Select
                    value={availabilityProfileId || 'default'}
                    onValueChange={v => setAvailabilityProfileId(v === 'default' ? '' : v)}
                  >
                    <SelectTrigger id="avail-profile-select" className="rounded-xl min-h-[44px]">
                      <SelectValue placeholder="Use Workspace Default Schedule" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="default">Use Workspace Default Schedule</SelectItem>
                      {(availabilityProfiles || []).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.timezone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    To customize working hours, visit the{' '}
                    <Link href="/admin/meetings/availability" className="text-primary hover:underline">
                      Availability Schedules Studio
                    </Link>
                    .
                  </p>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="notice-input" className="text-sm font-semibold">
                      Minimum Notice
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="notice-input"
                        type="number"
                        min="0"
                        step="0.5"
                        value={minimumNoticeHours}
                        onChange={e => setMinimumNoticeHours(e.target.value)}
                        className="rounded-xl min-h-[44px]"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">hours</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="horizon-input" className="text-sm font-semibold">
                      Booking Horizon
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="horizon-input"
                        type="number"
                        min="1"
                        max="365"
                        value={maximumBookingHorizonDays}
                        onChange={e => setMaximumBookingHorizonDays(e.target.value)}
                        className="rounded-xl min-h-[44px]"
                      />
                      <span className="text-sm text-muted-foreground shrink-0 font-medium">days in advance</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="buf-before" className="text-sm font-semibold">
                      Buffer Before
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="buf-before"
                        type="number"
                        min="0"
                        step="5"
                        value={bufferBeforeMinutes}
                        onChange={e => setBufferBeforeMinutes(e.target.value)}
                        className="rounded-xl min-h-[44px]"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">minutes</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="buf-after" className="text-sm font-semibold">
                      Buffer After
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="buf-after"
                        type="number"
                        min="0"
                        step="5"
                        value={bufferAfterMinutes}
                        onChange={e => setBufferAfterMinutes(e.target.value)}
                        className="rounded-xl min-h-[44px]"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">minutes</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB: TEAM & HOSTS */}
          {activeTab === 'team' && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Team & Host Assignment</CardTitle>
                <CardDescription>
                  Configure whether this event is hosted by a single person, required collective hosts, or distributed via round-robin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Host Strategy Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div
                    onClick={() => setHostStrategy('single')}
                    className={cn(
                      'p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5',
                      hostStrategy === 'single'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Single Host</span>
                      {hostStrategy === 'single' && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bookings are assigned to the primary event creator.
                    </p>
                  </div>

                  <div
                    onClick={() => setHostStrategy('collective')}
                    className={cn(
                      'p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5',
                      hostStrategy === 'collective'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Collective</span>
                      {hostStrategy === 'collective' && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All selected team hosts must be simultaneously available.
                    </p>
                  </div>

                  <div
                    onClick={() => setHostStrategy('round_robin')}
                    className={cn(
                      'p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5',
                      hostStrategy === 'round_robin'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Round-Robin</span>
                      {hostStrategy === 'round_robin' && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Distribute appointments across team members automatically.
                    </p>
                  </div>
                </div>

                {/* Team Members List (For Collective or Round-Robin) */}
                {(hostStrategy === 'collective' || hostStrategy === 'round_robin') && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Team Hosts Pool</h4>
                        <p className="text-xs text-muted-foreground">Add team members who will participate in this event.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newHost: TeamHostMember = {
                            userId: `user_${Date.now()}`,
                            name: 'Team Member',
                            email: 'member@smartsapp.com',
                            weight: 10,
                            isRequired: true,
                          };
                          setTeamHosts(prev => [...prev, newHost]);
                        }}
                        className="rounded-xl text-xs gap-1.5 h-8"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Team Member
                      </Button>
                    </div>

                    {hostStrategy === 'round_robin' && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Distribution Strategy</Label>
                        <Select
                          value={roundRobinDistribution}
                          onValueChange={v => setRoundRobinDistribution(v as RoundRobinDistribution)}
                        >
                          <SelectTrigger className="w-64 text-xs rounded-xl min-h-[44px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="availability">Optimize for Availability (Load-Balanced)</SelectItem>
                            <SelectItem value="strict_round_robin">Strict Circular Round-Robin</SelectItem>
                            <SelectItem value="weighted">Weighted Percentage Distribution</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-3">
                      {teamHosts.length === 0 ? (
                        <div className="p-8 text-center border-dashed border rounded-xl text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto opacity-30 mb-2" />
                          <p className="text-xs">No team hosts added yet. Click "Add Team Member" above.</p>
                        </div>
                      ) : (
                        teamHosts.map((host, hIdx) => (
                          <div key={host.userId || hIdx} className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between gap-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                              <Input
                                value={host.name}
                                onChange={e => {
                                  const updated = [...teamHosts];
                                  updated[hIdx].name = e.target.value;
                                  setTeamHosts(updated);
                                }}
                                placeholder="Host Name"
                                className="text-xs rounded-lg h-9"
                              />
                              <Input
                                value={host.email}
                                onChange={e => {
                                  const updated = [...teamHosts];
                                  updated[hIdx].email = e.target.value;
                                  setTeamHosts(updated);
                                }}
                                placeholder="Host Email"
                                className="text-xs rounded-lg h-9"
                              />
                            </div>

                            {hostStrategy === 'round_robin' && (
                              <div className="flex items-center gap-1.5 w-24">
                                <Input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={host.weight || 10}
                                  onChange={e => {
                                    const updated = [...teamHosts];
                                    updated[hIdx].weight = parseInt(e.target.value, 10) || 10;
                                    setTeamHosts(updated);
                                  }}
                                  className="text-xs rounded-lg h-9 text-center"
                                />
                                <span className="text-[10px] text-muted-foreground">%</span>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const updated = [...teamHosts];
                                updated.splice(hIdx, 1);
                                setTeamHosts(updated);
                              }}
                              className="h-8 w-8 text-rose-500 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 3: LOCATION */}
          {activeTab === 'location' && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Location & Conferencing</CardTitle>
                <CardDescription>Choose where and how the session will take place.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="loc-type-select" className="text-sm font-semibold">
                    Location Provider
                  </Label>
                  <Select
                    value={locationType}
                    onValueChange={(v: MeetingLocationType) => setLocationType(v)}
                  >
                    <SelectTrigger id="loc-type-select" className="rounded-xl min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="google_meet">Google Meet</SelectItem>
                      <SelectItem value="zoom">Zoom Video</SelectItem>
                      <SelectItem value="teams">Microsoft Teams</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="in_person">In-Person Address</SelectItem>
                      <SelectItem value="custom">Custom Online Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loc-details" className="text-sm font-semibold">
                    {locationType === 'in_person'
                      ? 'Physical Address'
                      : locationType === 'phone'
                      ? 'Phone Instructions'
                      : 'Meeting URL / Details'}
                  </Label>
                  <Input
                    id="loc-details"
                    value={locationDetails}
                    onChange={e => setLocationDetails(e.target.value)}
                    placeholder={
                      locationType === 'in_person'
                        ? 'e.g. 123 Main Street, Suite 400'
                        : locationType === 'phone'
                        ? 'Host will call attendee at their phone number'
                        : 'e.g. https://meet.google.com/abc-defg-hij'
                    }
                    className="rounded-xl min-h-[44px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    This location will be displayed on confirmation pages and included in the `.ics` calendar invitation.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: QUESTIONS & FORM */}
          {activeTab === 'questions' && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Booking Form Questions</CardTitle>
                  <CardDescription>Customize the details captured from attendees at checkout.</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuestionModalOpen(true)}
                  className="rounded-xl min-h-[44px] gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Question
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Default Locked Fields */}
                <div className="p-3.5 rounded-xl border border-border bg-muted/40 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm">Full Name</span>
                    <p className="text-xs text-muted-foreground">First Name, Last Name</p>
                  </div>
                  <Badge variant="secondary" className="rounded-lg text-xs">Required</Badge>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-muted/40 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm">Email Address</span>
                    <p className="text-xs text-muted-foreground">Primary attendee email for confirmations</p>
                  </div>
                  <Badge variant="secondary" className="rounded-lg text-xs">Required</Badge>
                </div>

                {/* Custom Fields */}
                {customQuestions.map(q => (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{q.label}</span>
                        {q.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">Type: {q.type}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveQuestion(q.id)}
                      className="text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* TAB 5: CRM & TAGS */}
          {activeTab === 'crm' && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">CRM Lead Capture & Tags</CardTitle>
                <CardDescription>
                  Automatically sync bookings to CRM entities and apply automated tags.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">CRM Auto-Prefill</Label>
                    <p className="text-xs text-muted-foreground">
                      Pre-populate booking form when attendee arrives with a contact token.
                    </p>
                  </div>
                  <Switch checked={crmPrefillEnabled} onCheckedChange={setCrmPrefillEnabled} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Auto-Apply Tags</Label>
                  <p className="text-xs text-muted-foreground">
                    These tags will automatically be applied to the contact entity upon confirmed booking.
                  </p>
                  {/* Standard TagSelector running in client/draft mode */}
                  <TagSelector
                    currentTagIds={autoTags}
                    onTagsChange={tags => setAutoTags(tags)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 6: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Confirmation & Notifications</CardTitle>
                <CardDescription>Configure success message copy and post-booking messaging.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="conf-msg" className="text-sm font-semibold">
                    Confirmation Success Message
                  </Label>
                  <Textarea
                    id="conf-msg"
                    value={confirmationMessage}
                    onChange={e => setConfirmationMessage(e.target.value)}
                    rows={3}
                    placeholder="Your booking is confirmed! See you then."
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Displayed on the public confirmation page after successful reservation.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 8: WORKFLOWS & AUTOMATION */}
          {activeTab === 'workflows' && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" />
                      Automated Lifecycle Workflows
                    </CardTitle>
                    <CardDescription>
                      Configure automated triggers before and after meetings (WhatsApp/SMS reminders, lead scoring, CRM tasks).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Trigger presets */}
                <div className="p-4 rounded-xl bg-muted/30 border space-y-3">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                    Add Lifecycle Action
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddWorkflow('before_24h', 'send_whatsapp')}
                      className="rounded-xl text-xs gap-1.5 active:scale-[0.97]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      24h WhatsApp Reminder
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddWorkflow('after_attended', 'update_lead_score')}
                      className="rounded-xl text-xs gap-1.5 active:scale-[0.97]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Lead Score on Attendance (+10)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddWorkflow('after_attended', 'create_crm_task')}
                      className="rounded-xl text-xs gap-1.5 active:scale-[0.97]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Follow-up Task on Completion
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddWorkflow('on_no_show', 'send_email')}
                      className="rounded-xl text-xs gap-1.5 active:scale-[0.97]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      No-Show Re-engagement Email
                    </Button>
                  </div>
                </div>

                {/* Workflow Rules List */}
                <div className="space-y-3">
                  {workflows.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground space-y-2">
                      <Zap className="w-8 h-8 mx-auto opacity-30" />
                      <p className="text-sm font-medium">No automated workflows configured</p>
                      <p className="text-xs">Click a preset above to create an automated lifecycle action.</p>
                    </div>
                  ) : (
                    workflows.map(rule => (
                      <div
                        key={rule.id}
                        className="p-4 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                              {rule.trigger.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs font-semibold text-foreground">
                              {rule.actionType.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>
                          {rule.config.customMessage && (
                            <p className="text-xs text-muted-foreground italic">
                              "{rule.config.customMessage}"
                            </p>
                          )}
                          {rule.config.scoreDelta && (
                            <p className="text-xs text-emerald-600 font-medium">
                              Score change: +{rule.config.scoreDelta} pts
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={v => handleToggleWorkflow(rule.id, v)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveWorkflow(rule.id)}
                            className="h-8 w-8 text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* Add Custom Question Modal */}
      <Dialog open={questionModalOpen} onOpenChange={setQuestionModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Question</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="q-label" className="text-sm font-semibold">
                Question Label *
              </Label>
              <Input
                id="q-label"
                value={newQuestionLabel}
                onChange={e => setNewQuestionLabel(e.target.value)}
                placeholder="e.g. What would you like to discuss?"
                className="rounded-xl min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Field Type</Label>
              <Select
                value={newQuestionType}
                onValueChange={(v: BookingField['type']) => setNewQuestionType(v)}
              >
                <SelectTrigger className="rounded-xl min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="text">Single Line Text</SelectItem>
                  <SelectItem value="textarea">Multi-line Textarea</SelectItem>
                  <SelectItem value="phone">Phone Number</SelectItem>
                  <SelectItem value="email">Email Address</SelectItem>
                  <SelectItem value="checkbox">Checkbox (Yes/No)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="q-placeholder" className="text-sm font-semibold">
                Placeholder Text (Optional)
              </Label>
              <Input
                id="q-placeholder"
                value={newQuestionPlaceholder}
                onChange={e => setNewQuestionPlaceholder(e.target.value)}
                placeholder="e.g. Briefly describe your goals..."
                className="rounded-xl min-h-[44px]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="q-req-switch" className="text-sm font-semibold cursor-pointer">
                Required Field
              </Label>
              <Switch
                id="q-req-switch"
                checked={newQuestionRequired}
                onCheckedChange={setNewQuestionRequired}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuestionModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddQuestion} className="rounded-xl">
              Add Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainerFluid>
  );
}
