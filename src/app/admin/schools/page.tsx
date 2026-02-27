'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { School, OnboardingStage, Module } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, CalendarPlus, Edit, Trash2, MapPin, Phone, MessageSquare, UserPlus, Workflow, ArrowUpDown, Send } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import SchoolDetailsModal from './components/school-details-modal';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AssignUserModal from './components/AssignUserModal';
import { Input } from '@/components/ui/input';
import ChangeStageModal from './components/ChangeStageModal';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { Separator } from '@/components/ui/separator';


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
  const [viewingSchoolIndex, setViewingSchoolIndex] = useState<number | null>(null);
  const [assigningSchool, setAssigningSchool] = useState<School | null>(null);
  const [changingStageSchool, setChangingStageSchool] = useState<School | null>(null);

  // State for filtering & sorting
  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof School | 'assignedTo.name' | 'stage.name'; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });


  // Data fetching
  const schoolsCol = useMemoFirebase(() => firestore ? collection(firestore, 'schools') : null, [firestore]);
  const stagesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order')) : null, [firestore]);
  const modulesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'modules'), orderBy('order')) : null, [firestore]);
  
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);
  const { data: stages, isLoading: isLoadingStages } = useCollection<OnboardingStage>(stagesCol);
  const { data: modules, isLoading: isLoadingModules } = useCollection<Module>(modulesCol);

  const isLoading = isLoadingSchools || isLoadingFilter || isLoadingStages || isLoadingModules;

  // Filtering Logic
  const filteredSchools = useMemo(() => {
    if (!schools) return [];
    let tempSchools = schools;
    
    // Global user filter
    if (assignedUserId) {
      if (assignedUserId === 'unassigned') {
        tempSchools = tempSchools.filter(school => !school.assignedTo?.userId);
      } else {
        tempSchools = tempSchools.filter(school => school.assignedTo?.userId === assignedUserId);
      }
    }

    // Search term filter
    if (searchTerm) {
        tempSchools = tempSchools.filter(school => school.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    // Stage filter
    if (stageFilter !== 'all') {
        tempSchools = tempSchools.filter(school => school.stage?.id === stageFilter);
    }
    
    // Module filter
    if (moduleFilter !== 'all') {
        tempSchools = tempSchools.filter(school => school.modules?.some(m => m.id === moduleFilter));
    }
    
    return tempSchools;
  }, [schools, assignedUserId, searchTerm, stageFilter, moduleFilter]);
  
  // Sorting Logic
  const sortedSchools = useMemo(() => {
    let sortableSchools = [...filteredSchools];
    if (sortConfig !== null) {
      sortableSchools.sort((a, b) => {
          const key = sortConfig.key;
          
          const getValue = (obj: any, path: string) => path.split('.').reduce((o, i) => o?.[i], obj);

          const aValue = getValue(a, key);
          const bValue = getValue(b, key);

          if (aValue === null || aValue === undefined) return 1;
          if (bValue === null || bValue === undefined) return -1;
          
          let comparison = 0;
          if (typeof aValue === 'string' && typeof bValue === 'string') {
              comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
          } else {
              if (aValue < bValue) {
                  comparison = -1;
              } else if (aValue > bValue) {
                  comparison = 1;
              }
          }

          return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    return sortableSchools;
  }, [filteredSchools, sortConfig]);
  
  const handleSort = (key: keyof School | 'assignedTo.name' | 'stage.name') => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };
  
  const renderSortArrow = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUpDown className="ml-2 h-4 w-4 shrink-0" />; 
    }
    return <ArrowUpDown className="ml-2 h-4 w-4 shrink-0" />;
  };

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
  
  const handleNavigate = (direction: 'next' | 'prev') => {
    if (viewingSchoolIndex === null) return;
    const newIndex = direction === 'next' ? viewingSchoolIndex + 1 : viewingSchoolIndex - 1;
    if (newIndex >= 0 && newIndex < sortedSchools.length) {
        setViewingSchoolIndex(newIndex);
    }
  };

  const viewingSchool = viewingSchoolIndex !== null ? sortedSchools[viewingSchoolIndex] : null;

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-8">
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto">
             <Input
                placeholder="Search schools..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-auto sm:max-w-xs"
            />
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by stage..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stages?.map(stage => <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>)}
              </SelectContent>
            </Select>
             <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by module..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {modules?.map(mod => <SelectItem key={mod.id} value={mod.id}>{mod.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
                <TableHead className="px-2">
                  <Button variant="ghost" onClick={() => handleSort('name')} className="px-2">
                      School Name
                      {renderSortArrow('name')}
                  </Button>
                </TableHead>
                <TableHead className="px-2">
                  <Button variant="ghost" onClick={() => handleSort('stage.name')} className="px-2">
                      Stage
                      {renderSortArrow('stage.name')}
                  </Button>
                </TableHead>
                <TableHead className="px-2">
                  <Button variant="ghost" onClick={() => handleSort('assignedTo.name')} className="px-2">
                      Assigned To
                      {renderSortArrow('assignedTo.name')}
                  </Button>
                </TableHead>
                <TableHead className="text-right px-2">
                  <Button variant="ghost" onClick={() => handleSort('nominalRoll')} className="px-2">
                      Students
                      {renderSortArrow('nominalRoll')}
                  </Button>
                </TableHead>
                <TableHead className="px-2">
                  <Button variant="ghost" onClick={() => handleSort('implementationDate')} className="px-2">
                      Go-live Date
                      {renderSortArrow('implementationDate')}
                  </Button>
                </TableHead>
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
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : sortedSchools && sortedSchools.length > 0 ? (
                sortedSchools.map((school, index) => (
                  <TableRow key={school.id}>
                    <TableCell>
                      <Avatar>
                        <AvatarImage src={school.logoUrl} alt={school.name} />
                        <AvatarFallback>{school.initials || getInitials(school.name)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      <button onClick={() => setViewingSchoolIndex(index)} className="hover:underline text-left">
                        {school.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{school.stage?.name || 'Welcome'}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {school.assignedTo?.userId ? school.assignedTo.name : <span className="italic">Unassigned</span>}
                    </TableCell>
                     <TableCell className="font-medium text-right tabular-nums">{school.nominalRoll?.toLocaleString() || 'N/A'}</TableCell>
                    <TableCell className="text-muted-foreground">
                        {school.implementationDate ? format(new Date(school.implementationDate), 'MMM dd, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                            {school.modules?.slice(0, 3).map(mod => <Badge key={mod.id} style={{backgroundColor: mod.color, color: 'hsl(var(--primary-foreground))'}} className="border-transparent">{mod.abbreviation}</Badge>) || 'N/A'}
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {renderSchoolActions(school)}
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
                                <Link href={`/admin/messaging/composer?recipient=${school.email || ''}&var_school_name=${encodeURIComponent(school.name)}&var_contact_name=${encodeURIComponent(school.contactPerson || '')}`}>
                                    <Send className="mr-2 h-4 w-4" />
                                    <span>Send Message</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAssigningSchool(school)}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              <span>Assign to User</span>
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => setChangingStageSchool(school)}>
                              <Workflow className="mr-2 h-4 w-4" />
                              <span>Change Stage</span>
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
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                              onClick={() => setSchoolToDelete(school)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete School</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
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
            ) : sortedSchools && sortedSchools.length > 0 ? (
                sortedSchools.map((school, index) => (
                    <Card key={school.id} className="w-full">
                        <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-1 items-center gap-3 min-w-0">
                                    <Avatar>
                                        <AvatarImage src={school.logoUrl} alt={school.name} />
                                        <AvatarFallback>{school.initials || getInitials(school.name)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <CardTitle className="cursor-pointer hover:underline text-base" onClick={() => setViewingSchoolIndex(index)}>{school.name}</CardTitle>
                                        <CardDescription>
                                            Go-live: {school.implementationDate ? format(new Date(school.implementationDate), 'MMM dd, yyyy') : 'N/A'}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" className="h-8 w-8 p-0">
                                              <span className="sr-only">Open menu</span>
                                              <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/messaging/composer?recipient=${school.email || ''}&var_school_name=${encodeURIComponent(school.name)}&var_contact_name=${encodeURIComponent(school.contactPerson || '')}`}>
                                                    <Send className="mr-2 h-4 w-4" />
                                                    <span>Send Message</span>
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setAssigningSchool(school)}>
                                              <UserPlus className="mr-2 h-4 w-4" />
                                              <span>Assign to User</span>
                                            </DropdownMenuItem>
                                             <DropdownMenuItem onClick={() => setChangingStageSchool(school)}>
                                              <Workflow className="mr-2 h-4 w-4" />
                                              <span>Change Stage</span>
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
                                            <DropdownMenuItem
                                              className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                                              onClick={() => setSchoolToDelete(school)}
                                            >
                                              <Trash2 className="mr-2 h-4 w-4" />
                                              <span>Delete School</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4">
                           <div>
                                <p className="text-xs font-medium text-muted-foreground">Stage</p>
                                <Badge variant="secondary" className="mt-1">{school.stage?.name || 'Welcome'}</Badge>
                            </div>
                             <div className="col-span-2">
                                <p className="text-xs font-medium text-muted-foreground">Students</p>
                                <p className="text-sm font-semibold">{school.nominalRoll?.toLocaleString() || 'N/A'}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs font-medium text-muted-foreground">Assigned To</p>
                                <p className="text-sm">{school.assignedTo?.userId ? school.assignedTo.name : <span className="italic">Unassigned</span>}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Modules</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {school.modules?.map(mod => <Badge key={mod.id} style={{backgroundColor: mod.color, color: 'hsl(var(--primary-foreground))'}} className="border-transparent">{mod.abbreviation}</Badge>) || <p className="text-sm italic text-muted-foreground">N/A</p>}
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex items-center justify-around border-t p-2">
                           <Button variant="ghost" size="sm" asChild>
                                <a href={`tel:${formatPhoneNumberForLink(school.phone)}`} className="flex flex-1 items-center justify-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    <span>Call</span>
                                </a>
                            </Button>
                            <Separator orientation="vertical" className="h-6" />
                            <Button variant="ghost" size="sm" asChild>
                                <a href={`https://wa.me/${formatPhoneNumberForLink(school.phone)}`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    <span>WhatsApp</span>
                                </a>
                            </Button>
                            <Separator orientation="vertical" className="h-6" />
                            <Button variant="ghost" size="sm" asChild>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.name)} ${encodeURIComponent(school.location || '')}`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span>Map</span>
                                </a>
                            </Button>
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
      
      <AlertDialog open={!!schoolToDelete} onOpenChange={(open) => !open && setSchoolToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the school <span className="font-bold">{schoolToDelete?.name}</span> and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSchool}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SchoolDetailsModal
        school={viewingSchool}
        open={viewingSchoolIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingSchoolIndex(null);
          }
        }}
        onNavigate={handleNavigate}
        canNavigatePrev={viewingSchoolIndex !== null && viewingSchoolIndex > 0}
        canNavigateNext={viewingSchoolIndex !== null && viewingSchoolIndex < sortedSchools.length - 1}
      />
      
      <AssignUserModal school={assigningSchool} open={!!assigningSchool} onOpenChange={(open) => !open && setAssigningSchool(null)} />
      
      <ChangeStageModal school={changingStageSchool} open={!!changingStageSchool} onOpenChange={(open) => !open && setChangingStageSchool(null)} />

    </TooltipProvider>
  );
}
