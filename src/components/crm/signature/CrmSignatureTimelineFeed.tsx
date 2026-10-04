'use client';

/**
 * @fileOverview CRM Signature Timeline Feed & Citations Component (Phase 9 Milestone 5)
 *
 * Implements 14-Step unified chronological timeline and grounded citations rendering:
 * - Rule 4: Strict Typing: Zero any / zero any[]
 * - Rule 7: Mobile-first >= 44px touch targets
 * - Rule 12: Canonical source categorization
 * - Rule 13 & 30: Untrusted reference data XML containerization (<untrusted_reference_data id="...">)
 * - Rule 68: Plain UI English without plain text walls
 */

import * as React from 'react';
import {
  Briefcase,
  Users,
  Calendar,
  FileText,
  CheckSquare,
  CreditCard,
  Brain,
  Quote,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  CrmSignatureTimelineEvent,
  CrmSignatureCitation,
} from '@/platform/agents/crm/signature/crm-signature-types';

function UntrustedReferenceData({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return React.createElement('untrusted_reference_data', { id, className }, children);
}

export interface CrmSignatureTimelineFeedProps {
  timeline: CrmSignatureTimelineEvent[];
  citations?: CrmSignatureCitation[];
  className?: string;
}

export function CrmSignatureTimelineFeed({
  timeline,
  citations = [],
  className,
}: CrmSignatureTimelineFeedProps) {
  const [showAllTimeline, setShowAllTimeline] = React.useState(false);
  const [showAllCitations, setShowAllCitations] = React.useState(false);

  const displayedTimeline = showAllTimeline ? timeline : timeline.slice(0, 5);
  const displayedCitations = showAllCitations ? citations : citations.slice(0, 4);

  const getCategoryIcon = (category: string) => {
    switch (category.toUpperCase()) {
      case 'COMMERCIAL':
      case 'DEAL':
        return <Briefcase className="h-4 w-4 text-emerald-500" />;
      case 'ENGAGEMENT':
      case 'MEETING':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'NOTE':
        return <FileText className="h-4 w-4 text-amber-500" />;
      case 'TASK':
        return <CheckSquare className="h-4 w-4 text-purple-500" />;
      case 'BILLING':
      case 'INVOICE':
        return <CreditCard className="h-4 w-4 text-cyan-500" />;
      case 'KNOWLEDGE':
      case 'MEMORY':
      default:
        return <Brain className="h-4 w-4 text-indigo-500" />;
    }
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'deal':
        return <Briefcase className="h-3.5 w-3.5 text-emerald-500" />;
      case 'meeting':
        return <Calendar className="h-3.5 w-3.5 text-blue-500" />;
      case 'note':
        return <FileText className="h-3.5 w-3.5 text-amber-500" />;
      case 'task':
        return <CheckSquare className="h-3.5 w-3.5 text-purple-500" />;
      case 'invoice':
        return <CreditCard className="h-3.5 w-3.5 text-cyan-500" />;
      default:
        return <Brain className="h-3.5 w-3.5 text-indigo-500" />;
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* 1. Chronological Timeline Highlights */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            14-Step Timeline Highlights ({timeline.length})
          </h4>
          {timeline.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllTimeline(!showAllTimeline)}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              {showAllTimeline ? (
                <>
                  Show Less <ChevronUp className="h-3 w-3 ml-1" />
                </>
              ) : (
                <>
                  View All ({timeline.length}) <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>

        {timeline.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
            No chronological timeline events recorded for this account.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
            {displayedTimeline.map((item) => (
              <div key={item.id} className="relative group">
                <div className="absolute -left-6 top-1.5 h-5 w-5 rounded-full bg-card border border-border flex items-center justify-center shadow-xs">
                  {getCategoryIcon(item.category)}
                </div>
                <div className="bg-muted/30 hover:bg-muted/50 transition-colors border border-border/60 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">{item.title}</span>
                    <Badge variant="outline" className="text-[10px] font-mono uppercase px-1.5 py-0">
                      {item.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/80 font-mono">
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="capitalize">{item.sourceRef.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Grounded Evidence Citations */}
      {citations.length > 0 && (
        <div className="pt-4 border-t border-border/60">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Quote className="h-3.5 w-3.5" />
              Grounded Evidence & Citations ({citations.length})
            </h4>
            {citations.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllCitations(!showAllCitations)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                {showAllCitations ? (
                  <>
                    Show Less <ChevronUp className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    View All ({citations.length}) <ChevronDown className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayedCitations.map((cite) => (
              <div
                key={cite.id}
                className="rounded-xl border border-border/70 bg-card p-3 flex flex-col justify-between hover:border-primary/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-foreground truncate">
                      {getSourceIcon(cite.sourceType)}
                      <span className="truncate">{cite.title}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0 px-1 py-0">
                      {Math.round(cite.confidence * 100)}% match
                    </Badge>
                  </div>

                  {/* Isolated Untrusted Reference Container (Rule 13 & 30) */}
                  <UntrustedReferenceData id={cite.id} className="block mt-1">
                    <p className="text-xs text-muted-foreground italic bg-muted/40 p-2 rounded-lg border border-border/40 font-serif leading-relaxed line-clamp-3">
                      &ldquo;{cite.snippet}&rdquo;
                    </p>
                  </UntrustedReferenceData>
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{new Date(cite.timestamp).toLocaleDateString()}</span>
                  {cite.deepLinkUrl && (
                    <a
                      href={cite.deepLinkUrl}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      Inspect <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
