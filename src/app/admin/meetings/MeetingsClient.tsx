
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, orderBy, query, where, doc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { Meeting, WorkspaceEntity, Entity } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { getEntityEmail } from '@/lib/entity-helpers';
import { useTerminology } from '@/hooks/use-terminology';
import { Button } from '@/components/ui/button';
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
    LayoutGrid
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext'; // Added useTenant import
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MeetingCalendar from './components/MeetingCalendar';

const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
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

  const entitiesCol = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);

  const { data: meetings, isLoading: isLoadingMeetings, error } = useCollection<Meeting>(meetingsQuery);
  const { data: entities, isLoading: isLoadingEntities } = useCollection<WorkspaceEntity>(entitiesCol);

  const globalEntitiesCol = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(collection(firestore, 'entities'), where('organizationId', '==', activeOrganizationId));
  }, [firestore, activeOrganizationId]);

  const { data: globalEntities, isLoading: isLoadingGlobalEntities } = useCollection<Entity>(globalEntitiesCol);

  const isLoading = isLoadingMeetings || isLoadingEntities || isLoadingGlobalEntities || isLoadingFilter;

  const entityLogoMap = useMemo(() => {
    if (!globalEntities) return new Map<string, string | undefined>();
    return new Map(globalEntities.map(s => [s.id, s.institutionData?.logoUrl]));
  }, [globalEntities]);

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
        temp = temp.filter(m => m.entityId && filteredEntityIds.has(m.entityId));
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

  const renderActions = (meeting: Meeting) => {
    const type = meeting.type || MEETING_TYPES[0];
    const entityEmail = meeting.entityId ? entityEmailMap.get(meeting.entityId) : undefined;
    const publicUrl = `/meetings/${type.slug}/${meeting.entitySlug}`;

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
                <Link href={`/admin/meetings/${meeting.id}/edit`}>
 <Edit className="mr-2 h-4 w-4" />
                    <span>Edit Architecture</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link href={`/admin/messaging/composer?recipient=${entityEmail || ''}&var_school_name=${encodeURIComponent(meeting.entityName || '')}&var_meeting_type=${encodeURIComponent(type.name)}&var_date=${format(new Date(meeting.meetingTime), 'PPP')}&var_time=${format(new Date(meeting.meetingTime), 'p')}&var_link=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : '')}&var__meetingId=${meeting.id}`}>
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
 <div className="h-full overflow-y-auto  bg-background">
 <div className=" space-y-8">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <Tabs value={activeView} onValueChange={setActiveView} className="w-fit">
 <TabsList className="bg-background border shadow-sm p-1 h-12 rounded-2xl">
 <TabsTrigger value="list" className="rounded-xl font-semibold text-[10px] px-8 gap-2">
 <LayoutList className="h-4 w-4" /> Hub Registry
                        </TabsTrigger>
 <TabsTrigger value="calendar" className="rounded-xl font-semibold text-[10px] px-8 gap-2">
 <LayoutGrid className="h-4 w-4" /> Temporal Map
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

 <div className="flex justify-end items-center gap-3 shrink-0">
 <Button asChild className="rounded-xl font-bold shadow-lg h-11 px-6">
                        <Link href="/admin/meetings/new">
 <PlusCircle className="mr-2 h-5 w-5" />
                            Schedule New Session
                        </Link>
                    </Button>
                </div>
            </div>

 <div className="flex flex-wrap items-center justify-between gap-4">
 <Card className="flex-1 min-w-[280px] max-w-sm border-none shadow-sm ring-1 ring-border rounded-xl bg-card overflow-hidden">
 <CardContent className="p-2">
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
                    </CardContent>
                </Card>
            </div>
            
 <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
 <TabsContent value="list" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
 <div className="rounded-2xl border border-border/50 bg-card text-card-foreground shadow-sm overflow-hidden ring-1 ring-black/5">
                        <Table>
 <TableHeader className="bg-muted/30">
                            <TableRow>
 <TableHead className="w-[80px]"></TableHead>
 <TableHead className="text-[10px] font-semibold py-4">{singular} Context</TableHead>
 <TableHead className="text-[10px] font-semibold py-4">Protocol Type</TableHead>
 <TableHead className="w-[250px] text-[10px] font-semibold py-4">Target Window</TableHead>
 <TableHead className="text-[10px] font-semibold py-4">Portal Status</TableHead>
 <TableHead className="w-[160px] text-right pr-6 text-[10px] font-semibold py-4">Actions</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
 <TableCell className="pl-6"><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
 <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
 <TableCell><Skeleton className="h-6 w-24" /></TableCell>
 <TableCell><Skeleton className="h-5 w-full" /></TableCell>
 <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
 <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                </TableRow>
                                ))
                            ) : filteredMeetings && filteredMeetings.length > 0 ? (
                                filteredMeetings.map((meeting) => {
                                const type = meeting.type || MEETING_TYPES[0];
                                 const logoUrl = meeting.entityId ? entityLogoMap.get(meeting.entityId) : undefined;
                                 const safeEntityName = meeting.entityName || (entities?.find(e => e.entityId === meeting.entityId)?.displayName) || 'Unknown Entity';
                                return (
                                <TableRow key={meeting.id} className="group hover:bg-muted/30 transition-colors">
                                    <TableCell className="pl-6">
                                        <Avatar className="h-10 w-10 ring-2 ring-border/50 shadow-sm">
                                        <AvatarImage src={logoUrl} alt={safeEntityName} />
                                        <AvatarFallback className="font-bold text-xs">{getInitials(safeEntityName)}</AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                    <TableCell className="font-semibold text-sm text-foreground tracking-tight">
                                        <Link href={`/admin/meetings/${meeting.id}/edit`} className="hover:text-primary hover:underline transition-colors">
                                            {safeEntityName}
                                        </Link>
                                    </TableCell>
                                    <TableCell><Badge variant="secondary" className="text-[9px] font-semibold uppercase ">{type.name}</Badge></TableCell>
 <TableCell className="text-xs font-bold text-muted-foreground tracking-tighter tabular-nums">
                                        {meeting.meetingTime ? format(new Date(meeting.meetingTime), "PPP · p") : 'Not set'}
                                    </TableCell>
                                    <TableCell>
 <div className="flex items-center gap-2">
 <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
 <span className="text-[10px] font-semibold text-muted-foreground tracking-tighter">Gateway Authorized</span>
                                        </div>
                                    </TableCell>
 <TableCell className="text-right pr-6">
                                        {renderActions(meeting)}
                                    </TableCell>
                                    </TableRow>
                                )
                                })
                            ) : (
                                <TableRow>
 <TableCell colSpan={6} className="h-64 text-center">
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
    </TooltipProvider>
  );
}
