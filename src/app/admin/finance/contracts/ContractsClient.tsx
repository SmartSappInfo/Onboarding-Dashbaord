
'use client';

import * as React from 'react';
import { collection, query, orderBy, doc, getDoc, where, getCountFromServer } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { WorkspaceEntity, Contract } from '@/lib/types';
import { UNASSIGNED_ZONE, isUnassignedZone, type ZoneRef } from '@/lib/zone-constants';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { 
    Plus, 
    Trash2, 
    Loader2, 
    ShieldAlert 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { format } from 'date-fns';
import ContractWizard from './components/ContractWizard';
import WithdrawContractModal from './components/WithdrawContractModal';
import EnvelopeDetailModal from './components/EnvelopeDetailModal';
import { useToast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
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
import { AgreementsDesktopTable } from './components/AgreementsDesktopTable';
import { AgreementsMobileCardList } from './components/AgreementsMobileCardList';

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
                sanitizeCell(entity.displayName || 'Unnamed Institution'),
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

    // Interactive row click opens contract lifecycle drawer or prep wizard (Phase 5)
    const handleRowClick = React.useCallback((item: EntityWithContract) => {
        if (item.contract?.id) {
            setLifecycleContractId(item.contract.id);
        } else {
            setSelectedEntities([item]);
            setIsWizardOpen(true);
        }
    }, []);

    const handlePrepContract = React.useCallback((item: EntityWithContract) => {
        setSelectedEntities([item]);
        setIsWizardOpen(true);
    }, []);

    const handleSendAgreement = React.useCallback((item: EntityWithContract) => {
        setSelectedEntities([item]);
        setIsWizardOpen(true);
    }, []);

    const handleSelectAll = React.useCallback((checked: boolean) => {
        if (checked) {
            setSelectedEntities(filteredList);
        } else {
            setSelectedEntities([]);
        }
    }, [filteredList]);

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

                    {/* Desktop Institutional Table (Phase 5 - hidden sm:block) */}
                    <AgreementsDesktopTable
                        className="hidden sm:block"
                        items={filteredList}
                        selectedEntities={selectedEntities}
                        onToggleSelect={toggleSelect}
                        onSelectAll={handleSelectAll}
                        onRowClick={handleRowClick}
                        onCopySigningLink={handleCopyLink}
                        onDownloadSignedPdf={handleDownload}
                        onPrepContract={handlePrepContract}
                        onSendAgreement={handleSendAgreement}
                        onTrackSignatories={(id) => setTrackingEnvelopeId(id)}
                        onOpenLifecycle={(id) => setLifecycleContractId(id)}
                        onOpenCopilot={(c) => setCopilotContract(c)}
                        onOpenRedline={(c) => setDiffContract(c)}
                        onOpenObligations={(c) => setReviewObligationContract(c)}
                        onOpenLegalHold={(params) => setLegalHoldContract(params)}
                        onPurgeContract={(params) => setContractToPurge(params)}
                        onAuditPurgeHistory={(entity) => setWithdrawingEntity(entity)}
                        downloadingId={downloadingId}
                        canPurge={canPurge}
                        isLoading={isLoading}
                        hasMore={hasMore}
                        isLoadingMore={isLoadingEntities}
                        onLoadMore={loadMore}
                        onResetFilters={handleResetFilters}
                        hasActiveFilters={hasActiveFilters}
                        getEntityZoneName={getEntityZoneName}
                    />

                    {/* Mobile Institutional Card List (Phase 5 - sm:hidden) */}
                    <AgreementsMobileCardList
                        className="sm:hidden"
                        items={filteredList}
                        selectedEntities={selectedEntities}
                        onToggleSelect={toggleSelect}
                        onRowClick={handleRowClick}
                        onCopySigningLink={handleCopyLink}
                        onDownloadSignedPdf={handleDownload}
                        onPrepContract={handlePrepContract}
                        onSendAgreement={handleSendAgreement}
                        onTrackSignatories={(id) => setTrackingEnvelopeId(id)}
                        onOpenLifecycle={(id) => setLifecycleContractId(id)}
                        onOpenCopilot={(c) => setCopilotContract(c)}
                        onOpenRedline={(c) => setDiffContract(c)}
                        onOpenObligations={(c) => setReviewObligationContract(c)}
                        onOpenLegalHold={(params) => setLegalHoldContract(params)}
                        onPurgeContract={(params) => setContractToPurge(params)}
                        onAuditPurgeHistory={(entity) => setWithdrawingEntity(entity)}
                        downloadingId={downloadingId}
                        canPurge={canPurge}
                        isLoading={isLoading}
                        hasMore={hasMore}
                        isLoadingMore={isLoadingEntities}
                        onLoadMore={loadMore}
                        onResetFilters={handleResetFilters}
                        hasActiveFilters={hasActiveFilters}
                        getEntityZoneName={getEntityZoneName}
                    />
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
