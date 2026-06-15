'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { doc, updateDoc, writeBatch, runTransaction, collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  RotateCcw,
  ShieldCheck,
  Mail,
  Phone,
  Settings2,
  Sliders, 
  Plus, 
  X, 
  TrendingUp, 
  Archive, 
  Flame, 
  Activity, 
  User,
  ShieldAlert,
  Download
} from 'lucide-react';
import type { WorkspaceEntity, EntityContact, LeadScoringSettings, EmailVerificationRule, PhoneVerificationRule } from '@/lib/types';
import { calculateEngagementAdjustment } from '@/lib/scoring-rules-engine';
import { BentoPagination } from '../components/BentoPagination';

const DEFAULT_SCORING_SETTINGS: LeadScoringSettings = {
  emailVerificationRules: [
    { minScore: 90, scoreValue: 10 },
    { minScore: 40, scoreValue: 5 },
    { minScore: 0, scoreValue: 0 }
  ],
  // Phone verification is opt-in: defaults contribute zero so enabling phone
  // verification never silently shifts existing lead scores. Configure tiers
  // here to start awarding points for verified phone numbers.
  phoneVerificationRules: [
    { minScore: 0, scoreValue: 0 }
  ],
  engagementRules: {
    'survey_completed': 15,
    'email_opened': 2,
    'email_clicked': 5,
    'meeting_attended': 20,
    'reply_received': 10
  }
};

const COMMON_ENGAGEMENTS = [
  { value: 'survey_completed', label: 'Survey Completed' },
  { value: 'email_opened', label: 'Email Opened' },
  { value: 'email_clicked', label: 'Email Clicked' },
  { value: 'meeting_attended', label: 'Meeting Attended' },
  { value: 'reply_received', label: 'Reply Received' },
  { value: 'outbound_call', label: 'Outbound Call Made' }
];

export default function LeadScoringCleanupPage() {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace() as any;
  const { toast } = useToast();

  // 1. Fetch all active workspace entities for this workspace
  const weQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', activeWorkspaceId),
      where('status', '==', 'active')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: workspaceEntities, isLoading } = useCollection<WorkspaceEntity>(weQuery);

  // 2. States
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<WorkspaceEntity | null>(null);
  
  // Adjust Score Modal States
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingContact, setAdjustingContact] = useState<EntityContact | null>(null);
  const [adjustOperation, setAdjustOperation] = useState<'add' | 'subtract' | 'set'>('add');
  const [adjustValue, setAdjustValue] = useState<string>('5');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Settings modification States
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const settings = useMemo<LeadScoringSettings>(() => {
    return activeWorkspace?.leadScoringSettings || DEFAULT_SCORING_SETTINGS;
  }, [activeWorkspace?.leadScoringSettings]);

  const [localVerificationRules, setLocalVerificationRules] = useState<EmailVerificationRule[]>([]);
  const [localPhoneVerificationRules, setLocalPhoneVerificationRules] = useState<PhoneVerificationRule[]>([]);
  const [localEngagementRules, setLocalEngagementRules] = useState<Record<string, number>>({});

  // Sync settings local state on load
  React.useEffect(() => {
    if (settings) {
      setLocalVerificationRules([...(settings.emailVerificationRules || [])]);
      setLocalPhoneVerificationRules([
        ...(settings.phoneVerificationRules || DEFAULT_SCORING_SETTINGS.phoneVerificationRules || [])
      ]);
      setLocalEngagementRules({ ...(settings.engagementRules || {}) });
    }
  }, [settings]);

  // Expand / collapse row toggle
  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  // Metrics Calculations
  const metrics = useMemo(() => {
    if (!workspaceEntities) return { total: 0, hot: 0, warm: 0, cold: 0 };
    let hot = 0;
    let warm = 0;
    let cold = 0;
    let total = 0;

    workspaceEntities.forEach((we) => {
      const score = we.leadScore || 0;
      total++;
      if (score >= 50) {
        hot++;
      } else if (score >= 15) {
        warm++;
      } else {
        cold++;
      }
    });

    return { total, hot, warm, cold };
  }, [workspaceEntities]);

  // Filtering leads based on search term
  const filteredLeads = useMemo(() => {
    if (!workspaceEntities) return [];
    return workspaceEntities.filter((we) => {
      const display = we.displayName || '';
      const email = we.primaryEmail || '';
      const search = searchTerm.toLowerCase();
      return (
        display.toLowerCase().includes(search) ||
        email.toLowerCase().includes(search)
      );
    });
  }, [workspaceEntities, searchTerm]);

  const totalRecords = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // Reset page on search or page size change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  // ==== Hygiene Tab Logic ====
  const [hygieneFilter, setHygieneFilter] = useState<string>('all');
  const [hygieneSearchTerm, setHygieneSearchTerm] = useState('');
  const [hygieneCurrentPage, setHygieneCurrentPage] = useState(1);
  const [hygienePageSize, setHygienePageSize] = useState(50);
  const [isBulkHygieneArchiveOpen, setIsBulkHygieneArchiveOpen] = useState(false);
  const [isBulkHygieneDeleteOpen, setIsBulkHygieneDeleteOpen] = useState(false);

  const hygieneLeads = useMemo(() => {
    if (!workspaceEntities) return [];
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    return workspaceEntities.filter(we => {
      let matchesFilter = false;
      const lastEngagedAt = we.lastEngagedAt ? new Date(we.lastEngagedAt).getTime() : 0;
      const daysInactive = lastEngagedAt ? (now - lastEngagedAt) / dayInMs : Infinity;
      
      const lastEmailOpenedAt = we.entityContacts.find(c => c.isPrimary)?.lastEmailOpenedAt;
      const emailOpenedAtMs = lastEmailOpenedAt ? new Date(lastEmailOpenedAt).getTime() : 0;
      const daysUnopened = emailOpenedAtMs ? (now - emailOpenedAtMs) / dayInMs : Infinity;
      
      const hasBounced = we.entityContacts.some(c => c.emailStatus === 'bounced');
      const hasUnsubscribed = we.entityContacts.some(c => c.emailStatus === 'unsubscribed');
      const hasNoRole = we.entityContacts.some(c => c.isPrimary && !c.typeLabel && !c.typeKey);
      const hasNoPhone = !we.primaryPhone;
      const hasNoEmail = !we.primaryEmail;
      const hasUnverifiedEmail = we.entityContacts.some(c => c.isPrimary && c.emailVerificationScore === undefined);
      
      if (hygieneFilter === 'all') {
        matchesFilter = hasBounced || hasUnsubscribed || daysInactive > 30 || hasNoRole || hasNoPhone || hasNoEmail || hasUnverifiedEmail || daysUnopened > 30;
      } else if (hygieneFilter === 'bounced') {
        matchesFilter = hasBounced;
      } else if (hygieneFilter === 'unsubscribed') {
        matchesFilter = hasUnsubscribed;
      } else if (hygieneFilter === 'inactive_30') {
        matchesFilter = daysInactive > 30;
      } else if (hygieneFilter === 'inactive_60') {
        matchesFilter = daysInactive > 60;
      } else if (hygieneFilter === 'inactive_90') {
        matchesFilter = daysInactive > 90;
      } else if (hygieneFilter === 'no_role') {
        matchesFilter = hasNoRole;
      } else if (hygieneFilter === 'no_phone') {
        matchesFilter = hasNoPhone;
      } else if (hygieneFilter === 'no_email') {
        matchesFilter = hasNoEmail;
      } else if (hygieneFilter === 'unverified_email') {
        matchesFilter = hasUnverifiedEmail;
      } else if (hygieneFilter === 'unopened_30') {
        matchesFilter = daysUnopened > 30;
      } else if (hygieneFilter === 'unopened_60') {
        matchesFilter = daysUnopened > 60;
      } else if (hygieneFilter === 'unopened_90') {
        matchesFilter = daysUnopened > 90;
      }
      
      if (!matchesFilter) return false;
      
      if (hygieneSearchTerm) {
        const term = hygieneSearchTerm.toLowerCase();
        const matchesSearch = (we.displayName || '').toLowerCase().includes(term) || (we.primaryEmail || '').toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }
      
      return true;
    });
  }, [workspaceEntities, hygieneFilter, hygieneSearchTerm]);

  const hygieneTotalRecords = hygieneLeads.length;
  const hygieneTotalPages = Math.max(1, Math.ceil(hygieneTotalRecords / hygienePageSize));
  
  const paginatedHygieneLeads = useMemo(() => {
    const start = (hygieneCurrentPage - 1) * hygienePageSize;
    return hygieneLeads.slice(start, start + hygienePageSize);
  }, [hygieneLeads, hygieneCurrentPage, hygienePageSize]);

  React.useEffect(() => {
    setHygieneCurrentPage(1);
  }, [hygieneSearchTerm, hygieneFilter, hygienePageSize]);

  const handleExportHygieneCSV = () => {
    if (hygieneLeads.length === 0) return;
    const headers = ['Entity Name', 'Primary Email', 'Bounce/Unsubscribe', 'Days Inactive', 'Lead Score'];
    const csvRows = hygieneLeads.map(lead => {
      const hasBounced = lead.entityContacts.some(c => c.emailStatus === 'bounced');
      const hasUnsubscribed = lead.entityContacts.some(c => c.emailStatus === 'unsubscribed');
      const issues = [hasBounced ? 'Bounced' : '', hasUnsubscribed ? 'Unsubscribed' : ''].filter(Boolean).join(' & ');
      
      const lastEngagedAt = lead.lastEngagedAt ? new Date(lead.lastEngagedAt).getTime() : 0;
      const daysInactive = lastEngagedAt ? Math.floor((Date.now() - lastEngagedAt) / (24 * 60 * 60 * 1000)) : 'Never';
      
      return `"${lead.displayName}","${lead.primaryEmail || ''}","${issues}","${daysInactive}","${lead.leadScore || 0}"`;
    });
    
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hygiene-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkArchiveHygiene = async () => {
    if (!firestore || hygieneLeads.length === 0) return;
    setIsBulkHygieneArchiveOpen(false);
    try {
      const batch = writeBatch(firestore);
      const timestamp = new Date().toISOString();
      hygieneLeads.forEach(lead => {
        batch.update(doc(firestore, 'workspace_entities', lead.id), { status: 'archived', updatedAt: timestamp });
        if (lead.entityId) {
          batch.update(doc(firestore, 'entities', lead.entityId), { status: 'archived', updatedAt: timestamp });
        }
      });
      await batch.commit();
      toast({ title: 'Success', description: `Archived ${hygieneLeads.length} records.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleBulkDeleteHygiene = async () => {
    if (!firestore || hygieneLeads.length === 0) return;
    setIsBulkHygieneDeleteOpen(false);
    try {
      const batch = writeBatch(firestore);
      hygieneLeads.forEach(lead => {
        batch.delete(doc(firestore, 'workspace_entities', lead.id));
      });
      await batch.commit();
      toast({ title: 'Success', description: `Permanently deleted ${hygieneLeads.length} records from this workspace.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  // ==== End Hygiene Logic ====

  // Soft-archive a single lead
  const handleSoftArchiveLead = async (lead: WorkspaceEntity) => {
    if (!firestore || !activeWorkspaceId) return;
    try {
      const timestamp = new Date().toISOString();
      const weRef = doc(firestore, 'workspace_entities', lead.id);
      await updateDoc(weRef, {
        status: 'archived',
        updatedAt: timestamp
      });

      if (lead.entityId) {
        const entityRef = doc(firestore, 'entities', lead.entityId);
        await updateDoc(entityRef, {
          status: 'archived',
          updatedAt: timestamp
        });
      }

      toast({
        title: 'Lead Archived',
        description: `Successfully soft-archived "${lead.displayName}".`
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Archive Failed',
        description: error.message
      });
    }
  };

  // Bulk soft-archive all cold leads (leadScore < 15)
  const handleBulkArchiveCold = async () => {
    if (!firestore || !workspaceEntities) return;
    setIsArchiveModalOpen(false);
    
    const coldLeads = workspaceEntities.filter((we) => (we.leadScore || 0) < 15);
    if (coldLeads.length === 0) {
      toast({
        title: 'No Cold Leads',
        description: 'There are no active leads with a score below 15.'
      });
      return;
    }

    try {
      const batch = writeBatch(firestore);
      const timestamp = new Date().toISOString();

      coldLeads.forEach((lead) => {
        const weRef = doc(firestore, 'workspace_entities', lead.id);
        batch.update(weRef, { status: 'archived', updatedAt: timestamp });

        if (lead.entityId) {
          const entityRef = doc(firestore, 'entities', lead.entityId);
          batch.update(entityRef, { status: 'archived', updatedAt: timestamp });
        }
      });

      await batch.commit();
      toast({
        title: 'Bulk Archive Successful',
        description: `Soft-archived ${coldLeads.length} cold leads.`
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk Archive Failed',
        description: error.message
      });
    }
  };

  // Reset scoring settings
  const handleResetSettings = () => {
    setLocalVerificationRules([...DEFAULT_SCORING_SETTINGS.emailVerificationRules]);
    setLocalPhoneVerificationRules([...(DEFAULT_SCORING_SETTINGS.phoneVerificationRules || [])]);
    setLocalEngagementRules({ ...DEFAULT_SCORING_SETTINGS.engagementRules });
    toast({
      title: 'Settings Reset Locally',
      description: 'Click "Save Settings" to apply the defaults to the workspace.'
    });
  };

  // Save rules and settings
  const handleSaveSettings = async () => {
    if (!firestore || !activeWorkspaceId) return;
    setIsSettingsSaving(true);
    try {
      const workspaceRef = doc(firestore, 'workspaces', activeWorkspaceId);
      
      // Sort rules descending by minScore to ensure scoring engine matches highest threshold correctly
      const sortedRules = [...localVerificationRules].sort((a, b) => b.minScore - a.minScore);
      const sortedPhoneRules = [...localPhoneVerificationRules].sort((a, b) => b.minScore - a.minScore);

      await updateDoc(workspaceRef, {
        leadScoringSettings: {
          emailVerificationRules: sortedRules,
          phoneVerificationRules: sortedPhoneRules,
          engagementRules: localEngagementRules
        }
      });

      toast({
        title: 'Settings Saved',
        description: 'Lead scoring settings successfully updated.'
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to Save Settings',
        description: error.message
      });
    } finally {
      setIsSettingsSaving(false);
    }
  };

  // Apply manual score adjustment to a sub-contact
  const handleApplyAdjustment = async () => {
    if (!firestore || !selectedLead || !adjustingContact) return;
    setIsAdjusting(true);

    const valNum = Math.max(0, Number(adjustValue) || 0);

    const entityId = selectedLead.entityId;
    const workspaceEntityId = selectedLead.id;

    if (!entityId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selected lead does not have a valid parent entity reference.' });
      setIsAdjusting(false);
      return;
    }

    try {
      const entityRef = doc(firestore, 'entities', entityId);
      const weRef = doc(firestore, 'workspace_entities', workspaceEntityId);

      await runTransaction(firestore, async (transaction) => {
        const entitySnap = await transaction.get(entityRef);
        if (!entitySnap.exists()) {
          throw new Error('Parent entity not found.');
        }

        const entityData = entitySnap.data() || {};
        const entityContacts = entityData.entityContacts || [];

        const { entityContacts: updatedContacts, leadScore } = calculateEngagementAdjustment(
          entityContacts,
          adjustingContact.email || adjustingContact.id,
          valNum,
          adjustOperation
        );

        transaction.update(entityRef, {
          entityContacts: updatedContacts,
          leadScore,
          updatedAt: new Date().toISOString()
        });

        transaction.update(weRef, {
          entityContacts: updatedContacts,
          leadScore,
          updatedAt: new Date().toISOString()
        });
      });

      toast({
        title: 'Score Adjusted',
        description: `Successfully adjusted score for contact ${adjustingContact.name}.`
      });

      setIsAdjustModalOpen(false);
      setSelectedLead(null);
      setAdjustingContact(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Adjustment Failed',
        description: error.message
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  // Helper functions for Verification Rules manipulation
  const addVerificationRule = () => {
    setLocalVerificationRules([...localVerificationRules, { minScore: 50, scoreValue: 5 }]);
  };

  const removeVerificationRule = (index: number) => {
    const updated = [...localVerificationRules];
    updated.splice(index, 1);
    setLocalVerificationRules(updated);
  };

  const updateVerificationRule = (index: number, key: keyof EmailVerificationRule, value: number) => {
    const updated = [...localVerificationRules];
    updated[index] = {
      ...updated[index],
      [key]: value
    };
    setLocalVerificationRules(updated);
  };

  // Helper functions for Phone Verification Rules manipulation
  const addPhoneVerificationRule = () => {
    setLocalPhoneVerificationRules([...localPhoneVerificationRules, { minScore: 50, scoreValue: 4 }]);
  };

  const removePhoneVerificationRule = (index: number) => {
    const updated = [...localPhoneVerificationRules];
    updated.splice(index, 1);
    setLocalPhoneVerificationRules(updated);
  };

  const updatePhoneVerificationRule = (index: number, key: keyof PhoneVerificationRule, value: number) => {
    const updated = [...localPhoneVerificationRules];
    updated[index] = {
      ...updated[index],
      [key]: value
    };
    setLocalPhoneVerificationRules(updated);
  };

  // Helper functions for Engagement Rules manipulation
  const addEngagementRule = () => {
    // Find first unused common key or use custom key
    const currentKeys = Object.keys(localEngagementRules);
    const unusedCommon = COMMON_ENGAGEMENTS.find(c => !currentKeys.includes(c.value));
    const newKey = unusedCommon ? unusedCommon.value : `custom_engagement_${Date.now()}`;
    
    setLocalEngagementRules({
      ...localEngagementRules,
      [newKey]: 5
    });
  };

  const removeEngagementRule = (key: string) => {
    const updated = { ...localEngagementRules };
    delete updated[key];
    setLocalEngagementRules(updated);
  };

  const updateEngagementRule = (key: string, value: number) => {
    setLocalEngagementRules({
      ...localEngagementRules,
      [key]: value
    });
  };

  const updateEngagementKey = (oldKey: string, newKey: string) => {
    if (!newKey || oldKey === newKey || Object.keys(localEngagementRules).includes(newKey)) return;
    const value = localEngagementRules[oldKey];
    const updated = { ...localEngagementRules };
    delete updated[oldKey];
    updated[newKey] = value;
    setLocalEngagementRules(updated);
  };

  return (
    <PageContainerFluid>
      <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto py-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary animate-pulse" /> Lead Scoring & Cleanup Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor active prospect scores, override metrics, soft-archive cold records, and configure auto-scoring settings.
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsArchiveModalOpen(true)}
              className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 rounded-xl"
              disabled={isLoading || metrics.cold === 0}
            >
              <Archive className="h-4 w-4 mr-2" /> Bulk Archive Cold Leads
            </Button>
          </div>
        </div>

        {/* Dashboard KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md shadow-sm flex items-center justify-between px-5 py-4 gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Total Active Leads</span>
            <span className="text-2xl font-black">{isLoading ? '...' : metrics.total}</span>
          </Card>

          <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5 backdrop-blur-md shadow-sm flex items-center justify-between px-5 py-4 gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 fill-current" /> Hot Leads
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{isLoading ? '...' : metrics.hot}</span>
          </Card>

          <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5 backdrop-blur-md shadow-sm flex items-center justify-between px-5 py-4 gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Warm Leads
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{isLoading ? '...' : metrics.warm}</span>
          </Card>

          <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5 backdrop-blur-md shadow-sm flex items-center justify-between px-5 py-4 gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600/70 dark:text-rose-400/70 flex items-center gap-1.5">
              <Archive className="h-3.5 w-3.5" /> Cold Leads (<span className="text-[9px] font-bold">{"< 15"}</span>)
            </span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{isLoading ? '...' : metrics.cold}</span>
          </Card>
        </div>

        {/* Tabs Core Layout */}
        <Tabs defaultValue="leads" className="w-full">
          <TabsList className="bg-muted/40 p-1 rounded-xl w-full max-w-[540px] border">
            <TabsTrigger value="leads" className="rounded-lg text-xs font-bold flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Leads Cleanup Registry
            </TabsTrigger>
            <TabsTrigger value="hygiene" className="rounded-lg text-xs font-bold flex items-center gap-2 text-rose-500">
              <ShieldAlert className="h-3.5 w-3.5" /> Data Hygiene
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg text-xs font-bold flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5" /> Auto-Scoring Settings
            </TabsTrigger>
          </TabsList>

          {/* Leads tab content */}
          <TabsContent value="leads" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 w-full max-w-md bg-card border rounded-xl px-3 h-10 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or primary email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-full text-xs font-medium"
              />
            </div>

            <Card className="rounded-2xl border-border/40 bg-card/35 backdrop-blur-md overflow-hidden">
              {filteredLeads.length > 0 && (
                <BentoPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={totalRecords}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  className="border-t-0 border-b"
                />
              )}
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/15">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Lead Company Name</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Primary Email</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Contact Count</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Overall Lead Score</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="w-[120px] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-xs font-semibold text-muted-foreground">
                        Loading directory and aggregating lead metrics...
                      </TableCell>
                    </TableRow>
                  ) : filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-xs font-semibold text-muted-foreground">
                        No leads found matching your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedLeads.map((lead) => {
                      const score = lead.leadScore || 0;
                      const isExpanded = expandedRows.has(lead.id);
                      const isCold = score < 15;
                      const statusVariant = score >= 50 ? 'emerald' : score >= 15 ? 'amber' : 'rose';

                      return (
                        <React.Fragment key={lead.id}>
                          <TableRow className="hover:bg-muted/5 group border-b border-border/30">
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg"
                                onClick={() => toggleRow(lead.id)}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                            <TableCell className="font-bold text-xs text-foreground py-3.5">
                              {lead.displayName}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-muted-foreground">
                              {lead.primaryEmail || <span className="italic opacity-60">None provided</span>}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-center">
                              {lead.entityContacts?.length || 0}
                            </TableCell>
                            <TableCell className="text-sm font-black text-center text-foreground">
                              {score}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant="outline" 
                                className={`
                                  rounded-full border-none font-bold text-[10px] tracking-wide uppercase px-2 py-0.5
                                  ${statusVariant === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 
                                    statusVariant === 'amber' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 
                                    'bg-rose-500/10 text-rose-600 dark:text-rose-400'}
                                `}
                              >
                                {score >= 50 ? 'Hot' : score >= 15 ? 'Warm' : 'Cold'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-lg text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                onClick={() => handleSoftArchiveLead(lead)}
                              >
                                <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                              </Button>
                            </TableCell>
                          </TableRow>

                          {/* Expanded sub-contacts row */}
                          {isExpanded && (
                            <TableRow className="bg-muted/10 border-b border-border/30">
                              <TableCell colSpan={7} className="px-6 py-4">
                                <div className="space-y-3">
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                    <Activity className="h-3.5 w-3.5 text-primary" /> Contact Association & Scores
                                  </h4>
                                  
                                  <div className="overflow-hidden border border-border/40 rounded-xl bg-card">
                                    <Table>
                                      <TableHeader className="bg-muted/20">
                                        <TableRow>
                                          <TableHead className="text-[10px] font-bold uppercase tracking-wider py-2">Name</TableHead>
                                          <TableHead className="text-[10px] font-bold uppercase tracking-wider py-2">Email</TableHead>
                                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center py-2">Verifier Score Points</TableHead>
                                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center py-2">Engagement / Manual Score</TableHead>
                                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center py-2">Total Score</TableHead>
                                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right py-2 w-[120px]"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {(!lead.entityContacts || lead.entityContacts.length === 0) ? (
                                          <TableRow>
                                            <TableCell colSpan={6} className="text-center py-4 text-xs italic opacity-60">
                                              No associated contacts linked to this entity.
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          lead.entityContacts.map((contact) => {
                                            const totalContScore = contact.score || 0;
                                            // Combined verifier points (email + phone) so engagement isn't overstated
                                            const verifyScore = (contact.emailVerificationScore || 0) + (contact.phoneVerificationScore || 0);
                                            const engScore = Math.max(0, totalContScore - verifyScore);

                                            return (
                                              <TableRow key={contact.id} className="hover:bg-muted/5 border-b border-border/10 last:border-none">
                                                <TableCell className="text-xs font-semibold py-2.5">{contact.name}</TableCell>
                                                <TableCell className="text-xs font-medium text-muted-foreground">
                                                  {contact.email ? (
                                                    <span className="flex items-center gap-1">
                                                      <Mail className="h-3 w-3 opacity-60" /> {contact.email}
                                                    </span>
                                                  ) : (
                                                    <span className="italic opacity-60">No email</span>
                                                  )}
                                                </TableCell>
                                                <TableCell className="text-xs font-bold text-center text-primary/80">{verifyScore}</TableCell>
                                                <TableCell className="text-xs font-bold text-center text-amber-500/80">{engScore}</TableCell>
                                                <TableCell className="text-xs font-black text-center text-foreground">{totalContScore}</TableCell>
                                                <TableCell className="text-right">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                      setSelectedLead(lead);
                                                      setAdjustingContact(contact);
                                                      setAdjustOperation('add');
                                                      setAdjustValue('5');
                                                      setIsAdjustModalOpen(true);
                                                    }}
                                                    className="h-7 rounded-lg text-[10px] font-bold hover:bg-muted"
                                                  >
                                                    Adjust Score
                                                  </Button>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {filteredLeads.length > 0 && (
                <BentoPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={totalRecords}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </Card>
          </TabsContent>

          {/* Settings tab content */}
          <TabsContent value="settings" className="space-y-6 mt-4">
            <Card className="rounded-2xl border-border/40 bg-card/35 backdrop-blur-md">
              <CardHeader className="border-b border-border/30 py-4">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="text-base font-extrabold flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" /> Auto-Scoring Rules Engine
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      onClick={handleResetSettings}
                      size="sm"
                      className="text-xs font-bold text-muted-foreground hover:text-foreground h-9"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Defaults
                    </Button>
                    <Button 
                      onClick={handleSaveSettings}
                      size="sm"
                      className="rounded-lg text-xs font-bold bg-primary hover:bg-primary/95 text-white h-9"
                      disabled={isSettingsSaving}
                    >
                      {isSettingsSaving ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                {/* 1. Email Verification Rules */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 text-left">
                      <Label className="text-xs font-black uppercase tracking-wider text-foreground">Email Verification Score Mapping</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Automatically adjust score once email quality is checked in the background. (Rules sorted descending).
                      </p>
                    </div>
                    <Button 
                      onClick={addVerificationRule}
                      variant="outline" 
                      size="sm"
                      className="h-8 rounded-lg text-xs font-bold border-dashed"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Tier
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {localVerificationRules.map((rule, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between gap-3 p-4 rounded-xl border bg-muted/10 relative group"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex flex-col gap-1.5 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Min Verifier Score (%)</span>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={rule.minScore}
                              onChange={(e) => updateVerificationRule(idx, 'minScore', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              className="h-9 rounded-lg font-mono text-xs text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Score Value Assigned</span>
                            <Input
                              type="number"
                              min="0"
                              value={rule.scoreValue}
                              onChange={(e) => updateVerificationRule(idx, 'scoreValue', Math.max(0, parseInt(e.target.value) || 0))}
                              className="h-9 rounded-lg font-mono text-xs text-center text-primary font-bold"
                            />
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeVerificationRule(idx)}
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg shrink-0"
                          disabled={localVerificationRules.length <= 1}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Phone Verification Rules */}
                <div className="space-y-4 border-t border-border/40 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 text-left">
                      <Label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-primary" /> Phone Verification Score Mapping
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Award points once a phone number passes background verification (format, allocated range, line type). Opt-in: leave the single 0 / 0 tier to keep phone scoring disabled. (Rules sorted descending).
                      </p>
                    </div>
                    <Button
                      onClick={addPhoneVerificationRule}
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg text-xs font-bold border-dashed"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Tier
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {localPhoneVerificationRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 p-4 rounded-xl border bg-muted/10 relative group"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex flex-col gap-1.5 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Min Verifier Score (%)</span>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={rule.minScore}
                              onChange={(e) => updatePhoneVerificationRule(idx, 'minScore', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                              className="h-9 rounded-lg font-mono text-xs text-center"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Score Value Assigned</span>
                            <Input
                              type="number"
                              min="0"
                              value={rule.scoreValue}
                              onChange={(e) => updatePhoneVerificationRule(idx, 'scoreValue', Math.max(0, parseInt(e.target.value) || 0))}
                              className="h-9 rounded-lg font-mono text-xs text-center text-primary font-bold"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePhoneVerificationRule(idx)}
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg shrink-0"
                          disabled={localPhoneVerificationRules.length <= 1}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Engagement Rules Mapping */}
                <div className="space-y-4 border-t border-border/40 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 text-left">
                      <Label className="text-xs font-black uppercase tracking-wider text-foreground">Engagement Activities Score Mapping</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Automatically adjust lead scores when specific activities/engagements are logged in the CRM history.
                      </p>
                    </div>
                    <Button 
                      onClick={addEngagementRule}
                      variant="outline" 
                      size="sm"
                      className="h-8 rounded-lg text-xs font-bold border-dashed"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Engagement Map
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(localEngagementRules).map(([key, val]) => {
                      const isCommon = COMMON_ENGAGEMENTS.some(c => c.value === key);
                      
                      return (
                        <div 
                          key={key}
                          className="flex items-center justify-between gap-4 p-4 rounded-xl border bg-muted/10"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
                              <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Engagement Event / Type</span>
                              {isCommon ? (
                                <Select
                                  value={key}
                                  onValueChange={(newKey) => updateEngagementKey(key, newKey)}
                                >
                                  <SelectTrigger className="h-9 rounded-lg text-xs font-semibold">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-lg">
                                    {COMMON_ENGAGEMENTS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value} className="text-xs rounded-md">
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value={`custom_input_${Date.now()}`} className="text-xs rounded-md italic text-primary">
                                      Custom Event Key...
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={key}
                                  onChange={(e) => updateEngagementKey(key, e.target.value)}
                                  placeholder="custom_event_name"
                                  className="h-9 rounded-lg font-mono text-xs"
                                />
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5 flex-1 max-w-[120px]">
                              <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Score Delta (+/-)</span>
                              <Input
                                type="number"
                                value={val}
                                onChange={(e) => updateEngagementRule(key, parseInt(e.target.value) || 0)}
                                className="h-9 rounded-lg font-mono text-xs text-center font-bold"
                              />
                            </div>
                          </div>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeEngagementRule(key)}
                            className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}

                    {Object.keys(localEngagementRules).length === 0 && (
                      <div className="p-8 text-center border-2 border-dashed rounded-xl opacity-60">
                        <p className="text-xs font-semibold text-muted-foreground">No engagement score rules mapped yet. Click "Add Engagement Map" to start.</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hygiene Tab Content */}
          <TabsContent value="hygiene" className="space-y-4 mt-4">
            <div className="flex flex-col md:flex-row gap-3 w-full border-b border-border/40 pb-4">
              <div className="flex items-center gap-3 w-full max-w-md bg-card border rounded-xl px-3 h-10 shadow-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search inactive/bounced leads..."
                  value={hygieneSearchTerm}
                  onChange={(e) => setHygieneSearchTerm(e.target.value)}
                  className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-full text-xs font-medium"
                />
              </div>
              <Select value={hygieneFilter} onValueChange={(val: any) => setHygieneFilter(val)}>
                <SelectTrigger className="w-full md:w-[200px] h-10 rounded-xl bg-card">
                  <SelectValue placeholder="Filter Issues" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Issues</SelectItem>
                  <SelectItem value="bounced">Hard Bounced</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  <SelectItem value="inactive_30">{"> 30 Days Inactive"}</SelectItem>
                  <SelectItem value="inactive_60">{"> 60 Days Inactive"}</SelectItem>
                  <SelectItem value="inactive_90">{"> 90 Days Inactive"}</SelectItem>
                  <SelectItem value="no_role">Missing Role</SelectItem>
                  <SelectItem value="no_phone">Missing Phone</SelectItem>
                  <SelectItem value="no_email">Missing Email</SelectItem>
                  <SelectItem value="unverified_email">Unverified Email</SelectItem>
                  <SelectItem value="unopened_30">{"> 30 Days Email Unopened"}</SelectItem>
                  <SelectItem value="unopened_60">{"> 60 Days Email Unopened"}</SelectItem>
                  <SelectItem value="unopened_90">{"> 90 Days Email Unopened"}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-10 rounded-xl font-bold text-xs" onClick={handleExportHygieneCSV} disabled={hygieneLeads.length === 0}>
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
                <Button variant="outline" className="h-10 rounded-xl font-bold text-xs text-rose-500 border-rose-500/20 hover:bg-rose-500/10" onClick={() => setIsBulkHygieneArchiveOpen(true)} disabled={hygieneLeads.length === 0}>
                  <Archive className="h-4 w-4 mr-2" /> Bulk Archive
                </Button>
                <Button variant="destructive" className="h-10 rounded-xl font-bold text-xs" onClick={() => setIsBulkHygieneDeleteOpen(true)} disabled={hygieneLeads.length === 0}>
                  <Trash2 className="h-4 w-4 mr-2" /> Permanent Delete
                </Button>
              </div>
            </div>

            <Card className="rounded-2xl border-border/40 bg-card/35 backdrop-blur-md overflow-hidden">
              {hygieneLeads.length > 0 && (
                <BentoPagination
                  currentPage={hygieneCurrentPage}
                  totalPages={hygieneTotalPages}
                  totalRecords={hygieneTotalRecords}
                  pageSize={hygienePageSize}
                  onPageChange={setHygieneCurrentPage}
                  onPageSizeChange={setHygienePageSize}
                  className="border-t-0 border-b"
                />
              )}
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/15">
                    <TableHead className="w-[40px] text-center"></TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-foreground">Entity Name</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Primary Email</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Deliverability</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Days Inactive</TableHead>
                    <TableHead className="w-[120px] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-xs font-semibold text-muted-foreground">Loading hygiene data...</TableCell>
                    </TableRow>
                  ) : paginatedHygieneLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-xs font-semibold text-muted-foreground">No leads matched your hygiene filters.</TableCell>
                    </TableRow>
                  ) : (
                    paginatedHygieneLeads.map((lead) => {
                      const hasBounced = lead.entityContacts.some(c => c.emailStatus === 'bounced');
                      const hasUnsubscribed = lead.entityContacts.some(c => c.emailStatus === 'unsubscribed');
                      const lastEngagedAt = lead.lastEngagedAt ? new Date(lead.lastEngagedAt).getTime() : 0;
                      const daysInactive = lastEngagedAt ? Math.floor((Date.now() - lastEngagedAt) / (24 * 60 * 60 * 1000)) : 'Never';
                      
                      const hasNoRole = lead.entityContacts.some(c => c.isPrimary && !c.typeLabel && !c.typeKey);
                      const hasNoPhone = !lead.primaryPhone;
                      const hasNoEmail = !lead.primaryEmail;
                      const hasUnverifiedEmail = lead.entityContacts.some(c => c.isPrimary && c.emailVerificationScore === undefined);
                      
                      return (
                        <TableRow key={lead.id} className="hover:bg-muted/5 group border-b border-border/30">
                          <TableCell className="text-center"><ShieldAlert className="h-4 w-4 text-muted-foreground/50 mx-auto" /></TableCell>
                          <TableCell className="font-bold text-xs text-foreground py-3.5">{lead.displayName}</TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">{lead.primaryEmail || <span className="italic opacity-60">None</span>}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {hasBounced && <Badge variant="destructive" className="text-[9px] uppercase">Bounced</Badge>}
                              {hasUnsubscribed && <Badge variant="secondary" className="text-[9px] uppercase">Unsub</Badge>}
                              {hasNoRole && <Badge variant="outline" className="text-[9px] uppercase border-amber-500/50 text-amber-500">No Role</Badge>}
                              {hasNoPhone && <Badge variant="outline" className="text-[9px] uppercase border-amber-500/50 text-amber-500">No Phone</Badge>}
                              {hasNoEmail && <Badge variant="outline" className="text-[9px] uppercase border-amber-500/50 text-amber-500">No Email</Badge>}
                              {hasUnverifiedEmail && <Badge variant="outline" className="text-[9px] uppercase border-blue-500/50 text-blue-500">Unverified</Badge>}
                              {!hasBounced && !hasUnsubscribed && !hasNoRole && !hasNoPhone && !hasNoEmail && !hasUnverifiedEmail && <span className="text-[10px] text-muted-foreground">OK</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-black text-center text-foreground">{daysInactive}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10" onClick={() => handleSoftArchiveLead(lead)}>
                              <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {hygieneLeads.length > 0 && (
                <BentoPagination
                  currentPage={hygieneCurrentPage}
                  totalPages={hygieneTotalPages}
                  totalRecords={hygieneTotalRecords}
                  pageSize={hygienePageSize}
                  onPageChange={setHygieneCurrentPage}
                  onPageSizeChange={setHygienePageSize}
                />
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal: Bulk Hygiene Archive Confirmation */}
        <Dialog open={isBulkHygieneArchiveOpen} onOpenChange={setIsBulkHygieneArchiveOpen}>
          <DialogContent className="rounded-2xl border bg-card max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-rose-500">
                <Archive className="h-5 w-5" /> Bulk Archive Filtered Leads
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to archive {hygieneLeads.length} leads matching your current hygiene filters?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-3">
              <Button variant="ghost" onClick={() => setIsBulkHygieneArchiveOpen(false)} className="rounded-xl text-xs font-bold">Cancel</Button>
              <Button onClick={handleBulkArchiveHygiene} className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold">Archive {hygieneLeads.length} Leads</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Bulk Hygiene Delete Confirmation */}
        <Dialog open={isBulkHygieneDeleteOpen} onOpenChange={setIsBulkHygieneDeleteOpen}>
          <DialogContent className="rounded-2xl border bg-card max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" /> Permanent Bulk Delete
              </DialogTitle>
              <DialogDescription className="text-xs">
                You are about to permanently delete {hygieneLeads.length} leads from this workspace. This action CANNOT be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 mt-3">
              <Button variant="ghost" onClick={() => setIsBulkHygieneDeleteOpen(false)} className="rounded-xl text-xs font-bold">Cancel</Button>
              <Button onClick={handleBulkDeleteHygiene} className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold">Delete {hygieneLeads.length} Leads</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Bulk Archive Confirmation */}
        <Dialog open={isArchiveModalOpen} onOpenChange={setIsArchiveModalOpen}>
          <DialogContent className="rounded-2xl border bg-card max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-rose-500">
                <Trash2 className="h-5 w-5" /> Bulk Archive Cold Leads
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to archive all active leads with an overall score below 15? This will change status to "archived" on both workspace records and parent contacts.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-1 bg-rose-500/5 p-4 rounded-xl border border-rose-500/10 text-left">
              <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wide">Leads to be Archived</span>
              <p className="text-sm font-bold text-rose-500">{metrics.cold} leads found with score {"< 15"}.</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 mt-3">
              <Button variant="ghost" onClick={() => setIsArchiveModalOpen(false)} className="rounded-xl text-xs font-bold">
                Cancel
              </Button>
              <Button onClick={handleBulkArchiveCold} className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold">
                Archive {metrics.cold} Cold Leads
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Manual Adjust Score */}
        <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
          <DialogContent className="rounded-2xl border bg-card max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary animate-pulse" /> Manual Score Adjustment
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update lead score metrics manually for contact {adjustingContact?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 text-left">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Operation</Label>
                <Select
                  value={adjustOperation}
                  onValueChange={(v: any) => setAdjustOperation(v)}
                >
                  <SelectTrigger className="h-10 rounded-xl text-xs font-semibold bg-card border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="add" className="text-xs">Add Points (+)</SelectItem>
                    <SelectItem value="subtract" className="text-xs">Subtract Points (-)</SelectItem>
                    <SelectItem value="set" className="text-xs">Override/Set Score (=)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Score Value (Points)</Label>
                <Input
                  type="number"
                  min="0"
                  value={adjustValue}
                  onChange={(e) => setAdjustValue(e.target.value)}
                  className="h-10 rounded-xl text-xs font-bold font-mono"
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-3">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsAdjustModalOpen(false);
                  setSelectedLead(null);
                  setAdjustingContact(null);
                }} 
                className="rounded-xl text-xs font-bold"
                disabled={isAdjusting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleApplyAdjustment} 
                className="bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-bold"
                disabled={isAdjusting}
              >
                {isAdjusting ? 'Updating...' : 'Apply Adjustment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainerFluid>
  );
}
