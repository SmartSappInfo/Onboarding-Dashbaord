'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { doc, updateDoc, writeBatch, runTransaction, collection, query, where, limit, orderBy } from 'firebase/firestore';
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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  RotateCcw,
  Sliders, 
  Plus, 
  X, 
  TrendingUp, 
  Archive, 
  Flame, 
  User,
  ShieldAlert,
  Download,
  Mail,
  Phone,
  Trash2,
  UserCheck,
  Building,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import type { 
  WorkspaceEntity, 
  EntityContact, 
  LeadScoringSettings, 
  EmailVerificationRule, 
  PhoneVerificationRule,
  UserProfile,
  Entity
} from '@/lib/types';
import { 
  adjustLeadScoreAction, 
  bulkAdjustScoresAction, 
  bulkArchiveEntitiesAction,
  bulkDeleteEntitiesAction,
  bulkAssignEntitiesAction,
  LeadScoreHistoryDoc
} from '@/lib/scoring-performance-engine';
import { BentoPagination } from '../components/BentoPagination';

const DEFAULT_SCORING_SETTINGS: LeadScoringSettings = {
  emailVerificationRules: [
    { minScore: 90, scoreValue: 10 },
    { minScore: 40, scoreValue: 5 },
    { minScore: 0, scoreValue: 0 }
  ],
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

interface ContactScoringRow {
  id: string; // generated contact doc identifier (weId_contactId)
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  entityId: string;
  companyName: string;
  leadScore: number;
  status: 'VIP' | 'Hot' | 'Warm' | 'Cold';
  ownerId: string | null;
  ownerName: string | null;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  countryName: string;
  // references
  lead: WorkspaceEntity;
  contact: EntityContact;
}

export default function LeadScoringCleanupPage() {
  const firestore = useFirestore();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { toast } = useToast();

  // 1. Fetch active workspace entities
  const weQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', activeWorkspaceId),
      where('status', '==', 'active')
    );
  }, [firestore, activeWorkspaceId]);
  const { data: workspaceEntities, isLoading } = useCollection<WorkspaceEntity>(weQuery);

  // 2. Fetch history for score change updates
  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'leadScoreHistory'),
      orderBy('createdAt', 'desc'),
      limit(400)
    );
  }, [firestore, activeWorkspaceId]);
  const { data: scoreHistory } = useCollection<LeadScoreHistoryDoc>(historyQuery);

  // 3. Fetch users for assigned owner lookups
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspace?.organizationId) return null;
    return query(
      collection(firestore, 'users'),
      where('organizationId', '==', activeWorkspace.organizationId)
    );
  }, [firestore, activeWorkspace?.organizationId]);
  const { data: users } = useCollection<UserProfile>(usersQuery);

  // 4. Map score history to contactId for latest diff lookup
  const latestHistoryMap = useMemo(() => {
    const map = new Map<string, LeadScoreHistoryDoc>();
    if (!scoreHistory) return map;
    scoreHistory.forEach(h => {
      if (!map.has(h.contactId)) {
        map.set(h.contactId, h);
      }
    });
    return map;
  }, [scoreHistory]);

  // 5. States
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Filter States
  const [filterScore, setFilterScore] = useState<string>('all');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterLastActivity, setFilterLastActivity] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');

  // Bulk operation UI states
  const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState('5');
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [bulkAssignUserId, setBulkAssignUserId] = useState<string>('unassigned');

  // Adjust Single Score Modal States
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ContactScoringRow | null>(null);
  const [adjustOperation, setAdjustOperation] = useState<'add' | 'subtract' | 'set' | 'reset'>('add');
  const [adjustValue, setAdjustValue] = useState<string>('5');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Settings tab local states
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

  // Flatten workspace entities to contact-centric rows
  const contactRows = useMemo<ContactScoringRow[]>(() => {
    if (!workspaceEntities) return [];
    const rows: ContactScoringRow[] = [];

    workspaceEntities.forEach(we => {
      const contacts = we.entityContacts || [];
      contacts.forEach(c => {
        const score = c.score || 0;
        let status: 'VIP' | 'Hot' | 'Warm' | 'Cold' = 'Cold';
        if (score >= 100) status = 'VIP';
        else if (score >= 50) status = 'Hot';
        else if (score >= 15) status = 'Warm';

        rows.push({
          id: `${we.id}_${c.id}`,
          contactId: c.id,
          contactName: c.name,
          contactEmail: c.email || '',
          contactPhone: c.phone || '',
          entityId: we.entityId || we.id,
          companyName: we.displayName || '',
          leadScore: score,
          status,
          ownerId: we.assignedTo?.userId || null,
          ownerName: we.assignedTo?.name || null,
          lastActivity: we.lastContactedAt || we.updatedAt || '',
          createdAt: we.addedAt || '',
          updatedAt: we.updatedAt || '',
          tags: we.workspaceTags || [],
          countryName: we.location?.country?.name || '',
          lead: we,
          contact: c
        });
      });
    });

    return rows;
  }, [workspaceEntities]);

  // Filter distinct lists dynamically for select controls
  const distinctOwners = useMemo(() => {
    const owners = new Map<string, string>();
    contactRows.forEach(r => {
      if (r.ownerId && r.ownerName) owners.set(r.ownerId, r.ownerName);
    });
    return Array.from(owners.entries()).map(([id, name]) => ({ id, name }));
  }, [contactRows]);

  const distinctTags = useMemo(() => {
    const tags = new Set<string>();
    contactRows.forEach(r => r.tags.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [contactRows]);

  const distinctCountries = useMemo(() => {
    const countries = new Set<string>();
    contactRows.forEach(r => {
      if (r.countryName) countries.add(r.countryName);
    });
    return Array.from(countries);
  }, [contactRows]);

  // Apply filters & search to contact list
  const filteredContactRows = useMemo(() => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    return contactRows.filter(row => {
      // 1. Search term check
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          row.contactName.toLowerCase().includes(term) ||
          row.contactEmail.toLowerCase().includes(term) ||
          row.companyName.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      // 2. Score check
      if (filterScore !== 'all') {
        const score = row.leadScore;
        if (filterScore === '0-25' && (score < 0 || score > 25)) return false;
        if (filterScore === '26-50' && (score < 26 || score > 50)) return false;
        if (filterScore === '51-75' && (score < 51 || score > 75)) return false;
        if (filterScore === '76-100' && (score < 76 || score > 100)) return false;
        if (filterScore === '100+' && score <= 100) return false;
      }

      // 3. Owner check
      if (filterOwner !== 'all') {
        if (filterOwner === 'unassigned' && row.ownerId !== null) return false;
        if (filterOwner !== 'unassigned' && row.ownerId !== filterOwner) return false;
      }

      // 4. Tag check
      if (filterTag !== 'all' && !row.tags.includes(filterTag)) return false;

      // 5. Country check
      if (filterCountry !== 'all' && row.countryName !== filterCountry) return false;

      // 6. Last Activity filter check
      if (filterLastActivity !== 'all') {
        const actTime = row.lastActivity ? new Date(row.lastActivity).getTime() : 0;
        const daysAgo = actTime ? (now - actTime) / dayInMs : Infinity;
        if (filterLastActivity === '1d' && daysAgo > 1) return false;
        if (filterLastActivity === '7d' && daysAgo > 7) return false;
        if (filterLastActivity === '30d' && daysAgo > 30) return false;
        if (filterLastActivity === '90d' && daysAgo > 90) return false;
      }

      // 7. Source filter check
      if (filterSource !== 'all') {
        const latestHist = latestHistoryMap.get(row.contactId);
        if (!latestHist || latestHist.source !== filterSource) return false;
      }

      return true;
    });
  }, [contactRows, searchTerm, filterScore, filterOwner, filterTag, filterCountry, filterLastActivity, filterSource, latestHistoryMap]);

  const totalRecords = filteredContactRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const paginatedContactRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContactRows.slice(start, start + pageSize);
  }, [filteredContactRows, currentPage, pageSize]);

  // Reset pagination on search
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterScore, filterOwner, filterTag, filterCountry, filterLastActivity, filterSource, pageSize]);

  // Dashboard calculations for metric cards
  const metrics = useMemo(() => {
    let vip = 0, hot = 0, warm = 0, cold = 0;
    contactRows.forEach(r => {
      if (r.status === 'VIP') vip++;
      else if (r.status === 'Hot') hot++;
      else if (r.status === 'Warm') warm++;
      else cold++;
    });
    return { total: contactRows.length, vip, hot, warm, cold };
  }, [contactRows]);

  // Selection Checkbox Helpers
  const isAllSelected = paginatedContactRows.length > 0 && paginatedContactRows.every(r => selectedRowIds.has(r.id));
  
  const handleToggleSelectAll = () => {
    const next = new Set(selectedRowIds);
    if (isAllSelected) {
      paginatedContactRows.forEach(r => next.delete(r.id));
    } else {
      paginatedContactRows.forEach(r => next.add(r.id));
    }
    setSelectedRowIds(next);
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRowIds(next);
  };

  // Convert selected contact row IDs into refs
  const selectedContactRefs = useMemo(() => {
    const refs: Array<{ entityId: string; contactId: string }> = [];
    selectedRowIds.forEach(rowId => {
      const match = contactRows.find(r => r.id === rowId);
      if (match) {
        refs.push({ entityId: match.entityId, contactId: match.contactId });
      }
    });
    return refs;
  }, [selectedRowIds, contactRows]);

  // Bulk Actions
  const handleBulkAdjustScores = async (op: 'add' | 'subtract' | 'reset') => {
    if (!activeWorkspaceId || selectedContactRefs.length === 0) return;
    setIsBulkExecuting(true);
    
    const valueNum = op === 'reset' ? 0 : Math.max(0, Number(bulkAdjustmentValue) || 0);

    try {
      const res = await bulkAdjustScoresAction({
        organizationId: activeWorkspace?.organizationId || '',
        workspaceId: activeWorkspaceId,
        contactRefs: selectedContactRefs,
        value: valueNum,
        operation: op,
        actorId: 'user-scoring-cleaner',
        actorType: 'User'
      });

      if (res.success) {
        toast({
          title: 'Bulk Action Successful',
          description: `Successfully adjusted score for ${selectedContactRefs.length} contacts.`
        });
        setSelectedRowIds(new Set());
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Bulk adjustment failed';
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: errorMsg
      });
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const handleBulkArchive = async () => {
    if (!activeWorkspaceId || selectedContactRefs.length === 0) return;
    setIsBulkExecuting(true);
    const entityIds = Array.from(new Set(selectedContactRefs.map(r => r.entityId)));

    try {
      const res = await bulkArchiveEntitiesAction(activeWorkspaceId, entityIds);
      if (res.success) {
        toast({
          title: 'Entities Archived',
          description: `Successfully soft-archived parent profile entities for ${entityIds.length} leads.`
        });
        setSelectedRowIds(new Set());
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Bulk archive failed';
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: errorMsg
      });
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!activeWorkspaceId || selectedContactRefs.length === 0) return;
    setIsBulkExecuting(true);
    const entityIds = Array.from(new Set(selectedContactRefs.map(r => r.entityId)));

    try {
      const res = await bulkDeleteEntitiesAction(activeWorkspaceId, entityIds);
      if (res.success) {
        toast({
          title: 'Entities Deleted',
          description: `Successfully removed workspace association for ${entityIds.length} leads.`
        });
        setSelectedRowIds(new Set());
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Bulk deletion failed';
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: errorMsg
      });
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!activeWorkspaceId || selectedContactRefs.length === 0) return;
    setIsBulkExecuting(true);
    const entityIds = Array.from(new Set(selectedContactRefs.map(r => r.entityId)));

    const selectedUser = users?.find(u => u.id === bulkAssignUserId);
    const assignUserId = selectedUser ? selectedUser.id : null;
    const assignUserName = selectedUser ? selectedUser.name : null;
    const assignUserEmail = selectedUser ? selectedUser.email : null;

    try {
      const res = await bulkAssignEntitiesAction(
        activeWorkspaceId,
        entityIds,
        assignUserId,
        assignUserName,
        assignUserEmail
      );
      if (res.success) {
        toast({
          title: 'Entities Assigned',
          description: `Reassigned ${entityIds.length} lead card owners.`
        });
        setSelectedRowIds(new Set());
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Bulk assign failed';
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: errorMsg
      });
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const handleExportCSV = () => {
    const listToExport = selectedRowIds.size > 0 
      ? filteredContactRows.filter(r => selectedRowIds.has(r.id)) 
      : filteredContactRows;

    if (listToExport.length === 0) return;

    const headers = ['Contact Name', 'Company Name', 'Email', 'Phone', 'Lead Score', 'Status', 'Owner', 'Last Activity', 'Created At'];
    const csvRows = listToExport.map(r => {
      return `"${r.contactName}","${r.companyName}","${r.contactEmail}","${r.contactPhone}","${r.leadScore}","${r.status}","${r.ownerName || 'Unassigned'}","${r.lastActivity}","${r.createdAt}"`;
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-scores-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Single adjustment click
  const handleApplySingleAdjustment = async () => {
    if (!selectedRow || !activeWorkspaceId) return;
    setIsAdjusting(true);

    const valNum = adjustOperation === 'reset' ? 0 : Math.max(0, Number(adjustValue) || 0);

    try {
      const res = await adjustLeadScoreAction({
        organizationId: activeWorkspace?.organizationId || '',
        workspaceId: activeWorkspaceId,
        entityId: selectedRow.entityId,
        contactEmailOrId: selectedRow.contactId,
        value: valNum,
        operation: adjustOperation,
        reason: `Manual score update (${adjustOperation}): ${reasonString(adjustOperation, valNum)}`,
        source: 'user',
        actorId: 'user-override-panel',
        actorType: 'User'
      });

      if (res.success) {
        toast({
          title: 'Score Updated',
          description: `Adjusted lead score for contact ${selectedRow.contactName}.`
        });
        setIsAdjustModalOpen(false);
        setSelectedRow(null);
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Override failed';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  const reasonString = (op: string, val: number) => {
    if (op === 'add') return `+${val} points`;
    if (op === 'subtract') return `-${val} points`;
    if (op === 'set') return `set to ${val}`;
    return 'reset score';
  };

  // settings rules helper triggers
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
    updated[index] = { ...updated[index], [key]: value };
    setLocalVerificationRules(updated);
  };

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
    updated[index] = { ...updated[index], [key]: value };
    setLocalPhoneVerificationRules(updated);
  };

  const addEngagementRule = () => {
    const currentKeys = Object.keys(localEngagementRules);
    const unusedCommon = COMMON_ENGAGEMENTS.find(c => !currentKeys.includes(c.value));
    const newKey = unusedCommon ? unusedCommon.value : `custom_engagement_${Date.now()}`;
    setLocalEngagementRules({ ...localEngagementRules, [newKey]: 5 });
  };
  const removeEngagementRule = (key: string) => {
    const updated = { ...localEngagementRules };
    delete updated[key];
    setLocalEngagementRules(updated);
  };
  const updateEngagementRule = (key: string, value: number) => {
    setLocalEngagementRules({ ...localEngagementRules, [key]: value });
  };
  const updateEngagementKey = (oldKey: string, newKey: string) => {
    if (!newKey || oldKey === newKey || Object.keys(localEngagementRules).includes(newKey)) return;
    const value = localEngagementRules[oldKey];
    const updated = { ...localEngagementRules };
    delete updated[oldKey];
    updated[newKey] = value;
    setLocalEngagementRules(updated);
  };

  const handleResetSettings = () => {
    setLocalVerificationRules([...DEFAULT_SCORING_SETTINGS.emailVerificationRules]);
    setLocalPhoneVerificationRules([...(DEFAULT_SCORING_SETTINGS.phoneVerificationRules || [])]);
    setLocalEngagementRules({ ...DEFAULT_SCORING_SETTINGS.engagementRules });
    toast({
      title: 'Settings Reset Locally',
      description: 'Click "Save Settings" to apply defaults.'
    });
  };

  const handleSaveSettings = async () => {
    if (!firestore || !activeWorkspaceId) return;
    setIsSettingsSaving(true);
    try {
      const workspaceRef = doc(firestore, 'workspaces', activeWorkspaceId);
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
        description: 'Auto-scoring settings updated successfully.'
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save';
      toast({ variant: 'destructive', title: 'Save Failed', description: errorMsg });
    } finally {
      setIsSettingsSaving(false);
    }
  };

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
      
      const lastEmailOpenedAt = we.entityContacts.find(c => c.isPrimary)?.emailStatus === 'valid'; // simple mock
      
      const hasBounced = we.entityContacts.some(c => c.emailStatus === 'bounced');
      const hasUnsubscribed = we.entityContacts.some(c => c.emailStatus === 'unsubscribed');
      const hasNoRole = we.entityContacts.some(c => c.isPrimary && !c.typeLabel && !c.typeKey);
      const hasNoPhone = !we.primaryPhone;
      const hasNoEmail = !we.primaryEmail;
      const hasUnverifiedEmail = we.entityContacts.some(c => c.isPrimary && c.emailVerificationScore === undefined);
      
      if (hygieneFilter === 'all') {
        matchesFilter = hasBounced || hasUnsubscribed || daysInactive > 30 || hasNoRole || hasNoPhone || hasNoEmail || hasUnverifiedEmail;
      } else if (hygieneFilter === 'bounced') {
        matchesFilter = hasBounced;
      } else if (hygieneFilter === 'unsubscribed') {
        matchesFilter = hasUnsubscribed;
      } else if (hygieneFilter === 'inactive_30') {
        matchesFilter = daysInactive > 30;
      } else if (hygieneFilter === 'no_role') {
        matchesFilter = hasNoRole;
      } else if (hygieneFilter === 'no_phone') {
        matchesFilter = hasNoPhone;
      } else if (hygieneFilter === 'no_email') {
        matchesFilter = hasNoEmail;
      } else if (hygieneFilter === 'unverified_email') {
        matchesFilter = hasUnverifiedEmail;
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
    const headers = ['Entity Name', 'Primary Email', 'Issues', 'Lead Score'];
    const csvRows = hygieneLeads.map(lead => {
      const hasBounced = lead.entityContacts.some(c => c.emailStatus === 'bounced');
      const hasUnsubscribed = lead.entityContacts.some(c => c.emailStatus === 'unsubscribed');
      const issues = [hasBounced ? 'Bounced' : '', hasUnsubscribed ? 'Unsubscribed' : ''].filter(Boolean).join(' & ');
      return `"${lead.displayName}","${lead.primaryEmail || ''}","${issues}","${lead.leadScore || 0}"`;
    });
    
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hygiene-export.csv`;
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
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Archive failed';
      toast({ variant: 'destructive', title: 'Error', description: errorMsg });
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
      toast({ title: 'Success', description: `Permanently deleted ${hygieneLeads.length} records.` });
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Delete failed';
      toast({ variant: 'destructive', title: 'Error', description: errorMsg });
    }
  };

  return (
    <PageContainerFluid>
      <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto py-6 animate-fade-in text-left">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary animate-pulse" /> Lead Scoring & Cleanup Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Evaluate contact scores, run bulk adjustments, soft-archive stale leads, and customize scoring conditions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleExportCSV}
              className="rounded-xl font-bold active:scale-[0.97]"
              disabled={isLoading || totalRecords === 0}
            >
              <Download className="h-4 w-4 mr-2" /> Export Scores
            </Button>
          </div>
        </div>

        {/* Dashboard KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md shadow-sm flex items-center justify-between px-5 py-4 gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Total Contacts</span>
            <span className="text-2xl font-black">{isLoading ? '...' : metrics.total}</span>
          </Card>
          <Card className="rounded-2xl border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md shadow-sm flex items-center justify-between px-5 py-4 gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">VIP Tiers</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{isLoading ? '...' : metrics.vip}</span>
          </Card>
          <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5 backdrop-blur-md shadow-sm flex items-center justify-between px-5 py-4 gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Hot Tiers</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{isLoading ? '...' : metrics.hot}</span>
          </Card>
          <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5 backdrop-blur-md shadow-sm flex items-center justify-between px-5 py-4 gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Warm Tiers</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{isLoading ? '...' : metrics.warm}</span>
          </Card>
          <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5 backdrop-blur-md shadow-sm flex items-center justify-between px-5 py-4 gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Cold Tiers</span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{isLoading ? '...' : metrics.cold}</span>
          </Card>
        </div>

        <Tabs defaultValue="leads" className="w-full">
          <TabsList className="bg-muted/40 p-1 rounded-xl w-full max-w-[540px] border">
            <TabsTrigger value="leads" className="rounded-lg text-xs font-bold flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Registry
            </TabsTrigger>
            <TabsTrigger value="hygiene" className="rounded-lg text-xs font-bold flex items-center gap-2 text-rose-500">
              <ShieldAlert className="h-3.5 w-3.5" /> Data Hygiene
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg text-xs font-bold flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5" /> Scoring Configurations
            </TabsTrigger>
          </TabsList>

          {/* Registry Tab */}
          <TabsContent value="leads" className="space-y-4 mt-4">
            {/* Filters panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3 bg-muted/20 border p-4 rounded-xl">
              {/* Search */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Search</span>
                <div className="relative h-9 w-full bg-background border rounded-lg px-2 flex items-center">
                  <Search className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                  <input
                    placeholder="Search name/company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-0 outline-none text-xs w-full font-medium"
                  />
                </div>
              </div>

              {/* Score Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Score Range</span>
                <Select value={filterScore} onValueChange={setFilterScore}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background border">
                    <SelectValue placeholder="All Scores" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all" className="text-xs">All Scores</SelectItem>
                    <SelectItem value="0-25" className="text-xs">0 - 25 (Cold)</SelectItem>
                    <SelectItem value="26-50" className="text-xs">26 - 50 (Warm)</SelectItem>
                    <SelectItem value="51-75" className="text-xs">51 - 75 (Hot)</SelectItem>
                    <SelectItem value="76-100" className="text-xs">76 - 100 (Hot)</SelectItem>
                    <SelectItem value="100+" className="text-xs">100+ (VIP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Owner Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Owner</span>
                <Select value={filterOwner} onValueChange={setFilterOwner}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background border">
                    <SelectValue placeholder="All Owners" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all" className="text-xs">All Owners</SelectItem>
                    <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                    {distinctOwners.map(o => (
                      <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tag Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Tag</span>
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background border">
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all" className="text-xs">All Tags</SelectItem>
                    {distinctTags.map(t => (
                      <SelectItem key={t} value={t} className="text-xs font-mono">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Country Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Country</span>
                <Select value={filterCountry} onValueChange={setFilterCountry}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background border">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all" className="text-xs">All Countries</SelectItem>
                    {distinctCountries.map(c => (
                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Last Activity Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Activity</span>
                <Select value={filterLastActivity} onValueChange={setFilterLastActivity}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background border">
                    <SelectValue placeholder="All Activity" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all" className="text-xs">All Activity</SelectItem>
                    <SelectItem value="1d" className="text-xs">Active within 24h</SelectItem>
                    <SelectItem value="7d" className="text-xs">Active within 7d</SelectItem>
                    <SelectItem value="30d" className="text-xs">Inactive &gt; 30d</SelectItem>
                    <SelectItem value="90d" className="text-xs">Inactive &gt; 90d</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source Filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Change Source</span>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background border">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all" className="text-xs">All Sources</SelectItem>
                    <SelectItem value="user" className="text-xs">Manual Updates</SelectItem>
                    <SelectItem value="automation" className="text-xs">Automations</SelectItem>
                    <SelectItem value="system" className="text-xs">System Triggers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bulk actions bar */}
            {selectedRowIds.size > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border-2 border-primary/30 bg-primary/5 animate-fade-in shadow-md">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-white rounded-lg font-bold text-xs shrink-0">{selectedRowIds.size} Selected</Badge>
                  <span className="text-xs font-semibold text-muted-foreground">Select bulk action:</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {/* Adjustment Point Input */}
                  <div className="flex items-center gap-1.5 border rounded-lg bg-background px-2 h-9 w-28">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Pts:</span>
                    <Input
                      type="number"
                      min="1"
                      value={bulkAdjustmentValue}
                      onChange={(e) => setBulkAdjustmentValue(e.target.value)}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-full text-xs font-mono font-bold text-center w-12"
                    />
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => handleBulkAdjustScores('add')}
                    disabled={isBulkExecuting}
                    size="sm"
                    className="h-9 rounded-lg font-bold hover:bg-emerald-500/10 hover:text-emerald-600 text-xs active:scale-[0.97]"
                  >
                    Increase (+)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleBulkAdjustScores('subtract')}
                    disabled={isBulkExecuting}
                    size="sm"
                    className="h-9 rounded-lg font-bold hover:bg-rose-500/10 hover:text-rose-600 text-xs active:scale-[0.97]"
                  >
                    Decrease (-)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleBulkAdjustScores('reset')}
                    disabled={isBulkExecuting}
                    size="sm"
                    className="h-9 rounded-lg font-bold text-rose-500 hover:bg-rose-500/10 text-xs active:scale-[0.97]"
                  >
                    Reset Scores
                  </Button>

                  {/* Assignee select */}
                  <div className="flex items-center gap-1.5 border rounded-lg bg-background px-2 h-9">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Owner:</span>
                    <Select value={bulkAssignUserId} onValueChange={setBulkAssignUserId}>
                      <SelectTrigger className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-full text-xs py-0 pl-1 pr-6 font-bold bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {users?.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleBulkAssign}
                    disabled={isBulkExecuting}
                    size="sm"
                    className="h-9 rounded-lg font-bold text-xs active:scale-[0.97]"
                  >
                    Assign Owner
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleBulkArchive}
                    disabled={isBulkExecuting}
                    size="sm"
                    className="h-9 rounded-lg font-bold text-rose-500 hover:bg-rose-500/10 text-xs active:scale-[0.97]"
                  >
                    Archive Leads
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleBulkDelete}
                    disabled={isBulkExecuting}
                    size="sm"
                    className="h-9 rounded-lg font-bold text-rose-600 hover:bg-rose-600/10 text-xs active:scale-[0.97]"
                  >
                    Delete Leads
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            <Card className="rounded-2xl border-border/40 bg-card/35 backdrop-blur-md overflow-hidden">
              {filteredContactRows.length > 0 && (
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
                    <TableHead className="w-12 text-center py-4">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Contact</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Company</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Score</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Owner</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Last Activity</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Last Score Change</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider w-[120px] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-xs font-semibold text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Fetching cleanup registry contacts...
                      </TableCell>
                    </TableRow>
                  ) : filteredContactRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-xs font-semibold text-muted-foreground">
                        No contacts found matching your filter parameters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedContactRows.map((row) => {
                      const isSelected = selectedRowIds.has(row.id);
                      const latestHist = latestHistoryMap.get(row.contactId);
                      
                      return (
                        <TableRow key={row.id} className="hover:bg-muted/5 group border-b border-border/30">
                          <TableCell className="text-center py-3.5">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelectRow(row.id)}
                              aria-label={`Select contact ${row.contactName}`}
                            />
                          </TableCell>
                          <TableCell className="font-bold text-xs text-foreground py-3.5">
                            <div className="flex flex-col">
                              <span className="font-extrabold">{row.contactName}</span>
                              <span className="text-[10px] text-muted-foreground font-medium">{row.contactEmail || 'No email'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-muted-foreground">
                            {row.companyName}
                          </TableCell>
                          <TableCell className="text-sm font-black text-center text-foreground font-mono">
                            {row.leadScore}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={`
                                rounded-full border-none font-bold text-[9px] tracking-wide uppercase px-2 py-0.5
                                ${row.status === 'VIP' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                                  row.status === 'Hot' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 
                                  row.status === 'Warm' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 
                                  'bg-rose-500/10 text-rose-600 dark:text-rose-400'}
                              `}
                            >
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-bold">
                            {row.ownerName || <span className="text-muted-foreground/40 italic font-medium">Unassigned</span>}
                          </TableCell>
                          <TableCell className="text-xs text-center font-medium text-muted-foreground font-mono">
                            {row.lastActivity ? new Date(row.lastActivity).toLocaleDateString() : 'Never'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {latestHist ? (
                              <div className="flex flex-col">
                                <span className={`font-mono font-bold ${latestHist.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {latestHist.change >= 0 ? `+${latestHist.change}` : latestHist.change} Pts
                                </span>
                                <span className="text-[9px] text-muted-foreground capitalize font-medium">{latestHist.source} - {latestHist.reason}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30 italic">None logged</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRow(row);
                                setAdjustOperation('add');
                                setAdjustValue('10');
                                setIsAdjustModalOpen(true);
                              }}
                              className="h-8 rounded-lg text-xs font-bold hover:bg-muted active:scale-[0.97]"
                            >
                              Override
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {filteredContactRows.length > 0 && (
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

          {/* Hygiene Tab */}
          <TabsContent value="hygiene" className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border bg-muted/10">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={hygieneFilter} onValueChange={setHygieneFilter}>
                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all" className="text-xs">All Issues</SelectItem>
                    <SelectItem value="bounced" className="text-xs text-rose-500">Bounced Emails</SelectItem>
                    <SelectItem value="unsubscribed" className="text-xs text-amber-500">Unsubscribed Contacts</SelectItem>
                    <SelectItem value="inactive_30" className="text-xs">Inactive &gt; 30 Days</SelectItem>
                    <SelectItem value="no_role" className="text-xs">No Contact Role</SelectItem>
                    <SelectItem value="no_phone" className="text-xs">No Phone Number</SelectItem>
                    <SelectItem value="no_email" className="text-xs">No Email Address</SelectItem>
                    <SelectItem value="unverified_email" className="text-xs">Unverified Email Address</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="relative h-9 w-60 bg-background border rounded-lg px-2 flex items-center">
                  <Search className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                  <input
                    placeholder="Search name/email..."
                    value={hygieneSearchTerm}
                    onChange={(e) => setHygieneSearchTerm(e.target.value)}
                    className="bg-transparent border-0 outline-none text-xs w-full font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportHygieneCSV} className="h-9 rounded-lg font-bold text-xs active:scale-[0.97]">
                  <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsBulkHygieneArchiveOpen(true)} className="h-9 rounded-lg font-bold text-xs text-rose-500 hover:bg-rose-500/5 active:scale-[0.97]" disabled={hygieneLeads.length === 0}>
                  <Archive className="h-3.5 w-3.5 mr-1" /> Archive All
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsBulkHygieneDeleteOpen(true)} className="h-9 rounded-lg font-bold text-xs text-rose-600 hover:bg-rose-600/5 active:scale-[0.97]" disabled={hygieneLeads.length === 0}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete All
                </Button>
              </div>
            </div>

            <Card className="rounded-2xl border-border/40 bg-card/35 backdrop-blur-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/15">
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Company Name</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Primary Email</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Score</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Issues Identified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-xs font-semibold text-muted-foreground">
                        Aggregating hygiene metrics...
                      </TableCell>
                    </TableRow>
                  ) : hygieneLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-xs font-semibold text-emerald-500">
                        <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-emerald-500 animate-bounce" />
                        Lead directory is clean! No hygiene alerts detected.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedHygieneLeads.map((lead) => {
                      const score = lead.leadScore || 0;
                      
                      const hasBounced = lead.entityContacts.some(c => c.emailStatus === 'bounced');
                      const hasUnsubscribed = lead.entityContacts.some(c => c.emailStatus === 'unsubscribed');
                      const hasNoRole = lead.entityContacts.some(c => c.isPrimary && !c.typeLabel && !c.typeKey);
                      const hasNoPhone = !lead.primaryPhone;
                      const hasNoEmail = !lead.primaryEmail;
                      
                      const issues = [
                        hasBounced ? 'Bounced Email' : '',
                        hasUnsubscribed ? 'Unsubscribed' : '',
                        hasNoRole ? 'Missing Job Title' : '',
                        hasNoPhone ? 'No Phone' : '',
                        hasNoEmail ? 'No Email' : ''
                      ].filter(Boolean);

                      return (
                        <TableRow key={lead.id} className="hover:bg-muted/5 border-b border-border/30 last:border-none">
                          <TableCell className="font-bold text-xs text-foreground py-3.5">{lead.displayName}</TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">{lead.primaryEmail || 'No Email'}</TableCell>
                          <TableCell className="text-xs font-black text-center text-foreground font-mono">{score}</TableCell>
                          <TableCell className="py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {issues.map((iss, i) => (
                                <Badge key={i} variant="outline" className="text-[8px] font-bold uppercase rounded-lg border-rose-500/20 text-rose-500 bg-rose-500/5">
                                  {iss}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6 mt-4">
            <Card className="rounded-2xl border-border/40 bg-card/35 backdrop-blur-md">
              <CardHeader className="border-b border-border/30 py-4">
                <div className="flex items-center justify-between w-full">
                  <div className="space-y-1 text-left">
                    <CardTitle className="text-base font-extrabold flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-primary" /> Auto-Scoring Mapping Rules
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Set system parameters to automatically adjust scores when integrations detect verification or client events.
                    </CardDescription>
                  </div>
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
                {/* Email verification mapping */}
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

                {/* Phone verification mapping */}
                <div className="space-y-4 border-t border-border/40 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 text-left">
                      <Label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-primary" /> Phone Verification Score Mapping
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Award points once a phone number passes background verification.
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

                {/* Engagement mapping */}
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Override Modal */}
        <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
          <DialogContent className="rounded-2xl max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold">Override Lead Score</DialogTitle>
              <DialogDescription className="text-xs font-semibold text-muted-foreground">
                Set manual adjustments for contact <span className="text-foreground font-bold">{selectedRow?.contactName}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Adjustment Type</Label>
                <Select value={adjustOperation} onValueChange={(v: any) => setAdjustOperation(v)}>
                  <SelectTrigger className="h-9 text-xs rounded-lg font-semibold bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="add" className="text-xs">Add Points (+)</SelectItem>
                    <SelectItem value="subtract" className="text-xs">Subtract Points (-)</SelectItem>
                    <SelectItem value="set" className="text-xs">Set Score Value (=)</SelectItem>
                    <SelectItem value="reset" className="text-xs text-rose-500">Reset Score to 0</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {adjustOperation !== 'reset' && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Points Weight</Label>
                  <Input
                    type="number"
                    min="1"
                    value={adjustValue}
                    onChange={(e) => setAdjustValue(e.target.value)}
                    className="h-9 rounded-lg font-mono text-xs text-center font-bold"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button variant="ghost" onClick={() => setIsAdjustModalOpen(false)} className="h-9 rounded-lg text-xs font-bold active:scale-[0.97]">Cancel</Button>
              <Button onClick={handleApplySingleAdjustment} disabled={isAdjusting} className="h-9 rounded-lg text-xs font-bold active:scale-[0.97]">
                {isAdjusting ? 'Saving Override...' : 'Apply Adjustment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hygiene Archive Confirm */}
        <Dialog open={isBulkHygieneArchiveOpen} onOpenChange={setIsBulkHygieneArchiveOpen}>
          <DialogContent className="rounded-2xl max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-rose-500 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Bulk Archive Warning
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                You are about to soft-archive <span className="font-bold text-foreground">{hygieneLeads.length}</span> stale prospects with identified data hygiene issues. This cannot be easily reversed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setIsBulkHygieneArchiveOpen(false)} className="h-9 rounded-lg text-xs font-bold active:scale-[0.97]">Cancel</Button>
              <Button onClick={handleBulkArchiveHygiene} className="h-9 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white active:scale-[0.97]">Archive All</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hygiene Delete Confirm */}
        <Dialog open={isBulkHygieneDeleteOpen} onOpenChange={setIsBulkHygieneDeleteOpen}>
          <DialogContent className="rounded-2xl max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-rose-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Permanent Delete Warning
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground animate-pulse">
                You are about to permanently delete <span className="font-bold text-foreground">{hygieneLeads.length}</span> leads from this workspace. This action is irreversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setIsBulkHygieneDeleteOpen(false)} className="h-9 rounded-lg text-xs font-bold active:scale-[0.97]">Cancel</Button>
              <Button onClick={handleBulkDeleteHygiene} className="h-9 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white active:scale-[0.97]">Permanently Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainerFluid>
  );
}
