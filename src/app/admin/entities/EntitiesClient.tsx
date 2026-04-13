'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { collection, doc, deleteDoc, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import type { WorkspaceEntity, Entity, OnboardingStage, Zone, Tag, TagCategory } from '@/lib/types';
import { TagSelector } from '@/components/tags/TagSelector';
import { TagBadges } from '@/components/tags/TagBadges';
import { BulkTagOperations } from '@/components/tags/BulkTagOperations';
import { TagFilter } from '@/components/tags/TagFilter';
import type { TagFilter as TagFilterState } from '@/components/tags/TagFilter';
import { getContactsByTagsAction } from '@/lib/tag-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, CalendarPlus, Edit, Trash2, MapPin, UserPlus, Workflow, ArrowUpDown, Eye, Send, PlusCircle, Sparkles, User, FileUp, ShieldCheck, ArrowRightLeft, Share2, Tag as TagIcon, Mail, Phone, MessageCircle } from 'lucide-react';
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

import { useTerminology } from '@/hooks/use-terminology';

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
  const { activeWorkspaceId } = useWorkspace();
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
  const [assigningEntity, setAssigningEntity] = useState<WorkspaceEntity | null>(null);
  const [changingStageEntity, setChangingStageEntity] = useState<WorkspaceEntity | null>(null);
  const [changingStatusEntity, setChangingStatusEntity] = useState<WorkspaceEntity | null>(null);
  const [transferringEntity, setTransferringEntity] = useState<WorkspaceEntity | null>(null);
  const [taggingEntity, setTaggingEntity] = useState<WorkspaceEntity | null>(null);

  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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
    
    // 3. Tag Filter — restrict to IDs returned by getContactsByTagsAction
    if (tagFilteredIds !== null) temp = temp.filter(s => tagFilteredIds.has(s.entityId));
    
    return temp;
  }, [entities, assignedUserId, searchTerm, stageFilter, statusFilter, tagFilteredIds]);
  
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
        toast({ title: `${singular} Archived`, description: `${entityToDelete.displayName} has been removed from this workspace.` });
        setEntityToDelete(null);
    }).catch((error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update' }));
        setEntityToDelete(null);
    });
  };

  return (
    <TooltipProvider>
 <div className="h-full overflow-y-auto  bg-background text-left">
 <div className=" space-y-8">
 <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6">
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
 <RainbowButton asChild className="h-11 px-6 gap-2 font-semibold text-[10px] shadow-xl transition-all active:scale-95 text-white">
                        <Link href="/admin/entities/new/ai">
 <Sparkles className="h-4 w-4" /> AI Architect
                        </Link>
                    </RainbowButton>
 <Button asChild className="rounded-xl font-bold shadow-lg h-11 px-6">
                        <Link href="/admin/entities/new">
 <PlusCircle className="mr-2 h-5 w-5" />
                            {addNew}
                        </Link>
                    </Button>
                </div>
            </div>
            
 <Card className="glass-card rounded-2xl overflow-hidden">
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
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
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
 <TableHead><Button variant="ghost" onClick={() => handleSort('displayName')} className="font-bold text-[10px] p-0 h-auto">{termName} <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
 <TableHead className="text-center"><span className="text-[10px] font-bold ">Status</span></TableHead>
 <TableHead><Button variant="ghost" onClick={() => handleSort('currentStageName')} className="font-bold text-[10px] p-0 h-auto">Pipeline Stage <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
 <TableHead><span className="text-[10px] font-bold ">Focal Persons</span></TableHead>
 <TableHead><Button variant="ghost" onClick={() => handleSort('assignedTo.name')} className="font-bold text-[10px] p-0 h-auto">Assigned To <ArrowUpDown className="ml-2 h-3 w-3"/></Button></TableHead>
 <TableHead className="text-right pr-6"><span className="text-[10px] font-bold ">Actions</span></TableHead>
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
 <TableRow key={entity.id} className={cn("group hover:bg-muted/30 transition-colors", assigningEntity?.id === entity.id && "bg-primary/5")}>
 <TableCell className="pl-6">
 <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedEntityIds.includes(entity.id)}
                                onChange={() => toggleEntitySelection(entity.id)}
 className="h-4 w-4 rounded border-border cursor-pointer"
                                aria-label={`Select ${entity.displayName}`}
                              />
 <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
 <AvatarFallback className="font-bold text-xs">{getInitials(entity.displayName)}</AvatarFallback>
                              </Avatar>
                            </div>
                            </TableCell>
 <TableCell className="py-4">
 <div className="flex flex-col text-left gap-1">
 <Link href={`/admin/entities/${entity.entityId}`} className="font-semibold text-sm text-foreground hover:text-primary hover:underline transition-colors tracking-tight">{entity.displayName}</Link>
 <span className="text-[9px] font-bold text-muted-foreground opacity-60 flex items-center gap-1">
 <User className="h-2 w-2" /> {entity.primaryEmail || 'No Primary Contact'}
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
 <div className="flex flex-col gap-1.5 max-w-[200px]">
                                    {(entity.focalPersons || []).length > 0 ? (
                                        entity.focalPersons?.map((fp, idx) => (
 <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors group/fp">
 <div className="flex flex-col min-w-0">
 <span className={cn("text-[10px] font-semibold truncate ", fp.isSignatory && "text-primary")}>{fp.name}</span>
 <span className="text-[8px] font-bold opacity-50 truncate">{fp.type}</span>
                                                </div>
 <div className="flex items-center gap-0.5 opacity-0 group-hover/fp:opacity-100 transition-opacity">
                                                    {fp.email && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
 <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" asChild>
 <a href={`mailto:${fp.email}`}><Mail className="h-3 w-3" /></a>
                                                                </Button>
                                                            </TooltipTrigger>
 <TooltipContent className="text-[10px]">Email {fp.name}</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                    {fp.phone && (
                                                        <>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
 <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" asChild>
 <a href={`tel:${fp.phone}`}><Phone className="h-3 w-3" /></a>
                                                                    </Button>
                                                                </TooltipTrigger>
 <TooltipContent className="text-[10px]">Call {fp.name}</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
 <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" asChild>
 <a href={`https://wa.me/${fp.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3 w-3" /></a>
                                                                    </Button>
                                                                </TooltipTrigger>
 <TooltipContent className="text-[10px]">WhatsApp {fp.name}</TooltipContent>
                                                          </Tooltip>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
 <span className="text-[10px] italic opacity-40">No Focal Persons</span>
                                    )}
                                </div>
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
 <DropdownMenuItem className="text-destructive focus:bg-destructive/10 rounded-xl p-2.5 gap-3" onClick={() => setEntityToDelete(entity)}><Trash2 className="h-3.5 w-3.5" /><span className="font-bold text-sm">{deleteLabel}</span></DropdownMenuItem>
                                </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            </TableCell>
                        </TableRow>
                        )})
                    ) : (
 <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">{noFound}</TableCell></TableRow>
                    )}
                    </TableBody>
                </Table>
            </div>
        </div>
      </div>
      <AlertDialog open={!!entityToDelete} onOpenChange={(open) => !open && setEntityToDelete(null)}>
 <AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle className="font-semibold">{deleteConfirm}</AlertDialogTitle><AlertDialogDescription>This will archive <span className="font-bold">{entityToDelete?.displayName}</span> from the active pipeline. You can still access the core record in global management.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteEntity} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold">Archive {singular}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
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
              contactId={taggingEntity.entityId}
              contactType="school"
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
        contactType="school"
        onComplete={() => setSelectedEntityIds([])}
      />
    </TooltipProvider>
  );
}
