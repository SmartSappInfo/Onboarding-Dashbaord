'use client';

/**
 * @fileOverview Related Entities Mesh Module (Phase 8 Milestone 4 Task 4)
 *
 * Implements Module 2 of the Global Context Rail:
 * - 2-degree entity relationship mesh (deals, contacts, companies, tickets)
 * - Financial amounts, currencies, relationship labels
 * - Rule 4 (Zero any/any[] strict typing)
 * - Rule 7 (Accessible touch targets >= 44px)
 * - Rule 68 / §81 (No Dead Ends navigation)
 */

import * as React from 'react';
import Link from 'next/link';
import {
  GitBranch,
  Building,
  User,
  DollarSign,
  Ticket,
  CheckSquare,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RelatedEntityRef } from '@/platform/ui/context-rail';

export interface RelatedEntitiesModuleProps {
  relatedEntities: RelatedEntityRef[];
}

export function RelatedEntitiesModule({ relatedEntities }: RelatedEntitiesModuleProps) {
  const getEntityIcon = (type: RelatedEntityRef['type']) => {
    switch (type) {
      case 'contact':
      case 'lead':
        return <User className="h-3.5 w-3.5" />;
      case 'company':
        return <Building className="h-3.5 w-3.5" />;
      case 'deal':
        return <DollarSign className="h-3.5 w-3.5" />;
      case 'ticket':
        return <Ticket className="h-3.5 w-3.5" />;
      case 'task':
        return <CheckSquare className="h-3.5 w-3.5" />;
      default:
        return <GitBranch className="h-3.5 w-3.5" />;
    }
  };

  if (relatedEntities.length === 0) {
    return (
      <div
        data-testid="context-rail-related-empty"
        className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/10 text-center space-y-1.5"
      >
        <GitBranch className="h-5 w-5 text-muted-foreground/60 mx-auto" />
        <p className="text-xs text-muted-foreground">No related entities mapped to this object yet.</p>
      </div>
    );
  }

  return (
    <div data-testid="context-rail-related-module" className="space-y-2">
      {relatedEntities.map((entity) => (
        <Link
          key={entity.id}
          href={entity.targetUrl}
          className="group block p-2.5 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/30 hover:border-border/90 transition-all active:scale-[0.98] min-h-[44px]"
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
                {getEntityIcon(entity.type)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {entity.name}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground capitalize">
                  <span>{entity.relationship}</span>
                  {entity.value !== undefined && (
                    <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      • {entity.currency || '$'}{entity.value.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {entity.status && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/80 text-muted-foreground font-normal">
                  {entity.status}
                </Badge>
              )}
              <ArrowRight className="h-3 w-3 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
