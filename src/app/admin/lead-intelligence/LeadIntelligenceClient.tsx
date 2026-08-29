'use client';

/**
 * Lead Intelligence Hub Client (Lead Intelligence 2.0)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Ergonomics & Motion: Unified tabs, keyboard ⌘K support, Emil Kowalski spring animations.
 * 2. High-Density Layout: FloatingActionToolbar for multi-select, ProspectSlideOverSheet for deep inspection.
 * 3. High-Load Guard: Batch sync and enrichment execute via chunked Server Actions with graceful error handling.
 * 4. Strict Typing: 100% strict TypeScript types without any/any[].
 */

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Zap, Loader2, Folder, LayoutGrid, Search, Globe, BookmarkCheck, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  importProspectsFromCSVAction
} from '@/app/actions/lead-intelligence-actions';
import type { 
  Prospect, 
  SearchFilters, 
  LeadIntelligenceSettings, 
  SavedSearch,
  LeadList,
  DiscoverySourceType 
} from '@/lib/lead-intelligence/types';
import { FloatingActionToolbar } from './components/FloatingActionToolbar';
import { ProspectSlideOverSheet } from './components/ProspectSlideOverSheet';

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

  // Token Generation
  const generateNewToken = () => {
    const newToken = `tok_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).substring(2, 15)}`;
    setSettings(prev => ({ ...prev, chromeExtensionToken: newToken }));
  };

  // Load Initial Workspace Data
  const loadInitialData = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const [keys, recent, searches, lists] = await Promise.all([
        getLeadSettingsAction(activeWorkspaceId),
        getRecentProspectsAction(activeWorkspaceId),
        getSavedSearchesAction(activeWorkspaceId),
        getLeadListsAction(activeWorkspaceId)
      ]);
      setSettings(keys);
      setRecentProspects(recent);
      if (prospects.length === 0 && recent.length > 0) {
        setProspects(recent);
      }
      setSavedSearches(searches);
      setLeadLists(lists);
    } catch (err: unknown) {
      console.error('[LeadIntelligenceClient] Failed to load initial workspace data:', err);
    }
  }, [activeWorkspaceId, prospects.length]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Execute Prospect Search
  const handleSearch = () => {
    if (!activeWorkspaceId) return;
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
        setProspects(res.prospects);
        toast({ 
          title: 'Discovery Complete', 
          description: `Discovered ${res.prospects.length} prospects matching your criteria.` 
        });
      } else {
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

  // Batch Sync to CRM
  const handleBatchSync = async () => {
    const selectedProspects = prospects.filter(p => selectedRowIds.has(p.id));
    if (selectedProspects.length === 0) return;

    try {
      setIsBatchSyncing(true);
      const res = await batchSyncProspectsAction(selectedProspects);
      if (res.success) {
        toast({
          title: 'Batch Sync Complete ✓',
          description: `Successfully ingested ${res.syncedCount} prospects into CRM.`
        });
        setSelectedRowIds(new Set());
        loadInitialData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Batch Sync Encountered Issues',
          description: res.errors?.join(', ') || 'No new records could be synced.'
        });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Batch Sync Failed', description: 'Transaction processing failed.' });
    } finally {
      setIsBatchSyncing(false);
    }
  };

  // Batch Enrich
  const handleBatchEnrich = async () => {
    const selectedProspects = prospects.filter(p => selectedRowIds.has(p.id));
    if (selectedProspects.length === 0) return;

    try {
      setIsBatchEnriching(true);
      const res = await batchEnrichProspectsAction(selectedProspects);
      if (res.success && res.enrichedProspects.length > 0) {
        const enrichedMap = new Map(res.enrichedProspects.map(p => [p.id, p]));
        setProspects(prev => prev.map(p => enrichedMap.get(p.id) || p));
        toast({
          title: 'Batch Enrichment Complete ✓',
          description: `Successfully enriched ${res.enrichedProspects.length} prospects.`
        });
      }
    } catch {
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
      // Create a default list
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
      // Add to latest list
      const targetList = leadLists[0];
      const res = await addProspectsToListAction(targetList.id, selectedIds, activeWorkspaceId || '');
      if (res.success) {
        toast({ title: 'Added to List ✓', description: `Added ${selectedIds.length} prospects to "${targetList.name}".` });
        setSelectedRowIds(new Set());
        loadInitialData();
      }
    }
  };

  // Ingest CSV Data
  const handleImportCSV = async (csvText: string) => {
    if (!activeWorkspaceId) return;
    const res = await importProspectsFromCSVAction(activeWorkspaceId, organizationId, csvText, filters.industry);
    if (res.success && res.prospects) {
      setProspects(res.prospects);
      toast({
        title: 'CSV Ingestion Complete ✓',
        description: `Successfully indexed ${res.prospects.length} prospects from spreadsheet.`
      });
    } else {
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

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full relative">
      {/* Glow Mesh Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.06),transparent_50%)] pointer-events-none" />

      {/* Page Title & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-400 to-indigo-500">
            Lead Intelligence Platform
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Discover local businesses, audit tech footprints, generate AI sales strategies, and sync directly to CRM.
          </p>
        </div>

        {(!settings.googlePlacesApiKey || !settings.builtwithApiKey) && (
          <Badge variant="outline" className="px-3 py-1 bg-amber-500/10 border-amber-500/20 text-amber-500 font-medium text-xs flex items-center gap-1.5 rounded-full self-start md:self-center">
            <Zap className="h-3.5 w-3.5 fill-amber-500" />
            AI-Simulation Fallback Active
          </Badge>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full max-w-4xl bg-muted/40 backdrop-blur-md border border-border/60 p-1 rounded-xl h-auto">
          <TabsTrigger value="finder" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2">
            <Search className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Prospect Finder
          </TabsTrigger>
          <TabsTrigger value="lists" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary py-2">
            <Folder className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Lead Lists
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
                  leadLists={leadLists}
                  allProspects={prospects.concat(recentProspects)}
                  onCreateList={handleCreateLeadList}
                  onDeleteList={handleDeleteLeadList}
                  onSelectProspectForInspection={setSelectedProspect}
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
                <DashboardTab recentProspects={recentProspects} />
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
        onBatchEnrich={handleBatchEnrich}
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
    </div>
  );
}
