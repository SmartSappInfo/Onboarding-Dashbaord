'use client';

/**
 * CRM Status & Ownership Visibility Card (Lead Intelligence 2.0 - Phase 9)
 * UI Spec Section 37: "Phase 9 UX — CRM Intelligence Status"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Prominent visibility for Not In CRM vs Existing Lead.
 * 2. 1-Click direct CRM record linkout.
 * 3. Proactive CRM Match Alert banner with trigger to CRMMatchStudioModal.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  ExternalLink, 
  User, 
  Clock, 
  GitMerge, 
  CheckCircle2, 
  PlusCircle, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import type { Prospect, CRMMatchCandidate } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface CRMStatusBadgeCardProps {
  prospect: Prospect;
  matchCandidate?: CRMMatchCandidate;
  onSyncToCRM: () => void;
  onOpenMatchStudio: () => void;
  isSyncing?: boolean;
  className?: string;
}

export const CRMStatusBadgeCard: React.FC<CRMStatusBadgeCardProps> = ({
  prospect,
  matchCandidate,
  onSyncToCRM,
  onOpenMatchStudio,
  isSyncing = false,
  className
}) => {
  const isSynced = prospect.syncStatus === 'synced';
  const hasMatchAlert = !isSynced && matchCandidate && matchCandidate.matchScore >= 75;

  return (
    <div className={cn("p-4 rounded-2xl border border-border/80 bg-card shadow-sm space-y-3", className)}>
      {/* Header / Primary Status */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            CRM Connection Status
          </h4>
        </div>

        {isSynced ? (
          <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Existing Lead in CRM</span>
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border/80 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Not in CRM</span>
          </Badge>
        )}
      </div>

      {/* Main Content Area */}
      {isSynced ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-muted/20 border border-border/60">
            {/* Assigned Owner */}
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                <User className="h-3 w-3" /> Owner
              </span>
              <p className="text-xs font-bold text-foreground truncate">
                {prospect.ownerName || 'Sales Operations Team'}
              </p>
            </div>

            {/* Current Stage */}
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                <GitMerge className="h-3 w-3" /> Pipeline Stage
              </span>
              <p className="text-xs font-bold text-primary truncate">
                {prospect.stageName || 'Qualified Lead'}
              </p>
            </div>

            {/* Last Activity */}
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3" /> Last Activity
              </span>
              <p className="text-xs font-bold text-foreground truncate">
                {prospect.lastActivityAt ? new Date(prospect.lastActivityAt).toLocaleDateString() : 'Recently active'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href={`/admin/entities?highlight=${prospect.syncedEntityId || prospect.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <span>View Full CRM Record</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Proactive Match Candidate Alert (UI Spec Section 38) */}
          {hasMatchAlert ? (
            <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-bold text-foreground">
                    Possible CRM Record Found ({matchCandidate.matchScore}% Match)
                  </span>
                </div>
                <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/40 text-[9px] font-mono font-bold">
                  {matchCandidate.matchedBy.toUpperCase()} MATCH
                </Badge>
              </div>

              <p className="text-xs text-foreground/80 font-medium">
                Matches existing entity: <strong className="text-foreground">"{matchCandidate.entityName}"</strong>.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={onOpenMatchStudio}
                  className="h-8 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg active:scale-[0.97]"
                >
                  Resolve Match in Studio
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">
                  Prospect has not been added to your CRM pipeline yet.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Creates an Entity record with contacts, phone, and intelligence scores.
                </p>
              </div>

              <Button
                size="sm"
                onClick={onSyncToCRM}
                disabled={isSyncing}
                className="h-8 px-3 text-xs font-bold bg-primary text-primary-foreground rounded-lg flex items-center gap-1.5 active:scale-[0.97]"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Create Lead</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
