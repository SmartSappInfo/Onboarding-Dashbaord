/**
 * @fileOverview CompanyBrain 2.0 Phase 6: Pending Approvals Queue
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Human-in-the-Loop Adjudication Gate:
 *    - Allows administrators to review, approve, or reject high-risk tool operations.
 * 2. Mobile Accessibility & Touch Targets:
 *    - All action targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]`.
 * 4. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - Fully typed props and handlers.
 */

'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import type { McpPendingApproval } from '@/lib/mcp/types';

export interface PendingApprovalsQueueProps {
  approvals: McpPendingApproval[];
  onAdjudicate: (
    approvalId: string,
    decision: 'approved' | 'rejected',
    notes: string
  ) => Promise<void>;
  isLoading?: boolean;
}

export function PendingApprovalsQueue({
  approvals,
  onAdjudicate,
  isLoading = false,
}: PendingApprovalsQueueProps) {
  const [activeFilter, setActiveFilter] = React.useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [notesMap, setNotesMap] = React.useState<Record<string, string>>({});
  const [adjudicatingId, setAdjudicatingId] = React.useState<string | null>(null);

  const filteredApprovals = React.useMemo(() => {
    if (activeFilter === 'all') return approvals;
    return approvals.filter((a) => a.status === activeFilter);
  }, [approvals, activeFilter]);

  const handleDecision = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setAdjudicatingId(approvalId);
    try {
      const note = notesMap[approvalId] || '';
      await onAdjudicate(approvalId, decision, note);
    } finally {
      setAdjudicatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveFilter('pending')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all min-h-[44px] active:scale-[0.97] ${
            activeFilter === 'pending'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Pending Review ({approvals.filter((a) => a.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveFilter('approved')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all min-h-[44px] active:scale-[0.97] ${
            activeFilter === 'approved'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Approved ({approvals.filter((a) => a.status === 'approved').length})
        </button>
        <button
          onClick={() => setActiveFilter('rejected')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all min-h-[44px] active:scale-[0.97] ${
            activeFilter === 'rejected'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Rejected ({approvals.filter((a) => a.status === 'rejected').length})
        </button>
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all min-h-[44px] active:scale-[0.97] ${
            activeFilter === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({approvals.length})
        </button>
      </div>

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          <div className="flex flex-col items-center justify-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <p className="font-medium text-slate-800">Queue is Clear</p>
            <p className="text-xs text-slate-400">
              No tool executions currently awaiting adjudication under &quot;{activeFilter}&quot;.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApprovals.map((approval) => {
            const isPending = approval.status === 'pending';
            const isExpanded = expandedId === approval.id;
            const isActing = adjudicatingId === approval.id;

            return (
              <Card
                key={approval.id}
                className="border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
              >
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-900">{approval.toolName}</span>
                      <Badge
                        variant="outline"
                        className={
                          approval.status === 'pending'
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : approval.status === 'approved'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-rose-300 bg-rose-50 text-rose-800'
                        }
                      >
                        {approval.status.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(approval.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{approval.reason}</p>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-mono">
                        <User className="w-3 h-3" /> Caller: {approval.callerId} ({approval.callerType})
                      </span>
                      {approval.adjudicatedBy && (
                        <span className="text-slate-400">
                          Adjudicated by: {approval.adjudicatedBy}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions for Pending */}
                  {isPending && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecision(approval.id, 'rejected')}
                        disabled={isActing || isLoading}
                        className="min-h-[44px] border-rose-200 text-rose-700 hover:bg-rose-50 active:scale-[0.97] transition-transform text-xs"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDecision(approval.id, 'approved')}
                        disabled={isActing || isLoading}
                        className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.97] transition-transform text-xs font-semibold"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                        Approve & Execute
                      </Button>
                    </div>
                  )}
                </div>

                {/* Collapsible Details */}
                <div className="px-4 pb-3 border-t border-slate-100 bg-slate-50/50">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium py-2 min-h-[44px]"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" /> Hide Tool Payload & Audit Notes
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" /> Inspect Tool Payload & Add Review Note
                      </>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="space-y-3 pb-3 pt-1">
                      <div>
                        <span className="text-[11px] font-semibold uppercase text-slate-500 block mb-1">
                          Input Arguments Payload
                        </span>
                        <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-lg overflow-x-auto max-h-48">
                          {JSON.stringify(approval.inputPayload, null, 2)}
                        </pre>
                      </div>

                      {isPending && (
                        <div>
                          <span className="text-[11px] font-semibold uppercase text-slate-500 block mb-1">
                            Adjudication Notes (Optional Rationale)
                          </span>
                          <Textarea
                            rows={2}
                            value={notesMap[approval.id] || ''}
                            onChange={(e) =>
                              setNotesMap((prev) => ({ ...prev, [approval.id]: e.target.value }))
                            }
                            placeholder="Add reason or governance rationale for this decision..."
                            className="text-xs bg-white border-slate-200"
                          />
                        </div>
                      )}

                      {approval.executionResult && (
                        <div>
                          <span className="text-[11px] font-semibold uppercase text-emerald-600 block mb-1">
                            Execution Output (Completed Post-Approval)
                          </span>
                          <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto max-h-48">
                            {JSON.stringify(approval.executionResult, null, 2)}
                          </pre>
                        </div>
                      )}

                      {approval.executionError && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                          <span className="font-semibold block mb-0.5">Execution Failure:</span>
                          <p className="font-mono">{approval.executionError}</p>
                        </div>
                      )}

                      {approval.adjudicationNotes && (
                        <div className="p-2.5 bg-slate-100 rounded-lg text-xs text-slate-700">
                          <span className="font-semibold block mb-0.5">Adjudicator Rationale:</span>
                          <p>{approval.adjudicationNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
