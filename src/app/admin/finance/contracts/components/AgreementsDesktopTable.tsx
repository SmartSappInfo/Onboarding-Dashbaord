'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * AgreementsDesktopTable:
 * 1. Purpose & Standards:
 *    Renders the noise-reduced tabular register for desktop and laptop viewports (hidden sm:block),
 *    as specified in `docs/billing/ui_enhancement/agreements_hub_enhancement.md` (Section 1.4 & 4).
 * 2. Visual Polish & Noise Reduction:
 *    - Replaces repetitive italic "Unassigned" labels with initials avatars, bold names, and clean role subtitling.
 *    - Standardizes status badges using `<AgreementsStatusBadge>`.
 *    - Surfaces relative time alongside formatted timestamps with RangeError-safe parsing.
 *    - Supports clickable rows (opening ContractLifecycleDetailModal) with rigorous event bubbling
 *      prevention (`e.stopPropagation()`) across checkboxes, quick link buttons, and action menus.
 * 3. Accessibility & Performance:
 *    - Tri-state master checkbox with 'indeterminate' support.
 *    - Zero `any` or `any[]` typing (Rule 4).
 *    - Memoized row rendering and stable callbacks to minimize re-render overhead.
 */

import * as React from 'react';
import Link from 'next/link';
import { 
  Lock, 
  Copy, 
  Globe, 
  MoreHorizontal, 
  Download, 
  Eye, 
  ShieldCheck, 
  Plus, 
  Send, 
  Users, 
  GitBranch, 
  Sparkles, 
  GitCompare, 
  CheckSquare, 
  Trash2, 
  History, 
  Loader2, 
  FileSearch,
  RotateCcw
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AgreementsStatusBadge } from './AgreementsStatusBadge';
import { formatSafeDate, formatSafeRelativeTime } from '@/lib/date-utils';
import type { WorkspaceEntity, Contract } from '@/lib/types';
import type { LegalHoldContractSummary } from './LegalHoldManagerModal';
import { cn } from '@/lib/utils';

export type EntityWithContract = WorkspaceEntity & { contract: Contract | null };

export interface AgreementsDesktopTableProps {
  items: EntityWithContract[];
  selectedEntities: WorkspaceEntity[];
  onToggleSelect: (item: EntityWithContract) => void;
  onSelectAll: (checked: boolean) => void;
  onRowClick: (item: EntityWithContract) => void;
  onCopySigningLink: (item: EntityWithContract) => void;
  onDownloadSignedPdf: (contract: Contract) => void;
  onPrepContract: (item: EntityWithContract) => void;
  onSendAgreement: (item: EntityWithContract) => void;
  onTrackSignatories: (contractId: string) => void;
  onOpenLifecycle: (contractId: string) => void;
  onOpenCopilot: (contract: { id: string; title: string }) => void;
  onOpenRedline: (contract: { id: string; title: string }) => void;
  onOpenObligations: (contract: { id: string; title: string }) => void;
  onOpenLegalHold: (params: LegalHoldContractSummary) => void;
  onPurgeContract: (params: { contract: Contract; entity: WorkspaceEntity }) => void;
  onAuditPurgeHistory: (entity: WorkspaceEntity) => void;
  downloadingId: string | null;
  canPurge: boolean;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  getEntityZoneName: (e: WorkspaceEntity) => string;
  className?: string;
}

/**
 * Extracts initials from an entity or user display name.
 */
function getInitials(name: string): string {
  if (!name) return 'IN';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const AgreementsDesktopTable = React.memo(function AgreementsDesktopTable({
  items,
  selectedEntities,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  onCopySigningLink,
  onDownloadSignedPdf,
  onPrepContract,
  onSendAgreement,
  onTrackSignatories,
  onOpenLifecycle,
  onOpenCopilot,
  onOpenRedline,
  onOpenObligations,
  onOpenLegalHold,
  onPurgeContract,
  onAuditPurgeHistory,
  downloadingId,
  canPurge,
  isLoading,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onResetFilters,
  hasActiveFilters,
  getEntityZoneName,
  className,
}: AgreementsDesktopTableProps) {
  const isAllSelected = items.length > 0 && selectedEntities.length === items.length;
  const isPartiallySelected = selectedEntities.length > 0 && selectedEntities.length < items.length;

  return (
    <div className={cn("rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden text-left", className)}>
      <Table>
        <TableHeader className="bg-muted/35 border-b border-border/80">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 pl-6 py-4">
              <Checkbox
                checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                aria-label="Select all institutions"
              />
            </TableHead>
            <TableHead className="text-xs font-semibold py-4 text-foreground/80">Institution</TableHead>
            <TableHead className="text-xs font-semibold py-4 text-foreground/80">Contract Status</TableHead>
            <TableHead className="text-xs font-semibold py-4 text-foreground/80">Last Update</TableHead>
            <TableHead className="text-xs font-semibold py-4 text-foreground/80">Assigned Representative</TableHead>
            <TableHead className="text-right pr-6 text-xs font-semibold py-4 text-foreground/80">Management</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="even:bg-muted/15">
                <TableCell className="pl-6 py-4"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4"><Skeleton className="h-6 w-24 rounded-lg" /></TableCell>
                <TableCell className="py-4">
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right pr-6 py-4"><Skeleton className="h-8 w-20 ml-auto rounded-lg" /></TableCell>
              </TableRow>
            ))
          ) : items.length > 0 ? (
            items.map((item) => {
              const contract = item.contract;
              const status = contract?.status || 'no_contract';
              const isSigningInProcess = downloadingId === contract?.id;
              const isSelected = selectedEntities.some((s) => s.id === item.id);
              const zoneName = getEntityZoneName(item);
              const representative = item.assignedTo;
              const primaryContact = item.entityContacts?.find(c => c.isSignatory) || item.entityContacts?.find(c => c.isPrimary);

              return (
                <TableRow
                  key={item.id}
                  onClick={() => onRowClick(item)}
                  className={cn(
                    "group cursor-pointer transition-colors duration-150 border-b border-border/50",
                    isSelected 
                      ? "bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15" 
                      : "hover:bg-muted/40 even:bg-muted/20 dark:even:bg-muted/10"
                  )}
                >
                  {/* Selection Checkbox */}
                  <TableCell 
                    className="pl-6 py-4 w-12"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(item)}
                      aria-label={`Select ${item.displayName}`}
                    />
                  </TableCell>

                  {/* Institution Details */}
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-9 w-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 transition-colors",
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-primary/10 border-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                      )}>
                        {getInitials(item.displayName)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors">
                            {item.displayName}
                          </span>
                          {contract?.isUnderLegalHold && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span 
                                  className="inline-flex items-center p-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Lock className="h-3 w-3" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                Legal Preservation Hold Active ({contract.legalHoldDetails?.matterId || 'FRCP 26/37'})
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground/75 truncate">
                          {zoneName ? zoneName : 'Unassigned zone'}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Contract Status Badge */}
                  <TableCell className="py-4">
                    <AgreementsStatusBadge status={status} size="default" />
                  </TableCell>

                  {/* Last Update */}
                  <TableCell className="py-4">
                    {contract?.updatedAt ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">
                          {formatSafeDate(contract.updatedAt, 'MMM d, yyyy')}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80">
                          {formatSafeRelativeTime(contract.updatedAt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </TableCell>

                  {/* Assigned Representative */}
                  <TableCell className="py-4">
                    {representative?.name ? (
                      <div className="flex items-center gap-2 max-w-[220px]">
                        <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                          {getInitials(representative.name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {representative.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {representative.email || primaryContact?.role || 'Sales Representative'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">— Not assigned</span>
                    )}
                  </TableCell>

                  {/* Management & Action Protocols */}
                  <TableCell 
                    className="text-right pr-6 py-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {contract?.pdfId && (
                        <div className="flex items-center gap-1 mr-1 border-r border-border/60 pr-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCopySigningLink(item);
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy Signing Link</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg shrink-0"
                                asChild
                              >
                                <a 
                                  href={`/forms/${contract.pdfId}?entityId=${item.entityId}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Signing Page</TooltipContent>
                          </Tooltip>
                        </div>
                      )}

                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-muted transition-colors active:scale-[0.97]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-60 rounded-2xl border border-border bg-card shadow-2xl p-2 animate-in zoom-in-95 duration-150 z-[100]"
                        >
                          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground px-3 py-1.5">
                            Agreement Protocols
                          </DropdownMenuLabel>

                          {status === 'signed' ? (
                            <>
                              <DropdownMenuItem
                                className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                onClick={() => contract && onDownloadSignedPdf(contract)}
                                disabled={isSigningInProcess}
                              >
                                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                                  {isSigningInProcess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                </div>
                                <span className="font-semibold text-xs">Download Signed PDF</span>
                              </DropdownMenuItem>

                              {contract?.submissionId && (
                                <DropdownMenuItem className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer" asChild>
                                  <Link href={`/admin/pdfs/${contract.pdfId}/submissions/${contract.submissionId}`}>
                                    <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                                      <Eye className="h-4 w-4" />
                                    </div>
                                    <span className="font-semibold text-xs">View Legal Record</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}

                              {contract?.id && (
                                <DropdownMenuItem className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer" asChild>
                                  <Link href={`/verify/${contract.id}`} target="_blank" rel="noopener noreferrer">
                                    <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                      <ShieldCheck className="h-4 w-4" />
                                    </div>
                                    <span className="font-semibold text-xs">Verify Certificate</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem
                                className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                onClick={() => onPrepContract(item)}
                              >
                                <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                                  <Plus className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-xs">Prep Contract</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                onClick={() => onSendAgreement(item)}
                              >
                                <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                                  <Send className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-xs">Send Agreement</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          {contract?.pdfId && (
                            <>
                              <DropdownMenuSeparator className="my-1 mx-2" />
                              <DropdownMenuItem
                                className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                onClick={() => onCopySigningLink(item)}
                              >
                                <div className="p-1.5 bg-muted rounded-lg text-muted-foreground">
                                  <Copy className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-xs">Copy Signing Link</span>
                              </DropdownMenuItem>

                              {contract?.id && (
                                <DropdownMenuItem
                                  className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                  onClick={() => onTrackSignatories(contract.id)}
                                >
                                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <Users className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-xs">Track Signatories</span>
                                </DropdownMenuItem>
                              )}

                              {contract?.id && (
                                <DropdownMenuItem
                                  className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                  onClick={() => onOpenLifecycle(contract.id)}
                                >
                                  <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                                    <GitBranch className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-xs">Contract Lifecycle</span>
                                </DropdownMenuItem>
                              )}

                              {contract?.id && (
                                <DropdownMenuItem
                                  className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                  onClick={() => onOpenCopilot({ id: contract.id, title: item.displayName || 'Agreement' })}
                                >
                                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                                    <Sparkles className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-xs">AI Assistant</span>
                                </DropdownMenuItem>
                              )}

                              {contract?.id && (
                                <DropdownMenuItem
                                  className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                  onClick={() => onOpenRedline({ id: contract.id, title: item.displayName || 'Agreement' })}
                                >
                                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <GitCompare className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-xs">Semantic Redline</span>
                                </DropdownMenuItem>
                              )}

                              {contract?.id && (
                                <DropdownMenuItem
                                  className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                  onClick={() => onOpenObligations({ id: contract.id, title: item.displayName || 'Agreement' })}
                                >
                                  <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400">
                                    <CheckSquare className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-xs">Obligation Review</span>
                                </DropdownMenuItem>
                              )}

                              {contract?.id && (
                                <DropdownMenuItem
                                  className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer"
                                  onClick={() => onOpenLegalHold({
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
                                  <span className="font-semibold text-xs">Legal Hold & Retention</span>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem className="gap-3 rounded-xl p-2.5 font-medium text-sm cursor-pointer" asChild>
                                <a 
                                  href={`/forms/${contract.pdfId}?entityId=${item.entityId}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <div className="p-1.5 bg-muted rounded-lg text-muted-foreground">
                                    <Globe className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-xs">Open Portal</span>
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
                                  <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600">
                                    <Lock className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-xs">Locked Under Legal Hold</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-destructive gap-3 rounded-xl p-2.5 focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                                  onClick={() => onPurgeContract({ contract, entity: item })}
                                >
                                  <div className="p-1.5 bg-destructive/10 rounded-lg">
                                    <Trash2 className="h-4 w-4" />
                                  </div>
                                  <span className="font-semibold text-xs">Purge Record</span>
                                </DropdownMenuItem>
                              )}
                            </>
                          )}

                          {canPurge && !contract && (
                            <>
                              <DropdownMenuSeparator className="my-2 mx-2" />
                              <DropdownMenuItem
                                className="text-destructive gap-3 rounded-xl p-2.5 focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                                onClick={() => onAuditPurgeHistory(item)}
                              >
                                <div className="p-1.5 bg-destructive/10 rounded-lg">
                                  <History className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-xs">Audit & Purge History</span>
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
                <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto p-6">
                  <div className="p-3 bg-muted/60 rounded-2xl text-muted-foreground">
                    <FileSearch className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">No matching institutions found</p>
                    <p className="text-xs text-muted-foreground">
                      {hasActiveFilters 
                        ? "Try clearing your filters or adjusting your search term."
                        : "There are currently no institutions registered in this workspace."}
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onResetFilters}
                      className="mt-2 rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset all filters
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination Footer */}
      {hasMore && (
        <div className="border-t border-border/50 p-3 bg-muted/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full py-2.5 text-center text-xs font-semibold text-primary hover:bg-primary/5 rounded-xl disabled:opacity-50 active:scale-[0.99] transition-all"
          >
            {isLoadingMore ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more institutions...
              </span>
            ) : (
              'Load more institutions'
            )}
          </Button>
        </div>
      )}
    </div>
  );
});

AgreementsDesktopTable.displayName = 'AgreementsDesktopTable';
