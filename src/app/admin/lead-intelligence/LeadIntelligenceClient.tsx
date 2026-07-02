'use client';

import * as React from 'react';
import { useState, useEffect, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Zap, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { 
  getLeadSettingsAction, 
  saveLeadSettingsAction, 
  searchProspectsAction, 
  enrichProspectAction, 
  syncProspectToCRMAction, 
  getRecentProspectsAction,
  getSavedSearchesAction,
  saveSearchAction
} from '@/app/actions/lead-intelligence-actions';
import type { 
  Prospect, 
  SearchFilters, 
  LeadIntelligenceSettings, 
  SavedSearch 
} from '@/lib/lead-intelligence/types';

// Lazy load components to keep bundle size small and responsive
const DashboardTab = dynamic(() => import('./components/DashboardTab'), {
  loading: () => <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
});
const ProspectFinderTab = dynamic(() => import('./components/ProspectFinderTab'), {
  loading: () => <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
});
const WebsiteScannerTab = dynamic(() => import('./components/WebsiteScannerTab'), {
  loading: () => <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
});
const SavedSearchesTab = dynamic(() => import('./components/SavedSearchesTab'), {
  loading: () => <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
});
const SettingsTab = dynamic(() => import('./components/SettingsTab'), {
  loading: () => <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
});

// Kowalski Animation Transition Constants
const kowalskiTransition: Transition = {
  duration: 0.25,
  ease: [0.23, 1, 0.32, 1]
};

export default function LeadIntelligenceClient() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const organizationId = activeWorkspace?.organizationId || 'smartsapp-hq';

  // Active Tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Search & Finder States
  const [searchQuery, setSearchQuery] = useState<string>('Schools Accra');
  const [cityFilter, setCityFilter] = useState<string>('Accra');
  const [industryFilter, setIndustryFilter] = useState<string>('Education');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);

  // Direct Scanner States
  const [scanUrl, setScanUrl] = useState<string>('');
  const [scannedProspect, setScannedProspect] = useState<Prospect | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Settings States
  const [settings, setSettings] = useState<LeadIntelligenceSettings>({
    googlePlacesApiKey: '',
    builtwithApiKey: '',
    hunterApiKey: '',
    chromeExtensionToken: ''
  });

  // Saved Searches & Lists
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [recentProspects, setRecentProspects] = useState<Prospect[]>([]);

  // Token Generation
  const generateNewToken = () => {
    const newToken = `tok_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).substring(2, 15)}`;
    setSettings(prev => ({ ...prev, chromeExtensionToken: newToken }));
  };

  // Load Initial Data
  const loadInitialData = async () => {
    if (!activeWorkspaceId) return;
    try {
      const keys = await getLeadSettingsAction(activeWorkspaceId);
      setSettings(keys);

      const recent = await getRecentProspectsAction(activeWorkspaceId);
      setRecentProspects(recent);

      const searches = await getSavedSearchesAction(activeWorkspaceId);
      setSavedSearches(searches);
    } catch (err: unknown) {
      console.error('Failed to load initial workspace data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [activeWorkspaceId]);

  // Execute Prospect Search
  const handleSearch = () => {
    if (!activeWorkspaceId) return;
    startTransition(async () => {
      const filters: SearchFilters = {
        city: cityFilter,
        country: 'Ghana',
        industry: industryFilter
      };
      const res = await searchProspectsAction(
        activeWorkspaceId,
        organizationId,
        searchQuery,
        filters
      );
      if (res.success && res.prospects) {
        setProspects(res.prospects);
        setSelectedProspect(null);
        toast({ title: 'Discovery Complete', description: `Found ${res.prospects.length} prospects.` });
      } else {
        toast({ variant: 'destructive', title: 'Discovery Failed', description: res.error || 'Unknown error' });
      }
    });
  };

  // Save Search Query
  const handleSaveSearch = async () => {
    if (!activeWorkspaceId) return;
    try {
      const filters: SearchFilters = { city: cityFilter, country: 'Ghana', industry: industryFilter };
      const res = await saveSearchAction(activeWorkspaceId, organizationId, searchQuery, filters);
      if (res.success) {
        toast({ title: 'Search Saved', description: 'Search criteria stored in Saved Searches.' });
        loadInitialData();
      }
    } catch (err: unknown) {
      console.error('Failed to save search query:', err);
    }
  };

  // Direct technology crawl scan
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
        syncStatus: 'unregistered',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const res = await enrichProspectAction(initialProspect);
      if (res.success && res.prospect) {
        setScannedProspect(res.prospect);
        toast({ title: 'Scan Completed', description: `Scanned domain ${cleanDomain} successfully.` });
        loadInitialData();
      } else {
        toast({ variant: 'destructive', title: 'Scan Failed', description: res.error || 'Verification failed.' });
      }
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Scan Failed', description: 'Failed to enrich domain metadata.' });
    } finally {
      setIsScanning(false);
    }
  };

  // Trigger Prospect Enrichment
  const handleEnrichProspect = async (prospect: Prospect) => {
    if (!activeWorkspaceId) return;
    toast({ title: 'Enrichment Started', description: `Running builtwith, hunter and AI analysis for ${prospect.name}...` });
    try {
      const res = await enrichProspectAction(prospect);
      if (res.success && res.prospect) {
        setProspects(prev => prev.map(p => p.id === prospect.id ? res.prospect! : p));
        if (selectedProspect?.id === prospect.id) {
          setSelectedProspect(res.prospect);
        }
        toast({ title: 'Enriched ✓', description: `Lead details successfully generated.` });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Enrichment Failed', description: 'Verification service error.' });
    }
  };

  // Trigger CRM Synced Write
  const handleSyncToCRM = async (prospect: Prospect) => {
    try {
      const res = await syncProspectToCRMAction(prospect);
      if (res.success) {
        setProspects(prev => prev.map(p => p.id === prospect.id ? { ...p, syncStatus: 'synced', syncedEntityId: res.entityId } : p));
        if (selectedProspect?.id === prospect.id) {
          setSelectedProspect(prev => prev ? { ...prev, syncStatus: 'synced', syncedEntityId: res.entityId } : null);
        }
        toast({ title: 'Synced ✓', description: `${prospect.name} added to SmartSapp Contacts.` });
        loadInitialData();
      } else {
        toast({ variant: 'destructive', title: 'Sync Warning', description: res.error || 'Sync failed.' });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Sync Failed', description: 'Failed to write CRM records.' });
    }
  };

  // Save Credentials settings
  const handleSaveSettings = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await saveLeadSettingsAction(activeWorkspaceId, organizationId, settings);
      if (res.success) {
        toast({ title: 'Settings Saved', description: 'Lead API settings successfully updated.' });
      } else {
        toast({ variant: 'destructive', title: 'Failed to Save', description: res.error });
      }
    } catch (err: unknown) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Dynamic Radial Gradient Glow Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none" />

      {/* Page Title & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500">
            Lead Intelligence Platform
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover prospects, audit technologies, uncover AI opportunities, and feed the CRM pipeline.
          </p>
        </div>

        {(!settings.googlePlacesApiKey || !settings.builtwithApiKey) && (
          <Badge variant="outline" className="px-3 py-1 bg-amber-500/10 border-amber-500/20 text-amber-500 font-medium text-xs flex items-center gap-1.5 rounded-full self-start md:self-center">
            <Zap className="h-3.5 w-3.5 fill-amber-500" />
            AI-Simulation Fallback Mode Active
          </Badge>
        )}
      </div>

      {/* Main Tabs Segment */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl bg-muted/40 backdrop-blur-md border border-border/50 p-1 rounded-xl">
          <TabsTrigger value="dashboard" className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20">Dashboard</TabsTrigger>
          <TabsTrigger value="finder" className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20">Prospect Finder</TabsTrigger>
          <TabsTrigger value="scanner" className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20">Website Scanner</TabsTrigger>
          <TabsTrigger value="searches" className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20">Saved Searches</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20">Settings & Chrome</TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="dashboard" className="mt-6">
                <DashboardTab recentProspects={recentProspects} />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === 'finder' && (
            <motion.div
              key="finder"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="finder" className="mt-6">
                <ProspectFinderTab
                  industryFilter={industryFilter}
                  setIndustryFilter={setIndustryFilter}
                  cityFilter={cityFilter}
                  setCityFilter={setCityFilter}
                  isSearching={isPending}
                  onSearch={handleSearch}
                  onSaveSearch={handleSaveSearch}
                  prospects={prospects}
                  selectedProspect={selectedProspect}
                  setSelectedProspect={setSelectedProspect}
                  onEnrich={handleEnrichProspect}
                  onSync={handleSyncToCRM}
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === 'scanner' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
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
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === 'searches' && (
            <motion.div
              key="searches"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="searches" className="mt-6">
                <SavedSearchesTab
                  savedSearches={savedSearches}
                  onRunSearch={(s) => {
                    setCityFilter(s.filters.city || '');
                    setIndustryFilter(s.filters.industry || '');
                    setSearchQuery(s.name);
                    setActiveTab('finder');
                    handleSearch();
                  }}
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
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
    </div>
  );
}
