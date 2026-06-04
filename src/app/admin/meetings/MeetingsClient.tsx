
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, orderBy, query, where, doc, deleteDoc, addDoc, getDocs, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { Meeting, WorkspaceEntity, Entity } from '@/lib/types';
import { useEntityCache } from '@/context/EntityCacheContext';
import { MEETING_TYPES } from '@/lib/types';
import { getEntityEmail } from '@/lib/entity-helpers';
import { useTerminology } from '@/hooks/use-terminology';
import { Button } from '@/components/ui/button';
import { cancelRemindersForMeeting } from '@/lib/reminder-actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
    MoreHorizontal, 
    Copy, 
    ExternalLink, 
    Edit, 
    Trash2, 
    Send, 
    PlusCircle, 
    Calendar as CalendarIcon, 
    BarChart3, 
    LayoutList, 
    Users,
    ClipboardCheck,
    LayoutGrid,
    Loader2,
    Plus,
    Calendar,
    Search,
    Filter,
    MoreVertical,
    Edit3,
    Save,
    Check,
    School,
    Video,
    Globe,
    X
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AsyncEntityAvatar } from '../components/AsyncEntityAvatar';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext'; // Added useTenant import
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
import { QrCode } from 'lucide-react';

const MeetingCalendar = dynamic(() => import('./components/MeetingCalendar'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading Calendar Map...</p>
    </div>
  )
});

const MeetingQRDialog = dynamic(() => import('./components/MeetingQRDialog'), { ssr: false });
import { PageContainerFluid } from '@/components/ui/page-container';

const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function MeetingStats({ meetingId }: { meetingId: string }) {
  const firestore = useFirestore();
  const registrantsQuery = useMemoFirebase(() => {
    if (!firestore || !meetingId) return null;
    return collection(firestore, `meetings/${meetingId}/registrants`);
  }, [firestore, meetingId]);

  const { data: registrants, isLoading } = useCollection<any>(registrantsQuery);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground/60 animate-pulse">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading stats...</span>
      </div>
    );
  }

  const invited = registrants?.filter(r => r.source === 'invite' || r.source === 'one-click').length ?? 0;
  const registrantsCount = registrants?.filter(r => r.status === 'approved' || r.status === 'attended' || r.status === 'registered').length ?? 0;
  const attendees = registrants?.filter(r => r.status === 'attended').length ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
      <span className="text-primary">{invited} Invited</span>
      <span className="text-muted-foreground/30">•</span>
      <span className="text-emerald-600 dark:text-emerald-400">{registrantsCount} Registrants</span>
      <span className="text-muted-foreground/30">•</span>
      <span className="text-blue-600 dark:text-blue-400">{attendees} Attendees</span>
    </div>
  );
}

/**
 * @fileOverview High-fidelity Meetings Hub Client.
 * Upgraded with Multi-Workspace Sharing logic and server-side array filtering.
 */
export default function MeetingsHubClient() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeView, setActiveView] = useState('list');
  const [meetingForQR, setMeetingForQR] = useState<Meeting | null>(null);
  const [meetingForTemplate, setMeetingForTemplate] = useState<Meeting | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const handleSaveName = async (meetingId: string) => {
    if (!firestore || !editingName.trim()) return;
    setIsUpdating(true);
    try {
      const docRef = doc(firestore, 'meetings', meetingId);
      await updateDoc(docRef, { 
        title: editingName.trim(),
        entityName: editingName.trim() 
      });
      toast({
        title: 'Meeting updated',
        description: 'Meeting internal name has been successfully updated.',
      });
      setEditingMeetingId(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err.message || 'An error occurred.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const { singular, plural } = useTerminology();

  const meetingsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'meetings');
  }, [firestore]);
  
  // HIGH PERFORMANCE: Filter by workspaceId array on the server
  const meetingsQuery = useMemoFirebase(() => {
    if (!meetingsCol || !activeWorkspaceId) return null;
    return query(
        meetingsCol, 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        orderBy('meetingTime', 'desc')
    );
  }, [meetingsCol, activeWorkspaceId]);



  const { data: meetings, isLoading: isLoadingMeetings, error } = useCollection<Meeting>(meetingsQuery);
  const { entities, isLoading: isLoadingEntities } = useEntityCache();

  const isLoading = isLoadingMeetings || isLoadingEntities || isLoadingFilter;

  const entityLogoMap = useMemo(() => {
    if (!entities) return new Map<string, string | undefined>();
    return new Map(entities.map(s => [s.entityId, s.logoUrl]));
  }, [entities]);

  const entityEmailMap = useMemo(() => {
    if (!entities) return new Map<string, string | undefined>();
    return new Map(entities.map(s => [s.entityId, getEntityEmail(s as any)]));
  }, [entities]);

  const filteredMeetings = useMemo(() => {
    if (!meetings || !entities) return [];
    
    let temp = meetings;

    // Filter by assigned user
    if (assignedUserId) {
        const filteredEntityIds = new Set(
            entities.filter(entity => {
                if (assignedUserId === 'unassigned') {
                    return !entity.assignedTo?.userId;
                }
                return entity.assignedTo?.userId === assignedUserId;
            }).map(s => s.entityId)
        );
        temp = temp.filter(m => {
            if (!m.entityId) return assignedUserId === 'all' || !assignedUserId; // Standalone meetings only show if no specific user filter or 'all'
            return filteredEntityIds.has(m.entityId);
        });
    }

    // Then filter by type
    if (typeFilter !== 'all') {
        temp = temp.filter(m => m.type?.id === typeFilter);
    }
    
    return temp;
  }, [meetings, entities, typeFilter, assignedUserId]);

  const handleDeleteMeeting = () => {
    if (!firestore || !meetingToDelete) return;

    const docRef = doc(firestore, 'meetings', meetingToDelete.id);
    
    // Task 12.4: Cancel reminders before deleting the meeting
    cancelRemindersForMeeting(meetingToDelete.id).catch(err => 
      console.warn("Reminder cancellation deferred:", err.message)
    );
    
    deleteDoc(docRef)
      .then(() => {
        toast({
          title: 'Meeting Deleted',
          description: `The meeting for ${meetingToDelete.entityName} has been deleted.`,
        });
        setMeetingToDelete(null);
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Error deleting meeting',
          description: 'You may not have the required permissions.',
        });
        setMeetingToDelete(null);
      });
  };

  if (error) {
 return <div className="text-destructive p-8 text-left">Error loading meetings: {error.message}</div>;
  }

  const handleSaveAsTemplate = async () => {
    if (!meetingForTemplate || !firestore || !activeWorkspaceId) return;
    setIsSavingTemplate(true);
    try {
        const templatesRef = collection(firestore, 'custom_meeting_templates');
        await addDoc(templatesRef, {
            title: templateName,
            description: templateDesc,
            typeId: meetingForTemplate.type?.id || '',
            workspaceId: activeWorkspaceId,
            createdAt: new Date().toISOString(),
            defaults: {
                heroTitle: meetingForTemplate.heroTitle || '',
                heroDescription: meetingForTemplate.heroDescription || '',
                heroTagline: meetingForTemplate.heroTagline || '',
                heroCtaLabel: meetingForTemplate.heroCtaLabel || '',
                logoUrl: meetingForTemplate.logoUrl || '',
                brandingEnabled: meetingForTemplate.brandingEnabled ?? true,
                heroLayout: meetingForTemplate.heroLayout || 'image',
                registrationEnabled: meetingForTemplate.registrationEnabled ?? false,
                registrationRequiredToJoin: meetingForTemplate.registrationRequiredToJoin ?? false,
                registrationMode: meetingForTemplate.registrationMode || 'open',
                registrationFields: meetingForTemplate.registrationFields || [],
                registrationSuccessMessage: meetingForTemplate.registrationSuccessMessage || '',
                capacityLimit: meetingForTemplate.capacityLimit || 0,
                waitlistEnabled: meetingForTemplate.waitlistEnabled ?? false,
            }
        });
        toast({ title: "Template Saved", description: "You can now use this layout for new sessions." });
        setMeetingForTemplate(null);
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Failed to save template", description: error.message });
    } finally {
        setIsSavingTemplate(false);
    }
  };

  const renderActions = (meeting: Meeting) => {
    const type = meeting.type || MEETING_TYPES[0];
    const entityEmail = meeting.entityId ? entityEmailMap.get(meeting.entityId) : undefined;
    const typeSlug = type.slug === 'parent' ? 'parent-engagement' : (type.slug || 'session');
    const publicUrl = `/meetings/${typeSlug}/${meeting.meetingSlug || meeting.entitySlug}`;

    return (
  <div className="flex items-center justify-end gap-1">
        <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
  className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
              onClick={() => {
                if (typeof window !== 'undefined') {
                   const url = `${window.location.origin}${publicUrl}`;
                  navigator.clipboard.writeText(url);
                  toast({
                    title: "Link Copied",
                    description: "Public meeting URL copied to clipboard.",
                  });
                }
              }}
            >
  <Copy className="h-4 w-4" />
  <span className="sr-only">Copy link</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy Public Link</p>
          </TooltipContent>
        </Tooltip>
 
        <Tooltip>
          <TooltipTrigger asChild>
  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
  <ExternalLink className="h-4 w-4" />
  <span className="sr-only">View public page</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View Public Page</p>
          </TooltipContent>
        </Tooltip>
 
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
  className="h-8 w-8 text-primary hover:bg-primary/5 transition-colors"
              asChild
            >
              <Link href={`/admin/meetings/${meeting.id}/results`}>
  <BarChart3 className="h-4 w-4" />
  <span className="sr-only">View reports</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View Intelligence</p>
          </TooltipContent>
        </Tooltip>
        </TooltipProvider>
 
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
  <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary transition-colors">
  <span className="sr-only">Open menu</span>
  <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
  <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground px-3">Management</DropdownMenuLabel>
            <DropdownMenuItem asChild>
                <Link href={`/admin/meetings/${meeting.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span>View Details</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link href={`/admin/meetings/${meeting.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit Architecture</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link href={`/admin/messaging/composer?category=meetings&meetingId=${meeting.id}&recipient=${entityEmail || ''}&var_school_name=${encodeURIComponent(meeting.entityName || '')}&var_meeting_type=${encodeURIComponent(type.name)}&var_date=${format(new Date(meeting.meetingTime), 'PPP')}&var_time=${format(new Date(meeting.meetingTime), 'p')}&var_link=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : '')}&var__meetingId=${meeting.id}`}>
                    <Send className="mr-2 h-4 w-4" />
                    <span>Send Invite/Reminder</span>
                </Link>
            </DropdownMenuItem>
            {meeting.registrationEnabled && (
                <DropdownMenuItem asChild>
                    <Link href={`/admin/meetings/${meeting.id}/registrants`}>
  <Users className="mr-2 h-4 w-4" />
                        <span>View Registrants</span>
                    </Link>
                </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
                <Link href={`/admin/meetings/${meeting.id}/invitations`}>
                    <Send className="mr-2 h-4 w-4" />
                    <span>Manage Invitations</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMeetingForQR(meeting)}>
                <QrCode className="mr-2 h-4 w-4" />
                <span>Generate QR Code</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => {
                setMeetingForTemplate(meeting);
                setTemplateName(meeting.heroTitle || (meeting.entityName ? `${meeting.entityName} Layout` : 'New Template'));
                setTemplateDesc(`Custom layout based on ${meeting.heroTitle || 'previous session'}.`);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span>Save as Template</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
  className="text-destructive focus:text-destructive-foreground focus:bg-destructive/10"
              onClick={() => setMeetingToDelete(meeting)}
            >
  <Trash2 className="mr-2 h-4 w-4" />
               <span>Delete Session</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

    return (
        <TooltipProvider>
            <PageContainerFluid>
            <div className="h-full overflow-y-auto w-full">
                <div className="space-y-8 pb-32 w-full">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex flex-col items-start">
                            <h1 className="text-3xl font-bold text-foreground">
                                Meetings and Webinars
                            </h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                Scheduled meetings, webinars, and attendance data
                            </p>
                        </div>
                        <div className="flex justify-end items-center gap-3 shrink-0">
                            <Button asChild className="rounded-xl font-bold shadow-lg h-11 px-6">
                                <Link href="/admin/meetings/new">
                                    <PlusCircle className="mr-2 h-5 w-5" />
                                    Schedule New Session
                                </Link>
                            </Button>
                        </div>
                    </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
  <Tabs value={activeView} onValueChange={setActiveView} className="w-fit">
            <TabsList className="bg-transparent border border-border shadow-sm p-1 h-12 rounded-xl ring-1 ring-border">
                <TabsTrigger value="list" className="rounded-lg font-semibold text-[10px] px-8 gap-2">
                    <LayoutList className="h-4 w-4" /> Hub Registry
                </TabsTrigger>
                <TabsTrigger value="calendar" className="rounded-lg font-semibold text-[10px] px-8 gap-2">
                    <LayoutGrid className="h-4 w-4" /> Temporal Map
                </TabsTrigger>
            </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[280px] max-w-sm border border-border bg-transparent shadow-sm rounded-3xl p-4 ring-1 ring-border">
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
  <SelectTrigger className="h-10 rounded-lg bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                <SelectValue placeholder="Filter by category..." />
                            </SelectTrigger>
  <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Meeting Categories</SelectItem>
                                {MEETING_TYPES.map(type => (
                                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
            </div>
            </div>
            
  <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
  <TabsContent value="list" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
  <div className="rounded-2xl border border-border bg-transparent text-card-foreground shadow-sm overflow-hidden ring-1 ring-border">
                        <Table>
  <TableHeader className="bg-muted/30">
                            <TableRow>
  <TableHead className="w-[80px]"></TableHead>
  <TableHead className="text-[10px] font-semibold py-4">{singular} Context</TableHead>
  <TableHead className="w-[220px] text-[10px] font-semibold py-4">Meeting Schedule</TableHead>
  <TableHead className="text-[10px] font-semibold py-4">Response Stats</TableHead>
  <TableHead className="w-[160px] text-right pr-6 text-[10px] font-semibold py-4">Actions</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
  <TableCell className="pl-6"><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
  <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
  <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
  <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                </TableRow>
                                ))
                            ) : filteredMeetings && filteredMeetings.length > 0 ? (
                                filteredMeetings.map((meeting) => {
                                 const type = meeting.type || MEETING_TYPES[0];
                                 const logoUrl = meeting.entityId ? entityLogoMap.get(meeting.entityId) : undefined;
                                 const safeEntityName = meeting.title || meeting.entityName || (meeting.entityId ? entities?.find(e => e.entityId === meeting.entityId)?.displayName : null) || meeting.heroTitle || 'Standalone Session';
                                 
                                 const isActive = meeting.status !== 'ended' && meeting.status !== 'cancelled';
                                return (
                                <TableRow key={meeting.id} className="group hover:bg-muted/30 transition-colors">
                                    <TableCell className="pl-6">
                                        <AsyncEntityAvatar 
                                            entityId={meeting.entityId || ''}
                                            src={logoUrl} 
                                            name={safeEntityName} 
                                            className="h-10 w-10 ring-2 ring-border/50 shadow-sm"
                                        />
                                    </TableCell>
                                    <TableCell className="font-semibold text-sm text-foreground tracking-tight py-4">
                                        <div className="flex flex-col gap-1.5">
                                            {/* Pills row */}
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-[9px] font-semibold uppercase px-2 py-0.5">
                                                    {type.name}
                                                </Badge>
                                                {isActive ? (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                        {meeting.status === 'ended' ? 'Ended' : 'Paused'}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Editable internal name */}
                                            {editingMeetingId === meeting.id ? (
                                                <div className="flex items-center gap-2 max-w-xs">
                                                    <input
                                                        type="text"
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        className="h-8 px-2 border rounded-lg text-xs font-semibold w-full focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                                                        disabled={isUpdating}
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveName(meeting.id);
                                                            if (e.key === 'Escape') setEditingMeetingId(null);
                                                        }}
                                                    />
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                                                        onClick={() => handleSaveName(meeting.id)}
                                                        disabled={isUpdating}
                                                    >
                                                        {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-4 w-4" />}
                                                    </Button>
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 shrink-0"
                                                        onClick={() => setEditingMeetingId(null)}
                                                        disabled={isUpdating}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 group/title">
                                                    <Link href={`/admin/meetings/${meeting.id}`} className="hover:text-primary hover:underline transition-colors text-sm font-semibold">
                                                        {safeEntityName}
                                                    </Link>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6 opacity-0 group-hover/title:opacity-100 transition-opacity rounded-md hover:bg-muted"
                                                        onClick={() => {
                                                            setEditingMeetingId(meeting.id);
                                                            setEditingName(meeting.title || meeting.entityName || safeEntityName);
                                                        }}
                                                    >
                                                        <Edit3 className="h-3 w-3 text-muted-foreground" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>

                                    <TableCell className="text-xs font-bold text-muted-foreground tracking-tighter tabular-nums">
                                        {meeting.meetingTime ? format(new Date(meeting.meetingTime), "PPP · p") : 'Not set'}
                                    </TableCell>
                                    <TableCell>
                                        <MeetingStats meetingId={meeting.id} />
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        {renderActions(meeting)}
                                    </TableCell>
                                    </TableRow>
                                )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                                            <CalendarIcon className="h-12 w-12" />
                                            <p className="text-xs font-semibold ">No meetings recorded</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

 <TabsContent value="calendar" className="m-0 animate-in fade-in zoom-in-95 duration-500">
                    <MeetingCalendar meetings={filteredMeetings} onMeetingClick={(m) => router.push(`/admin/meetings/${m.id}/results`)} />
                </TabsContent>
            </Tabs>
                </div>
            </div>

        <AlertDialog open={!!meetingToDelete} onOpenChange={(open) => !open && setMeetingToDelete(null)}>
          <AlertDialogContent className="rounded-[2.5rem]">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-semibold tracking-tight">Purge Session Architecture?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm font-medium">
                This will permanently remove the scheduled session for <span className="font-bold text-foreground">"{meetingToDelete?.entityName}"</span> and its attendance logic.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMeeting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-semibold px-8 shadow-xl">Delete Protocol</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {meetingForQR && (
            <MeetingQRDialog
                open={!!meetingForQR}
                onOpenChange={(open) => !open && setMeetingForQR(null)}
                meetingTitle={meetingForQR.heroTitle || meetingForQR.entityName || meetingForQR.type.name}
                publicUrl={meetingForQR.meetingSlug 
                    ? `/meetings/${meetingForQR.type?.slug === 'parent' ? 'parent-engagement' : (meetingForQR.type?.slug || 'session')}/${meetingForQR.meetingSlug}` 
                    : `/sessions/${meetingForQR.entitySlug || meetingForQR.id}/${meetingForQR.type?.slug === 'parent' ? 'parent-engagement' : (meetingForQR.type?.slug || 'session')}`
                }
            />
        )}

        {/* Save as Template Dialog */}
        <AlertDialog open={!!meetingForTemplate} onOpenChange={(open) => !open && setMeetingForTemplate(null)}>
            <AlertDialogContent className="rounded-[2rem]">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <PlusCircle className="h-5 w-5 text-primary" />
                        Save as Meeting Template
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Convert this session&apos;s layout, branding, and registration settings into a reusable template.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Template Name</label>
                        <input 
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="e.g. Annual Parent Conference"
                            className="w-full h-12 px-4 rounded-xl border-none bg-muted/30 focus:ring-1 focus:ring-primary/20 font-semibold"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Short Description</label>
                        <textarea 
                            value={templateDesc}
                            onChange={(e) => setTemplateDesc(e.target.value)}
                            placeholder="Describe when to use this template..."
                            className="w-full p-4 rounded-xl border-none bg-muted/30 focus:ring-1 focus:ring-primary/20 font-medium text-sm min-h-[100px] resize-none"
                        />
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                    <Button 
                        onClick={handleSaveAsTemplate} 
                        disabled={isSavingTemplate || !templateName} 
                        className="rounded-xl font-bold px-8 shadow-lg"
                    >
                        {isSavingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Template
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        </PageContainerFluid>
        </TooltipProvider>
  );
}
