'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { School } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, CalendarPlus, Edit, Trash2, MapPin, Phone, MessageSquare } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
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
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const formatPhoneNumberForLink = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/[\s-()]/g, '');
};

const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}


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

  const renderSchoolActions = (school: School) => {
    const sanitizedPhone = formatPhoneNumberForLink(school.phone);
    return (
        <div className="flex items-center gap-2">
            {school.phone && (
                <>
                    <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${sanitizedPhone}`} aria-label={`Call ${school.name}`}>
                            <Phone className="h-4 w-4" />
                            <span className="hidden sm:inline ml-2">Call</span>
                        </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${school.name}`}>
                            <MessageSquare className="h-4 w-4" />
                            <span className="hidden sm:inline ml-2">WhatsApp</span>
                        </a>
                    </Button>
                </>
            )}
            {school.location && (
                 <Button variant="outline" size="sm" asChild>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.name)} ${encodeURIComponent(school.location)}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${school.name} on map`}>
                        <MapPin className="h-4 w-4" />
                        <span className="hidden sm:inline ml-2">Map</span>
                    </a>
                </Button>
            )}
        </div>
    );
  }

  return (
    <AlertDialog>
      <div>
        <div className="flex items-center justify-end mb-8">
          <Button asChild>
            <Link href="/admin/schools/new">Add New School</Link>
          </Button>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]"></TableHead>
                <TableHead>School Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Implementation Date</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : schools && schools.length > 0 ? (
                schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell>
                      <Avatar>
                        <AvatarImage src={school.logoUrl} alt={school.name} />
                        <AvatarFallback>{getInitials(school.name)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      <button onClick={() => setViewingSchool(school)} className="hover:underline text-left">
                        {school.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{school.location || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">
                        {school.implementationDate ? format(new Date(school.implementationDate), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                            {school.modules?.split(',').map(m => m.trim()).slice(0, 3).map(mod => <Badge key={mod} variant="secondary">{mod}</Badge>) || 'N/A'}
                        </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{school.contactPerson || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">{school.phone || ''}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {renderSchoolActions(school)}
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No schools found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="grid gap-4 md:hidden">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-60 w-full" />)
            ) : schools && schools.length > 0 ? (
                schools.map(school => (
                    <Card key={school.id} className="w-full">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Avatar>
                                    <AvatarImage src={school.logoUrl} alt={school.name} />
                                    <AvatarFallback>{getInitials(school.name)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="cursor-pointer hover:underline" onClick={() => setViewingSchool(school)}>{school.name}</CardTitle>
                                    <CardDescription>
                                        Go-live: {school.implementationDate ? format(new Date(school.implementationDate), 'MMM dd, yyyy') : 'N/A'}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Location</p>
                                <p>{school.location || 'N/A'}</p>
                            </div>
                             <div>
                                <p className="text-sm font-medium text-muted-foreground">Modules</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {school.modules?.split(',').map(m => m.trim()).map(mod => <Badge key={mod} variant="secondary">{mod}</Badge>) || <p>N/A</p>}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Contact</p>
                                <p>{school.contactPerson || 'N/A'} ({school.phone || 'No phone'})</p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-3">
                            {renderSchoolActions(school)}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" className="w-full">
                                    <MoreHorizontal className="mr-2 h-4 w-4" />
                                    More Actions
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[--radix-dropdown-menu-trigger-width]]">
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
                        </CardFooter>
                    </Card>
                ))
            ) : (
                <div className="text-center h-24 text-muted-foreground">
                    No schools found. Create one to get started.
                </div>
            )}
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
