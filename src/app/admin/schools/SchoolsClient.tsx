
'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { collection, doc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import type { School, OnboardingStage, Zone, SchoolStatus, Tag, TagCategory } from '@/lib/types';
import { TagSelector } from '@/components/tags/TagSelector';
import { TagBadges } from '@/components/tags/TagBadges';
import { BulkTagOperations } from '@/components/tags/BulkTagOperations';
import { TagFilter } from '@/components/tags/TagFilter';
import type { TagFilter as TagFilterState } from '@/components/tags/TagFilter';
import { getContactsByTagsAction } from '@/lib/tag-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, CalendarPlus, Edit, Trash2, MapPin, UserPlus, Workflow, ArrowUpDown, Eye, Send, PlusCircle, Sparkles, User, FileUp, ShieldCheck, ArrowRightLeft, Share2, Tag as TagIcon } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AssignUserModal from './components/AssignUserModal';
import { Input } from '@/components/ui/input';
import ChangeStageModal from './components/ChangeStageModal';
import ChangeStatusModal from './components/ChangeStatusModal';
import TransferPipelineModal from './components/TransferPipelineModal';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn, toTitleCase } from '@/lib/utils';
import { RainbowButton } from '@/components/ui/rainbow-button';

const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

const getStatusBadgeVariant = (status: any) => {
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();

  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);
  const [assigningSchool, setAssigningSchool] = useState<School | null>(null);
  const [changingStageSchool, setChangingStageSchool] = useState<School | null>(null);
  const [changingStatusSchool, setChangingStatusSchool] = useState<School | null>(null);
  const [transferringSchool, setTransferringSchool] = useState<School | null>(null);
  const [taggingSchool, setTaggingSchool] = useState<School | null>(null);

  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof School | 'assignedTo.name' | 'stage.name' | 'zone.name'; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });

  // Tag-related state
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [isBulkTagOpen, setIsBulkTagOpen] = useState(false);

  // Tag filter state — initialised from URL params
  const [tagFilterState, setTagFilterState] = useState<TagFilterState>(() => {
    const tagsParam = searchParams.get('tags');
    const logicParam = searchParams.get('logic') as TagFilterState['logic'] | null;
    const categoryParam = searchParams.get('category') as TagCategory | null;
    return {
      tagIds: tagsParam ? tagsParam.split(',').filter(Boolean) : [],
      logic: logicParam && ['AND', 'OR', 'NOT'].includes(logicParam) ? logicParam : 'OR',
      categoryFilter: categoryParam ?? undefined,
    };
  });

  // IDs returned by server-side tag filter query
  const [tagFilteredIds, setTagFilteredIds] = useState<Set<string> | null>(null);
  const [isTagFiltering, setIsTagFiltering] = useState(false);

  // Real-time tags subscription
  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);
  const { data: allTags } = useCollection<Tag>(tagsQuery);

  // Sync tag filter state → URL params
  const updateUrlParams = useCallback((filter: TagFilterState) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter.tagIds.length > 0) {
      params.set('tags', filter.tagIds.join(','));
      params.set('logic', filter.logic);
      if (filter.categoryFilter) {
        params.set('category', filter.categoryFilter);
      } else {
        params.delete('category');
      }
    } else {
      params.delete('tags');
      params.delete('logic');
      params.delete('category');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  // Run server-side tag filter query when tagFilterState changes
  useEffect(() => {
    if (!activeWorkspaceId || tagFilterState.tagIds.length === 0) {
      setTagFilteredIds(null);
      return;
    }
    let cancelled = false;
    setIsTagFiltering(true);
    getContactsByTagsAction(activeWorkspaceId, tagFilterState).then(result => {
      if (cancelled) return;
      if (result.success && result.data) {
        setTagFilteredIds(new Set(result.data));
      } else {
        setTagFilteredIds(new Set());
      }
      setIsTagFiltering(false);
    });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, tagFilterState]);

  const handleTagFilterChange = useCallback((filter: TagFilterState) => {
    setTagFilterState(filter);
    updateUrlParams(filter);
  }, [updateUrlParams]);

  // MULTI-WORKSPACE QUERY: Use array-contains to find schools shared with the current hub
  const schoolsCol = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'schools'), where('workspaceIds', 'array-contains', activeWorkspaceId)) : null, 
  [firestore, activeWorkspaceId]);

  const stagesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order')) : null, [firestore]);
  const zonesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'zones'), orderBy('name')) : null, [firestore]);
  
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);
  const { data: stages } = useCollection<OnboardingStage>(stagesCol);
  const { data: zones } = useCollection<Zone>(zonesCol);

  const isLoading = isLoadingSchools || isLoadingFilter || isTagFiltering;

  const filteredSchools = useMemo(() => {
    if (!schools) return [];
    let temp = schools;

    // 1. Global Assignment Filter
    if (assignedUserId) temp = assignedUserId === 'unassigned' ? temp.filter(s => !s.assignedTo?.userId) : temp.filter(s => s.assignedTo?.userId === assignedUserId);
    
    // 2. Search & UI Filters
    if (searchTerm) temp = temp.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (stageFilter !== 'all') temp = temp.filter(s => s.stage?.id === stageFilter);
    if (zoneFilter !== 'all') temp = temp.filter(s => s.zone?.id === zoneFilter);
    if (statusFilter !== 'all') temp = temp.filter(s => s.status === statusFilter);
    
    // 3. Tag Filter — restrict to IDs returned by getContactsByTagsAction
    if (tagFilteredIds !== null) temp = temp.filter(s => tagFilteredIds.has(s.id));
    
    return temp;
  }, [schools, assignedUserId, searchTerm, stageFilter, zoneFilter, statusFilter, tagFilteredIds]);
  
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
      if (sortConfig?.key === key && sortConfig?.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };

  const toggleSchoolSelection = (schoolId: string) => {
    setSelectedSchoolIds(prev =>
      prev.includes(schoolId) ? prev.filter(id => id !== schoolId) : [...prev, schoolId]
    );
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
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6">
                <div className="flex justify-end items-center gap-3 shrink-0">
                    {selectedSchoolIds.length > 0 && (
                        <Button
                            variant="outline"
                            className="rounded-xl font-bold h-11 px-6 border-primary/20 text-primary hover:bg-primary/5 gap-2"
                            onClick={() => setIsBulkTagOpen(true)}
                        >
                            <TagIcon className="h-4 w-4" />
                            Tag {selectedSchoolIds.length} Selected
                        </Button>
                    )}
                    <Button asChild variant="outline" className="rounded-xl font-bold h-11 px-6 border-primary/20 text-primary hover:bg-primary/5">
                        <Link href="/admin/schools/upload">
                            <FileUp className="mr-2 h-4 w-4" />
                            Bulk Import
                        </Link>
                    </Button>
                    <RainbowButton asChild className="h-11 px-6 gap-2 font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 text-white">
                        <Link href="/admin/schools/new/ai">
                            <Sparkles className="h-4 w-4" /> AI Architect
                        </Link>
                    </RainbowButton>
                    <Button asChild className="rounded-xl font-bold shadow-lg h-11 px-6">
                        <Link href="/admin/schools/new">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            Add New School
                        </Link>
                    </Button>
                </div>
            </div>
            
            <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-card">
                <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-4">
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
                    </div>
                    {/* Tag filter row — shows active filter badges inline */}
                    <TagFilter onFilterChange={handleTagFilterChange} className="pt-0.5" />
                </CardContent>
            </Card>
            
            <div className="rounded-2xl border border-border/50 bg-card text-card-foreground shadow-sm overflow-hidden ring-1 ring-black/5">
                <Table>
                    <TableHeader className="bg-muted/30">
                    <TableRow>
                        <TableHead className="w-[80px]"></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => handleSort('name')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto">School Name <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
                        <TableHead className="text-center"><span className="text-[10px] font-bold uppercase tracking-widest">Status</span></TableHead>
                        <TableHead className="text-center"><span className="text-[10px] font-bold uppercase tracking-widest">Visibility</span></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => handleSort('zone.name')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto">Zone <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => handleSort('stage.name')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto">Pipeline Stage <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
                        <TableHead><Button variant="ghost" onClick={() => handleSort('assignedTo.name')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto">Assigned To <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
                        <TableHead className="text-right pr-6"><span className="text-[10px] font-bold uppercase tracking-widest">Actions</span></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-12 w-full rounded-lg" /></TableCell></TableRow>
                        ))
                    ) : sortedSchools.length > 0 ? (
                        sortedSchools.map((school) => {
                        const signatory = (school.focalPersons || []).find(p => p.isSignatory) || school.focalPersons?.[0];
                        return (
                        <TableRow key={school.id} className={cn("group hover:bg-muted/30 transition-colors", assigningSchool?.id === school.id && "bg-primary/5")}>
                            <TableCell className="pl-6">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedSchoolIds.includes(school.id)}
                                onChange={() => toggleSchoolSelection(school.id)}
                                className="h-4 w-4 rounded border-border cursor-pointer"
                                aria-label={`Select ${school.name}`}
                              />
                              <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                                <AvatarImage src={school.logoUrl} alt={school.name} />
                                <AvatarFallback className="font-bold text-xs">{school.initials || getInitials(school.name)}</AvatarFallback>
                              </Avatar>
                            </div>
                            </TableCell>
                            <TableCell className="py-4">
                                <div className="flex flex-col text-left gap-1">
                                    <Link href={`/admin/schools/${school.id}`} className="font-black text-sm text-foreground hover:text-primary hover:underline transition-colors uppercase tracking-tight">{school.name}</Link>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 flex items-center gap-1">
                                        <User className="h-2 w-2" /> {signatory?.name || 'No Primary Contact'}
                                    </span>
                                    {school.tags && school.tags.length > 0 && allTags && (
                                        <TagBadges
                                            tagIds={school.tags}
                                            allTags={allTags}
                                            maxVisible={3}
                                        />
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant={getStatusBadgeVariant(school.status)} className="rounded-full text-[10px] font-black uppercase px-2.5 h-5">{school.status}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <div className="flex justify-center items-center gap-1">
                                    {school.workspaceIds?.length > 1 ? (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary cursor-help"><Share2 className="h-3.5 w-3.5" /></div>
                                                </TooltipTrigger>
                                                <TooltipContent className="p-2 space-y-1">
                                                    <p className="text-[9px] font-black uppercase text-primary border-b pb-1">Shared Visibility</p>
                                                    {school.workspaceIds.map(w => <p key={w} className="text-[10px] font-bold uppercase">• {w}</p>)}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ) : <span className="text-[10px] font-black text-muted-foreground/30">—</span>}
                                </div>
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
                                <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl">
                                    <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground px-3 py-2">Management</DropdownMenuLabel>
                                    <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3"><Link href={`/admin/schools/${school.id}`}><div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Eye className="h-3.5 w-3.5" /></div><span className="font-bold text-sm">View Console</span></Link></DropdownMenuItem>
                                    
                                    <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => setChangingStatusSchool(school)}>
                                        <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" /></div>
                                        <span className="font-bold text-sm">Update School Status</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => setTransferringSchool(school)}>
                                        <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><ArrowRightLeft className="h-3.5 w-3.5" /></div>
                                        <span className="font-bold text-sm">Transfer Pipeline</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => setTaggingSchool(school)}>
                                        <div className="p-1.5 bg-violet-50 rounded-lg text-violet-600"><TagIcon className="h-3.5 w-3.5" /></div>
                                        <span className="font-bold text-sm">Manage Tags</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="my-2" />
                                    
                                    <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3"><Link href={`/admin/schools/${school.id}/edit`}><div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Edit className="h-3.5 w-3.5" /></div><span className="font-bold text-sm">Edit Profile</span></Link></DropdownMenuItem>
                                    <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3"><Link href={`/admin/meetings/new?schoolId=${school.id}`}><div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><CalendarPlus className="h-3.5 w-3.5" /></div><span className="font-bold text-sm">Schedule Session</span></Link></DropdownMenuItem>
                                    <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3">
                                        <Link href={`/admin/messaging/composer?schoolId=${school.id}&recipient=${signatory?.email || signatory?.phone || ''}`}>
                                            <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Send className="h-3.5 w-3.5" /></div>
                                            <span className="font-bold text-sm">Send Message</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuSeparator className="my-2" />
                                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10 rounded-xl p-2.5 gap-3" onClick={() => setSchoolToDelete(school)}><Trash2 className="h-3.5 w-3.5" /><span className="font-bold text-sm">Delete School</span></DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            </TableCell>
                        </TableRow>
                        )})
                    ) : (
                        <TableRow><TableCell colSpan={8} className="h-48 text-center text-muted-foreground italic">No school records found for the active workspace.</TableCell></TableRow>
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
      <ChangeStatusModal school={changingStatusSchool} open={!!changingStatusSchool} onOpenChange={(open) => !open && setChangingStatusSchool(null)} />
      <TransferPipelineModal school={transferringSchool} open={!!transferringSchool} onOpenChange={(open) => !open && setTransferringSchool(null)} />
      
      {taggingSchool && (
        <AlertDialog open={!!taggingSchool} onOpenChange={(open) => !open && setTaggingSchool(null)}>
          <AlertDialogContent className="rounded-2xl max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black">Manage Tags</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                {taggingSchool.name}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <TagSelector
              contactId={taggingSchool.id}
              contactType="school"
              currentTagIds={taggingSchool.tags ?? []}
            />
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" onClick={() => setTaggingSchool(null)}>Done</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <BulkTagOperations
        open={isBulkTagOpen}
        onOpenChange={setIsBulkTagOpen}
        selectedContactIds={selectedSchoolIds}
        contactType="school"
        onComplete={() => setSelectedSchoolIds([])}
      />
    </TooltipProvider>
  );
}
