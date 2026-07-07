'use client';
import { useState, useMemo, useEffect, useCallback, useTransition, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { collection, doc, deleteDoc, query, where, orderBy, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser, useDoc } from '@/firebase';
import type { WorkspaceEntity, Entity, Zone, Tag, TagCategory, Module } from '@/lib/types';
import { TagSelector } from '@/components/tags/TagSelector';
import { TagBadges } from '@/components/tags/TagBadges';
import { BulkTagOperations } from '@/components/tags/BulkTagOperations';
import { TagFilter } from '@/components/tags/TagFilter';
import type { TagFilter as TagFilterState } from '@/components/tags/TagFilter';import { useEntityFilters, DEFAULT_FILTERS, type DirectoryFilterState } from './hooks/useEntityFilters';
import { InterestFilterSelect } from './components/InterestFilterSelect';
import { getContactsByTagsAction } from '@/lib/tag-actions';
import { usePaginatedEntities } from './hooks/usePaginatedEntities';

import { 
  deleteEntityPermanentlyAction, 
  bulkArchiveEntitiesAction, 
  bulkDeleteEntitiesAction,
  getFilteredEntityIdsAction,
  archiveEntityAction
} from '@/lib/workspace-entity-actions';
import { PageContainerFluid } from '@/components/ui/page-container';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, CalendarPlus, Edit, Trash2, MapPin, UserPlus, ArrowUpDown, Eye, Send, PlusCircle, Sparkles, User, FileUp, ShieldCheck, Share2, Tag as TagIcon, Mail, Phone, MessageCircle, Building2, Flame, Filter, ChevronDown, ListFilter, X, RotateCcw, Clock, CalendarDays, ClipboardList, Video, PhoneCall, Download } from 'lucide-react';
import ManageWorkspacesModal from './components/ManageWorkspacesModal';
import AiEntityGenerator from './components/ai-entity-generator';
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
import { Textarea } from '@/components/ui/textarea';

import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn, toTitleCase } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { createAudience } from '@/lib/audience-hooks';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { LocationCascade, type LocationValue } from '@/components/location/LocationCascade';
import { CountrySelect } from '@/components/location/CountrySelect';
import { RegionSelect } from '@/components/location/RegionSelect';
import { DistrictSelect } from '@/components/location/DistrictSelect';
import { AsyncEntityAvatar } from '../components/AsyncEntityAvatar';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { useTerminology } from '@/hooks/use-terminology';
import { getIndustryErrorMessage, getIndustrySuccessMessage } from '@/lib/industry-monitoring';
import { useIndustry } from '@/context/IndustryContext';
import { ContactVerificationPanel } from '../components/ContactVerificationPanel';
import { BulkScanProgress } from '../components/BulkScanProgress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { exportEntitiesToCSVAction } from '@/lib/import-export/entity-export-actions';
import { useWorkspaceVisibility } from '@/hooks/use-workspace-visibility';

// Pagination & Selection Matrix Imports
import { useEntitySelection } from './hooks/useEntitySelection';
import { BentoPagination } from './components/BentoPagination';
import { BulkActionDock } from './components/BulkActionDock';
import BulkCreateDealModal from './components/BulkCreateDealModal';
import BulkCreateTaskModal from './components/BulkCreateTaskModal';
import BulkMeetingInviteModal from './components/BulkMeetingInviteModal';
import dynamic from 'next/dynamic';

const AddToCampaignDialog = dynamic(
  () => import('./components/AddToCampaignDialog').then(m => m.AddToCampaignDialog),
  { ssr: false, loading: () => <Skeleton className="h-10 w-full rounded-xl" /> }
);

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
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { industry } = useIndustry();
  const { restrictToAssigned } = useWorkspaceVisibility();
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
  const [isArchiving, setIsArchiving] = useState(false);
  const [assigningEntity, setAssigningEntity] = useState<WorkspaceEntity | null>(null);

  const [archiveAllWorkspaces, setArchiveAllWorkspaces] = useState(false);
  const [deleteAllWorkspaces, setDeleteAllWorkspaces] = useState(false);
  const [bulkArchiveAll, setBulkArchiveAll] = useState(false);
  const [bulkDeleteAll, setBulkDeleteAll] = useState(false);
  const [isBulkArchiveOpen, setIsBulkArchiveOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const [taggingEntity, setTaggingEntity] = useState<WorkspaceEntity | null>(null);
  const [managingWorkspacesEntity, setManagingWorkspacesEntity] = useState<WorkspaceEntity | null>(null);
  const [isAiArchitectOpen, setIsAiArchitectOpen] = useState(false);

  useEffect(() => {
    if (!entityToDelete) setArchiveAllWorkspaces(false);
  }, [entityToDelete]);

  useEffect(() => {
    if (!entityToPermanentDelete) setDeleteAllWorkspaces(false);
  }, [entityToPermanentDelete]);

  useEffect(() => {
    if (!isBulkArchiveOpen) setBulkArchiveAll(false);
  }, [isBulkArchiveOpen]);

  useEffect(() => {
    if (!isBulkDeleteOpen) setBulkDeleteAll(false);
  }, [isBulkDeleteOpen]);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProcessed, setScanProcessed] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanAbortController, setScanAbortController] = useState<AbortController | null>(null);

  const handleBulkScan = async () => {
    if (selectedEntityIds.length === 0) return;
    
    // 1. Gather all entity IDs from the selected workspace entities
    const selectedEntities = sortedEntities.filter(e => selectedEntityIds.includes(e.id));
    
    // 2. Fetch all contacts from entities documents in parallel
    let allEmails: string[] = [];
    
    try {
      if (!firestore) return;
      
      const fetchPromises = selectedEntities.map(async (e) => {
        if (!e.entityId) return [];
        const entityDocRef = doc(firestore, 'entities', e.entityId);
        const entityDoc = await getDoc(entityDocRef);
        if (!entityDoc.exists()) return [];
        const data = entityDoc.data();
        const contacts = data?.entityContacts || [];
        return contacts.map((c: any) => c.email).filter(Boolean) as string[];
      });
      
      const emailLists = await Promise.all(fetchPromises);
      allEmails = Array.from(new Set(emailLists.flat().map(email => email.toLowerCase())));
    } catch (err) {
      console.error('[BulkScan] Failed to fetch contact emails:', err);
      toast({ variant: 'destructive', title: 'Fetch Error', description: 'Failed to retrieve entity contact emails.' });
      return;
    }

    if (allEmails.length === 0) {
      toast({ title: 'No Emails Found', description: 'Selected entities do not have any contact emails.' });
      return;
    }

    setIsScanning(true);
    setScanTotal(allEmails.length);
    setScanProcessed(0);
    
    const abort = new AbortController();
    setScanAbortController(abort);

    try {
      // Fire-and-forget: send emails to background trigger in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < allEmails.length; i += chunkSize) {
        if (abort.signal.aborted) break;
        
        const chunk = allEmails.slice(i, i + chunkSize);
        const res = await fetch('/api/verify-email/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: chunk }),
          signal: abort.signal
        });
        
        if (!res.ok) throw new Error('Verification trigger failed');
        const data = await res.json();
        setScanProcessed(prev => prev + (data.processedCount || chunk.length));
      }
      if (!abort.signal.aborted) {
        toast({ title: 'Verification Queued', description: `${allEmails.length} emails are being verified in the background. Results will appear automatically.` });
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
         toast({ variant: 'destructive', title: 'Scan Interrupted', description: e.message });
      }
    } finally {
      setTimeout(() => setIsScanning(false), 2000);
      setScanAbortController(null);
    }
  };

  const handleManualRecheck = async (email: string) => {
    try {
      const res = await fetch('/api/verify-email/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [email] })
      });
      if (!res.ok) throw new Error('Verification trigger failed');
      toast({ title: 'Verification Queued', description: `${email} is being verified in the background.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Recheck Failed', description: e.message });
    }
  };

  const { can } = usePermissions();
  const canCreate = can('operations', 'campuses', 'create');
  const canDelete = can('operations', 'campuses', 'delete');
  const canEdit = can('operations', 'campuses', 'edit');

  const [isExporting, startExportTransition] = useTransition();

  const handleExportCSV = (entityIdsToExport?: string[]) => {
    if (!firestore || !activeWorkspaceId || !currentUser) return;

    const targetIds = entityIdsToExport || filteredEntityIds;
    if (targetIds.length === 0) {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'No records to export.' });
      return;
    }

    const orgId = activeWorkspace?.organizationId || 'smartsapp-hq';

    startExportTransition(async () => {
      try {
        const res = await exportEntitiesToCSVAction(
          targetIds,
          activeWorkspaceId,
          orgId,
          currentUser.uid
        );

        if (!res.success || res.data === undefined) {
          throw new Error(res.error || 'Failed to generate export file.');
        }

        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = `${(activeWorkspace?.name || 'SmartSapp').replace(/\s+/g, '_')}_${plural}_Export_${new Date().toISOString().slice(0, 10)}.csv`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        let description = `${res.count ?? targetIds.length} records successfully exported.`;
        if (targetIds.length > 5000) {
          description += ' (Limited to the first 5,000 records)';
        }

        toast({ title: 'Export Complete', description });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast({ variant: 'destructive', title: 'Export Failed', description: message });
      }
    });
  };

  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const [sortConfig, setSortConfig] = useState<{ key: keyof WorkspaceEntity | string; direction: 'asc' | 'desc' } | null>({ key: 'addedAt', direction: 'desc' });

  // Unified atomic filter state (prevents state drift on Clear All)
  const [filterState, setFilterState] = useState<DirectoryFilterState>(() => ({
    ...DEFAULT_FILTERS,
    tags: {
      tagIds: searchParams.get('tags')?.split(',').filter(Boolean) || [],
      logic: (['AND', 'OR', 'NOT'].includes(searchParams.get('logic') || '') ? searchParams.get('logic') as TagFilterState['logic'] : 'OR'),
      categoryFilter: (searchParams.get('category') as TagCategory) ?? undefined,
    },
    contactHealths: searchParams.get('health')?.split(',').filter(Boolean) || [],
  }));

  // Convenience accessors for backward-compatible bindings
  const searchTerm = filterState.search;
  const statusFilter = filterState.status;
  const locationFilter = filterState.location;
  const tagFilterState = filterState.tags;
  const dateAddedFilter = filterState.dateRange;
  const interestFilter = filterState.interests || [];

  const setSearchTerm = useCallback((v: string) => setFilterState(prev => ({ ...prev, search: v })), []);
  const setStatusFilter = useCallback((v: string) => setFilterState(prev => ({ ...prev, status: v })), []);
  const setLocationFilter = useCallback((v: LocationValue) => setFilterState(prev => ({ ...prev, location: v })), []);
  const setDateAddedFilter = useCallback((v: string) => setFilterState(prev => ({ ...prev, dateRange: v })), []);
  const setInterestFilter = useCallback((v: string[]) => setFilterState(prev => ({ ...prev, interests: v })), []);
  
  const clearAllFilters = useCallback(() => {
    setFilterState(DEFAULT_FILTERS);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tags');
    params.delete('logic');
    params.delete('category');
    params.delete('health');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  // Save Audience Dialog state
  const [isSaveAudienceOpen, setIsSaveAudienceOpen] = useState(false);
  const [audienceName, setAudienceName] = useState('');
  const [audienceDesc, setAudienceDesc] = useState('');
  const [isSavingAudience, setIsSavingAudience] = useState(false);

  const handleSaveAudience = async () => {
    if (!firestore || !currentUser || !activeWorkspaceId) return;
    setIsSavingAudience(true);
    try {
      const filters: any[] = [];
      
      if (filterState.status && filterState.status !== 'all') {
        filters.push({
          id: `status_${Date.now()}`,
          field: 'status',
          operator: 'is',
          value: filterState.status,
        });
      }
      
      if (filterState.location) {
        if (filterState.location.country) {
          filters.push({
            id: `country_${Date.now()}`,
            field: 'locationCountry',
            operator: 'is',
            value: filterState.location.country.id,
          });
        }
        if (filterState.location.region) {
          filters.push({
            id: `region_${Date.now()}`,
            field: 'locationRegion',
            operator: 'is',
            value: filterState.location.region.id,
          });
        }
        if (filterState.location.district) {
          filters.push({
            id: `district_${Date.now()}`,
            field: 'locationDistrict',
            operator: 'is',
            value: filterState.location.district.id,
          });
        }
      }
      
      if (filterState.tags && filterState.tags.tagIds.length > 0) {
        filters.push({
          id: `tags_${Date.now()}`,
          field: 'tags',
          operator: filterState.tags.logic === 'AND' ? 'all_of' : (filterState.tags.logic === 'NOT' ? 'is_not' : 'any_of'),
          value: filterState.tags.tagIds,
        });
      }
      

      
      if (filterState.interests && filterState.interests.length > 0) {
        filters.push({
          id: `interests_${Date.now()}`,
          field: 'interests',
          operator: 'any_of',
          value: filterState.interests,
        });
      }
      
      if (filterState.contactRoles && filterState.contactRoles.length > 0) {
        filters.push({
          id: `contactRoles_${Date.now()}`,
          field: 'contactRoles',
          operator: 'any_of',
          value: filterState.contactRoles,
        });
      }

      await createAudience(firestore, {
        workspaceId: activeWorkspaceId,
        name: audienceName.trim(),
        description: audienceDesc.trim() || undefined,
        filters,
        filterLogic: 'AND',
        groups: [{
          id: `g_${Date.now()}`,
          relation: 'and',
          conditions: filters.map((f: any) => ({
            id: f.id || `c_${Date.now()}`,
            field: f.field,
            operator: f.operator,
            value: f.value
          }))
        }],
        createdBy: currentUser.uid,
      });

      toast({ title: 'Audience Saved', description: `Saved "${audienceName}" for use in messaging.` });
      setIsSaveAudienceOpen(false);
      setAudienceName('');
      setAudienceDesc('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsSavingAudience(false);
    }
  };

  // Tag-related state
  const [isBulkTagOpen, setIsBulkTagOpen] = useState(false);

  // Custom Pagination state limits
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Bulk Modals state triggers
  const [isBulkDealOpen, setIsBulkDealOpen] = useState(false);
  const [isBulkTaskOpen, setIsBulkTaskOpen] = useState(false);
  const [isBulkMeetingOpen, setIsBulkMeetingOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [singleMeetingEntityId, setSingleMeetingEntityId] = useState<string | null>(null);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [campaignEntityIds, setCampaignEntityIds] = useState<string[]>([]);


  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

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

  const updateHealthUrlParams = useCallback((healths: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (healths.length > 0) {
      params.set('health', healths.join(','));
    } else {
      params.delete('health');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleHealthFilterChange = useCallback((val: string[]) => {
    setFilterState(prev => ({ ...prev, contactHealths: val }));
    updateHealthUrlParams(val);
  }, [updateHealthUrlParams]);

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
    setFilterState(prev => ({ ...prev, tags: filter }));
    updateUrlParams(filter);
  }, [updateUrlParams]);

  const [filteredEntityIds, setFilteredEntityIds] = useState<string[]>([]);
  const [isFetchingIds, setIsFetchingIds] = useState<boolean>(true);

  // Set up useEffect with a 300ms debounce to fetch matching document IDs
  useEffect(() => {
    if (!activeWorkspaceId) {
      setFilteredEntityIds([]);
      setIsFetchingIds(false);
      return;
    }

    if (isTagFiltering) {
      return;
    }

    let isCurrent = true;
    setIsFetchingIds(true);

    const debounceTimer = setTimeout(() => {
      const tagFilteredIdsArray = tagFilteredIds ? Array.from(tagFilteredIds) : null;

      getFilteredEntityIdsAction(
        activeWorkspaceId,
        filterState as any,
        assignedUserId,
        tagFilteredIdsArray,
        sortConfig
      ).then(res => {
        if (!isCurrent) return;
        if (res.success && res.data) {
          setFilteredEntityIds(res.data);
        } else {
          console.error("Failed to fetch filtered entity IDs:", res.error);
          setFilteredEntityIds([]);
        }
        setIsFetchingIds(false);
      }).catch(err => {
        if (!isCurrent) return;
        console.error("Error fetching filtered entity IDs:", err);
        setFilteredEntityIds([]);
        setIsFetchingIds(false);
      });
    }, 300);

    return () => {
      isCurrent = false;
      clearTimeout(debounceTimer);
    };
  }, [
    activeWorkspaceId,
    filterState,
    assignedUserId,
    tagFilteredIds,
    isTagFiltering,
    sortConfig
  ]);

  // STRICT PAGINATED QUERY: Fetches entities page-by-page from Firestore
  const { 
    entities, 
    isLoading: isLoadingEntities,
    totalCount: totalEntitiesCount
  } = usePaginatedEntities({
    firestore,
    activeWorkspaceId,
    currentPage,
    pageSize,
    filteredEntityIds,
  });

  // saved audiences query for client-side filtering
  const audiencesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'message_audiences'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);
  
  const { data: allAudiences } = useCollection<any>(audiencesQuery);

  // Extract unique contact roles from RAW entities for dropdown list
  const contactRoleOptions = useMemo(() => {
    const options = [
      { value: 'primary', label: 'Primary Contact' },
      { value: 'signatories', label: 'Signatory' },
    ];
    
    if (entities) {
      const uniqueRoles = new Map<string, string>();
      entities.forEach((entity: any) => {
        const sourceContacts = entity.entityContacts || entity.contacts || [];
        sourceContacts.forEach((c: any) => {
          if (c.typeKey && c.typeKey !== 'primary' && c.typeKey !== 'signatory' && c.typeKey !== 'signatories') {
            const label = c.typeLabel || c.typeKey.charAt(0).toUpperCase() + c.typeKey.slice(1);
            uniqueRoles.set(c.typeKey, label);
          }
        });
      });
      
      const sortedCustomRoles = Array.from(uniqueRoles.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([key, label]) => ({ value: `role:${key}`, label }));
        
      options.push(...sortedCustomRoles);
    }
    
    return options;
  }, [entities]);

  // Frequently used tags calculation for filtering
  const frequentlyUsedTags = useMemo(() => {
    if (!allTags) return [];
    
    // Count occurrences of each tag in entities
    const counts: Record<string, number> = {};
    if (entities) {
      entities.forEach((entity: any) => {
        if (entity.tagIds && Array.isArray(entity.tagIds)) {
          entity.tagIds.forEach((id: string) => {
            counts[id] = (counts[id] || 0) + 1;
          });
        }
      });
    }

    // Map tags with counts, sort by count descending, then take top 8
    const sorted = [...allTags]
      .map(tag => ({ ...tag, count: counts[tag.id] || 0 }))
      .sort((a, b) => b.count - a.count);
      
    return sorted.slice(0, 8);
  }, [allTags, entities]);

  const toggleTagFilter = useCallback((tagId: string) => {
    const isSelected = tagFilterState.tagIds.includes(tagId);
    const newTagIds = isSelected 
      ? tagFilterState.tagIds.filter(id => id !== tagId)
      : [...tagFilterState.tagIds, tagId];
      
    handleTagFilterChange({
      ...tagFilterState,
      tagIds: newTagIds
    });
  }, [tagFilterState, handleTagFilterChange]);

  const [emailVerificationCache, setEmailVerificationCache] = useState<Record<string, { status: string; score: number }>>({});
  const fetchedEmailsRef = useRef<Set<string>>(new Set());

  // Get all unique emails from the entities
  const allEmails = useMemo(() => {
    if (!entities) return [];
    const emails = new Set<string>();
    entities.forEach(entity => {
      const contacts = entity.entityContacts || [];
      contacts.forEach(c => {
        if (c.email) {
          emails.add(c.email.toLowerCase().trim());
        }
      });
    });
    return Array.from(emails);
  }, [entities]);

  // Batch fetch email verification cache from Firestore
  useEffect(() => {
    if (!firestore || allEmails.length === 0) return;

    let active = true;
    
    // Only query emails we don't have in cache yet to save reads
    const emailsToFetch = allEmails.filter(email => !fetchedEmailsRef.current.has(email));
    if (emailsToFetch.length === 0) return;

    // Mark as fetched immediately to avoid double fetching
    emailsToFetch.forEach(email => fetchedEmailsRef.current.add(email));

    const fetchCache = async () => {
      const newCacheData: Record<string, { status: string; score: number }> = {};
      const chunks: string[][] = [];
      for (let i = 0; i < emailsToFetch.length; i += 30) {
        chunks.push(emailsToFetch.slice(i, i + 30));
      }

      try {
        await Promise.all(chunks.map(async (chunk) => {
          const hashes = chunk.map(email => btoa(email.toLowerCase().trim()));
          const q = query(collection(firestore, 'verification_cache'), where('__name__', 'in', hashes));
          const snap = await getDocs(q);
          
          snap.forEach(doc => {
            const data = doc.data();
            try {
              const email = atob(doc.id).toLowerCase().trim();
              newCacheData[email] = {
                status: data.status || 'unchecked',
                score: data.score || 0
              };
            } catch (e) {
              console.warn('Failed to decode email hash:', doc.id);
            }
          });
        }));

        if (active && Object.keys(newCacheData).length > 0) {
          setEmailVerificationCache(prev => ({
            ...prev,
            ...newCacheData
          }));
        }
      } catch (err) {
        console.error('Error fetching verification cache:', err);
        if (active) {
          emailsToFetch.forEach(email => fetchedEmailsRef.current.delete(email));
        }
      }
    };

    fetchCache();
    
    return () => {
      active = false;
    };
  }, [firestore, allEmails]);

  const contactHealthOptions = [
    { value: 'verified', label: 'Verified' },
    { value: 'likely_valid', label: 'Likely Valid' },
    { value: 'risky', label: 'Risky' },
    { value: 'invalid', label: 'Invalid' },
    { value: 'unchecked', label: 'Unchecked' },
  ];

  const isLoading = isLoadingEntities || isLoadingFilter || isTagFiltering || isFetchingIds;

  // Decoupled single-pass filtering engine (useEntityFilters hook)
  const { filteredEntities, activeFiltersCount, activeFilterCapsules } = useEntityFilters({
    entities,
    filterState,
    assignedUserId,
    tagFilteredIds,
    emailVerificationCache,
    savedAudiences: allAudiences,
  });


  
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

  // Reset pagination index back to page 1 on active filter adjustments
  useEffect(() => {
    setCurrentPage(1);
  }, [filterState, assignedUserId]);

  // Hook up our robust Selection Hook Core
  const {
    selectedEntityIds,
    setSelectedEntityIds,
    paginatedEntities,
    totalPages,
    selectedCount,
    isAllSelectedOnPage,
    isAllSelectedInView,
    isIndeterminateOnPage,
    toggleSelect,
    selectCurrentPage,
    selectOtherPages,
    selectAllInView,
    clearSelection,
  } = useEntitySelection({
    entities: sortedEntities,
    currentPage,
    pageSize,
    onPageReset: () => setCurrentPage(1),
    serverPaginated: true,
    totalCount: filteredEntityIds.length,
    allFilteredIds: filteredEntityIds,
  });

  const selectedEntities = useMemo(() => {
    return sortedEntities.filter((e: any) => selectedEntityIds.includes(e.id));
  }, [sortedEntities, selectedEntityIds]);

  const handleDeleteEntity = async () => {
    if (!currentUser || !entityToDelete || isArchiving) return;
    setIsArchiving(true);
    try {
      const result = await archiveEntityAction({
        workspaceEntityId: entityToDelete.id,
        entityId: entityToDelete.entityId,
        userId: currentUser.uid,
        userName: currentUser.displayName || undefined,
        userEmail: currentUser.email || undefined,
        archiveAllWorkspaces,
      });

      if (result.success) {
        const successMessage = getIndustrySuccessMessage('archive', industry, entityToDelete.displayName);
        toast({
          title: successMessage,
          description: `"${entityToDelete.displayName}" has been archived${archiveAllWorkspaces ? ' across all workspaces' : ''}.`,
        });
        setEntityToDelete(null);
      } else {
        throw new Error(result.error);
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to archive';
      const errorMessage = getIndustryErrorMessage('entity_delete_failed', industry, { entityName: entityToDelete.displayName, details: errorMsg });
      toast({ variant: 'destructive', title: 'Archive Failed', description: errorMessage });
      setEntityToDelete(null);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnarchiveEntity = (entity: WorkspaceEntity) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'workspace_entities', entity.id);
    updateDoc(docRef, { status: 'active', updatedAt: new Date().toISOString() })
      .then(() => toast({ title: 'Restored', description: `${entity.displayName} has been restored and is now active.` }))
      .catch(() => toast({ variant: 'destructive', title: 'Restore Failed', description: 'Could not restore this record. Check your permissions.' }));
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
        deleteAllWorkspaces,
      });
      if (result.success) {
        toast({
          title: 'Permanently Deleted',
          description: `"${entityToPermanentDelete.displayName}" has been purged${deleteAllWorkspaces ? ' across all workspaces' : (result.rootEntityDeleted ? ' including the core identity record' : ' from this workspace')}.`,
        });
        setEntityToPermanentDelete(null);
      } else {
        throw new Error(result.error);
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to delete permanently';
      toast({ variant: 'destructive', title: 'Delete Failed', description: errorMsg });
    } finally {
      setIsPermanentDeleting(false);
    }
  };

  const [isBulkArchiving, startBulkArchiveTransition] = useTransition();
  const [isBulkDeleting, startBulkDeleteTransition] = useTransition();

  const handleBulkArchive = () => {
    if (selectedEntityIds.length === 0 || !currentUser) return;
    if (!canEdit) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permissions to edit/archive these records.',
      });
      return;
    }

    startBulkArchiveTransition(async () => {
      try {
        const result = await bulkArchiveEntitiesAction({
          workspaceEntityIds: selectedEntityIds,
          userId: currentUser.uid,
          userName: currentUser.displayName || undefined,
          userEmail: currentUser.email || undefined,
          archiveAllWorkspaces: bulkArchiveAll,
        });

        if (result.success) {
          toast({
            title: 'Bulk Archiving Complete',
            description: `${result.count} selected records have been archived successfully.`,
          });
          clearSelection();
          setIsBulkArchiveOpen(false);
        } else {
          throw new Error(result.error);
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Failed to bulk archive';
        toast({
          variant: 'destructive',
          title: 'Bulk Archive Failed',
          description: errorMsg,
        });
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedEntityIds.length === 0 || !currentUser) return;
    if (!canDelete) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have administrative permissions to delete records permanently.',
      });
      return;
    }

    startBulkDeleteTransition(async () => {
      try {
        const result = await bulkDeleteEntitiesAction({
          workspaceEntityIds: selectedEntityIds,
          userId: currentUser.uid,
          userName: currentUser.displayName || undefined,
          userEmail: currentUser.email || undefined,
          purgeRootEntity: true,
          deleteAllWorkspaces: bulkDeleteAll,
        });

        if (result.success) {
          toast({
            title: 'Bulk Deletion Complete',
            description: `${result.count} selected records have been permanently purged.`,
          });
          clearSelection();
          setIsBulkDeleteOpen(false);
        } else {
          throw new Error(result.error);
        }
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : 'Failed to bulk delete';
        toast({
          variant: 'destructive',
          title: 'Bulk Delete Failed',
          description: errorMsg,
        });
      }
    });
  };    return (
        <TooltipProvider>
            <PageContainerFluid>
                <div className="space-y-8 pb-32 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                {plural} Hub
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage and monitor your {plural} records
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedCount > 0 && (
                              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-black uppercase tracking-widest animate-pulse select-none mr-2">
                                {selectedCount} Active
                              </div>
                            )}

                            {canCreate && (
                                <RainbowButton onClick={() => setIsAiArchitectOpen(true)} className="h-11 px-5 gap-2 font-bold text-[10px] shadow-xl transition-all active:scale-95 text-white">
                                    <Sparkles className="h-4 w-4" /> AI Architect
                                </RainbowButton>
                            )}

                            <Button asChild variant="outline" className="h-11 px-5 gap-2 font-bold text-[10px] uppercase tracking-widest shadow-sm rounded-xl border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600">
                                <Link href="/admin/entities/lead-scoring">
                                    <Sparkles className="h-4 w-4 text-amber-500" />
                                    Lead Cleanup
                                </Link>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-11 px-5 gap-2 font-bold text-[10px] uppercase tracking-widest shadow-sm rounded-xl border-border bg-card hover:bg-accent hover:text-accent-foreground gap-2"
                                onClick={() => handleExportCSV()}
                                disabled={isExporting || filteredEntityIds.length === 0}
                            >
                                {isExporting ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                    <Download className="h-4 w-4 text-primary" />
                                )}
                                Export CSV
                            </Button>

                            {canCreate && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button className="rounded-xl font-bold shadow-lg h-11 px-5 gap-2 bg-[#4d69ff] hover:bg-[#3d59ef] text-white">
                                            <PlusCircle size={18} />
                                            Add
                                            <ChevronDown size={14} className="opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 mt-1">
                                        <DropdownMenuItem asChild className="rounded-lg py-3 cursor-pointer">
                                            <Link href="/admin/entities/new" className="flex items-center gap-3">
                                                <div className="p-2 rounded-md bg-primary/10 text-primary"><UserPlus size={16} /></div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm">New {singular}</span>
                                                    <span className="text-[10px] text-muted-foreground">Create manual entry</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild className="rounded-lg py-3 cursor-pointer">
                                            <Link href="/admin/entities/upload" className="flex items-center gap-3">
                                                <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-600"><FileUp size={16} /></div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm">Bulk Import</span>
                                                    <span className="text-[10px] text-muted-foreground">Upload CSV/Excel</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-border/50" />
                                        <DropdownMenuItem asChild className="rounded-lg py-3 cursor-pointer">
                                            <Link href="/admin/entities/imports" className="flex items-center gap-3">
                                                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600"><ClipboardList size={16} /></div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm">View Imports Log</span>
                                                    <span className="text-[10px] text-muted-foreground">Track & resolve duplicates</span>
                                                </div>
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>

                    {/* Unified Action Bar */}
                    <div className="flex flex-col md:flex-row items-center gap-3 bg-white dark:bg-slate-900/50 p-2.5 rounded-2xl border shadow-sm ring-1 ring-border">
                        <div className="relative flex-1 group w-full">
                            <Input 
                                placeholder={`Search ${plural.toLowerCase()}...`} 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="h-11 bg-muted/30 border-none shadow-none text-foreground placeholder:text-slate-500 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 pl-11" 
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                <Building2 size={18} />
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Button 
                                variant={isFilterPanelOpen ? "secondary" : "outline"}
                                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                                className={cn(
                                    "h-11 px-4 rounded-xl font-bold gap-2 transition-all border-border/50 w-full md:w-auto justify-center",
                                    isFilterPanelOpen && "ring-2 ring-primary/20 border-primary/30"
                                )}
                            >
                                <ListFilter size={18} className={cn(isFilterPanelOpen && "text-primary")} />
                                Filters
                                {activeFiltersCount > 0 ? (
                                    <Badge className={cn(
                                        "ml-0.5 h-5 min-w-[20px] px-1.5 bg-primary text-white border-none text-[10px] font-black tabular-nums rounded-full",
                                        !isFilterPanelOpen && "animate-pulse"
                                    )}>
                                        {activeFiltersCount}
                                    </Badge>
                                ) : null}
                            </Button>
                        </div>
                    </div>

                    {/* Compact Unified Filter Panel */}
                    {isFilterPanelOpen && (
                        <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card/50 backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Advanced Filters</p>
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-destructive/70 hover:text-destructive" onClick={clearAllFilters}>Reset All</Button>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Row 1: Filter by Tags (Full Width Row) */}
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center justify-between h-5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                            <TagIcon className="h-2.5 w-2.5 text-primary" /> Filter by Tags
                                        </label>
                                        {tagFilterState.tagIds.length > 0 && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleTagFilterChange({ tagIds: [], logic: 'OR' })} 
                                                className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in"
                                            >
                                                Clear Tags
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 bg-muted/10 p-2 rounded-xl border border-border/50">
                                        {/* Dropdown tag search filter */}
                                        <TagFilter onFilterChange={handleTagFilterChange} value={tagFilterState} />
                                        
                                        {/* Divider (shown if popular tags exist) */}
                                        {frequentlyUsedTags.length > 0 && (
                                            <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />
                                        )}

                                        {/* Frequently Used Badges list */}
                                        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[200px]">
                                            {frequentlyUsedTags.length > 0 && (
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mr-1.5 select-none hidden md:inline">Popular:</span>
                                            )}
                                            {frequentlyUsedTags.map(tag => {
                                                const isSelected = tagFilterState.tagIds.includes(tag.id);
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        onClick={() => toggleTagFilter(tag.id)}
                                                        className={cn(
                                                            "h-7 px-2.5 rounded-xl text-[10px] font-bold uppercase transition-all duration-200 flex items-center gap-1.5 border touch-manipulation cursor-pointer",
                                                            isSelected
                                                                ? "text-white shadow-sm border-transparent"
                                                                : "bg-background/40 border-border/60 text-muted-foreground hover:bg-background hover:text-foreground"
                                                        )}
                                                        style={{
                                                            backgroundColor: isSelected ? tag.color || '#3b82f6' : undefined,
                                                        }}
                                                    >
                                                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: isSelected ? '#ffffff' : tag.color || '#3b82f6' }} />
                                                        {tag.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Status + Country + Region + District + Date Added + Interests + Contact Roles — inline dropdowns */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-3">
                                    {/* Saved Audience / Segment Dropdown */}
                                    <div className="space-y-1.5 animate-in fade-in">
                                        <div className="flex items-center justify-between h-5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                                <ListFilter className="h-2.5 w-2.5" /> Segment
                                            </label>
                                            {filterState.savedAudienceId && (
                                                <button type="button" onClick={() => setFilterState(prev => ({ ...prev, savedAudienceId: null }))} className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in">Clear</button>
                                            )}
                                        </div>
                                        <Select value={filterState.savedAudienceId || 'none'} onValueChange={(val) => setFilterState(prev => ({ ...prev, savedAudienceId: val === 'none' ? null : val }))}>
                                            <SelectTrigger className="h-9 rounded-xl bg-background/50 border-border shadow-sm font-bold text-xs">
                                                <SelectValue placeholder="All Contacts" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl p-1 w-[200px]">
                                                <SelectItem value="none">All Contacts</SelectItem>
                                                {allAudiences?.map((aud: any) => (
                                                    <SelectItem key={aud.id} value={aud.id}>
                                                        {aud.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Status */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between h-5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                                <Building2 className="h-2.5 w-2.5" /> Status
                                            </label>
                                            {statusFilter !== 'all' && (
                                                <button type="button" onClick={() => setStatusFilter('all')} className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in">Clear</button>
                                            )}
                                        </div>
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger className="h-9 rounded-xl bg-background/50 border-border shadow-sm font-bold text-xs">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl p-1">
                                                <SelectItem value="all">All Statuses</SelectItem>
                                                <SelectItem value="active">Active Only</SelectItem>
                                                <SelectItem value="archived">Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Country */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between h-5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                                <MapPin className="h-2.5 w-2.5" /> Country
                                            </label>
                                            {locationFilter.country && (
                                                <button type="button" onClick={() => setLocationFilter({ country: null, region: null, district: null })} className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in">Clear</button>
                                            )}
                                        </div>
                                        <CountrySelect
                                            value={locationFilter.country}
                                            onValueChange={(country) => setLocationFilter({ country, region: null, district: null })}
                                            className="h-9 rounded-xl bg-background/50 border-border shadow-sm font-bold text-xs"
                                        />
                                    </div>

                                    {/* Region */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between h-5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                                <MapPin className="h-2.5 w-2.5" /> Region
                                            </label>
                                            {locationFilter.region && (
                                                <button type="button" onClick={() => setLocationFilter({ ...locationFilter, region: null, district: null })} className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in">Clear</button>
                                            )}
                                        </div>
                                        <RegionSelect
                                            value={locationFilter.region}
                                            onValueChange={(region) => setLocationFilter({ ...locationFilter, region, district: null })}
                                            countryId={locationFilter.country?.id}
                                            className="h-9 rounded-xl bg-background/50 border-border shadow-sm font-bold text-xs"
                                        />
                                    </div>

                                    {/* District */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between h-5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                                <MapPin className="h-2.5 w-2.5" /> District
                                            </label>
                                            {locationFilter.district && (
                                                <button type="button" onClick={() => setLocationFilter({ ...locationFilter, district: null })} className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in">Clear</button>
                                            )}
                                        </div>
                                        <DistrictSelect
                                            value={locationFilter.district}
                                            onValueChange={(district) => setLocationFilter({ ...locationFilter, district })}
                                            regionId={locationFilter.region?.id}
                                            className="h-9 rounded-xl bg-background/50 border-border shadow-sm font-bold text-xs"
                                        />
                                    </div>

                                    {/* Date Added — compact select */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between h-5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                                <CalendarDays className="h-2.5 w-2.5" /> Date Added
                                            </label>
                                            {dateAddedFilter !== 'all' && (
                                                <button type="button" onClick={() => setDateAddedFilter('all')} className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in">Clear</button>
                                            )}
                                        </div>
                                        <Select value={dateAddedFilter} onValueChange={setDateAddedFilter}>
                                            <SelectTrigger className="h-9 rounded-xl bg-background/50 border-border shadow-sm font-bold text-xs">
                                                <SelectValue placeholder="Date range" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl p-1">
                                                <SelectItem value="all">All Time</SelectItem>
                                                <SelectItem value="today">Today</SelectItem>
                                                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                                                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                                                <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Interests — multi select */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between h-5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                                <Flame className="h-2.5 w-2.5" /> Interests
                                            </label>
                                            {interestFilter.length > 0 && (
                                                <button type="button" onClick={() => setInterestFilter([])} className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in">Clear</button>
                                            )}
                                        </div>
                                        <InterestFilterSelect
                                            value={interestFilter}
                                            onChange={setInterestFilter}
                                        />
                                    </div>

                                    {/* Contact Roles — multi select */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between h-5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                                <User className="h-2.5 w-2.5" /> Contact Roles
                                            </label>
                                            {filterState.contactRoles && filterState.contactRoles.length > 0 && (
                                                <button type="button" onClick={() => setFilterState(prev => ({ ...prev, contactRoles: [] }))} className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in">Clear</button>
                                            )}
                                        </div>
                                        <MultiSelect
                                            options={contactRoleOptions}
                                            value={filterState.contactRoles || []}
                                            onChange={(val) => setFilterState(prev => ({ ...prev, contactRoles: val }))}
                                            placeholder="Select roles..."
                                            className="h-9 min-h-9 py-0.5 px-2 text-[10px] font-bold bg-background/50 border-border shadow-sm rounded-xl"
                                        />
                                    </div>

                                    {/* Contact Health — multi select */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between h-5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                                <ShieldCheck className="h-2.5 w-2.5" /> Contact Health
                                            </label>
                                            {filterState.contactHealths && filterState.contactHealths.length > 0 && (
                                                <button type="button" onClick={() => handleHealthFilterChange([])} className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors animate-in fade-in">Clear</button>
                                            )}
                                        </div>
                                        <MultiSelect
                                            options={contactHealthOptions}
                                            value={filterState.contactHealths || []}
                                            onChange={handleHealthFilterChange}
                                            placeholder="Select health..."
                                            className="h-9 min-h-9 py-0.5 px-2 text-[10px] font-bold bg-background/50 border-border shadow-sm rounded-xl"
                                        />
                                    </div>
                                </div>


                            </div>
                        </Card>
                    )}

                    {/* Active Filters Strip — closable capsule badges */}
                    {activeFilterCapsules.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
                            {activeFilterCapsules.map(capsule => (
                                <Badge
                                    key={capsule.id}
                                    variant="outline"
                                    className="h-7 pl-2.5 pr-1.5 rounded-xl text-[10px] font-bold gap-1.5 border-primary/20 bg-primary/5 text-foreground"
                                >
                                    <span className="text-muted-foreground">{capsule.label}:</span>
                                    <span className="font-black">{capsule.value}</span>
                                    <button
                                        type="button"
                                        onClick={() => setFilterState(capsule.onClear())}
                                        className="ml-0.5 hover:bg-destructive/10 rounded-full p-0.5 transition-colors text-muted-foreground hover:text-destructive"
                                        aria-label={`Remove ${capsule.label} filter`}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAllFilters}
                                className="h-7 rounded-xl text-[10px] font-black uppercase tracking-widest text-destructive/70 hover:text-destructive hover:bg-destructive/5 px-2.5"
                            >
                                Clear All
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsSaveAudienceOpen(true)}
                                className="h-7 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary border-primary/20 hover:bg-primary/5 px-2.5"
                            >
                                Save as Audience
                            </Button>
                        </div>
                    )}
            
                    {/* Gmail-style Selection Matrix Banner */}
                    {selectedCount > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 bg-primary/5 dark:bg-primary/10 border-x border-t border-border rounded-t-2xl text-left animate-in slide-in-from-top-2 duration-300">
                        <div className="text-xs font-bold text-foreground flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3">
                          <span>
                            {isAllSelectedInView ? (
                              <>All <span className="font-mono text-primary font-black">{selectedCount}</span> {plural.toLowerCase()} in active view are selected.</>
                            ) : selectedCount === sortedEntities.length - paginatedEntities.length ? (
                              <>All <span className="font-mono text-primary font-black">{selectedCount}</span> {plural.toLowerCase()} on other pages are selected (excluding current page).</>
                            ) : (
                              <>All <span className="font-mono text-primary font-black">{paginatedEntities.filter(e => selectedEntityIds.includes(e.id)).length}</span> {plural.toLowerCase()} on this page are selected.</>
                            )}
                          </span>
                          
                          {/* Dynamic selections options */}
                          <div className="flex items-center gap-3">
                            {!isAllSelectedInView && (
                              <button
                                type="button"
                                onClick={selectAllInView}
                                className="text-primary hover:underline font-extrabold"
                              >
                                Select all {sortedEntities.length} {plural.toLowerCase()} in view
                              </button>
                            )}
                            {selectedCount === paginatedEntities.length && sortedEntities.length > paginatedEntities.length && (
                              <button
                                type="button"
                                onClick={selectOtherPages}
                                className="text-violet-600 dark:text-violet-400 hover:underline font-extrabold"
                              >
                                Select all {sortedEntities.length - paginatedEntities.length} on other pages
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSelection}
                          className="h-7 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground gap-1.5 px-3 rounded-lg"
                        >
                          <X className="h-3 w-3" /> Clear Selection
                        </Button>
                      </div>
                    )}

                    {/* Data Table */}
                    <div className={cn("border border-border bg-muted/30 overflow-hidden", selectedCount > 0 ? "rounded-b-2xl border-t-0" : "rounded-2xl")}>
                        {/* Top Pagination */}
                        <BentoPagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          totalRecords={filteredEntityIds.length}
                          pageSize={pageSize}
                          onPageChange={setCurrentPage}
                          onPageSizeChange={(size) => {
                            setPageSize(size);
                            setCurrentPage(1);
                          }}
                          className="border-t-0 border-b bg-card/40"
                        />
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="w-[80px] pl-6">
                                        <Checkbox
                                            checked={
                                                paginatedEntities.length > 0 && selectedEntityIds.length > 0
                                                    ? isAllSelectedOnPage
                                                        ? true
                                                        : 'indeterminate'
                                                    : false
                                            }
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    selectCurrentPage();
                                                } else {
                                                    clearSelection();
                                                }
                                            }}
                                            aria-label={`Select page visible items`}
                                            className="rounded"
                                        />
                                    </TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                                        <Button variant="ghost" onClick={() => handleSort('displayName')} className="font-bold text-[10px] uppercase tracking-widest p-0 h-auto hover:bg-transparent">
                                            {termName} <ArrowUpDown className="ml-2 h-3 w-3" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold text-center">Status</TableHead>
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
                            ) : paginatedEntities.length > 0 ? (
                                paginatedEntities.map((entity) => {
                                return (
                                        <TableRow key={entity.id} className={cn("border-border hover:bg-accent/20 transition-colors", assigningEntity?.id === entity.id && "bg-primary/5")}>
                                            <TableCell className="pl-6">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={selectedEntityIds.includes(entity.id)}
                                                        onCheckedChange={() => toggleSelect(entity.id)}
                                                        aria-label={`Select ${entity.displayName}`}
                                                        className="rounded"
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
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={getStatusBadgeVariant(entity.status)} className="rounded-full text-[10px] font-semibold uppercase px-2.5 h-5">{entity.status}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <CompactContactList 
                                                    entityId={entity.entityId} 
                                                    onManualRecheck={handleManualRecheck} 
                                                    activeContactRoles={filterState.contactRoles} 
                                                    activeContactHealths={filterState.contactHealths}
                                                    emailVerificationCache={emailVerificationCache}
                                                />
                                            </TableCell>
                                            <TableCell className="text-xs font-medium text-muted-foreground">
                                                {entity.assignedTo?.name || <span className="italic opacity-50">Unassigned</span>}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-1 transition-opacity">
                                                    {!restrictToAssigned && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setAssigningEntity(entity)}>
                                                                    <UserPlus className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Assign User</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn(
                                                                    "h-8 w-8",
                                                                    entity.workspaceTags?.length ? "text-violet-500 hover:text-violet-600" : "text-muted-foreground/40 hover:text-violet-500"
                                                                )}
                                                                onClick={() => setTaggingEntity(entity)}
                                                            >
                                                                <TagIcon className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="p-3 max-w-[240px]">
                                                            {entity.workspaceTags?.length && allTags ? (
                                                                <div className="space-y-1.5">
                                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tags</p>
                                                                    <TagBadges tagIds={entity.workspaceTags} allTags={allTags} maxVisible={8} size="xs" />
                                                                </div>
                                                            ) : (
                                                                <p className="text-[10px] font-bold text-muted-foreground italic">No tags — click to add</p>
                                                            )}
                                                        </TooltipContent>
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
                                                            



                                                            <DropdownMenuSeparator className="my-2" />
                                                            
                                                            <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3"><Link href={`/admin/entities/${entity.entityId}/edit`}><div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Edit className="h-3.5 w-3.5" /></div><span className="font-bold text-sm">{editProfile}</span></Link></DropdownMenuItem>
                                                            <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3"><Link href={`/admin/meetings/new?entityId=${entity.entityId}${filterState.contactRoles?.length ? `&contactRoles=${encodeURIComponent(filterState.contactRoles.join(','))}` : ''}`}><div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><CalendarPlus className="h-3.5 w-3.5" /></div><span className="font-bold text-sm">Schedule Session</span></Link></DropdownMenuItem>
                                                            <DropdownMenuItem className="rounded-xl p-2.5 gap-3 cursor-pointer" onClick={() => setSingleMeetingEntityId(entity.entityId)}>
                                                                <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Video className="h-3.5 w-3.5" /></div>
                                                                <span className="font-bold text-sm">Invite to Meeting</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild className="rounded-xl p-2.5 gap-3">
                                                                <Link href={buildComposerLink(entity, filterState.contactRoles)}>
                                                                    <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Send className="h-3.5 w-3.5" /></div>
                                                                    <span className="font-bold text-sm">Send Message</span>
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="rounded-xl p-2.5 gap-3 cursor-pointer" onClick={() => {
                                                                setCampaignEntityIds([entity.entityId]);
                                                                setIsCampaignDialogOpen(true);
                                                            }}>
                                                                <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><PhoneCall className="h-3.5 w-3.5" /></div>
                                                                <span className="font-bold text-sm">Add to Call Campaign</span>
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
                                                                <>
                                                                    <DropdownMenuItem className="rounded-xl p-2.5 gap-3 text-emerald-600 focus:bg-emerald-500/10" onClick={() => handleUnarchiveEntity(entity)}>
                                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                                        <span className="font-bold text-sm">Restore</span>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10 rounded-xl p-2.5 gap-3" onClick={() => setEntityToPermanentDelete(entity)}>
                                                                        <Flame className="h-3.5 w-3.5" />
                                                                        <span className="font-bold text-sm">Delete Permanently</span>
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow className="border-border">
                                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">{noFound}</TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>

                        {/* Custom BentoPagination injection */}
                        <BentoPagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          totalRecords={filteredEntityIds.length}
                          pageSize={pageSize}
                          onPageChange={setCurrentPage}
                          onPageSizeChange={(size) => {
                            setPageSize(size);
                            setCurrentPage(1);
                          }}
                        />
                    </div>
                </div>
            <AlertDialog open={!!entityToDelete} onOpenChange={(open) => !open && setEntityToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-semibold">{deleteConfirm}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <p>This will archive <span className="font-bold text-foreground">{entityToDelete?.displayName}</span>. You can restore it later from the Archived status filter.</p>
                                <div className="flex items-center gap-2 pt-2 text-xs font-semibold text-foreground select-none">
                                    <Checkbox
                                        id="archive-all-workspaces"
                                        checked={archiveAllWorkspaces}
                                        onCheckedChange={(checked) => setArchiveAllWorkspaces(checked === true)}
                                        className="rounded-[4px] border-muted-foreground/30 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 transition-colors"
                                    />
                                    <label htmlFor="archive-all-workspaces" className="cursor-pointer">
                                        Archive across all workspaces in this organization
                                    </label>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl" disabled={isArchiving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteEntity} disabled={isArchiving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold active:scale-[0.97] transition-transform">
                            {isArchiving ? 'Archiving…' : `Archive ${singular}`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!entityToPermanentDelete} onOpenChange={(open) => !open && setEntityToPermanentDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-semibold text-destructive">Permanently Delete?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <p>This will <span className="font-bold text-foreground">irreversibly purge</span> <span className="font-bold text-foreground">{entityToPermanentDelete?.displayName}</span> and all associated data. If this is the last workspace it belongs to, the core identity record will also be deleted. This cannot be undone.</p>
                                <div className="flex items-center gap-2 pt-2 text-xs font-semibold text-destructive select-none">
                                    <Checkbox
                                        id="delete-all-workspaces"
                                        checked={deleteAllWorkspaces}
                                        onCheckedChange={(checked) => setDeleteAllWorkspaces(checked === true)}
                                        className="rounded-[4px] border-destructive/30 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive transition-colors"
                                    />
                                    <label htmlFor="delete-all-workspaces" className="cursor-pointer text-destructive">
                                        Delete permanently from all workspaces in this organization
                                    </label>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl" disabled={isPermanentDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePermanentDelete} disabled={isPermanentDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold gap-2 active:scale-[0.97] transition-transform">
                            {isPermanentDeleting ? 'Deleting…' : '⚠ Delete Forever'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isBulkArchiveOpen} onOpenChange={setIsBulkArchiveOpen}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-semibold">Archive Selected?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <p>This will archive the <span className="font-bold text-foreground">{selectedEntityIds.length}</span> selected {selectedEntityIds.length === 1 ? singular : plural}. You can restore them later from the Archived status filter.</p>
                                <div className="flex items-center gap-2 pt-2 text-xs font-semibold text-foreground select-none">
                                    <Checkbox
                                        id="bulk-archive-all"
                                        checked={bulkArchiveAll}
                                        onCheckedChange={(checked) => setBulkArchiveAll(checked === true)}
                                        className="rounded-[4px] border-muted-foreground/30 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600 transition-colors"
                                    />
                                    <label htmlFor="bulk-archive-all" className="cursor-pointer">
                                        Archive selected records across all workspaces in this organization
                                    </label>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl" disabled={isBulkArchiving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkArchive} disabled={isBulkArchiving} className="bg-amber-600 text-white hover:bg-amber-700 rounded-xl font-bold gap-2 active:scale-[0.97] transition-transform">
                            {isBulkArchiving ? 'Archiving…' : `Archive ${selectedEntityIds.length} ${selectedEntityIds.length === 1 ? singular : plural}`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-semibold text-destructive">Permanently Delete Selected?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <p>This will <span className="font-bold text-foreground">irreversibly purge</span> the <span className="font-bold text-foreground">{selectedEntityIds.length}</span> selected {selectedEntityIds.length === 1 ? singular : plural} and all associated data. Only previously archived records can be deleted. Core identity records will be purged if they belong to no other workspace. This cannot be undone.</p>
                                <div className="flex items-center gap-2 pt-2 text-xs font-semibold text-destructive select-none">
                                    <Checkbox
                                        id="bulk-delete-all"
                                        checked={bulkDeleteAll}
                                        onCheckedChange={(checked) => setBulkDeleteAll(checked === true)}
                                        className="rounded-[4px] border-destructive/30 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive transition-colors"
                                    />
                                    <label htmlFor="bulk-delete-all" className="cursor-pointer text-destructive">
                                        Permanently delete selected records from all workspaces in this organization
                                    </label>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl" disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold gap-2 active:scale-[0.97] transition-transform">
                            {isBulkDeleting ? 'Deleting…' : `⚠ Delete ${selectedEntityIds.length} ${selectedEntityIds.length === 1 ? singular : plural} Forever`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <BulkScanProgress 
                isScanning={isScanning} 
                total={scanTotal} 
                processed={scanProcessed} 
                onCancel={() => {
                  scanAbortController?.abort();
                  setIsScanning(false);
                }} 
            />

            {/* Handled by AssignUserModal under Bulk Action Modal Section */}

            
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
                onComplete={() => clearSelection()}
            />

            {/* Custom bulk action modals injection */}
            <BulkCreateDealModal
              entityIds={selectedEntityIds}
              open={isBulkDealOpen}
              onOpenChange={setIsBulkDealOpen}
              onComplete={() => clearSelection()}
            />

            <BulkCreateTaskModal
              entityIds={selectedEntityIds}
              open={isBulkTaskOpen}
              onOpenChange={setIsBulkTaskOpen}
              onComplete={() => clearSelection()}
            />

            <BulkMeetingInviteModal
              entityIds={selectedEntities.map(e => e.entityId)}
              open={isBulkMeetingOpen}
              onOpenChange={setIsBulkMeetingOpen}
              onComplete={() => clearSelection()}
            />

            {singleMeetingEntityId && (
              <BulkMeetingInviteModal
                entityIds={[singleMeetingEntityId]}
                open={!!singleMeetingEntityId}
                onOpenChange={(open) => {
                  if (!open) setSingleMeetingEntityId(null);
                }}
              />
            )}

            {isCampaignDialogOpen && (
              <AddToCampaignDialog
                open={isCampaignDialogOpen}
                onOpenChange={setIsCampaignDialogOpen}
                entityIds={campaignEntityIds}
                workspaceId={activeWorkspaceId}
                onComplete={() => clearSelection()}
              />
            )}

            {/* Reassignment modal with bulk support */}
            <AssignUserModal 
              entity={assigningEntity} 
              selectedEntityIds={selectedEntityIds}
              open={!!assigningEntity || isBulkAssignOpen} 
              onOpenChange={(open) => {
                if (!open) {
                  setAssigningEntity(null);
                  setIsBulkAssignOpen(false);
                }
              }} 
              onComplete={() => clearSelection()}
            />

            {/* Floating glassmorphic dock controller */}
            <BulkActionDock
              selectedCount={selectedCount}
              onClearSelection={clearSelection}
              onVerify={handleBulkScan}
              onTags={() => setIsBulkTagOpen(true)}
              onAssign={() => setIsBulkAssignOpen(true)}
              onInitiateDeals={() => setIsBulkDealOpen(true)}
              onCreateTasks={() => setIsBulkTaskOpen(true)}
              onInviteMeetings={() => setIsBulkMeetingOpen(true)}
              onAddToCampaign={() => {
                setCampaignEntityIds(selectedEntities.map(e => e.entityId));
                setIsCampaignDialogOpen(true);
              }}
              onArchive={() => setIsBulkArchiveOpen(true)}
              onDelete={() => setIsBulkDeleteOpen(true)}
              onExport={() => handleExportCSV(selectedEntityIds)}
              hideAssign={restrictToAssigned}
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
            
            <Dialog open={isSaveAudienceOpen} onOpenChange={setIsSaveAudienceOpen}>
                <DialogContent className="rounded-2xl max-w-md bg-card text-card-foreground border border-border shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="font-semibold text-lg">Save Filter as Audience</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Create a reusable audience segment from your active directory filters.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Audience Name</label>
                            <Input 
                                placeholder="e.g. Active Signatories in Greater Accra" 
                                value={audienceName} 
                                onChange={e => setAudienceName(e.target.value)} 
                                className="rounded-xl font-bold bg-background border-border"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Description</label>
                            <Textarea 
                                placeholder="Describe this audience segment..." 
                                value={audienceDesc} 
                                onChange={e => setAudienceDesc(e.target.value)} 
                                className="rounded-xl min-h-[80px] bg-background border-border"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" className="rounded-xl font-bold" onClick={() => setIsSaveAudienceOpen(false)} disabled={isSavingAudience}>
                            Cancel
                        </Button>
                        <Button className="rounded-xl font-bold" onClick={handleSaveAudience} disabled={isSavingAudience || !audienceName.trim()}>
                            {isSavingAudience && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Segment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AiEntityGenerator open={isAiArchitectOpen} onOpenChange={setIsAiArchitectOpen} />

            </PageContainerFluid>
        </TooltipProvider>
    );
}

/**
 * Checks if a contact matches any of the given role filter values.
 * Reuses the same matching logic as useEntityFilters.ts for consistency.
 */
function matchesContactRoles(contact: any, roles: string[]): boolean {
    return roles.some(role => {
        if (role === 'primary') return !!contact.isPrimary;
        if (role === 'signatories' || role === 'signatory') return !!contact.isSignatory;
        const cleanRole = role.startsWith('role:') ? role.substring(5) : role;
        return contact.typeKey === cleanRole;
    });
}

/**
 * Builds the composer link URL for a given entity.
 * When contact roles filter is active, resolves the first matching contact's
 * email/phone as the recipient and passes contactRoles so the composer can
 * scope its audience correctly.
 */
function buildComposerLink(entity: any, activeContactRoles?: string[]): string {
    const base = `/admin/messaging/composer?entityId=${entity.entityId}`;
    
    if (activeContactRoles && activeContactRoles.length > 0) {
        // Resolve matched contact from workspace entity's denormalized contacts
        const contacts: any[] = entity.entityContacts || [];
        const matched = contacts.filter((c: any) => matchesContactRoles(c, activeContactRoles));
        const firstMatch = matched[0];
        const recipient = firstMatch?.email || firstMatch?.phone || entity.primaryEmail || entity.primaryPhone || '';
        const rolesParam = encodeURIComponent(activeContactRoles.join(','));
        return `${base}&recipient=${encodeURIComponent(recipient)}&contactRoles=${rolesParam}`;
    }
    
    return `${base}&recipient=${entity.primaryEmail || entity.primaryPhone || ''}`;
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

function CompactContactList({ 
    entityId, 
    onManualRecheck, 
    activeContactRoles,
    activeContactHealths,
    emailVerificationCache
}: { 
    entityId: string, 
    onManualRecheck: (email: string) => void, 
    activeContactRoles?: string[],
    activeContactHealths?: string[],
    emailVerificationCache?: Record<string, { status: string; score: number }>
}) {
    const firestore = useFirestore();
    const docRef = useMemoFirebase(() => firestore ? doc(firestore, 'entities', entityId) : null, [firestore, entityId]);
    const { data: baseEntity } = useDoc<Entity>(docRef);

    const allContacts = baseEntity?.entityContacts || [];

    // When a role or health filter is active, show only matching contacts
    const contacts = useMemo(() => {
        let filtered = allContacts;
        if (activeContactRoles && activeContactRoles.length > 0) {
            filtered = filtered.filter(c => matchesContactRoles(c, activeContactRoles));
        }
        if (activeContactHealths && activeContactHealths.length > 0 && emailVerificationCache) {
            filtered = filtered.filter(c => {
                const email = c.email?.toLowerCase().trim() || '';
                const status = email ? (emailVerificationCache[email]?.status || 'unchecked') : 'unchecked';
                return activeContactHealths.includes(status);
            });
        }
        return filtered;
    }, [allContacts, activeContactRoles, activeContactHealths, emailVerificationCache]);

    const isFiltered = (activeContactRoles && activeContactRoles.length > 0) || (activeContactHealths && activeContactHealths.length > 0);

    if (contacts.length === 0) {
        return <span className="text-[10px] italic opacity-40">{isFiltered ? 'No match' : 'No Contacts'}</span>;
    }

    return (
        <div className="flex -space-x-2 overflow-visible py-1">
            {contacts.slice(0, 4).map((c, i) => (
                <InteractiveContactAvatar key={i} contact={c} onManualRecheck={onManualRecheck} />
            ))}
            {contacts.length > 4 && (
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-[10px] font-bold ring-2 ring-background z-0 relative border border-border/50">
                    +{contacts.length - 4}
                </div>
            )}
            {isFiltered && allContacts.length > contacts.length && (
                <div className="ml-1 flex items-center">
                    <span className="text-[8px] text-muted-foreground/60 italic">{contacts.length}/{allContacts.length}</span>
                </div>
            )}
        </div>
    );
}

function EmailVerificationStatusDot({ email }: { email: string }) {
    const firestore = useFirestore();
    const hashed = useMemo(() => btoa(email.toLowerCase()), [email]);
    const docRef = useMemoFirebase(() => firestore ? doc(firestore, 'verification_cache', hashed) : null, [firestore, hashed]);
    const { data: cache } = useDoc<any>(docRef);

    const status = cache?.status || 'unchecked';
    
    if (status === 'verified' || status === 'likely_valid') {
        return null;
    }
    
    const colors = {
        risky: 'bg-amber-500',
        invalid: 'bg-rose-500',
        unchecked: 'bg-slate-400'
    };

    return <span className={cn("absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-background", colors[status as keyof typeof colors] || colors.unchecked)} />;
}

function InteractiveContactAvatar({ contact, onManualRecheck }: { contact: any, onManualRecheck: (email: string) => void }) {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);
    
    return (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
                <div onClick={(e) => e.stopPropagation()}>
                    <Tooltip
                        open={isTooltipOpen && !isPopoverOpen}
                        onOpenChange={setIsTooltipOpen}
                        delayDuration={100}
                    >
                        <TooltipTrigger asChild>
                            <div className="relative cursor-pointer hover:-translate-y-1 transition-transform relative z-0 hover:z-10">
                                <Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-background border-none">
                                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                                        {getInitials(contact.name)}
                                    </AvatarFallback>
                                </Avatar>
                                {contact.email && <EmailVerificationStatusDot email={contact.email} />}
                            </div>
                        </TooltipTrigger>

                        <TooltipContent className="p-3 text-left z-50">
                            <p className="font-bold text-sm tracking-tight">{contact.name}</p>
                            <Badge variant="outline" className="text-[8px] uppercase tracking-tighter mt-1 mb-2">
                                {contact.typeLabel || contact.typeKey || contact.type}
                            </Badge>
                            <div className="space-y-1">
                                {contact.email && <p className="text-[10px] flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" /> {contact.email}</p>}
                                {contact.phone && <p className="text-[10px] flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" /> {contact.phone}</p>}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </PopoverTrigger>

            <PopoverContent side="top" className="w-80 p-0 bg-slate-950 border-slate-800 shadow-2xl overflow-hidden z-50 rounded-2xl">
                <ContactVerificationPanel contact={contact} onRecheckEmail={onManualRecheck} />
            </PopoverContent>
        </Popover>
    );
}
