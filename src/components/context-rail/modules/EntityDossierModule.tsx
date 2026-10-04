'use client';

/**
 * @fileOverview Entity Dossier Module (Phase 8 Milestone 4 Task 4)
 *
 * Implements Module 1 of the Global Context Rail:
 * - Entity identity, avatar/type icon, tier, and status
 * - Assigned owner, primary communication handles
 * - Tag pill display
 * - Last interaction timestamp
 * - Rule 4 (Zero any/any[] strict typing)
 * - Rule 7 (Accessible touch targets >= 44px)
 * - Rule 68 / §81 (No Dead Ends navigation)
 */

import * as React from 'react';
import Link from 'next/link';
import {
  User,
  Building,
  DollarSign,
  Ticket,
  CheckSquare,
  Mail,
  Phone,
  Clock,
  ExternalLink,
  Shield,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EntityDossier } from '@/platform/ui/context-rail';

export interface EntityDossierModuleProps {
  dossier: EntityDossier;
}

export function EntityDossierModule({ dossier }: EntityDossierModuleProps) {
  const getEntityIcon = (type: EntityDossier['entityType']) => {
    switch (type) {
      case 'contact':
      case 'lead':
        return <User className="h-4 w-4" />;
      case 'company':
        return <Building className="h-4 w-4" />;
      case 'deal':
        return <DollarSign className="h-4 w-4" />;
      case 'ticket':
        return <Ticket className="h-4 w-4" />;
      case 'task':
        return <CheckSquare className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('active') || s.includes('won') || s.includes('closed') || s.includes('vip')) {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-medium">
          {status}
        </Badge>
      );
    }
    if (s.includes('pending') || s.includes('in_progress') || s.includes('negotiating')) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-medium">
          {status}
        </Badge>
      );
    }
    if (s.includes('lost') || s.includes('inactive') || s.includes('churned')) {
      return (
        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[11px] font-medium">
          {status}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[11px] font-medium">
        {status}
      </Badge>
    );
  };

  const formattedDate = React.useMemo(() => {
    try {
      return new Date(dossier.lastInteractionAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dossier.lastInteractionAt;
    }
  }, [dossier.lastInteractionAt]);

  return (
    <div data-testid="context-rail-dossier-module" className="space-y-3.5">
      {/* Identity Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            {getEntityIcon(dossier.entityType)}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate">{dossier.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                {dossier.entityType}
              </span>
              {dossier.tier && (
                <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                  <Shield className="h-3 w-3" />
                  {dossier.tier}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0">{getStatusBadge(dossier.status)}</div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {dossier.primaryEmail && (
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/20 border border-border/50 text-muted-foreground truncate">
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{dossier.primaryEmail}</span>
          </div>
        )}
        {dossier.primaryPhone && (
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/20 border border-border/50 text-muted-foreground truncate">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{dossier.primaryPhone}</span>
          </div>
        )}
        {dossier.assignedOwner && (
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/20 border border-border/50 text-muted-foreground truncate sm:col-span-2">
            <User className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-foreground/90 font-medium">Owner:</span>
            <span className="truncate">{dossier.assignedOwner.name}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {dossier.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Tag className="h-3 w-3 text-muted-foreground/60 shrink-0 mr-0.5" />
          {dossier.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/40 border border-border/60 text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Last Interaction & Action Target */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span>Last interaction {formattedDate}</span>
        </div>
        <Link
          href={`/admin/entities/${dossier.entityId}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline min-h-[32px] sm:min-h-[28px] active:scale-[0.97]"
        >
          View Full Entity
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
