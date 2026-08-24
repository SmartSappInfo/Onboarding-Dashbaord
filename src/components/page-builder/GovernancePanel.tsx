'use client';

/**
 * @file src/components/page-builder/GovernancePanel.tsx
 * @description Studio Control Panel for Enterprise Governance, RBAC & Immutable Audit Logs.
 * Renders publish approval workflow controls, active approval requests, and audit history log feeds.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Mobile Touch Target Optimization (`min-h-[44px]`).
 * - Accessible focus outlines and visual active states.
 */

import React, { useState } from 'react';
import type { ApprovalRequest, PageAuditLog } from '@/lib/types';
import { evaluatePublishEligibility, hasBuilderPermission } from '@/lib/page-builder/governance-engine';
import { ShieldCheck, Lock, History, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';

export interface GovernancePanelProps {
  requiresApproval: boolean;
  userPermissions: string[];
  activeRequest?: ApprovalRequest;
  auditLogs: PageAuditLog[];
  onSubmitApproval: (notes: string) => void;
  onReviewApproval: (requestId: string, status: 'approved' | 'rejected') => void;
}

export const GovernancePanel: React.FC<GovernancePanelProps> = ({
  requiresApproval,
  userPermissions,
  activeRequest,
  auditLogs,
  onSubmitApproval,
  onReviewApproval,
}) => {
  const [requestNotes, setRequestNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'workflow' | 'audit'>('workflow');

  const eligibility = evaluatePublishEligibility(
    requiresApproval,
    userPermissions,
    activeRequest,
  );
  const isAdmin = hasBuilderPermission(userPermissions, 'studios_admin');

  return (
    <div className="w-full bg-background border border-border rounded-2xl p-4 space-y-4 shadow-sm">
      {/* Panel Header & Tab Switcher */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <div>
            <h4 className="font-semibold text-xs text-foreground">Enterprise Governance & Security</h4>
            <p className="text-[11px] text-muted-foreground">
              RBAC authorization, approval workflows & immutable audit logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl" role="tablist" aria-label="Governance Views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'workflow'}
            onClick={() => setActiveTab('workflow')}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97] flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === 'workflow'
                ? 'bg-background text-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Approval Flow
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97] flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === 'audit'
                ? 'bg-background text-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Audit History
          </button>
        </div>
      </div>

      {/* Tab 1: Approval Workflow */}
      {activeTab === 'workflow' && (
        <div className="space-y-3">
          {/* Eligibility Status Banner */}
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              eligibility.canPublish
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            {eligibility.canPublish ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
            ) : (
              <Clock className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">
                {eligibility.canPublish
                  ? 'Eligible to Publish'
                  : 'Publish Approval Required'}
              </p>
              {eligibility.reason && (
                <p className="text-[11px] opacity-90 mt-0.5">{eligibility.reason}</p>
              )}
            </div>
          </div>

          {/* Pending Approval Request Form (For Publishers) */}
          {eligibility.requiresApprovalRequest && (
            <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2.5">
              <h5 className="font-semibold text-xs text-foreground">Submit Approval Request</h5>
              <textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Optional notes explaining changes for admin review..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => {
                  onSubmitApproval(requestNotes);
                  setRequestNotes('');
                }}
                className="min-h-[44px] w-full px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
              >
                <Send className="w-3.5 h-3.5" /> Submit Request to Admins
              </button>
            </div>
          )}

          {/* Review Active Request Controls (For Admins) */}
          {activeRequest && activeRequest.status === 'pending' && isAdmin && (
            <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground">
                  Pending Request from {activeRequest.requesterEmail}
                </span>
                <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                  Pending Review
                </span>
              </div>
              {activeRequest.notes && (
                <p className="text-[11px] text-muted-foreground italic">
                  &ldquo;{activeRequest.notes}&rdquo;
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onReviewApproval(activeRequest.id, 'approved')}
                  className="min-h-[44px] flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.97] transition-all flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve Publish
                </button>
                <button
                  type="button"
                  onClick={() => onReviewApproval(activeRequest.id, 'rejected')}
                  className="min-h-[44px] flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.97] transition-all flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject Request
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Immutable Audit Log Feed */}
      {activeTab === 'audit' && (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {(auditLogs || []).length === 0 ? (
            <p className="text-center py-6 text-xs text-muted-foreground">
              No audit log entries recorded yet.
            </p>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-foreground capitalize">
                    {log.action.replace('_', ' ')}
                  </span>
                  <p className="text-[10px] text-muted-foreground">{log.actorEmail}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(log.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
