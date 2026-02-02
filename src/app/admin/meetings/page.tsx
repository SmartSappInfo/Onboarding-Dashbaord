'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { Meeting } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, Copy, ExternalLink, Edit, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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

export default function MeetingsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);

  const meetingsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'meetings');
  }, [firestore]);
  
  const meetingsQuery = useMemoFirebase(() => {
    if (!meetingsCol) return null;
    return query(meetingsCol, orderBy('meetingTime', 'desc'));
  }, [meetingsCol]);

  const { data: meetings, isLoading, error } = useCollection<Meeting>(meetingsQuery);

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

  return (
    <AlertDialog>
      <div>
        <div className="flex items-center justify-end mb-8">
          <Button asChild>
            <Link href="/admin/meetings/new">Add New Meeting</Link>
          </Button>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Name</TableHead>
                <TableHead className="w-[250px]">Meeting Time</TableHead>
                <TableHead>Meeting Page</TableHead>
                <TableHead className="w-[50px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : meetings && meetings.length > 0 ? (
                meetings.map((meeting) => (
                  <TableRow key={meeting.id}>
                    <TableCell className="font-medium">{meeting.schoolName}</TableCell>
                    <TableCell>
                      {meeting.meetingTime ? format(new Date(meeting.meetingTime), "PPP p") : 'Not set'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <a href={`/meetings/${meeting.schoolSlug}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-muted-foreground truncate">
                            {`/meetings/${meeting.schoolSlug}`}
                        </a>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 shrink-0"
                            onClick={() => {
                                const url = `${window.location.origin}/meetings/${meeting.schoolSlug}`;
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/admin/meetings/${meeting.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Edit Meeting</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/meetings/${meeting.schoolSlug}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              <span>View Meeting Page</span>
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                              onSelect={(e) => e.preventDefault()} // prevent menu from closing
                              onClick={() => setMeetingToDelete(meeting)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete Meeting</span>
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No meetings found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the meeting for <span className="font-bold">{meetingToDelete?.schoolName}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setMeetingToDelete(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteMeeting}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
