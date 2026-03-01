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
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';

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

  const renderDropdown = (meeting: Meeting) => {
    const type = meeting.type || MEETING_TYPES[0];
    const schoolEmail = schoolEmailMap.get(meeting.schoolId);
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
                <Link href={`/admin/messaging/composer?recipient=${schoolEmail || ''}&var_school_name=${encodeURIComponent(meeting.schoolName)}&var_meeting_type=${encodeURIComponent(type.name)}&var_date=${format(new Date(meeting.meetingTime), 'PPP')}&var_time=${format(new Date(meeting.meetingTime), 'p')}&var_link=${encodeURIComponent(meeting.meetingLink)}`}>
                    <Send className="mr-2 h-4 w-4" />
                    <span>Send Invite/Reminder</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/admin/meetings/${meeting.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Edit Meeting</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <a href={`/meetings/${type.slug}/${meeting.schoolSlug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                <span>View Meeting Page</span>
                </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
              onClick={() => setMeetingToDelete(meeting)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete Meeting</span>
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
  }

  return (
    <>
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="w-full max-w-xs">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Meeting Types</SelectItem>
                {MEETING_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button asChild>
            <Link href="/admin/meetings/new">Add New Meeting</Link>
          </Button>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]"></TableHead>
                <TableHead>School Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[250px]">Meeting Time</TableHead>
                <TableHead>Meeting Page</TableHead>
                <TableHead className="w-[50px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <Skeleton className="h-5 w-full" />
                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredMeetings && filteredMeetings.length > 0 ? (
                filteredMeetings.map((meeting) => {
                  const type = meeting.type || MEETING_TYPES[0];
                  const logoUrl = schoolLogoMap.get(meeting.schoolId);
                  return (
                    <TableRow key={meeting.id}>
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={logoUrl} alt={meeting.schoolName} />
                          <AvatarFallback>{getInitials(meeting.schoolName)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/admin/meetings/${meeting.id}/edit`} className="hover:underline hover:text-primary transition-colors">
                            {meeting.schoolName}
                        </Link>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{type.name}</Badge></TableCell>
                      <TableCell>
                        {meeting.meetingTime ? format(new Date(meeting.meetingTime), "PPP p") : 'Not set'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <a href={`/meetings/${type.slug}/${meeting.schoolSlug}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-muted-foreground truncate">
                              {`/meetings/${type.slug}/${meeting.schoolSlug}`}
                          </a>
                          <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 shrink-0"
                              onClick={() => {
                                  const url = `${window.location.origin}/meetings/${type.slug}/${meeting.schoolSlug}`;
                                  navigator.clipboard.writeText(url);
                                  toast({ title: 'Link Copied!', description: 'Meeting page URL copied.' });
                              }}
                          >
                              <span className="sr-only">Copy link</span>
                              <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {renderDropdown(meeting)}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No meetings found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Mobile Card View */}
        <div className="grid gap-4 md:hidden">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
            ) : filteredMeetings && filteredMeetings.length > 0 ? (
                filteredMeetings.map((meeting) => {
                    const type = meeting.type || MEETING_TYPES[0];
                    const logoUrl = schoolLogoMap.get(meeting.schoolId);
                    return (
                        <Card key={meeting.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                      <Avatar>
                                        <AvatarImage src={logoUrl} alt={meeting.schoolName} />
                                        <AvatarFallback>{getInitials(meeting.schoolName)}</AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                          <Link href={`/admin/meetings/${meeting.id}/edit`} className="block">
                                            <CardTitle className="truncate">{meeting.schoolName}</CardTitle>
                                          </Link>
                                          <CardDescription>{meeting.meetingTime ? format(new Date(meeting.meetingTime), "PPP p") : 'Not set'}</CardDescription>
                                      </div>
                                    </div>
                                    {renderDropdown(meeting)}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Badge variant="secondary">{type.name}</Badge>
                            </CardContent>
                            <CardFooter>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full"
                                    onClick={() => {
                                        const url = `${window.location.origin}/meetings/${type.slug}/${meeting.schoolSlug}`;
                                        navigator.clipboard.writeText(url);
                                        toast({ title: 'Link Copied!', description: 'Meeting page URL copied.' });
                                    }}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy Public Link
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })
            ) : (
                <div className="text-center text-muted-foreground py-10">
                    No meetings found. Create one to get started.
                </div>
            )}
        </div>
      </div>

      <AlertDialog open={!!meetingToDelete} onOpenChange={(open) => !open && setMeetingToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the meeting for <span className="font-bold">{meetingToDelete?.schoolName}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMeeting}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
