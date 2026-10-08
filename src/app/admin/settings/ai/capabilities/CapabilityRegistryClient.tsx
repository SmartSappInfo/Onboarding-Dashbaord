'use client';

/**
 * @fileOverview Capability Registry Operator Console Client (Phase 15 Milestone 4 Task 6)
 *
 * Implements Roadmap §22, Rule 7 (Mobile-first >= 44px), Rule 14 (Schema verification),
 * Rule 48 (Structured errors), Rule 51 (Server Actions), and theme.md §8.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Wrench,
  Search,
  Filter,
  Download,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { CapabilityDetailModal } from '@/components/registry/CapabilityDetailModal';
import type {
  CapabilityCatalogItem,
  DocumentationExportFormat,
} from '@/platform/registry/contracts/registry-types';
import { generatePlatformDocsAction } from '@/app/actions/registry-actions';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface CapabilityRegistryClientProps {
  initialCapabilities: readonly CapabilityCatalogItem[];
}

export function CapabilityRegistryClient({
  initialCapabilities,
}: CapabilityRegistryClientProps) {
  const [capabilities] = React.useState<readonly CapabilityCatalogItem[]>(initialCapabilities);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [selectedDomain, setSelectedDomain] = React.useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = React.useState<string>('ALL');
  const [selectedDrift, setSelectedDrift] = React.useState<string>('ALL');

  // Modal inspection state
  const [selectedCapability, setSelectedCapability] = React.useState<CapabilityCatalogItem | null>(
    null
  );
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);

  // Documentation export modal state
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [exportFormat, setExportFormat] = React.useState<DocumentationExportFormat>('OPENAPI_3_1');
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportedContent, setExportedContent] = React.useState<string | null>(null);
  const [docCopied, setDocCopied] = React.useState(false);

  // 300ms debounce for search query
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Derived KPI metrics
  const totalCount = capabilities.length;
  const readOnlyCount = React.useMemo(
    () => capabilities.filter((c) => c.riskLevel === 'L0_READ').length,
    [capabilities]
  );
  const mutatingCount = React.useMemo(
    () => capabilities.filter((c) => c.riskLevel !== 'L0_READ').length,
    [capabilities]
  );
  const driftDetectedCount = React.useMemo(
    () => capabilities.filter((c) => c.driftStatus === 'DRIFT_DETECTED').length,
    [capabilities]
  );

  // Unique domains list
  const availableDomains = React.useMemo(() => {
    const domains = new Set<string>();
    capabilities.forEach((c) => domains.add(c.domain));
    return Array.from(domains).sort();
  }, [capabilities]);

  // Filtered capabilities list
  const filteredCapabilities = React.useMemo(() => {
    return capabilities.filter((cap) => {
      if (selectedDomain !== 'ALL' && cap.domain !== selectedDomain) {
        return false;
      }
      if (selectedRisk !== 'ALL' && cap.riskLevel !== selectedRisk) {
        return false;
      }
      if (selectedDrift !== 'ALL' && cap.driftStatus !== selectedDrift) {
        return false;
      }
      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase();
        const matchesId = cap.id.toLowerCase().includes(q);
        const matchesDomain = cap.domain.toLowerCase().includes(q);
        const matchesDesc = cap.description.toLowerCase().includes(q);
        if (!matchesId && !matchesDomain && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [capabilities, selectedDomain, selectedRisk, selectedDrift, debouncedQuery]);

  const handleOpenDetail = (cap: CapabilityCatalogItem) => {
    setSelectedCapability(cap);
    setIsDetailModalOpen(true);
  };

  const handleExportDocumentation = async () => {
    setIsExporting(true);
    try {
      const res = await generatePlatformDocsAction({
        format: exportFormat,
        domain: selectedDomain !== 'ALL' ? selectedDomain : undefined,
      });

      if (!res.success) {
        toast({
          title: 'Export Failed',
          description: res.error.message || 'Unable to generate documentation',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/settings/ai/capabilities',
            label: 'View Capabilities',
          },
        });
        return;
      }

      setExportedContent(res.data.content);
      toast({
        title: 'Documentation Generated',
        description: `Generated ${exportFormat} export successfully.`,
      });
    } catch (err) {
      toast({
        title: 'Export Error',
        description: err instanceof Error ? err.message : 'Unknown generation error',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyDocContent = async () => {
    if (!exportedContent) return;
    try {
      await navigator.clipboard.writeText(exportedContent);
      setDocCopied(true);
      setTimeout(() => setDocCopied(false), 2000);
      toast({
        title: 'Copied to Clipboard',
        description: 'Documentation content copied successfully.',
      });
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Unable to access clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadDocContent = () => {
    if (!exportedContent) return;
    const extension = exportFormat === 'MARKDOWN_DOSSIER' ? 'md' : 'json';
    const filename = `platform-capabilities-${exportFormat.toLowerCase()}.${extension}`;
    const blob = new Blob([exportedContent], {
      type: exportFormat === 'MARKDOWN_DOSSIER' ? 'text/markdown' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'L0_READ':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'L1_INTERNAL_DRAFT':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'L2_STATE_MUTATION':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
        return 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400';
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return 'border-destructive/30 bg-destructive/10 text-destructive';
      default:
        return 'border-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Wrench className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Capabilities Registry
            </h1>
            <CardInfoTooltip text="Centralized inventory of canonical platform tool capabilities with cryptographic drift verification, parameter schemas, and auto-generated documentation manifests." />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Backoffice strategic asset catalog governing autonomous agents, tools, and execution boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsExportModalOpen(true)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] gap-2 border-border/80"
          >
            <Download className="h-4 w-4 text-primary" />
            Export Documentation
          </Button>
        </div>
      </div>

      {/* Zone 1: Executive KPI Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Capabilities</span>
            <Layers className="h-4 w-4 text-muted-foreground/70" />
          </div>
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <div className="text-xs text-muted-foreground">Across {availableDomains.length} domains</div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Read-Only Tools</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {readOnlyCount}
          </div>
          <div className="text-xs text-muted-foreground">L0_READ risk ceiling</div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Mutating Tools</span>
            <Lock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {mutatingCount}
          </div>
          <div className="text-xs text-muted-foreground">Governed by Two-Phase Proposals</div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Drift Status</span>
            {driftDetectedCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <div className="text-2xl font-bold text-foreground">
            {driftDetectedCount > 0 ? `${driftDetectedCount} Flagged` : '0 Drifts'}
          </div>
          <div className="text-xs text-muted-foreground">Cryptographically verified</div>
        </div>
      </div>

      {/* Zone 2: Filter Toolbar */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search capabilities by name, ID, or description..."
              className="pl-9 min-h-[44px] rounded-xl bg-background border-border/80"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by Domain"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="min-h-[44px] rounded-xl bg-background border border-border/80 px-3.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Domains</option>
              {availableDomains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Risk Level"
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="min-h-[44px] rounded-xl bg-background border border-border/80 px-3.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="L0_READ">L0_READ</option>
              <option value="L1_INTERNAL_DRAFT">L1_INTERNAL_DRAFT</option>
              <option value="L2_STATE_MUTATION">L2_STATE_MUTATION</option>
              <option value="L3_EXTERNAL_COMMUNICATION_FINANCE">L3_EXTERNAL_COMMUNICATION_FINANCE</option>
              <option value="L4_PRIVILEGED_DESTRUCTIVE">L4_PRIVILEGED_DESTRUCTIVE</option>
            </select>

            <select
              aria-label="Filter by Drift Status"
              value={selectedDrift}
              onChange={(e) => setSelectedDrift(e.target.value)}
              className="min-h-[44px] rounded-xl bg-background border border-border/80 px-3.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Drift Statuses</option>
              <option value="APPROVED">Approved Signature</option>
              <option value="DRIFT_DETECTED">Drift Detected</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Zone 3: Interactive Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/80 bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Capability ID & Description</th>
                <th className="px-4 py-3.5">Domain</th>
                <th className="px-4 py-3.5">Risk Level</th>
                <th className="px-4 py-3.5">Governance</th>
                <th className="px-4 py-3.5">Drift Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredCapabilities.length > 0 ? (
                filteredCapabilities.map((cap) => (
                  <tr key={cap.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3.5 max-w-sm">
                      <div className="font-mono font-semibold text-xs text-foreground">
                        {cap.id}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {cap.description}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="outline" className="text-xs font-mono">
                        {cap.domain}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="outline" className={cn('text-xs font-mono', getRiskBadgeColor(cap.riskLevel))}>
                        {cap.riskLevel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {cap.requiresApproval ? (
                          <span className="text-amber-500 flex items-center gap-1 font-medium">
                            <Lock className="h-3 w-3" /> Requires Approval
                          </span>
                        ) : (
                          <span className="text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Autonomous
                          </span>
                        )}
                        {cap.policies?.auditRequired && (
                          <span className="text-primary text-[11px]">Audit Logging</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {cap.driftStatus === 'APPROVED' ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" />
                          Approved
                        </Badge>
                      ) : cap.driftStatus === 'DRIFT_DETECTED' ? (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-[11px]">
                          <AlertTriangle className="h-3 w-3" />
                          Drift
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive gap-1 text-[11px]">
                          <AlertTriangle className="h-3 w-3" />
                          Suspended
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetail(cap)}
                        className="rounded-xl active:scale-[0.97] min-h-[36px] px-3 text-xs gap-1"
                      >
                        Inspect
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    No capabilities match the selected filters or search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capability Detail Modal */}
      <CapabilityDetailModal
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        capability={selectedCapability}
      />

      {/* Documentation Export Modal strictly adhering to theme.md §8 */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="max-w-3xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader
            demarcated
            className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <FileCode className="h-4 w-4" />
                </div>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                  Export Platform Documentation (Roadmap §25)
                </DialogTitle>
                <CardInfoTooltip text="Compiles live capability definitions, Zod schemas, and governance policies into industry-standard OpenAPI 3.1.0, Model Context Protocol (MCP), or Markdown guides." />
              </div>
            </div>
            <DialogDescription className="sr-only">
              Export canonical platform tool capability definitions and schemas in OpenAPI 3.1.0, MCP 2026-07-28, or Markdown format.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setExportFormat('OPENAPI_3_1');
                  setExportedContent(null);
                }}
                className={cn(
                  'rounded-xl border p-3.5 text-left transition-all active:scale-[0.98]',
                  exportFormat === 'OPENAPI_3_1'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/80 bg-muted/10 text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="font-semibold text-xs">OpenAPI 3.1.0</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Standard REST & LLM Tool Call schema spec
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExportFormat('MCP_MANIFEST');
                  setExportedContent(null);
                }}
                className={cn(
                  'rounded-xl border p-3.5 text-left transition-all active:scale-[0.98]',
                  exportFormat === 'MCP_MANIFEST'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/80 bg-muted/10 text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="font-semibold text-xs">MCP 2026-07-28</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Model Context Protocol tools manifest
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExportFormat('MARKDOWN_DOSSIER');
                  setExportedContent(null);
                }}
                className={cn(
                  'rounded-xl border p-3.5 text-left transition-all active:scale-[0.98]',
                  exportFormat === 'MARKDOWN_DOSSIER'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/80 bg-muted/10 text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="font-semibold text-xs">Markdown Guide</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Human & Agent reference handbook
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                Domain Scope: <span className="font-semibold text-foreground">{selectedDomain}</span>
              </span>
              <Button
                type="button"
                onClick={handleExportDocumentation}
                disabled={isExporting}
                className="rounded-xl active:scale-[0.97] min-h-[44px] px-5 gap-2"
              >
                {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isExporting ? 'Compiling...' : 'Generate Manifest'}
              </Button>
            </div>

            {exportedContent && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Output Preview
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyDocContent}
                      className="rounded-lg h-7 px-2.5 text-xs gap-1.5 active:scale-[0.97]"
                    >
                      {docCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {docCopied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadDocContent}
                      className="rounded-lg h-7 px-2.5 text-xs gap-1.5 active:scale-[0.97]"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-zinc-950 p-4 font-mono text-xs text-zinc-100 overflow-x-auto max-h-[300px]">
                  <pre>{exportedContent}</pre>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsExportModalOpen(false)}
              className="rounded-xl active:scale-[0.97] min-h-[44px] px-5"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
