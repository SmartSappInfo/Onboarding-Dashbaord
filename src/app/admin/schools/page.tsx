'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { School } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, CalendarPlus, ExternalLink, Edit, Trash2 } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import SchoolDetailsModal from './components/school-details-modal';

export default function SchoolsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);
  const [viewingSchool, setViewingSchool] = useState<School | null>(null);

  const schoolsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'schools');
  }, [firestore]);
  
  const { data: schools, isLoading, error } = useCollection<School>(schoolsCol);

  const handleDeleteSchool = () => {
    if (!firestore || !schoolToDelete) return;

    const docRef = doc(firestore, 'schools', schoolToDelete.id);
    deleteDoc(docRef)
      .then(() => {
        toast({
          title: 'School Deleted',
          description: `${schoolToDelete.name} has been deleted.`,
        });
        setSchoolToDelete(null);
      })
      .catch((error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Error deleting school',
          description: 'You may not have the required permissions.',
        });
        setSchoolToDelete(null);
      });
  };

  if (error) {
    return <div className="text-destructive">Error loading schools: {error.message}</div>;
  }

  return (
    <AlertDialog>
      <div>
        <div className="flex items-center justify-end mb-8">
          <Button asChild>
            <Link href="/admin/schools/new">Add New School</Link>
          </Button>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact Person</TableHead>
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
              ) : schools && schools.length > 0 ? (
                schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">
                      <button onClick={() => setViewingSchool(school)} className="hover:underline text-left">
                        {school.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{school.location}</TableCell>
                    <TableCell>
                      {school.contactPerson}
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
                          <DropdownMenuItem onClick={() => router.push(`/admin/schools/${school.id}/edit`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Edit School</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/admin/meetings/new?schoolId=${school.id}&schoolName=${encodeURIComponent(school.name)}`)}>
                            <CalendarPlus className="mr-2 h-4 w-4" />
                            <span>Schedule Meeting</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <AlertDialogTrigger asChild>
                             <DropdownMenuItem 
                              className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                              onSelect={(e) => e.preventDefault()}
                              onClick={() => setSchoolToDelete(school)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete School</span>
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
                    No schools found. Create one to get started.
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
            This action cannot be undone. This will permanently delete the school <span className="font-bold">{schoolToDelete?.name}</span> and all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setSchoolToDelete(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteSchool}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      <SchoolDetailsModal school={viewingSchool} open={!!viewingSchool} onOpenChange={(open) => !open && setViewingSchool(null)} />
    </AlertDialog>
  );
}
