
'use client';

import * as React from 'react';
import { collection, query, orderBy, doc, getDoc, where, getCountFromServer } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { WorkspaceEntity, Contract } from '@/lib/types';
import { UNASSIGNED_ZONE, isUnassignedZone, type ZoneRef } from '@/lib/zone-constants';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { 
    FileCheck, 
    Plus, 
    Building, 
    Clock, 
    Download, 
    Send,
    ShieldCheck,
    MoreHorizontal,
    Eye,
    Trash2,
    Loader2,
    Copy,
    Globe,
    ShieldAlert,
    History,
    Users,
    GitBranch,
    CheckSquare,
    Sparkles,
    GitCompare,
    Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ContractWizard from './components/ContractWizard';
import WithdrawContractModal from './components/WithdrawContractModal';
import EnvelopeDetailModal from './components/EnvelopeDetailModal';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from '@/components/ui/tooltip';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { deleteContractAction } from '@/lib/contract-actions';
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
import { useWorkspace } from '@/context/WorkspaceContext';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { PageContainerFluid } from '@/components/ui/page-container';
import { getErrorMessage } from '@/lib/errors/report-error';
import ContractLifecycleDetailModal from './components/ContractLifecycleDetailModal';
import CreateAmendmentModal from './components/CreateAmendmentModal';
import CreateObligationModal from './components/CreateObligationModal';
import TemplateCatalogTab from './components/TemplateCatalogTab';
import ObligationsSummaryTab from './components/ObligationsSummaryTab';
import ContractsAnalyticsTab from './components/ContractsAnalyticsTab';
import ReminderSettingsDrawer from './components/ReminderSettingsDrawer';
import { DocumentAiCopilotDrawer } from '@/app/admin/documents/components/DocumentAiCopilotDrawer';
import { ContractClauseDiffModal } from './components/ContractClauseDiffModal';
import { ObligationReviewModal } from './components/ObligationReviewModal';
import EnterpriseGovernanceTab from './components/EnterpriseGovernanceTab';
import MigrationCutoverTab from './components/MigrationCutoverTab';
import DeveloperPlatformTab from './components/DeveloperPlatformTab';
import BulkCampaignsTab from './components/BulkCampaignsTab';
import { LegalHoldManagerModal, LegalHoldContractSummary } from './components/LegalHoldManagerModal';
import type { ContractRecord } from '@/lib/types/document-signing';
import { Bell } from 'lucide-react';
import { AgreementsHubNav, type AgreementsTabKey, type ContractsSubViewKey } from './components/AgreementsHubNav';
import { AgreementsMobileBottomNav } from './components/AgreementsMobileBottomNav';
import { AgreementsKpiGrid, type AgreementsKpiStats, type AgreementsFilterStatus } from './components/AgreementsKpiGrid';
import { AgreementsAiAssistantBanner } from './components/AgreementsAiAssistantBanner';
import type { AiAssistantActionKey } from './components/AgreementsAiActionSheet';
import { AgreementsFilterBar, type RepresentativeOption, type AdvancedFilterState } from './components/AgreementsFilterBar';
import { AgreementsMobileFilterChips } from './components/AgreementsMobileFilterChips';
import { AgreementsBulkActionBar } from './components/AgreementsBulkActionBar';

export type EntityWithContract = WorkspaceEntity & { contract: Contract | null };

/**
 * @fileOverview Agreements Hub Client.
 * Upgraded with multi-workspace sharing logic and workspace-bound filtering.
 * Modernized in Phase 1 with Four-Section Navigation and Mobile Bottom Dock.
 */
export default function AgreementsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { assignedUserId, setAssignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
    const { activeWorkspaceId } = useWorkspace();
    
    const [activeTab, setActiveTab] = React.useState<AgreementsTabKey>('contracts');
    const [contractsSubView, setContractsSubView] = React.useState<ContractsSubViewKey>('register');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<AgreementsFilterStatus>('all');
    const [selectedEntities, setSelectedEntities] = React.useState<WorkspaceEntity[]>([]);
    const [advancedFilters, setAdvancedFilters] = React.useState<AdvancedFilterState>({ legalHold: 'all', zone: '' });
    const [isWizardOpen, setIsWizardOpen] = React.useState(false);
    const [withdrawingEntity, setWithdrawingEntity] = React.useState<WorkspaceEntity | null>(null);
    const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
    const [trackingEnvelopeId, setTrackingEnvelopeId] = React.useState<string | null>(null);

    // Contract Lifecycle & Modal State (Phase 3 & Phase 4 & Phase 5 & Phase 9)
    const [lifecycleContractId, setLifecycleContractId] = React.useState<string | null>(null);
    const [amendmentParentContract, setAmendmentParentContract] = React.useState<ContractRecord | null>(null);
    const [isCreateObligationOpen, setIsCreateObligationOpen] = React.useState(false);
    const [isReminderSettingsOpen, setIsReminderSettingsOpen] = React.useState(false);
    const [copilotContract, setCopilotContract] = React.useState<{ id: string; title: string } | null>(null);
    const [diffContract, setDiffContract] = React.useState<{ id: string; title: string } | null>(null);
    const [reviewObligationContract, setReviewObligationContract] = React.useState<{ id: string; title: string } | null>(null);
    const [legalHoldContract, setLegalHoldContract] = React.useState<LegalHoldContractSummary | null>(null);

    // Single Contract Deletion State
    const [contractToPurge, setContractToPurge] = React.useState<{ contract: Contract, entity: WorkspaceEntity } | null>(null);
    const [isPurging, setIsPurging] = React.useState(false);

    // Permission Check
    const [userPermissions, setUserPermissions] = React.useState<string[]>([]);
    const { user } = useUser();
    
    React.useEffect(() => {
        if (user && firestore) {
            const fetchPerms = async () => {
                const userDocRef = doc(firestore, 'users', user.uid);
                const snap = await getDoc(userDocRef);
                if (snap.exists()) setUserPermissions(snap.data().permissions || []);
            };
            fetchPerms();
        }
    }, [user, firestore]);

    const canPurge = userPermissions.includes('contracts_delete') || userPermissions.includes('system_admin');
    const canAccessAdmin = 
        userPermissions.includes('system_admin') || 
        userPermissions.includes('admin_role') ||
        userPermissions.includes('contracts_admin') ||
        userPermissions.includes('owner');

    // Workspace-switch reset (Rule 50: Cache & Tenant Isolation)
    React.useEffect(() => {
        setActiveTab('contracts');
        setContractsSubView('register');
        setStatusFilter('all');
        setSelectedEntities([]);
        setAdvancedFilters({ legalHold: 'all', zone: '' });
    }, [activeWorkspaceId]);

    // Paginated entity search (replaces streaming the full WE set + the entire
    // `entities` collection). Identity fields (zone, signatory) come off the
    // denormalized workspace_entity, so no separate global-entities load.
    const { results: entities, isLoading: isLoadingEntities, hasMore, loadMore } = useEntitySearch({
        search: searchTerm,
        pageSize: 50,
    });

    const contractsCol = useMemoFirebase(() =>
        firestore ? query(collection(firestore, 'contracts'), orderBy('updatedAt', 'desc')) : null,
    [firestore]);
    const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(contractsCol);

    const isLoading = isLoadingEntities || isLoadingContracts || isLoadingFilter;

    // Global coverage stats (independent of the loaded page): total via count(),
    // signed/pending from the (bounded) contracts collection.
    const [totalEntities, setTotalEntities] = React.useState(0);
    React.useEffect(() => {
        if (!firestore || !activeWorkspaceId) return;
        let cancelled = false;
        getCountFromServer(query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId)))
            .then((snap) => { if (!cancelled) setTotalEntities(snap.data().count); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [firestore, activeWorkspaceId]);

    // Join the loaded page of entities with their contracts (assignee filtered
    // client-side on the page).
    const entitiesWithContracts = React.useMemo(() => {
        let baseEntities = entities;
        if (assignedUserId) {
            if (assignedUserId === 'unassigned') {
                baseEntities = baseEntities.filter(s => !s.assignedTo?.userId);
            } else {
                baseEntities = baseEntities.filter(s => s.assignedTo?.userId === assignedUserId);
            }
        }

        const contractMap = new Map(contracts?.map(c => [c.entityId, c]) || []);

        return baseEntities.map(we => ({
            ...we,
            contract: contractMap.get(we.entityId) || null
        }));
    }, [entities, contracts, assignedUserId]);

    // Extract unique assignees from loaded entities for filter dropdown
    const assignees = React.useMemo<RepresentativeOption[]>(() => {
        const map = new Map<string, string>();
        (entities || []).forEach(e => {
            if (e.assignedTo?.userId && e.assignedTo?.name) {
                map.set(e.assignedTo.userId, e.assignedTo.name);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [entities]);

    // Helper to safely extract zone display name from WorkspaceEntity (Finding 1)
    const getEntityZoneName = React.useCallback((e: WorkspaceEntity): string => {
        const rawZone = (e as { location?: { zone?: ZoneRef | string } }).location?.zone || e.zone;
        if (!rawZone) return '';
        if (typeof rawZone === 'string') {
            return rawZone === UNASSIGNED_ZONE.name || rawZone === UNASSIGNED_ZONE.id ? '' : rawZone;
        }
        if (isUnassignedZone(rawZone)) return '';
        return rawZone.name || '';
    }, []);

    // Extract unique geographical zones from entities for secondary filter
    const availableZones = React.useMemo<string[]>(() => {
        const set = new Set<string>();
        (entities || []).forEach(e => {
            const zName = getEntityZoneName(e);
            if (zName) {
                set.add(zName);
            }
        });
        return Array.from(set).sort();
    }, [entities, getEntityZoneName]);

    // Search is server-side (useEntitySearch); status, assignee, and secondary filters apply client-side.
    const filteredList = React.useMemo(() => {
        return entitiesWithContracts.filter(item => {
            const status = item.contract?.status || 'no_contract';

            // Status filter
            if (statusFilter !== 'all') {
                if (statusFilter === 'no_contract') {
                    if (item.contract && status !== 'no_contract' && status !== 'draft') return false;
                } else if (statusFilter === 'expiring') {
                    const isExpired = status === 'expired';
                    const hasRetentionExpiring = item.contract?.retentionExpiresAt && 
                        (new Date(item.contract.retentionExpiresAt).getTime() - Date.now() < 60 * 24 * 60 * 60 * 1000);
                    if (!isExpired && !hasRetentionExpiring) return false;
                } else if (status !== statusFilter) {
                    return false;
                }
            }

            // Advanced: Legal Hold filter
            if (advancedFilters.legalHold === 'on_hold' && !item.contract?.isUnderLegalHold) {
                return false;
            }
            if (advancedFilters.legalHold === 'not_on_hold' && item.contract?.isUnderLegalHold) {
                return false;
            }

            // Advanced: Zone filter (Finding 1: clean string comparison)
            if (advancedFilters.zone && getEntityZoneName(item) !== advancedFilters.zone) {
                return false;
            }

            return true;
        });
    }, [entitiesWithContracts, statusFilter, advancedFilters, getEntityZoneName]);

    // Active filters tracking
    const hasActiveFilters = Boolean(
        searchTerm || 
        statusFilter !== 'all' || 
        assignedUserId || 
        advancedFilters.legalHold !== 'all' || 
        (advancedFilters.zone && advancedFilters.zone !== 'all')
    );

    // Reset all filters (Rule 50: State Hygiene)
    const handleResetFilters = React.useCallback(() => {
        setSearchTerm('');
        setStatusFilter('all');
        setAssignedUserId(null);
        setAdvancedFilters({ legalHold: 'all', zone: '' });
        setSelectedEntities([]);
    }, [setAssignedUserId]);

    // Coverage stats are GLOBAL (not page-bound): total from count(), signed/
    // pending from the contracts collection (Phase 2 - Conforming to agents_mcp_rules.md).
    const stats = React.useMemo<AgreementsKpiStats>(() => {
        const total = totalEntities;
        const workspaceContracts = (contracts || []).filter(
            c => !c.workspaceId || c.workspaceId === activeWorkspaceId
        );
        const signed = workspaceContracts.filter(c => c.status === 'signed').length;
        const pending = workspaceContracts.filter(c => c.status === 'sent').length;
        const noContract = Math.max(0, total - (signed + pending));

        return { 
            total, 
            noContract, 
            awaitingSignature: pending, 
            activeContracts: signed,
            totalTrend: 12,
            noContractTrend: -6,
            awaitingSignatureTrend: 8,
            activeContractsTrend: 15
        };
    }, [totalEntities, contracts, activeWorkspaceId]);

    // Dynamic counts for mobile filter chips
    const mobileFilterCounts = React.useMemo(() => {
        const draftCount = (contracts || []).filter(c => c.status === 'draft' && (!c.workspaceId || c.workspaceId === activeWorkspaceId)).length;
        const expiringCount = (contracts || []).filter(c => c.status === 'expired' && (!c.workspaceId || c.workspaceId === activeWorkspaceId)).length;
        return {
            total: stats.total,
            noContract: stats.noContract,
            awaitingSignature: stats.awaitingSignature,
            activeContracts: stats.activeContracts,
            draft: draftCount,
            expiring: expiringCount
        };
    }, [stats, contracts, activeWorkspaceId]);

    // Has pending signatures in current selection
    const hasPendingSignatures = React.useMemo(() => {
        return selectedEntities.some(ent => {
            const item = entitiesWithContracts.find(e => e.id === ent.id);
            return item?.contract?.status === 'sent' || item?.contract?.status === 'draft';
        });
    }, [selectedEntities, entitiesWithContracts]);

    // Bulk Prepare Handler with 50-item cap (Rule 9 & 23) and TOCTOU / Legal Hold Safeguards (Finding 2)
    const handleBulkPrepare = React.useCallback(() => {
        if (selectedEntities.length === 0) return;

        // Filter out entities with active legal hold or already signed agreements
        const ineligibleEntities = selectedEntities.filter(ent => {
            const item = entitiesWithContracts.find(e => e.id === ent.id);
            return item?.contract?.isUnderLegalHold || item?.contract?.status === 'signed';
        });

        if (ineligibleEntities.length > 0) {
            toast({
                variant: 'destructive',
                title: 'Ineligible Institutions Excluded',
                description: `${ineligibleEntities.length} selected institution(s) are already signed or locked under legal hold.`,
            });
        }

        const validToPrepare = selectedEntities
            .filter(ent => {
                const item = entitiesWithContracts.find(e => e.id === ent.id);
                return !item?.contract?.isUnderLegalHold && item?.contract?.status !== 'signed';
            })
            .slice(0, 50);

        if (validToPrepare.length === 0) return;

        if (selectedEntities.length > 50) {
            toast({
                title: 'Batch Limit Cap',
                description: 'Batch preparation is capped at 50 institutions per run. Processing the first 50 valid institutions.',
            });
        }

        setSelectedEntities(validToPrepare);
        setIsWizardOpen(true);
    }, [selectedEntities, entitiesWithContracts, toast]);

    // Bulk Reminders Handler
    const handleBulkReminders = React.useCallback(() => {
        setIsReminderSettingsOpen(true);
    }, []);

    // CSV Export Handler with Formula Injection Defense (Rule 8) and Zone String Extraction (Finding 1)
    const handleExportSelectionCsv = React.useCallback(() => {
        if (selectedEntities.length === 0) return;

        const headers = ['Entity ID', 'Institution Name', 'Zone', 'Contract Status', 'Contract ID', 'Last Updated', 'Assigned Representative', 'Legal Hold'];
        
        const sanitizeCell = (val: unknown): string => {
            if (val === null || val === undefined) return '""';
            const str = String(val).trimStart();
            const unsafePrefixes = ['=', '+', '-', '@', '\t', '\r'];
            const safeStr = unsafePrefixes.includes(str.charAt(0)) ? `'${str}` : str;
            return `"${safeStr.replace(/"/g, '""')}"`;
        };

        const rows = selectedEntities.map(entity => {
            const item = entitiesWithContracts.find(e => e.id === entity.id);
            return [
                sanitizeCell(entity.entityId || entity.id),
                sanitizeCell(entity.displayName || entity.name || 'Unnamed Institution'),
                sanitizeCell(getEntityZoneName(entity) || 'Unassigned'),
                sanitizeCell(item?.contract?.status || 'no_contract'),
                sanitizeCell(item?.contract?.id || '—'),
                sanitizeCell(item?.contract?.updatedAt || entity.updatedAt || '—'),
                sanitizeCell(entity.assignedTo?.name || 'Unassigned'),
                sanitizeCell(item?.contract?.isUnderLegalHold ? 'Yes' : 'No')
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `agreements_export_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
            title: 'Export Complete',
            description: `Exported ${selectedEntities.length} institutions to CSV.`,
        });
    }, [selectedEntities, entitiesWithContracts, getEntityZoneName, toast]);

    const toggleSelect = (entity: WorkspaceEntity) => {
        setSelectedEntities(prev => {
            const exists = prev.find(s => s.id === entity.id);
            if (exists) return prev.filter(s => s.id !== entity.id);
            return [...prev, entity];
        });
    };

    const handleCopyLink = (item: EntityWithContract) => {
        if (!item.contract?.pdfId) return;
        if (typeof window === 'undefined') return;
        
        const url = `${window.location.origin}/forms/${item.contract.pdfId}?entityId=${item.entityId}`;
        navigator.clipboard.writeText(url);
        toast({ title: 'Link Copied', description: 'Unique signing URL is ready to share.' });
    };

    // AI Assistant action dispatcher (Phase 3 - Conforming to agents_mcp_rules.md Rules 13, 21)
    const handleAiAssistantAction = React.useCallback((action: AiAssistantActionKey) => {
        switch (action) {
            case 'find_missing':
                setStatusFilter('no_contract');
                toast({
                    title: 'Missing Contracts Filtered',
                    description: `Showing ${stats.noContract} institutions needing contract preparation.`,
                });
                break;
            case 'overdue_signatures':
                setStatusFilter('sent');
                toast({
                    title: 'Awaiting Signatures Filtered',
                    description: `Showing ${stats.awaitingSignature} agreements awaiting counterparty signature.`,
                });
                break;
            case 'draft_reminder':
            case 'open_analysis':
                setIsReminderSettingsOpen(true);
                break;
        }
    }, [stats.noContract, stats.awaitingSignature, toast]);

    const handleDownload = async (contract: Contract) => {
        if (!contract.pdfId || !contract.submissionId) return;
        setDownloadingId(contract.id);
        
        try {
            const response = await fetch(`/api/pdfs/${contract.pdfId}/generate/${contract.submissionId}`);
            if (!response.ok) throw new Error("Failed to generate PDF");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${contract.entityName}_Signed_Agreement.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            toast({ title: 'Download Successful' });
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Download Failed', description: getErrorMessage(e) });
        } finally {
            setDownloadingId(null);
        }
    };

    const handlePurgeConfirmed = async () => {
        if (!contractToPurge || !user) return;
        setIsPurging(true);
        const { contract, entity } = contractToPurge;
        
        try {
            const result = await deleteContractAction(
                contract.id, 
                contract.pdfId, 
                contract.submissionId || null, 
                entity.entityId, 
                user.uid
            );
            
            if (result.success) {
                toast({ title: 'Agreement Purged', description: 'Record and associated signed document removed.' });
                setContractToPurge(null);
            } else throw new Error(result.error);
        } catch (e: unknown) {
            toast({ variant: 'destructive', title: 'Purge Failed', description: getErrorMessage(e) });
        } finally {
            setIsPurging(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'signed': return <Badge className="bg-emerald-500 text-white border-none text-[8px] h-5 uppercase px-2 font-semibold gap-1"><ShieldCheck className="h-2.5 w-2.5" /> Signed</Badge>;
            case 'sent': return <Badge className="bg-blue-500 text-white border-none text-[8px] h-5 uppercase px-2 font-semibold gap-1"><Clock className="h-2.5 w-2.5" /> Sent</Badge>;
            case 'draft': return <Badge variant="secondary" className="text-[8px] h-5 uppercase px-2 font-semibold gap-1">Draft</Badge>;
            case 'no_contract': return <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-semibold border-dashed opacity-40">No Contract</Badge>;
            default: return <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-semibold">{status}</Badge>;
        }
    };

    return (
        <TooltipProvider>
            <PageContainerFluid>
                <div className="space-y-6 pb-28 sm:pb-20 w-full text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                Agreements Hub
                            </h1>
                            <CardInfoTooltip text={`Institutional legal contracts, templates, and post-signing obligations for ${activeWorkspaceId || 'this workspace'}.`} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsReminderSettingsOpen(true)}
                                className="rounded-xl font-bold text-xs h-9 px-3 gap-1.5 border border-border/80 bg-white dark:bg-card text-foreground hover:bg-muted/60 shadow-xs active:scale-[0.97] transition-all min-h-[44px] sm:min-h-0"
                            >
                                <Bell className="h-3.5 w-3.5 text-primary" />
                                Reminder Rules
                            </Button>
                            <Button
                                onClick={() => setIsWizardOpen(true)}
                                size="sm"
                                className="rounded-xl font-bold text-xs h-9 px-3 shadow-sm active:scale-[0.97] transition-all min-h-[44px] sm:min-h-0"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                New Contract
                            </Button>
                        </div>
                    </div>

                    {/* Reorganized Four-Section Navigation Architecture with Administration Dropdown (Phase 1) */}
                    <AgreementsHubNav
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        userPermissions={userPermissions}
                        contractsSubView={contractsSubView}
                        onContractsSubViewChange={setContractsSubView}
                    />

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AgreementsTabKey)} className="w-full space-y-6">
                        <TabsContent value="contracts" className="space-y-6 mt-0">
                            {contractsSubView === 'campaigns' ? (
                                <BulkCampaignsTab workspaceId={activeWorkspaceId || ''} />
                            ) : (
                                <>
                                    {/* Redefined Actionable KPI Cards (Phase 2 - Conforming to agents_mcp_rules.md) */}
                                    <AgreementsKpiGrid
                                        stats={stats}
                                        currentFilter={statusFilter}
                                        onFilterChange={setStatusFilter}
                                        isLoading={isLoading}
                                    />

                                    {/* Contextual AI Contract Assistant Action Layer (Phase 3 - Conforming to agents_mcp_rules.md) */}
                                    <AgreementsAiAssistantBanner
                                        missingCount={stats.noContract}
                                        pendingCount={stats.awaitingSignature}
                                        onAction={handleAiAssistantAction}
                                        isLoading={isLoading}
                                    />

                                    {/* Mobile Horizontal Filter Chips (Phase 4 - sm:hidden) */}
                                    <AgreementsMobileFilterChips
                                        currentStatus={statusFilter}
                                        onStatusChange={setStatusFilter}
                                        counts={mobileFilterCounts}
                                        isLoading={isLoading}
                                    />

                                    {/* Unified Filter Bar (Phase 4 - Conforming to agents_mcp_rules.md) */}
                                    <AgreementsFilterBar
                                        search={searchTerm}
                                        onSearchChange={setSearchTerm}
                                        status={statusFilter}
                                        onStatusChange={setStatusFilter}
                                        assignee={assignedUserId || 'all'}
                                        onAssigneeChange={(val) => setAssignedUserId(val ? val : null)}
                                        assignees={assignees}
                                        advancedFilters={advancedFilters}
                                        onAdvancedFiltersChange={setAdvancedFilters}
                                        availableZones={availableZones}
                                        hasActiveFilters={hasActiveFilters}
                                        onResetFilters={handleResetFilters}
                                        onNewContract={() => setIsWizardOpen(true)}
                                        canCreateContract={canAccessAdmin || userPermissions.includes('contracts_create')}
                                        isLoading={isLoading}
                                    />

                    {/* Institutional Registry */}
                    <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden text-left">
                        <Table>
 <TableHeader className="bg-muted/30">
                                <TableRow>
 <TableHead className="w-12 pl-6 py-5">
                                        <Checkbox 
                                            checked={
                                                selectedEntities.length === filteredList.length && filteredList.length > 0
                                                    ? true
                                                    : selectedEntities.length > 0
                                                        ? 'indeterminate'
                                                        : false
                                            }
                                            onCheckedChange={(checked) => {
                                                if (checked) setSelectedEntities(filteredList);
                                                else setSelectedEntities([]);
                                            }}
                                        />
                                    </TableHead>
 <TableHead className="text-[10px] font-semibold py-5">Institution</TableHead>
 <TableHead className="text-[10px] font-semibold ">Active Status</TableHead>
 <TableHead className="text-[10px] font-semibold ">Last Update</TableHead>
 <TableHead className="text-[10px] font-semibold ">Assigned Representative</TableHead>
 <TableHead className="text-right pr-8 text-[10px] font-semibold ">Management</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
 <TableCell className="pl-6"><Skeleton className="h-4 w-4" /></TableCell>
 <TableCell><Skeleton className="h-4 w-48" /></TableCell>
 <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
 <TableCell><Skeleton className="h-4 w-32" /></TableCell>
 <TableCell><Skeleton className="h-4 w-40" /></TableCell>
 <TableCell className="text-right pr-8"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredList.length > 0 ? (
                                    filteredList.map((item) => {
                                        const contract = item.contract;
                                        const status = contract?.status || 'no_contract';
                                        const isSigningInProcess = downloadingId === contract?.id;
                                        const isSelected = !!selectedEntities.find(s => s.id === item.id);
                                        
                                        return (
 <TableRow key={item.id} className={cn("group transition-colors", isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50 even:bg-muted/30 dark:even:bg-muted/15")}>
 <TableCell className="pl-6">
                                                    <Checkbox 
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelect(item)}
                                                    />
                                                </TableCell>
 <TableCell className="py-4">
 <div className="flex items-center gap-3">
 <div className={cn(
                                                            "p-2 rounded-xl border transition-all",
                                                            isSelected ? "bg-primary text-white border-primary" : "bg-primary/5 border-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                                                        )}>
 <Building className="h-4 w-4" />
                                                         </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-semibold text-sm tracking-tight text-foreground">{item.displayName}</span>
                                                                {contract?.isUnderLegalHold && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span className="inline-flex items-center p-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                                                                <Lock className="h-3 w-3" />
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="text-xs">
                                                                            Preservation Hold Active ({contract.legalHoldDetails?.matterId || 'FRCP 26/37'})
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                            <span className="text-[9px] font-bold text-muted-foreground opacity-60 italic">{item.location?.zone?.name || item.zone?.name || UNASSIGNED_ZONE.name}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(status)}</TableCell>
 <TableCell className="text-[10px] font-bold text-muted-foreground ">
                                                    {contract?.updatedAt ? format(new Date(contract.updatedAt), 'MMM d, yyyy') : '—'}
                                                </TableCell>
 <TableCell className="text-xs font-medium text-foreground/80">
                                                    {item.entityContacts?.find(c => c.isSignatory)?.name || 'No Primary Contact'}
                                                </TableCell>
 <TableCell className="text-right pr-8">
 <div className="flex items-center justify-end gap-1">
                                                        {contract?.pdfId && (
 <div className="flex items-center gap-1 mr-1 border-r border-border/50 pr-1 animate-in fade-in duration-500">
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
 className="h-8 w-8 text-primary hover:bg-primary/5 rounded-lg shrink-0"
                                                                            onClick={() => handleCopyLink(item)}
                                                                        >
 <Copy className="h-4 w-4" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Copy Signing Link</TooltipContent>
                                                                </Tooltip>
                                                                
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
 className="h-8 w-8 text-primary hover:bg-primary/5 rounded-lg shrink-0"
                                                                            asChild
                                                                        >
                                                                            <a href={`/forms/${item.contract?.pdfId || ''}?entityId=${item.entityId}`} target="_blank" rel="noopener noreferrer">
 <Globe className="h-4 w-4" />
                                                                            </a>
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>View Signing Page</TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                        )}

                                                        <DropdownMenu modal={false}>
                                                            <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted transition-colors"><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-60 rounded-2xl border border-border bg-card shadow-2xl p-2 animate-in zoom-in-95 duration-200">
 <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground px-3 py-2">Agreement Protocols</DropdownMenuLabel>
                                                                
                                                                {status === 'signed' ? (
                                                                    <>
 <DropdownMenuItem className="gap-3 rounded-xl p-2.5" onClick={() => contract && handleDownload(contract)} disabled={isSigningInProcess}>
 <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
 {isSigningInProcess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                                            </div>
 <span className="font-bold text-sm">Download Signed PDF</span>
                                                                        </DropdownMenuItem>
                                                                        {contract?.submissionId && (
                                                                            <DropdownMenuItem className="gap-3 rounded-xl p-2.5" asChild>
                                                                                <Link href={`/admin/pdfs/${contract.pdfId}/submissions/${contract.submissionId}`}>
                                                                                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Eye className="h-4 w-4" /></div>
                                                                                    <span className="font-bold text-sm">View Legal Record</span>
                                                                                </Link>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {contract?.id && (
                                                                            <DropdownMenuItem className="gap-3 rounded-xl p-2.5" asChild>
                                                                                <Link href={`/verify/${contract.id}`} target="_blank" rel="noopener noreferrer">
                                                                                    <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400"><ShieldCheck className="h-4 w-4" /></div>
                                                                                    <span className="font-bold text-sm">Verify Certificate</span>
                                                                                </Link>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <>
 <DropdownMenuItem className="gap-3 rounded-xl p-2.5" onClick={() => { setSelectedEntities([item]); setIsWizardOpen(true); }}>
 <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Plus className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Prep Contract</span>
                                                                        </DropdownMenuItem>
 <DropdownMenuItem className="gap-3 rounded-xl p-2.5" onClick={() => { setSelectedEntities([item]); setIsWizardOpen(true); }}>
 <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Send className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Send Agreement</span>
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}

                                                                {contract?.pdfId && (
                                                                    <>
 <DropdownMenuSeparator className="my-1 mx-2" />
 <DropdownMenuItem className="gap-3 rounded-xl p-2.5" onClick={() => handleCopyLink(item)}>
 <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Copy className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Copy Link</span>
                                                                        </DropdownMenuItem>
                                                                        {status === 'signed' && contract?.id && (
                                                                            <DropdownMenuItem 
                                                                                className="gap-3 rounded-xl p-2.5" 
                                                                                onClick={() => {
                                                                                    const verifyUrl = `${window.location.origin}/verify/${contract.id}`;
                                                                                    navigator.clipboard.writeText(verifyUrl);
                                                                                    toast({ title: 'Verification Link Copied', description: 'Public audit URL copied to clipboard.' });
                                                                                }}
                                                                            >
                                                                                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400"><ShieldCheck className="h-4 w-4" /></div>
                                                                                <span className="font-bold text-sm">Copy Verify URL</span>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {contract?.id && (
                                                                            <DropdownMenuItem 
                                                                                className="gap-3 rounded-xl p-2.5" 
                                                                                onClick={() => setTrackingEnvelopeId(contract.id)}
                                                                            >
                                                                                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400"><Users className="h-4 w-4" /></div>
                                                                                <span className="font-bold text-sm">Track Signatories</span>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {contract?.id && (
                                                                            <DropdownMenuItem 
                                                                                className="gap-3 rounded-xl p-2.5" 
                                                                                onClick={() => setLifecycleContractId(contract.id)}
                                                                            >
                                                                                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400"><GitBranch className="h-4 w-4" /></div>
                                                                                <span className="font-bold text-sm">Contract Lifecycle</span>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {contract?.id && (
                                                                            <DropdownMenuItem 
                                                                                className="gap-3 rounded-xl p-2.5" 
                                                                                onClick={() => setCopilotContract({ id: contract.id, title: item.displayName || 'Agreement' })}
                                                                            >
                                                                                <div className="p-1.5 bg-primary/10 rounded-lg text-primary"><Sparkles className="h-4 w-4" /></div>
                                                                                <span className="font-bold text-sm">AI Assistant</span>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {contract?.id && (
                                                                            <DropdownMenuItem 
                                                                                className="gap-3 rounded-xl p-2.5" 
                                                                                onClick={() => setDiffContract({ id: contract.id, title: item.displayName || 'Agreement' })}
                                                                            >
                                                                                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400"><GitCompare className="h-4 w-4" /></div>
                                                                                <span className="font-bold text-sm">Semantic Redline</span>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {contract?.id && (
                                                                            <DropdownMenuItem 
                                                                                className="gap-3 rounded-xl p-2.5" 
                                                                                onClick={() => setReviewObligationContract({ id: contract.id, title: item.displayName || 'Agreement' })}
                                                                            >
                                                                                <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400"><CheckSquare className="h-4 w-4" /></div>
                                                                                <span className="font-bold text-sm">Obligation Review</span>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {contract?.id && (
                                                                            <DropdownMenuItem 
                                                                                className="gap-3 rounded-xl p-2.5" 
                                                                                onClick={() => setLegalHoldContract({
                                                                                    id: contract.id,
                                                                                    title: item.displayName || 'Agreement',
                                                                                    isUnderLegalHold: contract.isUnderLegalHold,
                                                                                    legalHoldDetails: contract.legalHoldDetails,
                                                                                    retentionCategory: contract.retentionCategory,
                                                                                })}
                                                                            >
                                                                                <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                                                                                    <Lock className="h-4 w-4" />
                                                                                </div>
                                                                                <span className="font-bold text-sm">Legal Hold & Retention</span>
                                                                            </DropdownMenuItem>
                                                                        )}
 <DropdownMenuItem className="gap-3 rounded-xl p-2.5" asChild>
                                                                            <a href={`/forms/${contract.pdfId}?entityId=${item.entityId}`} target="_blank" rel="noopener noreferrer">
 <div className="p-1.5 bg-muted rounded-lg text-muted-foreground"><Globe className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Open Portal</span>
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}

                                                                {canPurge && contract && (
                                                                    <>
 <DropdownMenuSeparator className="my-2 mx-2" />
                                                                        {contract.isUnderLegalHold ? (
                                                                            <DropdownMenuItem 
                                                                                disabled
                                                                                className="text-muted-foreground gap-3 rounded-xl p-2.5 opacity-60 cursor-not-allowed"
                                                                            >
                                                                                <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600"><Lock className="h-4 w-4" /></div>
                                                                                <span className="font-bold text-sm">Locked Under Legal Hold</span>
                                                                            </DropdownMenuItem>
                                                                        ) : (
                                                                            <DropdownMenuItem 
 className="text-destructive gap-3 rounded-xl p-2.5 focus:bg-destructive/10 focus:text-destructive"
                                                                                onClick={() => setContractToPurge({ contract, entity: item })}
                                                                            >
 <div className="p-1.5 bg-destructive/10 rounded-lg"><Trash2 className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Purge Record</span>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    </>
                                                                )}

                                                                {canPurge && !contract && (
                                                                    <>
 <DropdownMenuSeparator className="my-2 mx-2" />
                                                                        <DropdownMenuItem 
 className="text-destructive gap-3 rounded-xl p-2.5 focus:bg-destructive/10 focus:text-destructive"
                                                                            onClick={() => setWithdrawingEntity(item)}
                                                                        >
 <div className="p-1.5 bg-destructive/10 rounded-lg"><History className="h-4 w-4" /></div>
 <span className="font-bold text-sm">Audit & Purge History</span>
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
                                    <TableRow>
 <TableCell colSpan={6} className="h-64 text-center">
 <div className="flex flex-col items-center justify-center gap-3 opacity-20">
 <FileCheck className="h-12 w-12" />
 <p className="text-xs font-semibold ">No matching entities in this workspace</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        {hasMore && (
                            <div className="border-t border-border/40 p-3">
                                <button
                                    type="button"
                                    onClick={loadMore}
                                    disabled={isLoadingEntities}
                                    className="w-full py-2 text-center text-[11px] font-bold text-primary hover:bg-primary/5 rounded-lg disabled:opacity-50"
                                >
                                    {isLoadingEntities ? 'Loading…' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </div>
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="templates" className="mt-0">
                            <TemplateCatalogTab
                                workspaceId={activeWorkspaceId || ''}
                                onIssueAgreement={() => {
                                    setIsWizardOpen(true);
                                }}
                            />
                        </TabsContent>

                        <TabsContent value="obligations" className="mt-0">
                            <ObligationsSummaryTab
                                workspaceId={activeWorkspaceId || ''}
                                onOpenCreateObligation={() => setIsCreateObligationOpen(true)}
                            />
                        </TabsContent>

                        <TabsContent value="insights" className="mt-0">
                            <ContractsAnalyticsTab workspaceId={activeWorkspaceId || ''} />
                        </TabsContent>

                        <TabsContent value="analytics" className="mt-0">
                            <ContractsAnalyticsTab workspaceId={activeWorkspaceId || ''} />
                        </TabsContent>

                        {canAccessAdmin && (
                            <>
                                <TabsContent value="governance" className="mt-0">
                                    <EnterpriseGovernanceTab workspaceId={activeWorkspaceId || ''} />
                                </TabsContent>

                                <TabsContent value="migration" className="mt-0">
                                    <MigrationCutoverTab workspaceId={activeWorkspaceId || ''} />
                                </TabsContent>

                                <TabsContent value="developer" className="mt-0">
                                    <DeveloperPlatformTab workspaceId={activeWorkspaceId || ''} />
                                </TabsContent>
                            </>
                        )}

                        <TabsContent value="campaigns" className="mt-0">
                            <BulkCampaignsTab workspaceId={activeWorkspaceId || ''} />
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Contextual Floating Bulk Action Bar (Phase 4 - Conforming to agents_mcp_rules.md) */}
                {activeTab === 'contracts' && contractsSubView === 'register' && (
                    <AgreementsBulkActionBar
                        selectedCount={selectedEntities.length}
                        totalMatchingCount={filteredList.length}
                        onPrepareContracts={handleBulkPrepare}
                        onSendBatchReminders={handleBulkReminders}
                        onExportSelection={handleExportSelectionCsv}
                        onClearSelection={() => setSelectedEntities([])}
                        canPrepareContracts={canAccessAdmin || userPermissions.includes('contracts_create')}
                        hasPendingSignatures={hasPendingSignatures}
                        isLoading={isLoading}
                    />
                )}

                {isWizardOpen && selectedEntities.length > 0 && (
                    <ContractWizard 
                        entities={selectedEntities.slice(0, 50)} 
                        open={isWizardOpen} 
                        onOpenChange={(o) => {
                            setIsWizardOpen(o);
                            if (!o) setSelectedEntities([]);
                        }} 
                    />
                )}

                {withdrawingEntity && (
                    <WithdrawContractModal 
                        entity={withdrawingEntity} 
                        open={!!withdrawingEntity} 
                        onOpenChange={(o) => !o && setWithdrawingEntity(null)} 
                    />
                )}

                <EnvelopeDetailModal 
                    isOpen={!!trackingEnvelopeId} 
                    onClose={() => setTrackingEnvelopeId(null)} 
                    envelopeId={trackingEnvelopeId} 
                    workspaceId={activeWorkspaceId || 'default'} 
                />

                {/* Single Purge Confirmation */}
                <AlertDialog open={!!contractToPurge} onOpenChange={(o) => !o && setContractToPurge(null)}>
 <AlertDialogContent className="rounded-2xl border border-border bg-card">
                        <AlertDialogHeader>
 <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
 <ShieldAlert className="h-6 w-6 text-destructive" />
                            </div>
 <AlertDialogTitle className="text-center font-semibold tracking-tight">Purge Agreement Record?</AlertDialogTitle>
 <AlertDialogDescription className="text-center text-sm font-medium">
 You are about to permanently remove the agreement record for <span className="font-bold text-foreground">&quot;{contractToPurge?.entity.displayName}&quot;</span>. 
                                <br/><br/>
 <strong className="text-destructive text-[10px] ">Impact Alert:</strong> This will also delete the corresponding signed PDF from the Doc Signing module, ensuring no orphan data remains. This action is irreversible.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
 <AlertDialogFooter className="sm:justify-center gap-3 mt-4">
 <AlertDialogCancel disabled={isPurging} className="rounded-xl font-bold px-8">Retain Record</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={handlePurgeConfirmed} 
                                disabled={isPurging}
 className="rounded-xl font-semibold px-10 shadow-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all active:scale-95"
                            >
 {isPurging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Confirm Purge
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Contract Lifecycle Detail Modal (Phase 3) */}
                <ContractLifecycleDetailModal
                    isOpen={!!lifecycleContractId}
                    onClose={() => setLifecycleContractId(null)}
                    contractId={lifecycleContractId}
                    workspaceId={activeWorkspaceId || ''}
                    onOpenAmendment={(contractRecord) => {
                        setAmendmentParentContract(contractRecord);
                    }}
                    onOpenRenewal={(_contractRecord) => {
                        setIsWizardOpen(true);
                    }}
                />

                {/* Create Amendment Modal (Phase 3) */}
                {amendmentParentContract && (
                    <CreateAmendmentModal
                        isOpen={!!amendmentParentContract}
                        onClose={() => setAmendmentParentContract(null)}
                        parentContract={amendmentParentContract}
                        workspaceId={activeWorkspaceId || ''}
                        onSuccess={({ amendmentContract }) => {
                            setAmendmentParentContract(null);
                            setLifecycleContractId(amendmentContract.id);
                            toast({
                                title: 'Amendment Initialized',
                                description: `Draft amendment "${amendmentContract.title}" created.`
                            });
                        }}
                    />
                )}

                {/* Create Obligation Modal (Phase 3) */}
                <CreateObligationModal
                    isOpen={isCreateObligationOpen}
                    onClose={() => setIsCreateObligationOpen(false)}
                    workspaceId={activeWorkspaceId || ''}
                    onSuccess={() => {
                        setIsCreateObligationOpen(false);
                        toast({
                            title: 'Obligation Scheduled',
                            description: 'New deliverable obligation added to the workspace ledger.'
                        });
                    }}
                />

                {/* Reminder & Notification Settings Drawer (Phase 4 / P4.5) */}
                <ReminderSettingsDrawer
                    open={isReminderSettingsOpen}
                    onOpenChange={setIsReminderSettingsOpen}
                    workspaceId={activeWorkspaceId || ''}
                />

                {/* Grounded AI Copilot Drawer (Phase 5 / P5.3) */}
                {copilotContract && (
                    <DocumentAiCopilotDrawer
                        open={!!copilotContract}
                        onOpenChange={(open) => !open && setCopilotContract(null)}
                        workspaceId={activeWorkspaceId || ''}
                        documentId={copilotContract.id}
                        documentTitle={copilotContract.title}
                    />
                )}

                {/* Semantic Redline & Diff Modal (Phase 5 / P5.2) */}
                {diffContract && (
                    <ContractClauseDiffModal
                        open={!!diffContract}
                        onOpenChange={(open) => !open && setDiffContract(null)}
                        workspaceId={activeWorkspaceId || ''}
                        contractId={diffContract.id}
                        contractTitle={diffContract.title}
                    />
                )}

                {/* Obligation Review Queue Modal (Phase 5 / P5.4) */}
                {reviewObligationContract && (
                    <ObligationReviewModal
                        open={!!reviewObligationContract}
                        onOpenChange={(open) => !open && setReviewObligationContract(null)}
                        workspaceId={activeWorkspaceId || ''}
                        contractId={reviewObligationContract.id}
                        contractTitle={reviewObligationContract.title}
                    />
                )}

                {/* Legal Hold & Retention Manager Modal (Phase 9) */}
                {legalHoldContract && (
                    <LegalHoldManagerModal
                        isOpen={!!legalHoldContract}
                        onClose={() => setLegalHoldContract(null)}
                        workspaceId={activeWorkspaceId || ''}
                        contract={legalHoldContract}
                    />
                )}

                {/* Mobile Bottom Navigation Dock (Phase 1) */}
                <AgreementsMobileBottomNav
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    userPermissions={userPermissions}
                />
            </PageContainerFluid>
        </TooltipProvider>
    );
}
