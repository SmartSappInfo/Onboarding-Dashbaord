'use client';

/**
 * Lead Lists, Dynamic Segments & Prospecting Campaigns Tab (Lead Intelligence 2.0 - Phase 10)
 * UI Spec Sections 40-43, PRD Sections 3.6 & 4.5
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 3-Tab Architecture: My Lists (Static), Dynamic Segments (AST Rules), and Prospecting Campaigns (8-Step Automation).
 * 2. Mobile-first layout with touch targets >= 44px.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, 
  Folder, 
  Trash2, 
  Download, 
  Users, 
  Calendar, 
  Plus, 
  ExternalLink,
  Filter,
  Rocket,
  Sparkles,
  TrendingUp,
  Briefcase,
  Star,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { 
  LeadList, 
  Prospect, 
  DynamicSegment, 
  ProspectingCampaign 
} from '@/lib/lead-intelligence/types';
import { 
  getWorkspaceSegmentsAction, 
  deleteDynamicSegmentAction,
  getProspectingCampaignsAction
} from '@/app/actions/lead-intelligence-actions';
import { DynamicSegmentBuilderModal } from './DynamicSegmentBuilderModal';
import { ProspectingCampaignWizardModal } from './ProspectingCampaignWizardModal';
import { ProspectingCampaignDashboardModal } from './ProspectingCampaignDashboardModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LeadListsTabProps {
  workspaceId: string;
  organizationId: string;
  leadLists: LeadList[];
  allProspects: Prospect[];
  onCreateList: (name: string, description?: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onSelectProspectForInspection: (prospect: Prospect) => void;
}

export const LeadListsTab: React.FC<LeadListsTabProps> = ({
  workspaceId,
  organizationId,
  leadLists,
  allProspects,
  onCreateList,
  onDeleteList,
  onSelectProspectForInspection,
}) => {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'static_lists' | 'dynamic_segments' | 'campaigns'>('static_lists');

  // Static List Creation
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Dynamic Segments State
  const [segments, setSegments] = useState<DynamicSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<DynamicSegment | null>(null);
  const [isSegmentBuilderOpen, setIsSegmentBuilderOpen] = useState(false);
  const [isLoadingSegments, setIsLoadingSegments] = useState(false);

  // Prospecting Campaigns State
  const [campaigns, setCampaigns] = useState<ProspectingCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<ProspectingCampaign | null>(null);
  const [isCampaignWizardOpen, setIsCampaignWizardOpen] = useState(false);
  const [isCampaignDashboardOpen, setIsCampaignDashboardOpen] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);

  // Load Segments & Campaigns
  const loadSegments = () => {
    if (!workspaceId) return;
    setIsLoadingSegments(true);
    getWorkspaceSegmentsAction(workspaceId, organizationId)
      .then((res) => {
        if (res.success) setSegments(res.segments);
      })
      .finally(() => setIsLoadingSegments(false));
  };

  const loadCampaigns = () => {
    if (!workspaceId) return;
    setIsLoadingCampaigns(true);
    getProspectingCampaignsAction(workspaceId)
      .then((res) => {
        if (res.success) setCampaigns(res.campaigns);
      })
      .finally(() => setIsLoadingCampaigns(false));
  };

  useEffect(() => {
    loadSegments();
    loadCampaigns();
  }, [workspaceId, organizationId]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please enter a list name.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateList(listName.trim(), listDescription.trim());
      setListName('');
      setListDescription('');
      setIsCreateOpen(false);
      toast({ title: 'Lead List Created ✓', description: `Successfully created list "${listName.trim()}".` });
    } catch {
      toast({ variant: 'destructive', title: 'Creation Failed', description: 'Failed to create lead list.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSegment = async (segmentId: string) => {
    if (!confirm('Are you sure you want to delete this dynamic segment?')) return;
    const res = await deleteDynamicSegmentAction(segmentId, workspaceId);
    if (res.success) {
      toast({ title: 'Segment Deleted' });
      loadSegments();
    } else {
      toast({ variant: 'destructive', title: 'Delete Failed', description: res.error });
    }
  };

  const handleExportListCSV = (list: LeadList) => {
    const listProspects = allProspects.filter((p) => list.prospectIds?.includes(p.id));
    if (listProspects.length === 0) {
      toast({ variant: 'destructive', title: 'Export Notice', description: 'No prospects currently in this list to export.' });
      return;
    }

    const headers = ['Name', 'Domain', 'Phone', 'Address', 'Industry', 'Rating', 'Overall Score', 'Sync Status'];
    const csvRows = [headers.join(',')];

    for (const p of listProspects) {
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
      csvRows.push(row.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${list.name.toLowerCase().replace(/\s+/g, '_')}_prospects.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Exported to CSV ✓', description: `Downloaded ${listProspects.length} prospects from ${list.name}.` });
  };

  const selectedList = leadLists.find((l) => l.id === activeListId);
  const selectedListProspects = selectedList 
    ? allProspects.filter((p) => selectedList.prospectIds?.includes(p.id)) 
    : [];

  return (
    <div className="space-y-6">
      {/* 3-Sub-Tab Header Ribbon (UI Spec Sections 40-43) */}
      <Tabs value={activeSubTab} onValueChange={(val) => setActiveSubTab(val as 'static_lists' | 'dynamic_segments' | 'campaigns')} className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border/70 p-4 rounded-2xl shadow-sm">
          <TabsList className="grid grid-cols-3 h-10 p-1 bg-muted/50 rounded-xl w-full sm:w-auto">
            <TabsTrigger value="static_lists" className="text-xs font-bold rounded-lg flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" />
              <span>My Lists</span>
            </TabsTrigger>
            <TabsTrigger value="dynamic_segments" className="text-xs font-bold rounded-lg flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              <span>Dynamic Segments</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="text-xs font-bold rounded-lg flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5" />
              <span>Prospecting Campaigns</span>
            </TabsTrigger>
          </TabsList>

          {/* Action Trigger depending on active sub-tab */}
          {activeSubTab === 'static_lists' && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]">
                  <Plus className="w-4 h-4" /> Create New List
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreateSubmit}>
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                      <FolderPlus className="w-5 h-5 text-primary" /> Create Lead List
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Create a named cohort to group prospects from searches, website scans, or CSV imports.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3.5 py-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="list-name" className="text-xs font-semibold">List Name *</Label>
                      <Input
                        id="list-name"
                        placeholder="e.g. Kumasi Private Schools — Q3 Outreach"
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                        required
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="list-description" className="text-xs font-semibold">Description (Optional)</Label>
                      <Input
                        id="list-description"
                        placeholder="e.g. Verified institutions without online payment setup"
                        value={listDescription}
                        onChange={(e) => setListDescription(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <DialogFooter className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsCreateOpen(false)}
                      className="h-9 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      size="sm" 
                      disabled={isSubmitting}
                      className="h-9 text-xs bg-primary text-primary-foreground font-medium"
                    >
                      {isSubmitting ? 'Creating...' : 'Create List'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {activeSubTab === 'dynamic_segments' && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedSegment(null);
                setIsSegmentBuilderOpen(true);
              }}
              className="h-9 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
            >
              <Plus className="w-4 h-4" /> New Dynamic Segment
            </Button>
          )}

          {activeSubTab === 'campaigns' && (
            <Button
              size="sm"
              onClick={() => setIsCampaignWizardOpen(true)}
              className="h-9 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
            >
              <Rocket className="w-4 h-4" /> Launch Campaign
            </Button>
          )}
        </div>

        {/* SUB-TAB 1: STATIC LEAD LISTS (UI Spec Section 40) */}
        <TabsContent value="static_lists" className="space-y-6 mt-0">
          {leadLists.length === 0 ? (
            <div className="p-12 border border-dashed border-border rounded-2xl bg-card text-center space-y-3">
              <FolderPlus className="w-10 h-10 text-muted-foreground/60 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">No lead lists created yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Save prospect search batches into persistent lists for campaign targeting and bulk CRM synchronization.
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setIsCreateOpen(true)}
                className="h-8 text-xs font-medium active:scale-[0.97]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Your First List
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leadLists.map((list) => {
                const isSelected = activeListId === list.id;
                return (
                  <div
                    key={list.id}
                    className={`p-4 rounded-2xl border bg-card transition-all space-y-3 flex flex-col justify-between ${
                      isSelected ? 'border-primary shadow-md ring-1 ring-primary/30' : 'border-border/70 hover:border-border'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          <span>{list.name}</span>
                        </h4>
                        <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 shrink-0 bg-primary/10 text-primary border border-primary/20">
                          <Users className="w-3 h-3 mr-1" />
                          {list.prospectsCount} {list.prospectsCount === 1 ? 'lead' : 'leads'}
                        </Badge>
                      </div>

                      {list.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                        <Calendar className="w-3 h-3" />
                        <span>Created {new Date(list.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        variant={isSelected ? "secondary" : "outline"}
                        onClick={() => setActiveListId(isSelected ? null : list.id)}
                        className="h-8 text-xs font-medium active:scale-[0.97]"
                      >
                        {isSelected ? 'Hide Leads' : 'View Leads'}
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleExportListCSV(list)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground active:scale-[0.97]"
                          title="Export list to CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete the list "${list.name}"?`)) {
                              onDeleteList(list.id);
                            }
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive active:scale-[0.97]"
                          title="Delete list"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected List Inspector Table */}
          {selectedList && (
            <div className="mt-6 bg-card border border-border/80 rounded-2xl p-5 space-y-4 shadow-sm animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>Prospects in &ldquo;{selectedList.name}&rdquo;</span>
                    <Badge variant="outline" className="text-xs">{selectedListProspects.length} total</Badge>
                  </h4>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportListCSV(selectedList)}
                  className="h-8 text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </div>

              {selectedListProspects.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No prospect details cached in memory. Search prospects in Prospect Finder and add them to this list.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground">
                        <th className="py-2.5 px-3 font-semibold">Company Name</th>
                        <th className="py-2.5 px-3 font-semibold">Domain</th>
                        <th className="py-2.5 px-3 font-semibold">Location</th>
                        <th className="py-2.5 px-3 font-semibold">Score</th>
                        <th className="py-2.5 px-3 font-semibold">CRM Status</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {selectedListProspects.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-foreground">{p.name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{p.domain}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{p.address || p.industry || '—'}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              {p.scoring?.overallScore ?? 50}/100
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            {p.syncStatus === 'synced' ? (
                              <Badge className="bg-blue-500/10 text-blue-500 text-[10px]">In CRM</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">Unregistered</Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onSelectProspectForInspection(p)}
                              className="h-7 px-2 text-xs text-primary hover:text-primary/90"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* SUB-TAB 2: DYNAMIC SEGMENTS (UI Spec Section 41) */}
        <TabsContent value="dynamic_segments" className="space-y-6 mt-0">
          {isLoadingSegments ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading dynamic segments...</p>
            </div>
          ) : segments.length === 0 ? (
            <div className="p-12 border border-dashed border-border rounded-2xl bg-card text-center space-y-3">
              <Filter className="w-10 h-10 text-muted-foreground/60 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">No dynamic segments created</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Create automated multi-condition segments that filter prospects dynamically based on scores, tech stacks, and CRM status.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsSegmentBuilderOpen(true)}
                className="h-8 text-xs font-bold bg-primary text-primary-foreground active:scale-[0.97]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Dynamic Segment
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="p-4 rounded-2xl border border-border/70 bg-card hover:border-primary/40 transition-all space-y-3 flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground truncate">{seg.name}</h4>
                      {seg.isTemplate && (
                        <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[9px] font-bold">
                          TEMPLATE
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {seg.description || 'Dynamic filter based on custom AST rules'}
                    </p>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs font-mono font-bold">
                        {seg.ruleGroup?.rules?.length || 0} Condition{(seg.ruleGroup?.rules?.length || 0) !== 1 ? 's' : ''} ({seg.ruleGroup?.combinator || 'AND'})
                      </Badge>
                      <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/40 text-xs font-bold">
                        {seg.cachedCount ?? 0} Matching
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSegment(seg);
                        setIsSegmentBuilderOpen(true);
                      }}
                      className="h-8 text-xs font-bold active:scale-[0.97]"
                    >
                      Edit Rules
                    </Button>

                    {!seg.isTemplate && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteSegment(seg.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive active:scale-[0.97]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* SUB-TAB 3: PROSPECTING CAMPAIGNS (UI Spec Section 42 & 43) */}
        <TabsContent value="campaigns" className="space-y-6 mt-0">
          {isLoadingCampaigns ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading prospecting campaigns...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 border border-dashed border-border rounded-2xl bg-card text-center space-y-3">
              <Rocket className="w-10 h-10 text-muted-foreground/60 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">No active prospecting campaigns</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Launch automated 8-step prospecting workflows from discovery to CRM deals and multi-channel outreach.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsCampaignWizardOpen(true)}
                className="h-8 text-xs font-bold bg-primary text-primary-foreground active:scale-[0.97]"
              >
                <Rocket className="w-3.5 h-3.5 mr-1" /> Launch First Campaign
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="p-4 rounded-2xl border border-border/70 bg-card hover:border-primary/40 transition-all space-y-3 flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground truncate">{camp.name}</h4>
                      <Badge className={cn(
                        "text-[10px] font-bold capitalize",
                        camp.status === 'running' && "bg-emerald-500/20 text-emerald-600 border-emerald-500/40",
                        camp.status === 'draft' && "bg-muted text-muted-foreground border-border",
                        camp.status === 'completed' && "bg-primary/20 text-primary border-primary/40"
                      )}>
                        {camp.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Target: {camp.targetCriteria?.region || 'All'} • {camp.targetCriteria?.industry || 'Schools'}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 rounded-xl bg-muted/20 border border-border/60 text-center">
                        <span className="text-[10px] font-semibold text-muted-foreground block">Qualified</span>
                        <span className="text-xs font-extrabold text-foreground">{camp.stats?.qualifiedCount || 0}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-muted/20 border border-border/60 text-center">
                        <span className="text-[10px] font-semibold text-muted-foreground block">Deals Created</span>
                        <span className="text-xs font-extrabold text-primary">{camp.stats?.dealsCreated || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCampaign(camp);
                        setIsCampaignDashboardOpen(true);
                      }}
                      className="h-8 text-xs font-bold active:scale-[0.97]"
                    >
                      Telemetry Dashboard
                    </Button>

                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(camp.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dynamic Segment Builder Modal (UI Spec Section 41) */}
      <DynamicSegmentBuilderModal
        workspaceId={workspaceId}
        organizationId={organizationId}
        existingSegment={selectedSegment}
        isOpen={isSegmentBuilderOpen}
        onClose={() => setIsSegmentBuilderOpen(false)}
        onSaved={loadSegments}
      />

      {/* 8-Step Guided Prospecting Campaign Wizard Modal (UI Spec Section 42) */}
      <ProspectingCampaignWizardModal
        workspaceId={workspaceId}
        organizationId={organizationId}
        lists={leadLists}
        isOpen={isCampaignWizardOpen}
        onClose={() => setIsCampaignWizardOpen(false)}
        onCampaignLaunched={loadCampaigns}
      />

      {/* Campaign Telemetry Dashboard Modal (UI Spec Section 43) */}
      <ProspectingCampaignDashboardModal
        campaign={selectedCampaign}
        isOpen={isCampaignDashboardOpen}
        onClose={() => setIsCampaignDashboardOpen(false)}
      />
    </div>
  );
};

export default LeadListsTab;
