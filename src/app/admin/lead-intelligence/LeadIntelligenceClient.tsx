'use client';

import * as React from 'react';
import { useState, useEffect, useTransition } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, 
  Search, 
  Settings, 
  Download, 
  MapPin, 
  Loader2, 
  Building2, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Globe, 
  History, 
  Plus, 
  X, 
  Zap, 
  ShieldCheck, 
  Activity, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
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

// Kowalski Animation Transition Constants
const kowalskiTransition = {
  duration: 0.25,
  ease: [0.23, 1, 0.32, 1] // cubic-bezier(0.23, 1, 0.32, 1)
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
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="dashboard" className="mt-6 space-y-6">
                {/* Stats cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-md">
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prospects Discovered</CardTitle>
                        <div className="text-3xl font-extrabold mt-1 text-emerald-400">1,248</div>
                      </div>
                      <Globe className="h-8 w-8 text-emerald-500/50" />
                    </CardHeader>
                  </Card>
                  <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-md">
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Direct Audits</CardTitle>
                        <div className="text-3xl font-extrabold mt-1 text-teal-400">382</div>
                      </div>
                      <Activity className="h-8 w-8 text-teal-500/50" />
                    </CardHeader>
                  </Card>
                  <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-md">
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Synced to CRM</CardTitle>
                        <div className="text-3xl font-extrabold mt-1 text-emerald-400">89 Leads</div>
                      </div>
                      <Building2 className="h-8 w-8 text-emerald-500/50" />
                    </CardHeader>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Activity Card */}
                  <Card className="bg-card/35 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm font-bold">
                        <History className="h-4 w-4 text-emerald-400" />
                        Recent Discovery Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {recentProspects.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-6 text-center">No recent prospect scans recorded in this workspace.</div>
                      ) : (
                        recentProspects.map((p) => (
                          <div key={p.id} className="flex justify-between items-center border-b border-border/30 pb-3 last:border-0 last:pb-0">
                            <div>
                              <div className="font-bold text-xs">{p.name}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{p.domain} • {p.industry}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10 text-[9px] font-bold">Score: {p.scoring.overallScore}%</Badge>
                              {p.syncStatus === 'synced' ? (
                                <Badge className="bg-emerald-500 text-black hover:bg-emerald-500 text-[8px] uppercase font-bold">Synced</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[8px] uppercase font-bold opacity-60">Scan Only</Badge>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick-Notes & Tips */}
                  <Card className="bg-card/35 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm font-bold">
                        <Sparkles className="h-4 w-4 text-emerald-400" />
                        AI Opportunities Stethoscope
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-xs">
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                        <span className="font-bold text-emerald-400">Pro Tip: </span>
                        Always scan prospects with the Chrome Extension first. It extracts details dynamically without using Places searches or BuiltWith limits.
                      </div>
                      <div className="p-3 bg-muted/20 border border-border/40 rounded-lg">
                        <span className="font-bold">Sync workflow: </span>
                        Synced leads will immediately have an Entity record created, allowing you to add deals, link meetings, and enroll in scheduled Campaigns.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 2: PROSPECT FINDER */}
          {activeTab === 'finder' && (
            <motion.div
              key="finder"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="finder" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Left Filters sidebar */}
                  <Card className="lg:col-span-1 bg-card/35 backdrop-blur-sm border-border/50 h-fit">
                    <CardHeader className="p-4">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider">Search Filters</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="industry-filter" className="text-[10px] font-bold uppercase text-muted-foreground">Industry / Keyword</Label>
                        <Input 
                          id="industry-filter" 
                          value={industryFilter} 
                          onChange={(e) => setIndustryFilter(e.target.value)} 
                          className="h-8 text-xs border-border/60 bg-muted/10 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="city-filter" className="text-[10px] font-bold uppercase text-muted-foreground">City / Region</Label>
                        <Input 
                          id="city-filter" 
                          value={cityFilter} 
                          onChange={(e) => setCityFilter(e.target.value)} 
                          className="h-8 text-xs border-border/60 bg-muted/10 rounded-lg"
                        />
                      </div>
                      <div className="pt-2">
                        <Button 
                          onClick={handleSearch} 
                          disabled={isPending} 
                          className="w-full h-8 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] transition-all rounded-lg text-black font-semibold text-xs flex items-center justify-center gap-1.5"
                        >
                          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                          Run Discovery
                        </Button>
                      </div>
                      <div className="pt-1">
                        <Button 
                          onClick={handleSaveSearch} 
                          variant="ghost" 
                          className="w-full h-8 text-[10px] font-bold text-muted-foreground border border-border/40 hover:bg-muted/10 hover:text-foreground active:scale-[0.97] transition-all rounded-lg"
                        >
                          Save Search Filters
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Main Grid View */}
                  <div className="lg:col-span-3 space-y-6">
                    {/* Interactive Mock Map */}
                    {prospects.length > 0 && (
                      <Card className="bg-card/35 backdrop-blur-sm border-border/50 overflow-hidden relative shadow-md">
                        <CardHeader className="p-4 border-b border-border/30 bg-muted/10 flex flex-row justify-between items-center">
                          <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-emerald-400" />
                            Target Area Map Pins (Kumasi / Accra)
                          </CardTitle>
                        </CardHeader>
                        <div className="h-44 bg-zinc-950 relative flex items-center justify-center p-2">
                          {/* Simulated SVG street grid */}
                          <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                            <line x1="0" y1="50" x2="100%" y2="50" stroke="white" strokeWidth="2" />
                            <line x1="0" y1="120" x2="100%" y2="120" stroke="white" strokeWidth="2" />
                            <line x1="100" y1="0" x2="100" y2="100%" stroke="white" strokeWidth="2" />
                            <line x1="250" y1="0" x2="250" y2="100%" stroke="white" strokeWidth="2" />
                          </svg>

                          {/* Render coordinate dots for found prospects */}
                          {prospects.map((p, index) => {
                            const isSelected = selectedProspect?.id === p.id;
                            const isSynced = p.syncStatus === 'synced';
                            
                            // Map coordinate spacing mock
                            const leftPercent = 15 + (index * 13) % 70;
                            const topPercent = 20 + (index * 17) % 60;

                            return (
                              <button
                                key={p.id}
                                onClick={() => setSelectedProspect(p)}
                                className="absolute active:scale-90 transition-transform focus:outline-none"
                                style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                              >
                                <div className={`relative flex items-center justify-center h-5 w-5 rounded-full shadow-lg ${
                                  isSelected ? 'bg-primary border-2 border-white scale-125 z-20' : 
                                  isSynced ? 'bg-emerald-500 border border-emerald-600' : 'bg-rose-500 border border-rose-600'
                                }`}>
                                  <MapPin className="h-3 w-3 text-black" />
                                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 text-[8px] font-bold px-1 rounded truncate max-w-[80px]">
                                    {p.name.substring(0, 8)}..
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </Card>
                    )}

                    {/* Search result list */}
                    <Card className="bg-card/35 backdrop-blur-sm border-border/50">
                      <CardContent className="p-0">
                        {prospects.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                            <Building2 className="h-10 w-10 text-muted-foreground opacity-40" />
                            <div className="text-xs text-muted-foreground">Search and scan prospects to populate list.</div>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader className="bg-muted/10">
                              <TableRow>
                                <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9">Business</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9">Rating</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9">Google claimed</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9">Need Score</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold text-muted-foreground h-9 text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {prospects.map((p) => {
                                const isSelected = selectedProspect?.id === p.id;
                                return (
                                  <TableRow 
                                    key={p.id} 
                                    className={`cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-emerald-500/5' : 'hover:bg-muted/10'}`}
                                    onClick={() => setSelectedProspect(p)}
                                  >
                                    <TableCell className="p-3">
                                      <div className="font-bold text-xs">{p.name}</div>
                                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.domain}</div>
                                    </TableCell>
                                    <TableCell className="p-3 text-xs">{p.rating ? `⭐ ${p.rating} (${p.reviewsCount})` : 'N/A'}</TableCell>
                                    <TableCell className="p-3">
                                      <Badge variant="outline" className={`text-[8px] uppercase font-bold ${p.claimed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                                        {p.claimed ? 'Claimed' : 'Unclaimed'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="p-3">
                                      <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10 text-[10px] font-extrabold">{p.scoring.overallScore}%</Badge>
                                    </TableCell>
                                    <TableCell className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-end gap-1.5">
                                        <Button 
                                          onClick={() => handleEnrichProspect(p)} 
                                          variant="ghost" 
                                          className="h-7 px-2 text-[10px] hover:bg-muted/10 hover:text-emerald-400 active:scale-[0.97] transition-all rounded-lg"
                                        >
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Enrich
                                        </Button>
                                        <Button 
                                          onClick={() => handleSyncToCRM(p)} 
                                          disabled={p.syncStatus === 'synced'} 
                                          className="h-7 px-2 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-black font-semibold active:scale-[0.97] transition-all rounded-lg"
                                        >
                                          {p.syncStatus === 'synced' ? 'Synced ✓' : 'Sync CRM'}
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    {/* Prospect Side Drawer Detail Sheet */}
                    {selectedProspect && (
                      <Card className="bg-card/45 border-emerald-500/20 relative shadow-lg">
                        <div className="absolute top-3 right-3">
                          <Button variant="ghost" className="h-6 w-6 p-0 rounded-full" onClick={() => setSelectedProspect(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <CardHeader className="p-4 border-b border-border/30">
                          <div className="flex justify-between items-start pr-6">
                            <div>
                              <CardTitle className="text-sm font-extrabold text-emerald-400">{selectedProspect.name}</CardTitle>
                              <CardDescription className="text-xs">{selectedProspect.domain}</CardDescription>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-black text-emerald-400">{selectedProspect.scoring.overallScore}%</div>
                              <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Smart Score</div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-3 space-y-4 text-xs">
                          {/* Scoring matrix */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-b border-border/30 pb-3">
                            <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Need</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.needScore}/25</div></div>
                            <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Digital Maturity</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.digitalMaturity}/15</div></div>
                            <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Intent</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.buyingIntent}/20</div></div>
                            <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Budget</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.budgetProbability}/15</div></div>
                            <div><div className="text-[8px] uppercase tracking-wider font-bold opacity-60">Decision Maker</div><div className="font-bold text-xs mt-0.5">{selectedProspect.scoring.decisionMakerFound}/10</div></div>
                          </div>

                          {/* AI summary */}
                          {selectedProspect.aiInsights ? (
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-bold text-emerald-400 text-[10px] uppercase tracking-wider">AI Summary Analysis</h4>
                                <p className="mt-1 leading-relaxed text-muted-foreground">{selectedProspect.aiInsights.summary}</p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-bold text-[10px] uppercase tracking-wider text-rose-400">Problems Found</h4>
                                  <ul className="list-disc pl-4 mt-1 space-y-1 text-muted-foreground">
                                    {selectedProspect.aiInsights.problemsFound.map((p, i) => <li key={i}>{p}</li>)}
                                  </ul>
                                </div>
                                <div>
                                  <h4 className="font-bold text-[10px] uppercase tracking-wider text-emerald-400">Smart Opportunities</h4>
                                  <ul className="list-disc pl-4 mt-1 space-y-1 text-muted-foreground">
                                    {selectedProspect.aiInsights.opportunities.map((o, i) => <li key={i}>{o}</li>)}
                                  </ul>
                                </div>
                              </div>

                              <div className="border-t border-border/30 pt-3">
                                <h4 className="font-bold text-emerald-400 text-[10px] uppercase tracking-wider">Recommended Pitch</h4>
                                <p className="mt-1 text-muted-foreground italic bg-muted/10 p-2 border border-border/40 rounded-lg">"{selectedProspect.aiInsights.recommendedPitch}"</p>
                              </div>
                            </div>
                          ) : (
                            <div className="py-4 text-center">
                              <p className="text-muted-foreground mb-2">Detailed AI insights, pitches, and technographic analysis have not been generated.</p>
                              <Button 
                                onClick={() => handleEnrichProspect(selectedProspect)} 
                                className="h-8 bg-emerald-500 text-black font-semibold rounded-lg text-xs"
                              >
                                Run AI Opportunity Scan
                              </Button>
                            </div>
                          )}

                          {/* Contacts info */}
                          {selectedProspect.contacts.length > 0 && (
                            <div className="border-t border-border/30 pt-3">
                              <h4 className="font-bold text-emerald-400 text-[10px] uppercase tracking-wider">Found Decision Makers</h4>
                              <div className="mt-2 space-y-1.5">
                                {selectedProspect.contacts.map((c, i) => (
                                  <div key={i} className="flex justify-between items-center">
                                    <span><strong>{c.name}</strong> ({c.role})</span>
                                    <span className="text-muted-foreground">{c.email}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 3: WEBSITE SCANNERS */}
          {activeTab === 'scanner' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="scanner" className="mt-6">
                <Card className="bg-card/35 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-emerald-400" />
                      Direct Website Tech Scanner
                    </CardTitle>
                    <CardDescription className="text-xs">Enter a domain name to execute an audit of its SSL, technologies, performance, and AI conversion opportunities.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="school.edu" 
                        value={scanUrl} 
                        onChange={(e) => setScanUrl(e.target.value)} 
                        className="h-10 text-xs border-border/60 bg-muted/10 rounded-lg"
                      />
                      <Button 
                        onClick={handleUrlScan} 
                        disabled={isScanning || !scanUrl} 
                        className="h-10 px-6 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold active:scale-[0.97] transition-all rounded-lg text-xs"
                      >
                        {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Audit Domain'}
                      </Button>
                    </div>

                    {scannedProspect && (
                      <div className="space-y-6 text-xs border-t border-border/30 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Technology Stack */}
                          <Card className="bg-muted/10 border-border/40">
                            <CardHeader className="p-4"><CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-400">Technology Stack</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0">
                              <div className="flex flex-wrap gap-1.5">
                                {scannedProspect.websiteScan?.technologies.map((tech, i) => (
                                  <Badge key={i} variant="outline" className="bg-background text-foreground text-[9px] font-bold py-0.5 px-2">{tech}</Badge>
                                )) || <span className="text-muted-foreground text-xs">No verification credentials keys found. Falling back to simulated stack.</span>}
                              </div>
                            </CardContent>
                          </Card>

                          {/* SSL & Speed */}
                          <Card className="bg-muted/10 border-border/40">
                            <CardHeader className="p-4"><CardTitle className="text-xs font-bold uppercase tracking-wider text-teal-400">Network & Performance</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0 space-y-2">
                              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                                <span>SSL Status</span>
                                <Badge className={scannedProspect.websiteScan?.sslValid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}>
                                  {scannedProspect.websiteScan?.sslValid ? 'Secure SSL' : 'Invalid SSL'}
                                </Badge>
                              </div>
                              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                                <span>Load Time</span>
                                <span className="font-bold">{scannedProspect.websiteScan?.loadTimeMs ? `${scannedProspect.websiteScan.loadTimeMs}ms` : '9s (Critical)'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Facebook detected</span>
                                <span>{scannedProspect.websiteScan?.hasFacebook ? 'Yes' : 'No'}</span>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Opportunity Score */}
                          <Card className="bg-muted/10 border-border/40">
                            <CardHeader className="p-4"><CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-400">Smart Opportunity Score</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0 flex flex-col items-center justify-center py-4">
                              <div className="text-3xl font-black text-emerald-400">{scannedProspect.scoring.overallScore}%</div>
                              <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-1">High conversion potential</div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* AI Insights & Pitch */}
                        {scannedProspect.aiInsights && (
                          <div className="space-y-4">
                            <div className="p-4 bg-muted/10 border border-border/40 rounded-xl space-y-2">
                              <h4 className="font-bold text-emerald-400 text-xs uppercase">AI Stethoscope Report</h4>
                              <p className="leading-relaxed text-muted-foreground">{scannedProspect.aiInsights.summary}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-2">
                                <h4 className="font-bold text-rose-400 text-xs uppercase">Weaknesses Detected</h4>
                                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                                  {scannedProspect.aiInsights.problemsFound.map((p, i) => <li key={i}>{p}</li>)}
                                </ul>
                              </div>
                              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                                <h4 className="font-bold text-emerald-400 text-xs uppercase">Target Solutions</h4>
                                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                                  {scannedProspect.aiInsights.opportunities.map((o, i) => <li key={i}>{o}</li>)}
                                </ul>
                              </div>
                            </div>

                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl space-y-2">
                              <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-2">
                                <h4 className="font-bold text-emerald-400 text-xs uppercase">Tailored Sales Presentation</h4>
                                <span className="font-bold text-teal-400">Est. Revenue Value: ${scannedProspect.aiInsights.estimatedRevenueOpportunity}/yr</span>
                              </div>
                              <p className="italic text-muted-foreground leading-relaxed">"{scannedProspect.aiInsights.recommendedPitch}"</p>
                              <div className="pt-3">
                                <Button 
                                  onClick={() => handleSyncToCRM(scannedProspect)} 
                                  disabled={scannedProspect.syncStatus === 'synced'} 
                                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-lg h-9 px-4 active:scale-[0.97]"
                                >
                                  {scannedProspect.syncStatus === 'synced' ? 'Synced ✓' : 'Import to SmartSapp Contacts'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 4: SAVED SEARCHES */}
          {activeTab === 'searches' && (
            <motion.div
              key="searches"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="searches" className="mt-6">
                <Card className="bg-card/35 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">Saved Search Configurations</CardTitle>
                    <CardDescription className="text-xs">Quickly run or edit your saved location discovery filters.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {savedSearches.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-10 text-center">No saved search configurations yet.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedSearches.map((s) => (
                          <div key={s.id} className="p-4 bg-muted/10 border border-border/40 rounded-xl flex justify-between items-center">
                            <div>
                              <div className="font-bold text-xs">{s.name}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Region: {s.filters.city || 'Global'} • Industry: {s.filters.industry || 'All'}
                              </div>
                            </div>
                            <Button 
                              onClick={() => {
                                setCityFilter(s.filters.city || '');
                                setIndustryFilter(s.filters.industry || '');
                                setSearchQuery(s.name);
                                setActiveTab('finder');
                                handleSearch();
                              }}
                              className="h-8 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs rounded-lg active:scale-[0.97]"
                            >
                              Run Search
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </motion.div>
          )}

          {/* TAB 5: SETTINGS & CHROME */}
          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={kowalskiTransition}
            >
              <TabsContent value="settings" className="mt-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* API keys credentials config */}
                  <Card className="bg-card/35 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Settings className="h-4 w-4 text-emerald-400" />
                        Credentials & Data Integration Keys
                      </CardTitle>
                      <CardDescription className="text-xs">Add your API credentials to connect Google Maps, BuiltWith technographics and Hunter decision makers.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="google-key font-bold text-[10px]">Google Places API Key</Label>
                        <Input 
                          id="google-key" 
                          type="password"
                          placeholder="AIzaSy..." 
                          value={settings.googlePlacesApiKey} 
                          onChange={(e) => setSettings(prev => ({ ...prev, googlePlacesApiKey: e.target.value }))}
                          className="h-9 text-xs border-border/60 bg-muted/10 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="builtwith-key font-bold text-[10px]">BuiltWith API Key</Label>
                        <Input 
                          id="builtwith-key" 
                          type="password"
                          placeholder="e.g. 5d5a8..." 
                          value={settings.builtwithApiKey} 
                          onChange={(e) => setSettings(prev => ({ ...prev, builtwithApiKey: e.target.value }))}
                          className="h-9 text-xs border-border/60 bg-muted/10 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="hunter-key font-bold text-[10px]">Hunter.io API Key</Label>
                        <Input 
                          id="hunter-key" 
                          type="password"
                          placeholder="e.g. key_66a7b..." 
                          value={settings.hunterApiKey} 
                          onChange={(e) => setSettings(prev => ({ ...prev, hunterApiKey: e.target.value }))}
                          className="h-9 text-xs border-border/60 bg-muted/10 rounded-lg"
                        />
                      </div>
                      <div className="pt-2">
                        <Button 
                          onClick={handleSaveSettings} 
                          className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs h-9 px-6 rounded-lg active:scale-[0.97]"
                        >
                          Save API settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Chrome extension bundle section */}
                  <Card className="bg-card/35 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Chrome Extension Sideload Installer
                      </CardTitle>
                      <CardDescription className="text-xs">Integrate SmartSapp Lead Intelligence directly into your Chrome browser toolbar.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-xs">
                      <div className="space-y-2">
                        <span className="font-bold block text-[10px] uppercase text-muted-foreground">Workspace Extension Token</span>
                        <div className="flex gap-2">
                          <Input 
                            readOnly 
                            value={settings.chromeExtensionToken || 'No token generated'} 
                            className="h-9 text-xs border-border/60 bg-muted/10 rounded-lg"
                          />
                          <Button 
                            onClick={generateNewToken} 
                            variant="outline" 
                            className="h-9 text-xs font-bold border-border/50 hover:bg-muted/10 active:scale-[0.97] rounded-lg"
                          >
                            Generate
                          </Button>
                        </div>
                      </div>

                      {/* Download section */}
                      <div className="p-3 bg-muted/10 border border-border/40 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="font-bold block">Download extension bundle</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">Custom pre-configured ZIP containing your workspace token keys.</span>
                        </div>
                        <Button 
                          asChild
                          disabled={!settings.chromeExtensionToken}
                          className="h-9 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-lg active:scale-[0.97]"
                        >
                          <a href={`/api/lead-intelligence/extension/download?workspaceId=${activeWorkspaceId}&token=${settings.chromeExtensionToken}`} download>
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            ZIP Archive
                          </a>
                        </Button>
                      </div>

                      <div className="space-y-2 border-t border-border/30 pt-3">
                        <span className="font-bold block text-[10px] uppercase text-muted-foreground">How to Install in Chrome</span>
                        <ol className="list-decimal pl-4 space-y-1.5 text-muted-foreground">
                          <li>Download the ZIP archive above and extract its contents to a local folder.</li>
                          <li>Open Google Chrome and navigate to: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">chrome://extensions</code></li>
                          <li>Toggle the <strong>Developer Mode</strong> switch in the upper-right corner of the extensions page.</li>
                          <li>Click the <strong>Load Unpacked</strong> button and select the extracted folder.</li>
                          <li>Pin the SmartSapp Extension to your toolbar. Start scanning any school or business domain!</li>
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
