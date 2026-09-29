'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Bulk Campaigns & Compliance Vault Tab (Phase 9 UI):
 * 1. Purpose:
 *    Central console for managing enterprise bulk document signing campaigns,
 *    monitoring live batch dispatch slices, enforcing FRCP 26/37 legal preservation
 *    holds, and generating court-admissible cryptographic e-Discovery ZIP archives.
 * 2. Invariants & Failure Mode Defenses:
 *    - Bounded Slice Dispatch (FM-P9-01): Dispatches in slices of 25 to prevent gateway exhaustion.
 *    - Partial-Failure Isolation (FM-P9-03): "Retry Failed" isolates failed rows without resending.
 *    - Legal Hold Freeze (FM-P9-05): Locks contracts against deletion across the workspace.
 *    - Mobile Ergonomics (FM-P9-10): Responsive data cards for viewport < 640px, min-h-[44px] touch targets.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { BulkCampaign, ContractRecord } from '@/lib/types/document-signing';
import type { PDFForm } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { BulkCampaignWizardModal } from './BulkCampaignWizardModal';
import { LegalHoldManagerModal, LegalHoldContractSummary } from './LegalHoldManagerModal';
import {
  dispatchBulkCampaignSliceAction,
  retryFailedCampaignRecipientsAction,
} from '@/app/actions/bulk-campaign-actions';
import { generateEDiscoveryPackageAction } from '@/app/actions/compliance-archival-actions';
import {
  Layers,
  Send,
  RotateCcw,
  Lock,
  ShieldCheck,
  FileArchive,
  Download,
  Search,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  Sparkles,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';

export interface BulkCampaignsTabProps {
  workspaceId: string;
}

export default function BulkCampaignsTab({ workspaceId }: BulkCampaignsTabProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Sub-navigation view state
  const [subView, setSubView] = React.useState<'campaigns' | 'legal_hold' | 'vault'>('campaigns');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterHoldOnly, setFilterHoldOnly] = React.useState(false);

  // Modal States
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const [selectedHoldContract, setSelectedHoldContract] = React.useState<LegalHoldContractSummary | null>(null);

  // Action Loading States
  const [dispatchingCampaignId, setDispatchingCampaignId] = React.useState<string | null>(null);
  const [retryingCampaignId, setRetryingCampaignId] = React.useState<string | null>(null);
  const [exportingContractId, setExportingContractId] = React.useState<string | null>(null);

  // 1. Fetch Bulk Campaigns for active workspace
  const campaignsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'bulk_campaigns'),
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, workspaceId]);

  const { data: rawCampaigns, isLoading: isCampaignsLoading } =
    useCollection<BulkCampaign>(campaignsQuery);

  const campaigns = React.useMemo(() => rawCampaigns || [], [rawCampaigns]);

  // 2. Fetch Contracts for Legal Hold & Retention View
  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'contracts'),
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, workspaceId]);

  const { data: rawContracts, isLoading: isContractsLoading } =
    useCollection<ContractRecord>(contractsQuery);

  const contracts = React.useMemo(() => rawContracts || [], [rawContracts]);

  // 3. Fetch PDF templates for wizard selection
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'pdfs'),
      where('workspaceIds', 'array-contains', workspaceId)
    );
  }, [firestore, workspaceId]);

  const { data: rawTemplates } = useCollection<PDFForm>(templatesQuery);

  const publishedTemplates = React.useMemo(() => {
    if (!rawTemplates) return [];
    return rawTemplates.map((p) => ({
      id: p.id,
      name: p.name || p.publicTitle || 'Untitled Template',
      variables: (p.fields || []).map((f) => f.id),
    }));
  }, [rawTemplates]);

  // Derived KPIs
  const kpis = React.useMemo(() => {
    const totalCampaigns = campaigns.length;
    const totalDispatched = campaigns.reduce((acc, c) => acc + (c.dispatchedCount || 0), 0);
    const totalSigned = campaigns.reduce((acc, c) => acc + (c.signedCount || 0), 0);
    const totalFailed = campaigns.reduce((acc, c) => acc + (c.failedCount || 0), 0);
    const activeLegalHolds = contracts.filter((c) => Boolean(c.isUnderLegalHold)).length;

    return {
      totalCampaigns,
      totalDispatched,
      totalSigned,
      totalFailed,
      activeLegalHolds,
    };
  }, [campaigns, contracts]);

  // Filtered Campaigns
  const filteredCampaigns = React.useMemo(() => {
    if (!searchTerm.trim()) return campaigns;
    const q = searchTerm.toLowerCase();
    return campaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [campaigns, searchTerm]);

  // Filtered Contracts for Legal Hold Tab
  const filteredContracts = React.useMemo(() => {
    return contracts.filter((c) => {
      if (filterHoldOnly && !c.isUnderLegalHold) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.legalHoldDetails?.matterId?.toLowerCase().includes(q) ||
        c.retentionCategory?.toLowerCase().includes(q)
      );
    });
  }, [contracts, filterHoldOnly, searchTerm]);

  // Handlers
  const handleDispatchSlice = async (campaignId: string) => {
    setDispatchingCampaignId(campaignId);
    try {
      const res = await dispatchBulkCampaignSliceAction(workspaceId, campaignId, 25);
      if (!res.success || !res.data) {
        toast({
          title: 'Batch Dispatch Error',
          description: res.error || 'Failed to dispatch campaign slice.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Batch Slice Dispatched',
        description: `Processed ${res.data.processedCount} recipient(s): ${res.data.successfulCount} sent, ${res.data.failedCount} failed. Remaining queued: ${res.data.remainingCount}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Slice dispatch failed';
      toast({
        title: 'Dispatch Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setDispatchingCampaignId(null);
    }
  };

  const handleRetryFailed = async (campaignId: string) => {
    setRetryingCampaignId(campaignId);
    try {
      const res = await retryFailedCampaignRecipientsAction(workspaceId, campaignId);
      if (!res.success || !res.data) {
        toast({
          title: 'Retry Error',
          description: res.error || 'Failed to retry failed recipients.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Retried Failed Recipients',
        description: res.data.message || `Targeted ${res.data.retriedCount} failed signers for retry.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      toast({
        title: 'Retry Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setRetryingCampaignId(null);
    }
  };

  const handleExportEDiscovery = async (contractId: string) => {
    setExportingContractId(contractId);
    try {
      const res = await generateEDiscoveryPackageAction(workspaceId, contractId);
      if (!res.success || !res.data) {
        toast({
          title: 'Export Failed',
          description: res.error || 'Unable to generate e-Discovery package.',
          variant: 'destructive',
        });
        return;
      }

      const bundle = res.data;
      if (bundle.storageUrl) {
        window.open(bundle.storageUrl, '_blank');
        toast({
          title: 'Vault Export Ready',
          description: 'Large evidence package opened from secure storage.',
        });
      } else if (bundle.zipBase64) {
        const byteCharacters = atob(bundle.zipBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ediscovery-${contractId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'e-Discovery Package Downloaded',
          description: `Merkle Root: ${bundle.manifest.merkleRootSha256.substring(0, 16)}...`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast({
        title: 'Export Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setExportingContractId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Bulk Campaigns & Compliance Vault
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enterprise bulk document signing dispatch, FRCP 26/37 legal preservation holds, and
            court-admissible e-Discovery packages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsWizardOpen(true)}
            className="min-h-[44px] rounded-xl font-bold text-xs px-4 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.97] transition-all gap-2"
          >
            <Plus className="h-4 w-4" />
            New Bulk Campaign
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-border bg-card/50 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Campaigns
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {kpis.totalCampaigns}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border bg-card/50 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Envelopes Dispatched
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {kpis.totalDispatched}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border bg-card/50 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Completed Signatures
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {kpis.totalSigned}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border bg-card/50 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Active Legal Holds
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {kpis.activeLegalHolds}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-view Navigation & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border w-fit">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSubView('campaigns')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold px-3 ${
              subView === 'campaigns' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            Bulk Campaigns ({campaigns.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSubView('legal_hold')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold px-3 ${
              subView === 'legal_hold' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            Legal Holds & Retention ({contracts.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSubView('vault')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold px-3 ${
              subView === 'vault' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            e-Discovery Vault
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={
                subView === 'campaigns' ? 'Search campaigns by title, tag...' : 'Search contracts by title, matter...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 min-h-[38px] text-base sm:text-xs rounded-xl"
            />
          </div>

          {subView === 'legal_hold' && (
            <Button
              variant={filterHoldOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterHoldOnly(!filterHoldOnly)}
              className="min-h-[38px] rounded-xl text-xs font-semibold gap-1.5 shrink-0"
            >
              <Filter className="h-3.5 w-3.5" />
              {filterHoldOnly ? 'Only Holds Active' : 'All Contracts'}
            </Button>
          )}
        </div>
      </div>

      {/* Sub-view 1: Bulk Campaigns */}
      {subView === 'campaigns' && (
        <Card className="rounded-2xl border border-border shadow-sm overflow-hidden">
          <CardHeader className="p-4 border-b border-border bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Campaign Roster & Dispatch Engine
            </CardTitle>
            <CardDescription className="text-xs">
              Live batch slice processing with deterministic deduplication and rate limiting.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isCampaignsLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading workspace campaigns...</p>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <Layers className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-semibold text-foreground">No Bulk Campaigns Found</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Launch an enterprise bulk signing campaign using pre-approved templates and CSV
                  roster ingestion.
                </p>
                <Button
                  onClick={() => setIsWizardOpen(true)}
                  size="sm"
                  className="mt-2 min-h-[44px] rounded-xl text-xs font-bold"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Launch First Campaign
                </Button>
              </div>
            ) : (
              <div>
                {/* Desktop View Table (hidden < 640px) */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10">
                        <TableHead className="text-xs font-bold">Campaign Details</TableHead>
                        <TableHead className="text-xs font-bold">Status</TableHead>
                        <TableHead className="text-xs font-bold">Completion Progress</TableHead>
                        <TableHead className="text-xs font-bold">Breakdown</TableHead>
                        <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCampaigns.map((camp) => {
                        const total = camp.totalCount || 0;
                        const dispatched = camp.dispatchedCount || 0;
                        const signed = camp.signedCount || 0;
                        const failed = camp.failedCount || 0;
                        const pct = total > 0 ? Math.round((signed / total) * 100) : 0;
                        const hasQueued = total > dispatched;

                        return (
                          <TableRow key={camp.id} className="hover:bg-muted/30">
                            <TableCell className="py-3">
                              <div className="space-y-1">
                                <p className="font-bold text-xs text-foreground truncate max-w-[220px]">
                                  {camp.title}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span>{format(new Date(camp.createdAt), 'MMM d, yyyy')}</span>
                                  <span>•</span>
                                  <span className="font-mono text-[9px] truncate max-w-[100px]">
                                    {camp.id}
                                  </span>
                                </div>
                                {camp.tags && camp.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {camp.tags.map((t) => (
                                      <Badge
                                        key={t}
                                        variant="outline"
                                        className="text-[8px] h-4 px-1.5 py-0 font-normal"
                                      >
                                        {t}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={
                                  camp.status === 'completed'
                                    ? 'secondary'
                                    : camp.status === 'dispatching'
                                    ? 'default'
                                    : camp.status === 'failed'
                                    ? 'destructive'
                                    : 'outline'
                                }
                                className="text-[9px] uppercase font-bold tracking-wider"
                              >
                                {camp.status}
                              </Badge>
                            </TableCell>

                            <TableCell className="w-[200px]">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-bold">
                                  <span>{pct}% Executed</span>
                                  <span className="text-muted-foreground">
                                    {signed} of {total}
                                  </span>
                                </div>
                                <Progress value={pct} className="h-2 rounded-full" />
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <Badge variant="outline" className="text-[9px] font-mono">
                                  {dispatched} sent
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400"
                                >
                                  {signed} signed
                                </Badge>
                                {failed > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="text-[9px] font-mono"
                                  >
                                    {failed} failed
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {hasQueued && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDispatchSlice(camp.id)}
                                    disabled={dispatchingCampaignId === camp.id}
                                    className="min-h-[38px] rounded-lg text-xs font-semibold gap-1 active:scale-[0.97]"
                                  >
                                    {dispatchingCampaignId === camp.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Send className="h-3.5 w-3.5" />
                                    )}
                                    Send Slice (25)
                                  </Button>
                                )}

                                {failed > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRetryFailed(camp.id)}
                                    disabled={retryingCampaignId === camp.id}
                                    className="min-h-[38px] rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 border-destructive/30 gap-1 active:scale-[0.97]"
                                  >
                                    {retryingCampaignId === camp.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    )}
                                    Retry Failed ({failed})
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View Cards (shown < 640px) */}
                <div className="sm:hidden divide-y divide-border">
                  {filteredCampaigns.map((camp) => {
                    const total = camp.totalCount || 0;
                    const dispatched = camp.dispatchedCount || 0;
                    const signed = camp.signedCount || 0;
                    const failed = camp.failedCount || 0;
                    const pct = total > 0 ? Math.round((signed / total) * 100) : 0;
                    const hasQueued = total > dispatched;

                    return (
                      <div key={camp.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm text-foreground">{camp.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {format(new Date(camp.createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge
                            variant={
                              camp.status === 'completed'
                                ? 'secondary'
                                : camp.status === 'dispatching'
                                ? 'default'
                                : camp.status === 'failed'
                                ? 'destructive'
                                : 'outline'
                            }
                            className="text-[9px] uppercase font-bold"
                          >
                            {camp.status}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span>{pct}% Executed</span>
                            <span className="text-muted-foreground text-[10px]">
                              {signed}/{total}
                            </span>
                          </div>
                          <Progress value={pct} className="h-2 rounded-full" />
                        </div>

                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <Badge variant="outline">{dispatched} sent</Badge>
                          <Badge
                            variant="secondary"
                            className="text-emerald-600 dark:text-emerald-400"
                          >
                            {signed} signed
                          </Badge>
                          {failed > 0 && <Badge variant="destructive">{failed} failed</Badge>}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          {hasQueued && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDispatchSlice(camp.id)}
                              disabled={dispatchingCampaignId === camp.id}
                              className="flex-1 min-h-[44px] rounded-xl text-xs font-bold gap-1 active:scale-[0.97]"
                            >
                              {dispatchingCampaignId === camp.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              Send Slice (25)
                            </Button>
                          )}

                          {failed > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryFailed(camp.id)}
                              disabled={retryingCampaignId === camp.id}
                              className="flex-1 min-h-[44px] rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 gap-1 active:scale-[0.97]"
                            >
                              {retryingCampaignId === camp.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              Retry Failed
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sub-view 2: Legal Holds & Retention */}
      {subView === 'legal_hold' && (
        <Card className="rounded-2xl border border-border shadow-sm overflow-hidden">
          <CardHeader className="p-4 border-b border-border bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" />
              Litigation Holds & Statutory Retention Schedules
            </CardTitle>
            <CardDescription className="text-xs">
              Manage FRCP 26/37 deletion freezes, custodian tracking, and regulatory audit preservation.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isContractsLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading workspace agreements...</p>
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <ShieldCheck className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-semibold text-foreground">No Contracts Match Criteria</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {filterHoldOnly
                    ? 'No contracts currently have an active litigation legal hold.'
                    : 'No contracts found in this workspace.'}
                </p>
              </div>
            ) : (
              <div>
                {/* Desktop View Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10">
                        <TableHead className="text-xs font-bold">Agreement</TableHead>
                        <TableHead className="text-xs font-bold">Hold Status</TableHead>
                        <TableHead className="text-xs font-bold">Retention Category</TableHead>
                        <TableHead className="text-xs font-bold">Matter Reference</TableHead>
                        <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContracts.map((c) => {
                        const isHold = Boolean(c.isUnderLegalHold);

                        return (
                          <TableRow key={c.id} className="hover:bg-muted/30">
                            <TableCell className="py-3">
                              <div className="space-y-0.5">
                                <p className="font-bold text-xs text-foreground truncate max-w-[260px]">
                                  {c.title}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                                  {c.id}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              {isHold ? (
                                <Badge
                                  variant="destructive"
                                  className="text-[9px] font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white gap-1"
                                >
                                  <Lock className="h-3 w-3" />
                                  Legal Hold Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[9px] font-medium">
                                  Standard Lifecycle
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell>
                              <span className="text-xs text-muted-foreground capitalize">
                                {c.retentionCategory?.replace('_', ' ') || 'General Commercial'}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className="text-xs font-medium text-foreground">
                                {c.legalHoldDetails?.matterId || '—'}
                              </span>
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedHoldContract(c)}
                                  className="min-h-[38px] rounded-lg text-xs font-semibold gap-1 active:scale-[0.97]"
                                >
                                  {isHold ? (
                                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                                  ) : (
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                  )}
                                  Manage Hold
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleExportEDiscovery(c.id)}
                                  disabled={exportingContractId === c.id}
                                  className="min-h-[38px] rounded-lg text-xs font-semibold gap-1 active:scale-[0.97]"
                                >
                                  {exportingContractId === c.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5" />
                                  )}
                                  Export Archive
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View Cards */}
                <div className="sm:hidden divide-y divide-border">
                  {filteredContracts.map((c) => {
                    const isHold = Boolean(c.isUnderLegalHold);

                    return (
                      <div key={c.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm text-foreground">{c.title}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{c.id}</p>
                          </div>
                          {isHold ? (
                            <Badge
                              variant="destructive"
                              className="text-[9px] font-bold uppercase bg-amber-500 text-white gap-1"
                            >
                              <Lock className="h-3 w-3" />
                              Hold
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px]">
                              Normal
                            </Badge>
                          )}
                        </div>

                        {c.legalHoldDetails?.matterId && (
                          <div className="text-xs text-muted-foreground">
                            Matter Ref:{' '}
                            <span className="font-semibold text-foreground">
                              {c.legalHoldDetails.matterId}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedHoldContract(c)}
                            className="flex-1 min-h-[44px] rounded-xl text-xs font-bold gap-1 active:scale-[0.97]"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Manage Hold
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportEDiscovery(c.id)}
                            disabled={exportingContractId === c.id}
                            className="flex-1 min-h-[44px] rounded-xl text-xs font-bold gap-1 active:scale-[0.97]"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Archive
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sub-view 3: e-Discovery Vault */}
      {subView === 'vault' && (
        <Card className="rounded-2xl border border-border shadow-sm">
          <CardHeader className="p-6 border-b border-border bg-muted/20">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />
              Cryptographic e-Discovery Compliance Vault
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Court-admissible evidentiary packages structured with SHA-256 Merkle root verification
              trees and automated verification scripts.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Dual-PDF Bundling
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every bundle packages both the original pre-execution template and the authoritative
                  final vector signed document.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Audit Trail Ledger
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Includes the append-only evidence events ledger, biometric stroke entropy data, and
                  the cryptographic Certificate of Completion.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Merkle Manifest Verification
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Includes a standalone POSIX shell script (`verify-manifest.sh`) allowing opposing
                  counsel or judges to verify bundle authenticity offline.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-bold text-xs text-foreground">
                  Need to export evidence for active litigation?
                </p>
                <p className="text-xs text-muted-foreground">
                  Switch to the Legal Holds & Retention tab or select any executed agreement to export
                  the complete judicial package.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSubView('legal_hold')}
                className="min-h-[44px] rounded-xl text-xs font-bold shrink-0 active:scale-[0.97]"
              >
                View Agreements for Export
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <BulkCampaignWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        workspaceId={workspaceId}
        publishedTemplates={publishedTemplates}
      />

      <LegalHoldManagerModal
        isOpen={Boolean(selectedHoldContract)}
        onClose={() => setSelectedHoldContract(null)}
        workspaceId={workspaceId}
        contract={selectedHoldContract}
      />
    </div>
  );
}
