'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { School, OnboardingStage, Zone, SchoolStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, CalendarPlus, Edit, Trash2, MapPin, UserPlus, Workflow, ArrowUpDown, Eye, Send, PlusCircle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AssignUserModal from './components/AssignUserModal';
import { Input } from '@/components/ui/input';
import ChangeStageModal from './components/ChangeStageModal';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { cn } from '@/lib/utils';

const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

const getStatusBadgeVariant = (status: SchoolStatus) => {
    switch (status) {
        case 'Active': return 'default';
        case 'Inactive': return 'secondary';
        case 'Archived': return 'outline';
        default: return 'secondary';
    }
}

export default function SchoolsClient() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);
  const [assigningSchool, setAssigningSchool] = useState<School | null>(null);
  const [changingStageSchool, setChangingStageSchool] = useState<School | null>(null);

  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof School | 'assignedTo.name' | 'stage.name' | 'zone.name'; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });

  const schoolsCol = useMemoFirebase(() => firestore ? collection(firestore, 'schools') : null, [firestore]);
  const stagesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order')) : null, [firestore]);
  const zonesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'zones'), orderBy('name')) : null, [firestore]);
  
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);
  const { data: stages } = useCollection<OnboardingStage>(stagesCol);
  const { data: zones } = useCollection<Zone>(zonesCol);

  const isLoading = isLoadingSchools || isLoadingFilter;

  const filteredSchools = useMemo(() => {
    if (!schools) return [];
    let temp = schools;
    if (assignedUserId) temp = assignedUserId === 'unassigned' ? temp.filter(s => !s.assignedTo?.userId) : temp.filter(s => s.assignedTo?.userId === assignedUserId);
    if (searchTerm) temp = temp.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (stageFilter !== 'all') temp = temp.filter(s => s.stage?.id === stageFilter);
    if (zoneFilter !== 'all') temp = temp.filter(s => s.zone?.id === zoneFilter);
    if (statusFilter !== 'all') temp = temp.filter(s => s.status === statusFilter);
    return temp;
  }, [schools, assignedUserId, searchTerm, stageFilter, zoneFilter, statusFilter]);
  
  const sortedSchools = useMemo(() => {
    let sortable = [...filteredSchools];
    if (sortConfig) {
      sortable.sort((a, b) => {
          const getValue = (obj: any, path: string) => path.split('.').reduce((o, i) => o?.[i], obj);
          const aV = getValue(a, sortConfig.key);
          const bV = getValue(b, sortConfig.key);
          if (aV === null || aV === undefined) return 1;
          if (bV === null || bV === undefined) return -1;
          const comparison = typeof aV === 'string' ? aV.localeCompare(bV, undefined, { numeric: true }) : (aV < bV ? -1 : 1);
          return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    return sortable;
  }, [filteredSchools, sortConfig]);
  
  const handleSort = (key: any) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };

  const handleDeleteSchool = () => {
    if (!firestore || !schoolToDelete) return;
    const docRef = doc(firestore, 'schools', schoolToDelete.id);
    deleteDoc(docRef).then(() => {
        toast({ title: 'School Deleted', description: `${schoolToDelete.name} has been removed.` });
        setSchoolToDelete(null);
    }).catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
        setSchoolToDelete(null);
    });
  };

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6">
                <div className="flex justify-end items-center shrink-0">
                    <Button asChild className="rounded-xl font-bold shadow-lg h-11 px-6">
                        <Link href="/admin/schools/new">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            Initialize New School
                        </Link>
                    </Button>
                </div>
            </div>
            
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-card">
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <Input placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-medium" />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                            <SelectItem value="Archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={zoneFilter} onValueChange={setZoneFilter}>
                        <SelectTrigger className="w-[180px] h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                            <SelectValue placeholder="All Zones" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Zones</SelectItem>
                            {zones?.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={stageFilter} onValueChange={setStageFilter}>
                        <SelectTrigger className="w-[180px] h-10 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                            <SelectValue placeholder="All Stages" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Stages</SelectItem>
                            {stages?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
            
            <div className="rounded-2xl border border-border/50 bg-card text-card-foreground shadow-sm overflow-hidden ring-1 ring-black/5">
                <Table>
                    <TableHeader className="bg-muted/30">
                    <TableRow>
                        <TableHead className="w-[80px]"></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => handleSort('name')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto">School Name <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
                        <TableHead className="text-center"><span className="text-[10px] font-bold uppercase tracking-widest">Status</span></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => handleSort('zone.name')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto">Zone <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => handleSort('stage.name')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto">Pipeline Stage <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => handleSort('assignedTo.name')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto">Assigned To <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
                        <TableHead className="text-right pr-6"><span className="text-[10px] font-bold uppercase tracking-widest">Actions</span></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12 w-full rounded-lg" /></TableCell></TableRow>
                        ))
                    ) : sortedSchools.length > 0 ? (
                        sortedSchools.map((school) => (
                        <TableRow key={school.id} className={cn("group hover:bg-muted/30 transition-colors", assigningSchool?.id === school.id && "bg-primary/5")}>
                            <TableCell className="pl-6">
                            <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                                <AvatarImage src={school.logoUrl} alt={school.name} />
                                <AvatarFallback className="font-bold text-xs">{school.initials || getInitials(school.name)}</AvatarFallback>
                            </Avatar>
                            </TableCell>
                            <TableCell className="font-black text-sm text-foreground">
                            <Link href={`/admin/schools/${school.id}`} className="hover:text-primary hover:underline transition-colors">{school.name}</Link>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant={getStatusBadgeVariant(school.status)} className="rounded-full text-[10px] font-black uppercase px-2.5 h-5">{school.status}</Badge>
                            </TableCell>
                            <TableCell><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><MapPin className="h-3 w-3" /> {school.zone?.name || 'Unassigned'}</div></TableCell>
                            <TableCell>
                            <Badge style={{ backgroundColor: school.stage?.color || '#ccc', color: 'white' }} className="text-[10px] font-bold uppercase border-none h-6">{school.stage?.name || 'Welcome'}</Badge>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-muted-foreground">
                            {school.assignedTo?.name || <span className="italic opacity-50">Unassigned</span>}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1 transition-opacity">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setChangingStageSchool(school)}>
                                            <Workflow className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Change Stage</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setAssigningSchool(school)}>
                                            <UserPlus className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Assign User</TooltipContent>
                                </Tooltip>
                                <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl w-48">
                                    <DropdownMenuLabel className="text-[10px] uppercase font-black text-muted-foreground px-3">Management</DropdownMenuLabel>
                                    <DropdownMenuItem asChild><Link href={`/admin/schools/${school.id}`}><Eye className="mr-2 h-4 w-4" /> View Console</Link></DropdownMenuItem>
                                    <DropdownMenuItem asChild><Link href={`/admin/schools/${school.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Profile</Link></DropdownMenuItem>
                                    <DropdownMenuItem asChild><Link href={`/admin/meetings/new?schoolId=${school.id}`}><CalendarPlus className="mr-2 h-4 w-4" /> Schedule Meeting</Link></DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/admin/messaging/composer?schoolId=${school.id}&recipient=${school.phone || school.email || ''}`}>
                                            <Send className="mr-2 h-4 w-4" /> Send Message
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => setSchoolToDelete(school)}><Trash2 className="mr-2 h-4 w-4" /> Delete School</DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            </TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">No school records found matching your current filters.</TableCell></TableRow>
                    )}
                    </TableBody>
                </Table>
            </div>
        </div>
      </div>
      <AlertDialog open={!!schoolToDelete} onOpenChange={(open) => !open && setSchoolToDelete(null)}>
        <AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle className="font-black">Delete School?</AlertDialogTitle><AlertDialogDescription>This will permanently remove <span className="font-bold">{schoolToDelete?.name}</span> and all its interaction history. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteSchool} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold">Delete Campus</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AssignUserModal school={assigningSchool} open={!!assigningSchool} onOpenChange={(open) => !open && setAssigningSchool(null)} />
      <ChangeStageModal school={changingStageSchool} open={!!changingStageSchool} onOpenChange={(open) => !open && setChangingStageSchool(null)} />
    </TooltipProvider>
  );
}
