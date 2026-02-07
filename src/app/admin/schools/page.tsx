'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { School } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, CalendarPlus, Edit, Trash2, MapPin, Phone, MessageSquare, UserPlus } from 'lucide-react';
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
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AssignUserModal from './components/AssignUserModal';
import UserFilterSelect from './components/UserFilterSelect';
import { Input } from '@/components/ui/input';

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

  // State for modals
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);
  const [viewingSchool, setViewingSchool] = useState<School | null>(null);
  const [assigningSchool, setAssigningSchool] = useState<School | null>(null);

  // State for filtering
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const schoolsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'schools');
  }, [firestore]);
  
  const { data: schools, isLoading, error } = useCollection<School>(schoolsCol);

  const filteredSchools = useMemo(() => {
    if (!schools) return [];
    let tempSchools = schools;
    
    // Filter by assigned user
    if (userFilter) {
      if (userFilter === 'unassigned') {
        tempSchools = tempSchools.filter(school => !school.assignedTo?.userId);
      } else {
        tempSchools = tempSchools.filter(school => school.assignedTo?.userId === userFilter);
      }
    }

    // Filter by search term
    if (searchTerm) {
        tempSchools = tempSchools.filter(school => school.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    return tempSchools;
  }, [schools, userFilter, searchTerm]);

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
        <div className="flex items-center gap-1 sm:gap-2">
            {school.phone && (
                <>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                                <a href={`tel:${sanitizedPhone}`} aria-label={`Call ${school.name}`}>
                                    <Phone className="h-4 w-4" />
                                </a>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Call</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${school.name}`}>
                                    <MessageSquare className="h-4 w-4" />
                                </a>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>WhatsApp</p></TooltipContent>
                    </Tooltip>
                </>
            )}
            {school.location && (
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.name)} ${encodeURIComponent(school.location)}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${school.name} on map`}>
                                <MapPin className="h-4 w-4" />
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>View on Map</p></TooltipContent>
                </Tooltip>
            )}
        </div>
    );
  }

  return (
    <AlertDialog>
      <TooltipProvider>
        <div>
          <div className="flex flex-wrap gap-2 items-center justify-between mb-8">
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                 <Input
                    placeholder="Search schools..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-xs"
                />
                <UserFilterSelect value={userFilter} onValueChange={setUserFilter} />
              </div>
              <div className="flex items-center gap-2">
                  <Button asChild>
                    <Link href="/admin/schools/new">Add New School</Link>
                  </Button>
              </div>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]"></TableHead>
                  <TableHead>School Name</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Implementation Date</TableHead>
                  <TableHead>Modules</TableHead>
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
                      <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredSchools && filteredSchools.length > 0 ? (
                  filteredSchools.map((school) => (
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
                      <TableCell className="text-muted-foreground">
                        {school.assignedTo?.userId ? school.assignedTo.name : <span className="italic">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                          {school.implementationDate ? format(new Date(school.implementationDate), 'MMM dd, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                              {school.modules?.split(',').map(m => m.trim()).slice(0, 3).map(mod => <Badge key={mod} variant="secondary">{mod}</Badge>) || 'N/A'}
                          </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
                              <DropdownMenuItem onClick={() => setAssigningSchool(school)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                <span>Assign to User</span>
                              </DropdownMenuItem>
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
                    <TableCell colSpan={6} className="h-24 text-center">
                      No schools found.
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
              ) : filteredSchools && filteredSchools.length > 0 ? (
                  filteredSchools.map(school => (
                      <Card key={school.id} className="w-full">
                          <CardHeader>
                              <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                      <Avatar>
                                          <AvatarImage src={school.logoUrl} alt={school.name} />
                                          <AvatarFallback>{getInitials(school.name)}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                          <CardTitle className="cursor-pointer hover:underline text-base" onClick={() => setViewingSchool(school)}>{school.name}</CardTitle>
                                          <CardDescription>
                                              Go-live: {school.implementationDate ? format(new Date(school.implementationDate), 'MMM dd, yyyy') : 'N/A'}
                                          </CardDescription>
                                      </div>
                                  </div>
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => setAssigningSchool(school)}>
                                            <UserPlus className="mr-2 h-4 w-4" />
                                            <span>Assign to User</span>
                                          </DropdownMenuItem>
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
                          </CardHeader>
                          <CardContent className="space-y-3">
                              <div>
                                  <p className="text-xs font-medium text-muted-foreground">Assigned To</p>
                                  <p className="text-sm">{school.assignedTo?.userId ? school.assignedTo.name : <span className="italic">Unassigned</span>}</p>
                              </div>
                              <div>
                                  <p className="text-xs font-medium text-muted-foreground">Location</p>
                                  <p className="text-sm">{school.location || 'N/A'}</p>
                              </div>
                               <div>
                                  <p className="text-xs font-medium text-muted-foreground">Modules</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                      {school.modules?.split(',').map(m => m.trim()).map(mod => <Badge key={mod} variant="secondary">{mod}</Badge>) || <p className="text-sm">N/A</p>}
                                  </div>
                              </div>
                          </CardContent>
                          <CardFooter className="flex-col items-start gap-3">
                               <div className="flex items-center gap-2 w-full">
                                    <Button variant="outline" size="sm" asChild className="flex-1">
                                        <a href={`tel:${formatPhoneNumberForLink(school.phone)}`} aria-label={`Call ${school.name}`}>
                                            <Phone className="h-4 w-4" />
                                            <span className="sm:inline ml-2">Call</span>
                                        </a>
                                    </Button>
                                    <Button variant="outline" size="sm" asChild className="flex-1">
                                        <a href={`https://wa.me/${formatPhoneNumberForLink(school.phone)}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${school.name}`}>
                                            <MessageSquare className="h-4 w-4" />
                                            <span className="sm:inline ml-2">WhatsApp</span>
                                        </a>
                                    </Button>
                                    <Button variant="outline" size="sm" asChild className="flex-1">
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.name)} ${encodeURIComponent(school.location || '')}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${school.name} on map`}>
                                            <MapPin className="h-4 w-4" />
                                            <span className="sm:inline ml-2">Map</span>
                                        </a>
                                    </Button>
                               </div>
                          </CardFooter>
                      </Card>
                  ))
              ) : (
                  <div className="text-center h-24 text-muted-foreground">
                      No schools found.
                  </div>
              )}
          </div>
        </div>
      </TooltipProvider>
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
      
      <AssignUserModal school={assigningSchool} open={!!assigningSchool} onOpenChange={(open) => !open && setAssigningSchool(null)} />

    </AlertDialog>
  );
}
