'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * AgreementsMobileCardList:
 * 1. Purpose & Standards:
 *    Renders the touch-optimized card list for mobile viewports (sm:hidden),
 *    as specified in `docs/billing/ui_enhancement/agreements_hub_enhancement.md` (Section 1.4 & 4).
 * 2. Mobile-First Ergonomics (Rule 7):
 *    - Replaces cramped horizontal table scrolling with clean, vertical tactile cards.
 *    - All interactive touch targets (checkboxes, action triggers, chevrons, pagination) meet min-h-[44px].
 *    - Tactile micro-interactions via Emil Kowalski `active:scale-[0.99]` feedback on card tap.
 *    - Safe text truncation prevents layout breakage on narrow 375px screens (e.g. iPhone SE).
 * 3. Action Parity & Zero Regression:
 *    - Full 10+ agreement protocol dropdown menu preserved.
 *    - Tapping the card opens the ContractLifecycleDetailModal (or ContractWizard if uncontracted).
 *    - Event bubbling stopper (`e.stopPropagation()`) prevents selection or menu clicks from triggering row navigation.
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
  RotateCcw,
  ChevronRight
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AgreementsStatusBadge, getInitials } from './AgreementsStatusBadge';
import { formatSafeRelativeTime } from '@/lib/date-utils';
import type { WorkspaceEntity, Contract } from '@/lib/types';
import type { LegalHoldContractSummary } from './LegalHoldManagerModal';
import { cn } from '@/lib/utils';

export type EntityWithContract = WorkspaceEntity & { contract: Contract | null };

export interface AgreementsMobileCardListProps {
  items: EntityWithContract[];
  selectedEntities: WorkspaceEntity[];
  onToggleSelect: (item: EntityWithContract) => void;
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

export const AgreementsMobileCardList = React.memo(function AgreementsMobileCardList({
  items,
  selectedEntities,
  onToggleSelect,
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
}: AgreementsMobileCardListProps) {
  return (
    <div className={cn("space-y-3 sm:hidden text-left", className)}>
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <div className="border-t border-border/50 pt-2.5 flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
          </div>
        ))
      ) : items.length > 0 ? (
        items.map((item) => {
          const contract = item.contract;
          const status = contract?.status || 'no_contract';
          const isSigningInProcess = downloadingId === contract?.id;
          const isSelected = selectedEntities.some((s) => s.id === item.id);
          const zoneName = getEntityZoneName(item);
          const representative = item.assignedTo;

          return (
            <div
              key={item.id}
              onClick={() => onRowClick(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(item);
                }
              }}
              className={cn(
                "rounded-2xl border bg-card p-4 shadow-xs space-y-3 transition-all cursor-pointer active:scale-[0.99]",
                isSelected 
                  ? "border-primary/50 ring-1 ring-primary/30 bg-primary/5 dark:bg-primary/10" 
                  : "border-border/80 hover:border-border hover:shadow-sm"
              )}
            >
              {/* Card Header: Checkbox + Avatar + Title + Menu */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Min-h-44px Touch Target for Selection (Rule 7) */}
                  <div
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(item);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(item)}
                      aria-label={`Select ${item.displayName}`}
                    />
                  </div>

                  {/* Institution Initials */}
                  <div className={cn(
                    "h-10 w-10 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 border-primary/20 text-primary"
                  )}>
                    {getInitials(item.displayName)}
                  </div>

                  {/* Title & Zone */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span 
                        title={item.displayName}
                        className="font-semibold text-sm tracking-tight text-foreground truncate max-w-[170px]"
                      >
                        {item.displayName}
                      </span>
                      {contract?.isUnderLegalHold && (
                        <span 
                          className="inline-flex items-center p-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          title="Preservation Hold Active"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground/75 truncate max-w-[170px]">
                      {zoneName ? zoneName : 'Unassigned zone'}
                    </span>
                  </div>
                </div>

                {/* 3-Dot Action Menu Button (min-h-[44px] touch target) */}
                <div 
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 -mt-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground active:scale-[0.97]"
                        aria-label={`Actions for ${item.displayName}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 rounded-2xl border border-border bg-card shadow-2xl p-2 z-[100] animate-in zoom-in-95 duration-150"
                    >
                      <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground px-3 py-1.5">
                        Agreement Protocols
                      </DropdownMenuLabel>

                      {status === 'signed' ? (
                        <>
                          <DropdownMenuItem
                            className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
                            onClick={() => contract && onDownloadSignedPdf(contract)}
                            disabled={isSigningInProcess}
                          >
                            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                              {isSigningInProcess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            </div>
                            <span className="font-semibold text-xs">Download Signed PDF</span>
                          </DropdownMenuItem>

                          {contract?.submissionId && (
                            <DropdownMenuItem className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer" asChild>
                              <Link href={`/admin/pdfs/${contract.pdfId}/submissions/${contract.submissionId}`}>
                                <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                                  <Eye className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-xs">View Legal Record</span>
                              </Link>
                            </DropdownMenuItem>
                          )}

                          {contract?.id && (
                            <DropdownMenuItem className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer" asChild>
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
                            className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
                            onClick={() => onPrepContract(item)}
                          >
                            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                              <Plus className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-xs">Prep Contract</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
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
                            className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
                            onClick={() => onCopySigningLink(item)}
                          >
                            <div className="p-1.5 bg-muted rounded-lg text-muted-foreground">
                              <Copy className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-xs">Copy Signing Link</span>
                          </DropdownMenuItem>

                          {contract?.id && (
                            <DropdownMenuItem
                              className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
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
                              className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
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
                              className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
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
                              className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
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
                              className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
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
                              className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer"
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

                          <DropdownMenuItem className="gap-3 rounded-xl p-2.5 font-medium text-sm min-h-[44px] cursor-pointer" asChild>
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
                              className="text-muted-foreground gap-3 rounded-xl p-2.5 opacity-60 cursor-not-allowed min-h-[44px]"
                            >
                              <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600">
                                <Lock className="h-4 w-4" />
                              </div>
                              <span className="font-semibold text-xs">Locked Under Legal Hold</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive gap-3 rounded-xl p-2.5 focus:bg-destructive/10 focus:text-destructive min-h-[44px] cursor-pointer"
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
                            className="text-destructive gap-3 rounded-xl p-2.5 focus:bg-destructive/10 focus:text-destructive min-h-[44px] cursor-pointer"
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
              </div>

              {/* Card Body: Status Badge & Last Updated */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                <AgreementsStatusBadge status={status} size="compact" />
                <div className="text-right">
                  {contract?.updatedAt ? (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Updated {formatSafeRelativeTime(contract.updatedAt)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/60">No update history</span>
                  )}
                </div>
              </div>

              {/* Card Footer: Representative & Tap chevron target */}
              <div className="border-t border-border/40 pt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {representative?.name ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-[9px] flex items-center justify-center shrink-0">
                        {getInitials(representative.name)}
                      </div>
                      <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
                        {representative.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">— Not assigned</span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-primary text-xs font-semibold shrink-0">
                  <span>{contract ? 'View Lifecycle' : 'Prep Contract'}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="rounded-2xl border border-border/80 bg-card p-6 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
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
                className="mt-2 rounded-xl text-xs font-semibold gap-1.5 active:scale-[0.97] min-h-[44px]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset all filters
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Pagination */}
      {hasMore && (
        <Button
          variant="outline"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="w-full min-h-[44px] rounded-xl text-xs font-semibold text-primary border-border/80 bg-card hover:bg-muted/40 active:scale-[0.98] transition-all"
        >
          {isLoadingMore ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more institutions...
            </span>
          ) : (
            'Load more institutions'
          )}
        </Button>
      )}
    </div>
  );
});

AgreementsMobileCardList.displayName = 'AgreementsMobileCardList';
