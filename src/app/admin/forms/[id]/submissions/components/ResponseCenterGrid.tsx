'use client';

/**
 * SmartSapp Forms 2.0: Response Center Custom Grid
 * 
 * Interactive submissions table with row selection, dynamic columns,
 * inline status updates, lead scoring indicators, and CRM jump links.
 */

import React from 'react';
import Link from 'next/link';
import { 
  ExternalLink, 
  User, 
  Flame, 
  MoreHorizontal, 
  Eye, 
  Trash2, 
  Inbox
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatFieldValue, parseDateSafe } from '@/lib/forms-utils';
import type { Form, FormSubmission } from '@/lib/types';
import type { SubmissionStatus, ColumnDefinition } from '@/lib/forms/form-response-types';

interface ResponseCenterGridProps {
  submissions: FormSubmission[];
  form: Form;
  columns: ColumnDefinition[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSelectSubmission: (submission: FormSubmission) => void;
  onUpdateStatus: (submissionId: string, status: SubmissionStatus) => Promise<void>;
  onDeleteSubmission: (submissionId: string) => Promise<void>;
  onClearFilters?: () => void;
}

export default function ResponseCenterGrid({
  submissions = [],
  form,
  columns = [],
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onSelectSubmission,
  onUpdateStatus,
  onDeleteSubmission,
  onClearFilters,
}: ResponseCenterGridProps) {
  const isAllSelected = submissions.length > 0 && selectedIds.length === submissions.length;

  const visibleCols = columns.filter(c => c.isVisible);

  const statusColors: Record<SubmissionStatus, string> = {
    new: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    processing: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    qualified: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    unqualified: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    contacted: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    converted: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    rejected: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    needs_review: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    ai_flagged: 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20',
  };

  if (submissions.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center space-y-4 bg-card/30">
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-muted/30 text-muted-foreground mx-auto">
          <Inbox className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">No Submissions Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No responses match your active filters or search criteria.
          </p>
        </div>
        {onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="text-xs font-bold rounded-xl"
          >
            Clear All Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow className="border-border/40 text-[11px] font-bold uppercase tracking-wider">
              {/* Select All Checkbox */}
              <TableHead className="w-12 px-4">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={onToggleSelectAll}
                  aria-label="Select all"
                  className="rounded-md"
                />
              </TableHead>

              {/* Dynamic Columns */}
              {visibleCols.map((col) => (
                <TableHead key={col.key} className="py-3.5 text-xs text-foreground font-bold">
                  {col.label}
                </TableHead>
              ))}

              <TableHead className="w-16 text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-border/30">
            {submissions.map((sub) => {
              const isSelected = selectedIds.includes(sub.id);
              const status = (sub.status as SubmissionStatus) || 'new';

              // Extract respondent display name from captured data
              const respondentName = 
                sub.data?.fullName || 
                sub.data?.name || 
                sub.data?.firstName ? `${sub.data?.firstName} ${sub.data?.lastName || ''}`.trim() :
                sub.data?.email || 
                'Anonymous Respondent';

              const respondentEmail = sub.data?.email || sub.data?.primaryEmail || null;

              return (
                <TableRow
                  key={sub.id}
                  className={cn(
                    "hover:bg-muted/30 transition-colors cursor-pointer",
                    isSelected && "bg-primary/5"
                  )}
                  onClick={() => onSelectSubmission(sub)}
                >
                  {/* Row Checkbox */}
                  <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(sub.id)}
                      aria-label={`Select ${sub.id}`}
                      className="rounded-md"
                    />
                  </TableCell>

                  {/* Dynamic Columns Renderer */}
                  {visibleCols.map((col) => {
                    if (col.key === 'respondent') {
                      return (
                        <TableCell key={col.key} className="py-3">
                          <div className="flex items-center gap-2.5 min-w-[180px]">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {String(respondentName).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-foreground block truncate">
                                {String(respondentName)}
                              </span>
                              {respondentEmail && (
                                <span className="text-[10px] text-muted-foreground truncate block">
                                  {String(respondentEmail)}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      );
                    }

                    if (col.key === 'status') {
                      return (
                        <TableCell key={col.key} className="py-3" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={status}
                            onValueChange={(val) => onUpdateStatus(sub.id, val as SubmissionStatus)}
                          >
                            <SelectTrigger className={cn("h-7 text-[11px] font-bold rounded-xl border w-[125px]", statusColors[status])}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New Intake</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              <SelectItem value="qualified">Qualified Lead</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="converted">Converted</SelectItem>
                              <SelectItem value="needs_review">Needs Review</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="unqualified">Unqualified</SelectItem>
                              <SelectItem value="ai_flagged">AI Flagged</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      );
                    }

                    if (col.key === 'score') {
                      return (
                        <TableCell key={col.key} className="py-3">
                          {sub.totalScore !== undefined ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full gap-1",
                                (sub.totalScore || 0) >= 50
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {(sub.totalScore || 0) >= 50 && <Flame className="h-3 w-3" />}
                              {sub.totalScore} pts
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    }

                    if (col.key === 'crm') {
                      return (
                        <TableCell key={col.key} className="py-3" onClick={(e) => e.stopPropagation()}>
                          {sub.entityId ? (
                            <Button asChild variant="ghost" size="sm" className="h-7 text-xs font-bold text-emerald-600 hover:text-emerald-700 p-0">
                              <Link
                                href={form.contactScope === 'institution' ? `/admin/schools/${sub.entityId}` : `/admin/entities/${sub.entityId}`}
                                target="_blank"
                                className="flex items-center gap-1"
                              >
                                <User className="h-3 w-3" />
                                <span className="font-mono text-[10px]">{sub.entityId.slice(0, 8)}...</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">Unlinked</span>
                          )}
                        </TableCell>
                      );
                    }

                    if (col.key === 'submittedAt') {
                      return (
                        <TableCell key={col.key} className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {(() => {
                            const d = parseDateSafe(sub.submittedAt);
                            return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
                          })()}
                        </TableCell>
                      );
                    }

                    // Captured Form Field Columns
                    if (col.isCustomField) {
                      const val = sub.data ? sub.data[col.key] : undefined;
                      return (
                        <TableCell key={col.key} className="py-3 text-xs text-foreground max-w-[200px] truncate">
                          {formatFieldValue(val) || '—'}
                        </TableCell>
                      );
                    }

                    return <TableCell key={col.key}>—</TableCell>;
                  })}

                  {/* Actions Dropdown */}
                  <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl w-44">
                        <DropdownMenuItem onClick={() => onSelectSubmission(sub)} className="text-xs font-semibold gap-2">
                          <Eye className="h-3.5 w-3.5" /> View Profile Drawer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDeleteSubmission(sub.id)} className="text-xs font-semibold text-rose-600 gap-2">
                          <Trash2 className="h-3.5 w-3.5" /> Delete Submission
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
