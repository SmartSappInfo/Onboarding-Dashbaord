'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { Meeting, School } from '@/lib/types';
import { MEETING_TYPES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Copy, ExternalLink, Edit, Trash2, Send } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export default function MeetingsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();

  const meetingsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'meetings');
  }, [firestore]);
  
  const meetingsQuery = useMemoFirebase(() => {
    if (!meetingsCol) return null;
    return query(meetingsCol, orderBy('meetingTime', 'desc'));
  }, [meetingsCol]);

  const schoolsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'schools');
  }, [firestore]);

  const { data: meetings, isLoading: isLoadingMeetings, error } = useCollection<Meeting>(meetingsQuery);
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);

  const isLoading = isLoadingMeetings || isLoadingSchools || isLoadingFilter;

  const schoolLogoMap = useMemo(() => {
    if (!schools) return new Map<string, string | undefined>();
    return new Map(schools.map(s => [s.id, s.logoUrl]));
  }, [schools]);

  const schoolEmailMap = useMemo(() => {
    if (!schools) return new Map<string, string | undefined>();
    return new Map(schools.map(s => [s.id, s.email]));
  }, [schools]);

  const filteredMeetings = useMemo(() => {
    if (!meetings || !schools) return [];
    
    // Filter by assigned user first
    let userFilteredMeetings = meetings;
    if (assignedUserId) {
        const filteredSchoolIds = new Set(
            schools.filter(school => {
                if (assignedUserId === 'unassigned') {
                    return !school.assignedTo?.userId;
                }
                return school.assignedTo?.userId === assignedUserId;
            }).map(s => s.id)
        );
        userFilteredMeetings = meetings.filter(m => filteredSchoolIds.has(m.schoolId));
    }

    // Then filter by type
    if (typeFilter === 'all') return userFilteredMeetings;
    return userFilteredMeetings.filter(m => m.type?.id === typeFilter);
  }, [meetings, schools, typeFilter, assignedUserId]);

  const handleDeleteMeeting = () => {
    if (!firestore || !meetingToDelete) return;

    const docRef = doc(firestore, 'meetings', meetingToDelete.id);
    deleteDoc(docRef)
      .then(() => {
        toast({
          title: 'Meeting Deleted',
          description: `The meeting for ${meetingToDelete.schoolName} has been deleted.`,
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
    return <div className="text-destructive">Error loading meetings: {error.message}</div>;
  }

  const renderActions = (meeting: Meeting) => {
    const type = meeting.type || MEETING_TYPES[0];
    const schoolEmail = schoolEmailMap.get(meeting.schoolId);
    const publicUrl = `/meetings/${type.slug}/${meeting.schoolSlug}`;

    return (
      <div className="flex items-center justify-end gap-1">
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
              className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
              onClick={() => router.push(`/admin/meetings/${meeting.id}/edit`)}
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">Edit meeting</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit Details</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary transition-colors">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-[10px] uppercase font-black text-muted-foreground px-3">Management</DropdownMenuLabel>
            <DropdownMenuItem asChild>
                <Link href={`/admin/messaging/composer?recipient=${schoolEmail || ''}&var_school_name=${encodeURIComponent(meeting.schoolName)}&var_meeting_type=${encodeURIComponent(type.name)}&var_date=${format(new Date(meeting.meetingTime), 'PPP')}&var_time=${format(new Date(meeting.meetingTime), 'p')}&var_link=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}${publicUrl}` : '')}`}>
                    <Send className="mr-2 h-4 w-4" />
                    <span>Send Invite/Reminder</span>
                </Link>
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
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="w-full max-w-xs">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                <SelectValue placeholder="Filter by type..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Meeting Types</SelectItem>
                {MEETING_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button asChild className="rounded-xl font-bold shadow-lg">
            <Link href="/admin/meetings/new">Add New Meeting</Link>
          </Button>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block rounded-2xl border border-border/50 bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[80px]"></TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest py-4">School Name</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest py-4">Type</TableHead>
                <TableHead className="w-[250px] text-[10px] font-bold uppercase tracking-widest py-4">Meeting Time</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest py-4">Public Status</TableHead>
                <TableHead className="w-[160px] text-right pr-6 text-[10px] font-bold uppercase tracking-widest py-4">Actions</TableHead>
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
                  const logoUrl = schoolLogoMap.get(meeting.schoolId);
                  return (
                    <TableRow key={meeting.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6">
                        <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                          <AvatarImage src={logoUrl} alt={meeting.schoolName} />
                          <AvatarFallback className="font-bold text-xs">{getInitials(meeting.schoolName)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-black text-sm text-foreground">
                        <Link href={`/admin/meetings/${meeting.id}/edit`} className="hover:text-primary hover:underline transition-colors">
                            {meeting.schoolName}
                        </Link>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px] font-bold uppercase">{type.name}</Badge></TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {meeting.meetingTime ? format(new Date(meeting.meetingTime), "PPP · p") : 'Not set'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Portal Active</span>
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
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                    No meetings found matching your current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Mobile Card View */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)
            ) : filteredMeetings && filteredMeetings.length > 0 ? (
                filteredMeetings.map((meeting) => {
                    const type = meeting.type || MEETING_TYPES[0];
                    const logoUrl = schoolLogoMap.get(meeting.schoolId);
                    return (
                        <Card key={meeting.id} className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md rounded-2xl bg-card">
                            <CardHeader className="p-5 pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm shrink-0">
                                        <AvatarImage src={logoUrl} alt={meeting.schoolName} />
                                        <AvatarFallback className="font-bold text-xs">{getInitials(meeting.schoolName)}</AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                          <Link href={`/admin/meetings/${meeting.id}/edit`} className="block group">
                                            <CardTitle className="text-base font-black truncate group-hover:text-primary transition-colors leading-tight">{meeting.schoolName}</CardTitle>
                                          </Link>
                                          <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
                                            {meeting.meetingTime ? format(new Date(meeting.meetingTime), "MMM d · p") : 'Not set'}
                                          </CardDescription>
                                      </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 pb-4">
                                <Badge variant="secondary" className="text-[10px] font-bold uppercase">{type.name}</Badge>
                            </CardContent>
                            <CardFooter className="bg-muted/30 p-3 flex justify-end">
                                {renderActions(meeting)}
                            </CardFooter>
                        </Card>
                    );
                })
            ) : (
                <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                    <p className="text-muted-foreground font-medium">No meetings found.</p>
                </div>
            )}
        </div>
      </div>

      <AlertDialog open={!!meetingToDelete} onOpenChange={(open) => !open && setMeetingToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the scheduled session for <span className="font-bold text-foreground">"{meetingToDelete?.schoolName}"</span> and disable the public meeting page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMeeting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold">Delete Session</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
