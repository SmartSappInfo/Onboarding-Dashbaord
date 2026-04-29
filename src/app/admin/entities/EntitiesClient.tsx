'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { collection, doc, deleteDoc, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser, useDoc } from '@/firebase';
import type { WorkspaceEntity, Entity, OnboardingStage, Zone, Tag, TagCategory } from '@/lib/types';
import { TagSelector } from '@/components/tags/TagSelector';
import { TagBadges } from '@/components/tags/TagBadges';
import { BulkTagOperations } from '@/components/tags/BulkTagOperations';
import { TagFilter } from '@/components/tags/TagFilter';
import type { TagFilter as TagFilterState } from '@/components/tags/TagFilter';
import { getContactsByTagsAction } from '@/lib/tag-actions';
import { deleteEntityPermanentlyAction } from '@/lib/workspace-entity-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, CalendarPlus, Edit, Trash2, MapPin, UserPlus, Workflow, ArrowUpDown, Eye, Send, PlusCircle, Sparkles, User, FileUp, ShieldCheck, ArrowRightLeft, Share2, Tag as TagIcon, Mail, Phone, MessageCircle, Building2, Flame } from 'lucide-react';
import ManageWorkspacesModal from './components/ManageWorkspacesModal';
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
import { usePermissions } from '@/hooks/use-permissions';
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
import { LocationCascade, type LocationValue } from '@/components/location/LocationCascade';
import { AsyncEntityAvatar } from '../components/AsyncEntityAvatar';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { useTerminology } from '@/hooks/use-terminology';
import { getIndustryErrorMessage, getIndustrySuccessMessage } from '@/lib/industry-monitoring';
import { useIndustry } from '@/context/IndustryContext';

const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

const getStatusBadgeVariant = (status: any) => {
    switch (status) {
        case 'active':
        case 'Active': return 'default';
        case 'Inactive': return 'secondary';
        case 'archived':
        case 'Archived': return 'outline';
        default: return 'secondary';
    }
}

export default function EntitiesClient() {
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user: currentUser } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { industry } = useIndustry();
  const { 
    singular, 
    plural, 
    addNew, 
    importBulk, 
    noFound, 
    deleteConfirm, 
    deleteLabel, 
    updateStatus, 
    termName, 
    termStatus,
    viewConsole,
    editProfile
  } = useTerminology();

  const [entityToDelete, setEntityToDelete] = useState<WorkspaceEntity | null>(null);
  const [entityToPermanentDelete, setEntityToPermanentDelete] = useState<WorkspaceEntity | null>(null);
  const [isPermanentDeleting, setIsPermanentDeleting] = useState(false);
  const [assigningEntity, setAssigningEntity] = useState<WorkspaceEntity | null>(null);
  const [changingStageEntity, setChangingStageEntity] = useState<WorkspaceEntity | null>(null);
  const [changingStatusEntity, setChangingStatusEntity] = useState<WorkspaceEntity | null>(null);
  const [transferringEntity, setTransferringEntity] = useState<WorkspaceEntity | null>(null);
  const [taggingEntity, setTaggingEntity] = useState<WorkspaceEntity | null>(null);
  const [managingWorkspacesEntity, setManagingWorkspacesEntity] = useState<WorkspaceEntity | null>(null);

  const { can } = usePermissions();
  const canCreate = can('operations', 'campuses', 'create');
  const canDelete = can('operations', 'campuses', 'delete');
  const canEdit = can('operations', 'campuses', 'edit');

  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortConfig, setSortConfig] = useState<{ key: keyof WorkspaceEntity | string; direction: 'asc' | 'desc' } | null>({ key: 'addedAt', direction: 'desc' });

  // Tag-related state
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
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

  // Location filter state
  const [locationFilter, setLocationFilter] = useState<LocationValue>({});

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

  // STRICT ENTITY QUERY: Use workspace_entities collection exclusively
  const entitiesCol = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId)) : null, 
  [firestore, activeWorkspaceId]);

  const stagesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order')) : null, [firestore]);
  const zonesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'zones'), orderBy('name')) : null, [firestore]);
  
  const { data: entities, isLoading: isLoadingEntities } = useCollection<WorkspaceEntity>(entitiesCol);
  const { data: stages } = useCollection<OnboardingStage>(stagesCol);
  const { data: zones } = useCollection<Zone>(zonesCol);

  const isLoading = isLoadingEntities || isLoadingFilter || isTagFiltering;

  const filteredEntities = useMemo(() => {
    if (!entities) return [];
    let temp = entities;

    // 1. Global Assignment Filter
    if (assignedUserId) temp = assignedUserId === 'unassigned' ? temp.filter(s => !s.assignedTo?.userId) : temp.filter(s => s.assignedTo?.userId === assignedUserId);
    
    // 2. Search & UI Filters
    if (searchTerm) temp = temp.filter(s => s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (stageFilter !== 'all') temp = temp.filter(s => s.stageId === stageFilter);
    if (statusFilter !== 'all') temp = temp.filter(s => s.status === statusFilter);
    
    // 3. Location Filters
    if (locationFilter.country) temp = temp.filter(s => s.locationCountryId === locationFilter.country?.id);
    if (locationFilter.region) temp = temp.filter(s => s.locationRegionId === locationFilter.region?.id);
    if (locationFilter.district) temp = temp.filter(s => s.locationDistrictId === locationFilter.district?.id);

    // 4. Tag Filter — restrict to IDs returned by getContactsByTagsAction
    if (tagFilteredIds !== null) temp = temp.filter(s => tagFilteredIds.has(s.entityId));
    
    return temp;
  }, [entities, assignedUserId, searchTerm, stageFilter, statusFilter, tagFilteredIds, locationFilter]);
  
  const sortedEntities = useMemo(() => {
    let sortable = [...filteredEntities];
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
  }, [filteredEntities, sortConfig]);
  
  const handleSort = (key: any) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig?.key === key && sortConfig?.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };

  const toggleEntitySelection = (id: string) => {
    setSelectedEntityIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteEntity = () => {
    if (!firestore || !entityToDelete) return;
    const docRef = doc(firestore, 'workspace_entities', entityToDelete.id);
    updateDoc(docRef, { status: 'archived', updatedAt: new Date().toISOString() }).then(() => {
        const successMessage = getIndustrySuccessMessage('archive', industry, entityToDelete.displayName);
        toast({ title: successMessage, description: `${entityToDelete.displayName} has been archived.` });
        setEntityToDelete(null);
    }).catch((error) => {
        const errorMessage = getIndustryErrorMessage('entity_delete_failed', industry, { entityName: entityToDelete.displayName, details: error.message });
        toast({ variant: 'destructive', title: 'Archive Failed', description: errorMessage });
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setEntityToDelete(null);
    });
  };

  const handlePermanentDelete = async () => {
    if (!entityToPermanentDelete || !currentUser || isPermanentDeleting) return;
    setIsPermanentDeleting(true);
    try {
      const result = await deleteEntityPermanentlyAction({
        workspaceEntityId: entityToPermanentDelete.id,
        entityId: entityToPermanentDelete.entityId,
        userId: currentUser.uid,
        userName: currentUser.displayName || undefined,
        userEmail: currentUser.email || undefined,
      });
      if (result.success) {
        toast({
          title: 'Permanently Deleted',
          description: `"${entityToPermanentDelete.displayName}" has been purged${result.rootEntityDeleted ? ' including the core identity record' : ' from this workspace'}.`,
        });
        setEntityToPermanentDelete(null);
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
      setIsPermanentDeleting(false);
    }
  };

    return (
        <TooltipProvider>
            <div className="h-full overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-8 pb-32">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                        <div className="flex flex-col items-start">
                            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-foreground ">
                                <Building2 className="h-10 w-10 text-primary" />
                                {plural} Hub
                            </h1>
                            <p className="text-muted-foreground font-medium text-lg mt-1">
                                Pipeline entities and relationship management
                            </p>
                        </div>
                        <div className="flex justify-end items-center gap-3 shrink-0">
                            {selectedEntityIds.length > 0 && (
                                <Button
                                    variant="outline"
                                    className="rounded-xl font-bold h-11 px-6 border-primary/20 text-primary hover:bg-primary/5 gap-2"
                                    onClick={() => setIsBulkTagOpen(true)}
                                >
                                    <TagIcon className="h-4 w-4" />
                                    Tag {selectedEntityIds.length} Selected
                                </Button>
                            )}
                            <Button asChild variant="outline" className="rounded-xl font-bold h-11 px-6 border-primary/20 text-primary hover:bg-primary/5">
                                <Link href="/admin/entities/upload">
                                    <FileUp className="mr-2 h-4 w-4" />
                                    {importBulk}
                                </Link>
                            </Button>
                            {canCreate && (
                                <RainbowButton asChild className="h-11 px-6 gap-2 font-semibold text-[10px] shadow-xl transition-all active:scale-95 text-white">
                                    <Link href="/admin/entities/new/ai">
                                        <Sparkles className="h-4 w-4" /> AI Architect
                                    </Link>
                                </RainbowButton>
                            )}
                            {canCreate && (
                                <Button asChild className="rounded-xl font-bold shadow-lg h-11 px-6">
                                    <Link href="/admin/entities/new">
                                        <PlusCircle className="mr-2 h-5 w-5" />
                                        {addNew}
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>
            
                    {/* Filters Area */}
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-transparent p-4 rounded-3xl border shadow-sm ring-1 ring-border">
                        <div className="relative flex-1 max-w-sm">
                            <Input placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 bg-muted/50 border-border text-foreground placeholder:text-slate-600 rounded-xl focus:border-primary/50 focus:ring-primary/20" />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-12 w-full md:w-[200px] rounded-2xl bg-background/50 backdrop-blur-sm border border-border shadow-sm font-semibold text-[10px] transition-all hover:bg-accent/10 focus:ring-1 focus:ring-primary/20">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-muted border-border rounded-xl">
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={stageFilter} onValueChange={setStageFilter}>
                            <SelectTrigger className="w-[180px] h-10 bg-muted/50 border-border text-foreground rounded-xl">
                                <SelectValue placeholder="All Stages" />
                            </SelectTrigger>
                            <SelectContent className="bg-muted border-border rounded-xl">
                                <SelectItem value="all">All Stages</SelectItem>
                                {stages?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Badge variant="outline" className="text-xs text-muted-foreground border-border px-3 h-10 flex items-center shrink-0">
                            {filteredEntities.length} {filteredEntities.length === 1 ? singular : plural}
                        </Badge>
                    </div>

                    {/* Location and Tag filter row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-transparent p-4 rounded-3xl border shadow-sm ring-1 ring-border">
                            <LocationCascade 
                                value={locationFilter} 
                                onChange={setLocationFilter} 
                            />
                        </div>
                        <div className="bg-transparent p-4 rounded-3xl border shadow-sm ring-1 ring-border">
                            <TagFilter onFilterChange={handleTagFilterChange} className="pt-0.5" />
                        </div>
                    </div>
            
                    {/* Data Table */}
                    <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="w-[80px]" />
                                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                                        <Button variant="ghost" onClick={() => handleSort('displayName')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto hover:bg-transparent">
                                            {termName} <ArrowUpDown className="ml-2 h-3 w-3" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">Status</TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                                        <Button variant="ghost" onClick={() => handleSort('currentStageName')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto hover:bg-transparent">
                                            Pipeline Stage <ArrowUpDown className="ml-2 h-3 w-3" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">Contacts</TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                                        <Button variant="ghost" onClick={() => handleSort('assignedTo.name')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto hover:bg-transparent">
                                            Assigned To <ArrowUpDown className="ml-2 h-3 w-3" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-right pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-12 w-full rounded-lg" /></TableCell></TableRow>
                                ))
                            ) : sortedEntities.length > 0 ? (
                                sortedEntities.map((entity) => {
                                return (
                                        <TableRow key={entity.id} className={cn("border-border hover:bg-accent/20 transition-colors", assigningEntity?.id === entity.id && "bg-primary/5")}>
                                            <TableCell className="pl-6">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEntityIds.includes(entity.id)}
                                                        onChange={() => toggleEntitySelection(entity.id)}
                                                        className="h-4 w-4 rounded border-border cursor-pointer"
                                                        aria-label={`Select ${entity.displayName}`}
                                                    />
                                                    <AsyncEntityAvatar 
                                                        entityId={entity.entityId}
                                                        src={entity.logoUrl} 
                                                        name={entity.displayName} 
                                                        initials={entity.initials}
                                                        className="h-10 w-10 ring-2 ring-background shadow-sm"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col text-left gap-1">
                                                    <Link href={`/admin/entities/${entity.entityId}`} className="font-semibold text-sm text-foreground hover:text-primary hover:underline transition-colors tracking-tight">{entity.displayName}</Link>
                                                    <span className="text-[9px] font-bold text-muted-foreground opacity-60 flex items-center gap-1">
                                                        <User className="h-2 w-2" /> <PrimaryContactName entityId={entity.entityId} fallback={entity.primaryEmail} />
                                                    </span>
                                                    {entity.workspaceTags && entity.workspaceTags.length > 0 && allTags && (
                                                        <TagBadges
                                                            tagIds={entity.workspaceTags}
                                                            allTags={allTags}
                                                            maxVisible={3}
                                                        />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={getStatusBadgeVariant(entity.status)} className="rounded-full text-[10px] font-semibold uppercase px-2.5 h-5">{entity.status}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="text-[10px] font-bold uppercase border-none h-6 bg-primary/10 text-primary">{entity.currentStageName || 'Welcome'}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <CompactContactList entityId={entity.entityId} />
                                            </TableCell>
                                            <TableCell className="text-xs font-medium text-muted-foreground">
                                                {entity.assignedTo?.name || <span className="italic opacity-50">Unassigned</span>}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-1 transition-opacity">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setChangingStageEntity(entity)}>
                                                                <Workflow className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Change Stage</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setAssigningEntity(entity)}>
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
                                                            <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground px-3 py-2">Management</DropdownMenuLabel>
                                                            <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3"><Link href={`/admin/entities/${entity.entityId}`}><div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Eye className="h-3.5 w-3.5" /></div><span className="font-bold text-sm">{viewConsole}</span></Link></DropdownMenuItem>
                                                            
                                                            <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => setChangingStatusEntity(entity)}>
                                                                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500"><ShieldCheck className="h-3.5 w-3.5" /></div>
                                                                <span className="font-bold text-sm">{updateStatus}</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => setTransferringEntity(entity)}>
                                                                <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500"><ArrowRightLeft className="h-3.5 w-3.5" /></div>
                                                                <span className="font-bold text-sm">Transfer Pipeline</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => setTaggingEntity(entity)}>
                                                                <div className="p-1.5 bg-violet-500/10 rounded-lg text-violet-500"><TagIcon className="h-3.5 w-3.5" /></div>
                                                                <span className="font-bold text-sm">Manage Tags</span>
                                                            </DropdownMenuItem>

                                                            <DropdownMenuSeparator className="my-2" />
                                                            
                                                            <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3"><Link href={`/admin/entities/${entity.entityId}/edit`}><div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Edit className="h-3.5 w-3.5" /></div><span className="font-bold text-sm">{editProfile}</span></Link></DropdownMenuItem>
                                                            <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3"><Link href={`/admin/meetings/new?entityId=${entity.entityId}`}><div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><CalendarPlus className="h-3.5 w-3.5" /></div><span className="font-bold text-sm">Schedule Session</span></Link></DropdownMenuItem>
                                                            <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3">
                                                                <Link href={`/admin/messaging/composer?entityId=${entity.entityId}&recipient=${entity.primaryEmail || entity.primaryPhone || ''}`}>
                                                                    <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Send className="h-3.5 w-3.5" /></div>
                                                                    <span className="font-bold text-sm">Send Message</span>
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            
                                                            <DropdownMenuSeparator className="my-2" />
                                                            <DropdownMenuItem className="rounded-xl p-2.5 gap-3" onClick={() => setManagingWorkspacesEntity(entity)}>
                                                                <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-500"><Share2 className="h-3.5 w-3.5" /></div>
                                                                <span className="font-bold text-sm">Manage Workspaces</span>
                                                            </DropdownMenuItem>

                                                            <DropdownMenuSeparator className="my-2" />
                                                            {canDelete && (
                                                                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 rounded-xl p-2.5 gap-3" onClick={() => setEntityToDelete(entity)}>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    <span className="font-bold text-sm">{deleteLabel}</span>
                                                                </DropdownMenuItem>
                                                            )}
                                                            {canDelete && entity.status === 'archived' && (
                                                                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 rounded-xl p-2.5 gap-3" onClick={() => setEntityToPermanentDelete(entity)}>
                                                                    <Flame className="h-3.5 w-3.5" />
                                                                    <span className="font-bold text-sm">Delete Permanently</span>
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        )})
                            ) : (
                                <TableRow className="border-border">
                                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">{noFound}</TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
            <AlertDialog open={!!entityToDelete} onOpenChange={(open) => !open && setEntityToDelete(null)}>
                <AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle className="font-semibold">{deleteConfirm}</AlertDialogTitle><AlertDialogDescription>This will archive <span className="font-bold">{entityToDelete?.displayName}</span> from the active pipeline. Switch the status filter to &ldquo;Archived&rdquo; to find and permanently delete it later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteEntity} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold">Archive {singular}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!entityToPermanentDelete} onOpenChange={(open) => !open && setEntityToPermanentDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-semibold text-destructive">Permanently Delete?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will <span className="font-bold text-foreground">irreversibly purge</span> <span className="font-bold">{entityToPermanentDelete?.displayName}</span> and all associated data. If this is the last workspace it belongs to, the core identity record will also be deleted. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl" disabled={isPermanentDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePermanentDelete} disabled={isPermanentDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold gap-2">
                            {isPermanentDeleting ? 'Deleting…' : '⚠ Delete Forever'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AssignUserModal entity={assigningEntity} open={!!assigningEntity} onOpenChange={(open) => !open && setAssigningEntity(null)} />
            <ChangeStageModal entity={changingStageEntity} open={!!changingStageEntity} onOpenChange={(open) => !open && setChangingStageEntity(null)} />
            <ChangeStatusModal entity={changingStatusEntity} open={!!changingStatusEntity} onOpenChange={(open) => !open && setChangingStatusEntity(null)} />
            <TransferPipelineModal entity={transferringEntity} open={!!transferringEntity} onOpenChange={(open) => !open && setTransferringEntity(null)} />
            
            {taggingEntity && (
                <AlertDialog open={!!taggingEntity} onOpenChange={(open) => !open && setTaggingEntity(null)}>
                    <AlertDialogContent className="rounded-2xl max-w-md">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-semibold">Manage Tags</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs text-muted-foreground">
                                {taggingEntity.displayName}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <TagSelector
                            contactId={taggingEntity.id}
                            contactType="workspace_entity"
                            currentTagIds={taggingEntity.workspaceTags ?? []}
                        />
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl" onClick={() => setTaggingEntity(null)}>Done</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            <BulkTagOperations
                open={isBulkTagOpen}
                onOpenChange={setIsBulkTagOpen}
                selectedContactIds={selectedEntityIds}
                contactType="workspace_entity"
                onComplete={() => setSelectedEntityIds([])}
            />

            {managingWorkspacesEntity && (
                <ManageWorkspacesModal
                    entityId={managingWorkspacesEntity.entityId}
                    entityType={managingWorkspacesEntity.entityType}
                    entityName={managingWorkspacesEntity.displayName}
                    open={!!managingWorkspacesEntity}
                    onOpenChange={(open) => !open && setManagingWorkspacesEntity(null)}
                />
            )}
        </TooltipProvider>
    );
}

function PrimaryContactName({ entityId, fallback }: { entityId: string, fallback?: string }) {
    const firestore = useFirestore();
    const docRef = useMemoFirebase(() => firestore ? doc(firestore, 'entities', entityId) : null, [firestore, entityId]);
    const { data: baseEntity } = useDoc<Entity>(docRef);

    const contacts = baseEntity?.entityContacts || [];
    const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
    const name = primaryContact?.name || fallback;

    if (!name) return <span className="italic opacity-50">No Primary Contact</span>;
    return <span className="tracking-tight">{name}</span>;
}

function CompactContactList({ entityId }: { entityId: string }) {
    const firestore = useFirestore();
    const docRef = useMemoFirebase(() => firestore ? doc(firestore, 'entities', entityId) : null, [firestore, entityId]);
    const { data: baseEntity } = useDoc<Entity>(docRef);

    const contacts = baseEntity?.entityContacts || [];

    if (contacts.length === 0) {
        return <span className="text-[10px] italic opacity-40">No Contacts</span>;
    }

    return (
        <div className="flex -space-x-2 overflow-visible py-1">
            {contacts.slice(0, 4).map((c, i) => (
                <Tooltip key={i} delayDuration={100}>
                    <TooltipTrigger asChild>
                        <Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background cursor-pointer hover:-translate-y-1 transition-transform relative z-0 hover:z-10 bg-background border-none">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">{getInitials(c.name)}</AvatarFallback>
                        </Avatar>
                    </TooltipTrigger>
                    <TooltipContent className="p-3 text-left z-50">
                        <p className="font-bold text-sm tracking-tight">{c.name}</p>
                        <Badge variant="outline" className="text-[8px] uppercase tracking-tighter mt-1 mb-2">{c.typeLabel || c.typeKey || (c as any).type}</Badge>
                        <div className="space-y-1">
                            {c.email && <p className="text-[10px] flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" /> {c.email}</p>}
                            {c.phone && <p className="text-[10px] flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" /> {c.phone}</p>}
                        </div>
                    </TooltipContent>
                </Tooltip>
            ))}
            {contacts.length > 4 && (
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-[10px] font-bold ring-2 ring-background z-0 relative border border-border/50">
                    +{contacts.length - 4}
                </div>
            )}
        </div>
    );
}
