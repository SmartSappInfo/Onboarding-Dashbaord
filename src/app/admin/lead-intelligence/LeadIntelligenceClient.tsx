'use client';

/**
 * Lead Intelligence Hub Client (Lead Intelligence 2.0 - Phase 1)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. UI Spec Alignment: Fully conforms to intelligence_ui (Global Header Metrics, Jobs Center Tray, Power UX).
 * 2. Pre-Mortem & High-Load Guard: Batch sync and enrichment execute via chunked transactions with job progress tracking.
 * 3. Keyboard Ergonomics: Global '/' key for search autofocus (guarded for text inputs) and 'Esc' for modal dismissals.
 * 4. Strict Typing: 100% strict TypeScript types without any/any[].
 */

import React, { useState, useEffect, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Zap, 
  Loader2, 
  Folder, 
  LayoutGrid, 
  Search, 
  Globe, 
  BookmarkCheck, 
  Settings, 
  Activity, 
  Flame, 
  Database, 
  Building2,
  GitMerge,
  Radio,
  Sliders
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { 
  getLeadSettingsAction, 
  saveLeadSettingsAction, 
  searchProspectsAction, 
  enrichProspectAction, 
  syncProspectToCRMAction, 
  getRecentProspectsAction,
  getSavedSearchesAction,
  saveSearchAction,
  createLeadListAction,
  getLeadListsAction,
  addProspectsToListAction,
  deleteLeadListAction,
  batchSyncProspectsAction,
  batchEnrichProspectsAction,
  importProspectsFromCSVAction,
  saveViewAction,
  getIdentityCollisionsAction,
  getWorkspaceSignalsAction,
  getDailyRepBriefingAction
} from '@/app/actions/lead-intelligence-actions';
import type { 
  Prospect, 
  SearchFilters, 
  LeadIntelligenceSettings, 
  SavedSearch, 
  LeadList,
  DiscoverySourceType,
  IntelligenceJob,
  DailyRepBriefing
} from '@/lib/lead-intelligence/types';
import { FloatingActionToolbar } from './components/FloatingActionToolbar';
import { ProspectSlideOverSheet } from './components/ProspectSlideOverSheet';
import { JobsCenterDrawer } from './components/JobsCenterDrawer';
import { EnrichmentCostPreviewModal } from './components/EnrichmentCostPreviewModal';
import { ScoringModelConfigModal } from './components/ScoringModelConfigModal';
import { PriorityQueueModal } from './components/PriorityQueueModal';

// Lazy load tab components for optimal bundle performance
const DashboardTab = dynamic(() => import('./components/DashboardTab'), {
  loading: () => <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
});
const ProspectFinderTab = dynamic(() => import('./components/ProspectFinderTab'), {
  loading: () => <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
});
const LeadListsTab = dynamic(() => import('./components/LeadListsTab').then(m => m.LeadListsTab), {
  loading: () => <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
});
const DeduplicationQueueTab = dynamic(() => import('./components/DeduplicationQueueTab').then(m => m.DeduplicationQueueTab), {
  loading: () => <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
});
const SignalsFeedTab = dynamic(() => import('./components/SignalsFeedTab').then(m => m.SignalsFeedTab), {
  loading: () => <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
});
const WebsiteScannerTab = dynamic(() => import('./components/WebsiteScannerTab'), {
  loading: () => <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
});
const SavedSearchesTab = dynamic(() => import('./components/SavedSearchesTab'), {
  loading: () => <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
});
const SettingsTab = dynamic(() => import('./components/SettingsTab'), {
  loading: () => <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
});

const kowalskiTransition: Transition = {
  duration: 0.22,
  ease: [0.23, 1, 0.32, 1]
};

export default function LeadIntelligenceClient() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const organizationId = activeWorkspace?.organizationId || 'smartsapp-hq';

  // Active Tab View
  const [activeTab, setActiveTab] = useState<string>('finder');

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState<string>('Private Schools');
  const [filters, setFilters] = useState<SearchFilters>({
    city: 'Kumasi',
    country: 'Ghana',
    industry: 'Education'
  });
  const [selectedSource, setSelectedSource] = useState<DiscoverySourceType>('google_places');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);

  // Multi-Selection State for Batch Actions
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isBatchEnriching, setIsBatchEnriching] = useState(false);

  // Direct Scanner State
  const [scanUrl, setScanUrl] = useState<string>('');
  const [scannedProspect, setScannedProspect] = useState<Prospect | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Settings State
  const [settings, setSettings] = useState<LeadIntelligenceSettings>({
    googlePlacesApiKey: '',
    builtwithApiKey: '',
    hunterApiKey: '',
    chromeExtensionToken: ''
  });

  // Collections & Recent History
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [recentProspects, setRecentProspects] = useState<Prospect[]>([]);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);

  // Async Jobs Center State (intelligence_ui Section 10 & 11)
  const [isJobsDrawerOpen, setIsJobsDrawerOpen] = useState(false);
  const [jobs, setJobs] = useState<IntelligenceJob[]>([]);

  // Phase 2 Cost Preview Modal & Saved Views
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);

  // Phase 8 Scoring Model Configuration Modal
  const [isScoringConfigOpen, setIsScoringConfigOpen] = useState(false);

  const handleSaveCustomView = async (viewName: string) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await saveViewAction(activeWorkspaceId, organizationId, {
        name: viewName,
        densityMode: 'standard',
        viewMode: 'table',
        columns: {
          company: true,
          domain: true,
          location: true,
          rating: true,
          techFootprint: true,
          smartScore: true,
          crmStatus: true,
          contacts: true,
          phone: true,
        },
        filters
      });
      if (res.success) {
        toast({ title: 'View Saved ✓', description: `Saved view "${viewName}" to workspace.` });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Failed to save view preset.' });
    }
  };

  // Token Generation
  const generateNewToken = () => {
    const newToken = `tok_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).substring(2, 15)}`;
    setSettings(prev => ({ ...prev, chromeExtensionToken: newToken }));
  };

  // Keyboard Shortcuts (intelligence_ui Section 82 & 83)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Guard: Ignore if user is currently typing in an input, textarea or contenteditable element
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement || 
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('lead-omnisearch-input');
        searchInput?.focus();
      } else if (e.key === 'Escape') {
        setSelectedProspect(null);
        setIsJobsDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Deduplication Queue State (Phase 3)
  const [pendingCollisionsCount, setPendingCollisionsCount] = useState<number>(0);

  // Live Continuous Signals State (Phase 7)
  const [unreadSignalsCount, setUnreadSignalsCount] = useState<number>(0);

  // Autonomous SDR Daily Briefing State (Phase 12)
  const [dailyBriefing, setDailyBriefing] = useState<DailyRepBriefing | null>(null);
  const [priorityQueueProspects, setPriorityQueueProspects] = useState<Prospect[]>([]);
  const [isPriorityQueueOpen, setIsPriorityQueueOpen] = useState(false);

  // Initial Data Fetch
  const loadInitialData = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const [keys, recent, searches, lists, pendingCollisions, signalsRes, briefingRes] = await Promise.all([
        getLeadSettingsAction(activeWorkspaceId),
        getRecentProspectsAction(activeWorkspaceId),
        getSavedSearchesAction(activeWorkspaceId),
        getLeadListsAction(activeWorkspaceId),
        getIdentityCollisionsAction(activeWorkspaceId, 'pending_review'),
        getWorkspaceSignalsAction(activeWorkspaceId, { unreadOnly: true }),
        getDailyRepBriefingAction(activeWorkspaceId, 'rep_kwame', 'Kwame')
      ]);
      setSettings(keys);
      setRecentProspects(recent);
      if (prospects.length === 0 && recent.length > 0) {
        setProspects(recent);
      }
      setSavedSearches(searches);
      setLeadLists(lists);
      setPendingCollisionsCount(pendingCollisions.length);
      if (signalsRes.success && typeof signalsRes.unreadCount === 'number') {
        setUnreadSignalsCount(signalsRes.unreadCount);
      }
      if (briefingRes.success && briefingRes.briefing) {
        setDailyBriefing(briefingRes.briefing);
        setPriorityQueueProspects(briefingRes.priorityProspects || []);
      }
    } catch (err: unknown) {
      console.error('[LeadIntelligenceClient] Failed to load initial workspace data:', err);
    }
  }, [activeWorkspaceId, prospects.length]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Execute Prospect Search with Job Tracking
  const handleSearch = () => {
    if (!activeWorkspaceId) return;

    const jobId = `job_disc_${Date.now()}`;
    const newJob: IntelligenceJob = {
      id: jobId,
      workspaceId: activeWorkspaceId,
      type: 'discovery',
      title: `Prospect Discovery: ${searchQuery}`,
      status: 'running',
      progressPercent: 30,
      foundCount: 0,
      uniqueCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      startedAt: new Date().toISOString()
    };
    setJobs(prev => [newJob, ...prev]);

    startTransition(async () => {
      setSelectedRowIds(new Set());
      const res = await searchProspectsAction(
        activeWorkspaceId,
        organizationId,
        searchQuery,
        filters,
        selectedSource
      );
      if (res.success && res.prospects) {
        const found = res.prospects.length;
        setProspects(res.prospects);
        setJobs(prev => prev.map(j => j.id === jobId ? {
          ...j,
          status: 'completed',
          progressPercent: 100,
          foundCount: found,
          uniqueCount: found,
          completedAt: new Date().toISOString()
        } : j));
        toast({ 
          title: 'Discovery Complete', 
          description: `Discovered ${found} prospects matching your criteria.` 
        });
      } else {
        setJobs(prev => prev.map(j => j.id === jobId ? {
          ...j,
          status: 'failed',
          progressPercent: 100,
          errorCount: 1,
          errorDetails: [res.error || 'Discovery query failed'],
          completedAt: new Date().toISOString()
        } : j));
        toast({ 
          variant: 'destructive', 
          title: 'Discovery Failed', 
          description: res.error || 'Unable to fetch prospects.' 
        });
      }
    });
  };

  // Save Search Query
  const handleSaveSearch = async (name: string) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await saveSearchAction(activeWorkspaceId, organizationId, name || searchQuery, filters);
      if (res.success) {
        toast({ title: 'Search Saved', description: `Saved "${name || searchQuery}" in Saved Searches.` });
        loadInitialData();
      }
    } catch (err: unknown) {
      console.error('[LeadIntelligenceClient] Failed to save search query:', err);
    }
  };

  // Direct Domain Scan
  const handleUrlScan = async () => {
    if (!scanUrl || !activeWorkspaceId) return;
    setIsScanning(true);
    setScannedProspect(null);
    try {
      const cleanDomain = scanUrl.trim().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      const initialProspect: Prospect = {
        id: `scan_${activeWorkspaceId}_${Date.now()}`,
        organizationId,
        workspaceId: activeWorkspaceId,
        name: cleanDomain.split('.')[0].toUpperCase(),
        domain: cleanDomain,
        contacts: [],
        scoring: {
          overallScore: 50,
          needScore: 10,
          digitalMaturity: 8,
          buyingIntent: 12,
          budgetProbability: 10,
          decisionMakerFound: 5,
          engagement: 5
        },
        source: 'web_crawl',
        syncStatus: 'unregistered',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const res = await enrichProspectAction(initialProspect);
      if (res.success && res.prospect) {
        setScannedProspect(res.prospect);
        toast({ title: 'Scan Completed', description: `Successfully audited ${cleanDomain}.` });
        loadInitialData();
      } else {
        toast({ variant: 'destructive', title: 'Scan Failed', description: res.error || 'Verification failed.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Scan Failed', description: 'Failed to enrich domain metadata.' });
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger Single Prospect Enrichment
  const handleEnrichProspect = async (prospect: Prospect) => {
    if (!activeWorkspaceId) return;
    toast({ title: 'Enrichment Started', description: `Running builtwith, hunter, and AI strategy for ${prospect.name}...` });
    try {
      const res = await enrichProspectAction(prospect);
      if (res.success && res.prospect) {
        const updated = res.prospect;
        setProspects(prev => prev.map(p => p.id === prospect.id ? updated : p));
        if (selectedProspect?.id === prospect.id) {
          setSelectedProspect(updated);
        }
        toast({ title: 'Enriched ✓', description: `AI intelligence and decision makers generated.` });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Enrichment Failed', description: 'Verification service error.' });
    }
  };

  // Trigger Single CRM Synced Write
  const handleSyncToCRM = async (prospect: Prospect) => {
    try {
      const res = await syncProspectToCRMAction(prospect);
      if (res.success) {
        setProspects(prev => prev.map(p => p.id === prospect.id ? { ...p, syncStatus: 'synced', syncedEntityId: res.entityId } : p));
        if (selectedProspect?.id === prospect.id) {
          setSelectedProspect(prev => prev ? { ...prev, syncStatus: 'synced', syncedEntityId: res.entityId } : null);
        }
        toast({ 
          title: 'Synced to CRM ✓', 
          description: `Created Entity "${prospect.name}" in SmartSapp Contacts.`
        });
        loadInitialData();
      } else {
        toast({ variant: 'destructive', title: 'Sync Notice', description: res.error || 'Sync could not be completed.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Sync Failed', description: 'Failed to create CRM record.' });
    }
  };

  // Save Credentials Settings
  const handleSaveSettings = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await saveLeadSettingsAction(activeWorkspaceId, organizationId, settings);
      if (res.success) {
        toast({ title: 'Settings Saved', description: 'Lead API integration keys updated successfully.' });
      } else {
        toast({ variant: 'destructive', title: 'Failed to Save', description: res.error });
      }
    } catch (err: unknown) {
      console.error(err);
    }
  };

  // Multi-Select Checkbox Handlers
  const handleToggleRowSelect = (id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllRows = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedRowIds(new Set(prospects.map(p => p.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  // Batch Sync to CRM with Job Tracking
  const handleBatchSync = async () => {
    const selectedProspects = prospects.filter(p => selectedRowIds.has(p.id));
    if (selectedProspects.length === 0) return;

    const jobId = `job_sync_${Date.now()}`;
    const newJob: IntelligenceJob = {
      id: jobId,
      workspaceId: activeWorkspaceId || '',
      type: 'batch_sync',
      title: `CRM Batch Sync: ${selectedProspects.length} prospects`,
      status: 'running',
      progressPercent: 40,
      foundCount: selectedProspects.length,
      uniqueCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      startedAt: new Date().toISOString()
    };
    setJobs(prev => [newJob, ...prev]);

    try {
      setIsBatchSyncing(true);
      const res = await batchSyncProspectsAction(selectedProspects);
      if (res.success) {
        setJobs(prev => prev.map(j => j.id === jobId ? {
          ...j,
          status: 'completed',
          progressPercent: 100,
          uniqueCount: res.syncedCount,
          duplicateCount: res.failedCount,
          errorCount: res.errors?.length || 0,
          completedAt: new Date().toISOString()
        } : j));
        toast({
          title: 'Batch Sync Complete ✓',
          description: `Successfully ingested ${res.syncedCount} prospects into CRM.`
        });
        setSelectedRowIds(new Set());
        loadInitialData();
      } else {
        setJobs(prev => prev.map(j => j.id === jobId ? {
          ...j,
          status: 'failed',
          progressPercent: 100,
          errorCount: res.errors?.length || 1,
          errorDetails: res.errors,
          completedAt: new Date().toISOString()
        } : j));
        toast({
          variant: 'destructive',
          title: 'Batch Sync Encountered Issues',
          description: res.errors?.join(', ') || 'No new records could be synced.'
        });
      }
    } catch {
      setJobs(prev => prev.map(j => j.id === jobId ? {
        ...j,
        status: 'failed',
        progressPercent: 100,
        errorCount: 1,
        completedAt: new Date().toISOString()
      } : j));
      toast({ variant: 'destructive', title: 'Batch Sync Failed', description: 'Transaction processing failed.' });
    } finally {
      setIsBatchSyncing(false);
    }
  };

  // Batch Enrich with Job Tracking
  const handleBatchEnrich = async () => {
    const selectedProspects = prospects.filter(p => selectedRowIds.has(p.id));
    if (selectedProspects.length === 0) return;

    const jobId = `job_enrich_${Date.now()}`;
    const newJob: IntelligenceJob = {
      id: jobId,
      workspaceId: activeWorkspaceId || '',
      type: 'batch_enrich',
      title: `Batch AI Enrichment: ${selectedProspects.length} prospects`,
      status: 'running',
      progressPercent: 50,
      foundCount: selectedProspects.length,
      uniqueCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      startedAt: new Date().toISOString()
    };
    setJobs(prev => [newJob, ...prev]);

    try {
      setIsBatchEnriching(true);
      const res = await batchEnrichProspectsAction(selectedProspects);
      if (res.success && res.enrichedProspects.length > 0) {
        const enrichedMap = new Map(res.enrichedProspects.map(p => [p.id, p]));
        setProspects(prev => prev.map(p => enrichedMap.get(p.id) || p));
        setJobs(prev => prev.map(j => j.id === jobId ? {
          ...j,
          status: 'completed',
          progressPercent: 100,
          uniqueCount: res.enrichedProspects.length,
          completedAt: new Date().toISOString()
        } : j));
        toast({
          title: 'Batch Enrichment Complete ✓',
          description: `Successfully enriched ${res.enrichedProspects.length} prospects.`
        });
      }
    } catch {
      setJobs(prev => prev.map(j => j.id === jobId ? {
        ...j,
        status: 'failed',
        progressPercent: 100,
        errorCount: 1,
        completedAt: new Date().toISOString()
      } : j));
      toast({ variant: 'destructive', title: 'Batch Enrich Failed', description: 'Enrichment service error.' });
    } finally {
      setIsBatchEnriching(false);
    }
  };

  // Batch Export CSV
  const handleBatchExportCSV = () => {
    const selectedProspects = prospects.filter(p => selectedRowIds.has(p.id));
    if (selectedProspects.length === 0) return;

    const headers = ['Name', 'Domain', 'Phone', 'Address', 'Industry', 'Rating', 'Score', 'Sync Status'];
    const rows = [headers.join(',')];

    for (const p of selectedProspects) {
      const row = [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${p.domain || ''}"`,
        `"${p.phone || ''}"`,
        `"${(p.address || '').replace(/"/g, '""')}"`,
        `"${p.industry || ''}"`,
        p.rating || '',
        p.scoring?.overallScore || '',
        p.syncStatus || 'unregistered'
      ];
      rows.push(row.join(','));
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `prospects_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Exported CSV', description: `Downloaded ${selectedProspects.length} prospects.` });
  };

  // Add Selected to Lead List
  const handleAddSelectedToList = async () => {
    const selectedIds = Array.from(selectedRowIds);
    if (selectedIds.length === 0) return;

    if (leadLists.length === 0) {
      const res = await createLeadListAction(
        activeWorkspaceId || '',
        organizationId,
        `Discovery Cohort (${new Date().toLocaleDateString()})`,
        'Auto-created list from selected prospects',
        selectedIds
      );
      if (res.success) {
        toast({ title: 'List Created & Added ✓', description: `Added ${selectedIds.length} prospects to new list.` });
        setSelectedRowIds(new Set());
        loadInitialData();
      }
    } else {
      const targetList = leadLists[0];
      const res = await addProspectsToListAction(targetList.id, selectedIds, activeWorkspaceId || '');
      if (res.success) {
        toast({ title: 'Added to List ✓', description: `Added ${selectedIds.length} prospects to "${targetList.name}".` });
        setSelectedRowIds(new Set());
        loadInitialData();
      }
    }
  };

  // Ingest CSV Data with Job Tracking
  const handleImportCSV = async (csvText: string) => {
    if (!activeWorkspaceId) return;

    const jobId = `job_csv_${Date.now()}`;
    const newJob: IntelligenceJob = {
      id: jobId,
      workspaceId: activeWorkspaceId,
      type: 'csv_import',
      title: `CSV Tabular Import`,
      status: 'running',
      progressPercent: 50,
      foundCount: 0,
      uniqueCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      startedAt: new Date().toISOString()
    };
    setJobs(prev => [newJob, ...prev]);

    const res = await importProspectsFromCSVAction(activeWorkspaceId, organizationId, csvText, filters.industry);
    if (res.success && res.prospects) {
      setProspects(res.prospects);
      setJobs(prev => prev.map(j => j.id === jobId ? {
        ...j,
        status: 'completed',
        progressPercent: 100,
        foundCount: res.prospects!.length,
        uniqueCount: res.prospects!.length,
        completedAt: new Date().toISOString()
      } : j));
      toast({
        title: 'CSV Ingestion Complete ✓',
        description: `Successfully indexed ${res.prospects.length} prospects from spreadsheet.`
      });
    } else {
      setJobs(prev => prev.map(j => j.id === jobId ? {
        ...j,
        status: 'failed',
        progressPercent: 100,
        errorCount: 1,
        errorDetails: [res.error || 'CSV import parsing failed'],
        completedAt: new Date().toISOString()
      } : j));
      toast({
        variant: 'destructive',
        title: 'CSV Ingestion Failed',
        description: res.error || 'Could not parse tabular data.'
      });
    }
  };

  // Create Lead List Handler
  const handleCreateLeadList = async (name: string, description?: string) => {
    if (!activeWorkspaceId) return;
    const res = await createLeadListAction(activeWorkspaceId, organizationId, name, description);
    if (res.success) {
      loadInitialData();
    }
  };

  // Delete Lead List Handler
  const handleDeleteLeadList = async (listId: string) => {
    if (!activeWorkspaceId) return;
    const res = await deleteLeadListAction(listId, activeWorkspaceId);
    if (res.success) {
      toast({ title: 'List Deleted', description: 'Lead list removed.' });
      loadInitialData();
    }
  };

  // Jobs Actions Handlers
  const handleCancelJob = (jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'failed', completedAt: new Date().toISOString() } : j));
    toast({ title: 'Job Cancelled', description: 'Operation stopped.' });
  };

  const handleTogglePauseJob = (jobId: string) => {
    setJobs(prev => prev.map(j => {
      if (j.id !== jobId) return j;
      const nextStatus = j.status === 'running' ? 'paused' : 'running';
      return { ...j, status: nextStatus };
    }));
  };

  const handleClearCompletedJobs = () => {
    setJobs(prev => prev.filter(j => j.status === 'running' || j.status === 'paused'));
    toast({ title: 'Cleared Completed Jobs', description: 'Cleaned up job tray history.' });
  };

  const runningJobsCount = jobs.filter(j => j.status === 'running').length;
  const highIntentCount = prospects.filter(p => (p.scoring?.overallScore ?? 0) >= 75).length;
  const syncedCount = prospects.filter(p => p.syncStatus === 'synced').length;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full relative">
      {/* Glow Mesh Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.06),transparent_50%)] pointer-events-none" />

      {/* Page Title & Status Header (intelligence_ui Section 4) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-400 to-indigo-500">
            Lead Intelligence Platform
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Discover local businesses, audit tech footprints, generate AI sales strategies, and sync directly to CRM.
          </p>

          {/* Live Metric Counters Ribbon (intelligence_ui Section 4) */}
          <div className="flex items-center gap-3 pt-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 border border-border/60 px-2.5 py-1 rounded-lg">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span><strong>{prospects.length}</strong> Prospects</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span><strong className="text-amber-600 dark:text-amber-400">{highIntentCount}</strong> High Intent</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 px-2.5 py-1 rounded-lg">
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span><strong className="text-blue-600 dark:text-blue-400">{syncedCount}</strong> Synced in CRM</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start md:self-center">
          {/* Scoring Model Config Trigger (UI Spec Section 36) */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsScoringConfigOpen(true)}
            className="h-9 px-3 text-xs border-border/80 rounded-xl relative active:scale-[0.97] flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span>Scoring Model</span>
          </Button>

          {/* Jobs Center Trigger (intelligence_ui Section 10) */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsJobsDrawerOpen(true)}
            className="h-9 px-3 text-xs border-border/80 rounded-xl relative active:scale-[0.97] flex items-center gap-1.5"
          >
            <Activity className={`w-3.5 h-3.5 ${runningJobsCount > 0 ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            <span>Jobs Center</span>
            {runningJobsCount > 0 && (
              <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold rounded-full">
                {runningJobsCount} Active
              </Badge>
            )}
          </Button>

          {(!settings.googlePlacesApiKey || !settings.builtwithApiKey) && (
            <Badge variant="outline" className="px-3 py-1 bg-amber-500/10 border-amber-500/20 text-amber-500 font-medium text-xs flex items-center gap-1.5 rounded-full">
              <Zap className="h-3.5 w-3.5 fill-amber-500" />
              AI Simulation Active
            </Badge>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 w-full max-w-6xl bg-muted/40 backdrop-blur-md border border-border/60 p-1 rounded-xl h-auto gap-1">
          <TabsTrigger value="finder" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2">
            <Search className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Prospect Finder
          </TabsTrigger>
          <TabsTrigger value="signals" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 relative">
            <Radio className="w-3.5 h-3.5 mr-1 hidden sm:inline text-rose-500" />
            <span>Signals</span>
            {unreadSignalsCount > 0 && (
              <Badge className="ml-1 h-4 px-1 text-[9px] bg-rose-500 text-white font-bold rounded-full">
                {unreadSignalsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="lists" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2">
            <Folder className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Lead Lists
          </TabsTrigger>
          <TabsTrigger value="dedup" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2 relative">
            <GitMerge className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            <span>Deduplication</span>
            {pendingCollisionsCount > 0 && (
              <Badge className="ml-1 h-4 px-1 text-[9px] bg-amber-500 text-white font-bold rounded-full">
                {pendingCollisionsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scanner" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2">
            <Globe className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Domain Scanner
          </TabsTrigger>
          <TabsTrigger value="searches" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2">
            <BookmarkCheck className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Saved Searches
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2">
            <LayoutGrid className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2">
            <Settings className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Extension & Keys
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {/* TAB: SIGNALS FEED (UI Spec Section 31) */}
          {activeTab === 'signals' && (
            <motion.div
              key="signals"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="signals" className="mt-6">
                <SignalsFeedTab
                  workspaceId={activeWorkspaceId || ''}
                  onSelectProspect={(pid) => {
                    const target = prospects.find(p => p.id === pid) || recentProspects.find(p => p.id === pid);
                    if (target) setSelectedProspect(target);
                  }}
                  onCreateTask={(sig) => {
                    toast({
                      title: 'Follow-up Task Scheduled ✓',
                      description: `Created CRM task for ${sig.prospectName}: "${sig.recommendedAction}"`
                    });
                  }}
                />
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 1: PROSPECT FINDER */}
          {activeTab === 'finder' && (
            <motion.div
              key="finder"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="finder" className="mt-6">
                <ProspectFinderTab
                  prospects={prospects}
                  selectedProspect={selectedProspect}
                  onSelectProspect={setSelectedProspect}
                  selectedRowIds={selectedRowIds}
                  onToggleRowSelect={handleToggleRowSelect}
                  onSelectAllRows={handleSelectAllRows}
                  queryText={searchQuery}
                  onQueryTextChange={setSearchQuery}
                  filters={filters}
                  onFiltersChange={setFilters}
                  selectedSource={selectedSource}
                  onSourceChange={setSelectedSource}
                  onSearch={handleSearch}
                  onSaveSearch={handleSaveSearch}
                  isSearching={isPending}
                  onEnrich={handleEnrichProspect}
                  onSync={handleSyncToCRM}
                  onImportCSV={handleImportCSV}
                  onSaveCustomView={handleSaveCustomView}
                  dailyBriefing={dailyBriefing}
                  onStartPriorityQueue={() => setIsPriorityQueueOpen(true)}
                />
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 2: LEAD LISTS */}
          {activeTab === 'lists' && (
            <motion.div
              key="lists"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="lists" className="mt-6">
                <LeadListsTab
                  workspaceId={activeWorkspaceId || ''}
                  organizationId={organizationId || ''}
                  leadLists={leadLists}
                  allProspects={prospects.concat(recentProspects)}
                  onCreateList={handleCreateLeadList}
                  onDeleteList={handleDeleteLeadList}
                  onSelectProspectForInspection={setSelectedProspect}
                />
              </TabsContent>
            </motion.div>
          )}

          {/* TAB: DEDUPLICATION QUEUE (Phase 3) */}
          {activeTab === 'dedup' && (
            <motion.div
              key="dedup"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="dedup" className="mt-6">
                <DeduplicationQueueTab
                  workspaceId={activeWorkspaceId || ''}
                  onCollisionResolved={() => {
                    loadInitialData();
                  }}
                />
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 3: DOMAIN SCANNER */}
          {activeTab === 'scanner' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="scanner" className="mt-6">
                <WebsiteScannerTab
                  scanUrl={scanUrl}
                  setScanUrl={setScanUrl}
                  isScanning={isScanning}
                  onUrlScan={handleUrlScan}
                  scannedProspect={scannedProspect}
                  onSync={handleSyncToCRM}
                  onInspectProspect={setSelectedProspect}
                />
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 4: SAVED SEARCHES */}
          {activeTab === 'searches' && (
            <motion.div
              key="searches"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="searches" className="mt-6">
                <SavedSearchesTab
                  savedSearches={savedSearches}
                  onRunSearch={(s) => {
                    setFilters(s.filters);
                    setSearchQuery(s.name);
                    setActiveTab('finder');
                    handleSearch();
                  }}
                />
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 5: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="dashboard" className="mt-6">
                <DashboardTab 
                  workspaceId={activeWorkspaceId || ''}
                  recentProspects={recentProspects} 
                />
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 6: SETTINGS & EXTENSION */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="settings" className="mt-6">
                <SettingsTab
                  settings={settings}
                  setSettings={setSettings}
                  activeWorkspaceId={activeWorkspaceId || ''}
                  onSaveSettings={handleSaveSettings}
                  onGenerateToken={generateNewToken}
                />
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>

      {/* Floating Batch Action Toolbar */}
      <FloatingActionToolbar
        selectedCount={selectedRowIds.size}
        onClearSelection={() => setSelectedRowIds(new Set())}
        onBatchSync={handleBatchSync}
        onBatchEnrich={() => setIsCostModalOpen(true)}
        onAddToList={handleAddSelectedToList}
        onExportCSV={handleBatchExportCSV}
        isSyncing={isBatchSyncing}
        isEnriching={isBatchEnriching}
      />

      {/* Slide-Over Prospect Inspection Sheet */}
      <ProspectSlideOverSheet
        prospect={selectedProspect}
        isOpen={selectedProspect !== null}
        onClose={() => setSelectedProspect(null)}
        onSyncToCRM={handleSyncToCRM}
        onEnrichProspect={handleEnrichProspect}
      />

      {/* Jobs Center & Task Progress Tray Drawer (intelligence_ui Section 10 & 11) */}
      <JobsCenterDrawer
        isOpen={isJobsDrawerOpen}
        onClose={() => setIsJobsDrawerOpen(false)}
        jobs={jobs}
        onCancelJob={handleCancelJob}
        onTogglePauseJob={handleTogglePauseJob}
        onClearCompletedJobs={handleClearCompletedJobs}
        onViewJobResults={() => {
          setActiveTab('finder');
        }}
      />

      {/* Credit Cost Transparency Preview Modal (intelligence_ui Section 23 & 60) */}
      <EnrichmentCostPreviewModal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        prospectCount={selectedRowIds.size}
        onConfirmEnrich={() => {
          setIsCostModalOpen(false);
          handleBatchEnrich();
        }}
        isProcessing={isBatchEnriching}
      />

      {/* Scoring Model Configuration & Simulator Modal (UI Spec Section 36) */}
      <ScoringModelConfigModal
        workspaceId={activeWorkspaceId || ''}
        organizationId={organizationId}
        isOpen={isScoringConfigOpen}
        onClose={() => setIsScoringConfigOpen(false)}
        onModelSaved={() => {
          loadInitialData();
        }}
      />

      {/* Focus Mode Priority Queue Studio Modal (UI Spec Section 54) */}
      <PriorityQueueModal
        prospects={priorityQueueProspects.length > 0 ? priorityQueueProspects : prospects.slice(0, 10)}
        workspaceId={activeWorkspaceId || ''}
        isOpen={isPriorityQueueOpen}
        onClose={() => setIsPriorityQueueOpen(false)}
        onProspectActivated={() => {
          loadInitialData();
        }}
      />
    </div>
  );
}
