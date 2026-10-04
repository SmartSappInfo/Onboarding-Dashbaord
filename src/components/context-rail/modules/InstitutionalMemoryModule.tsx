'use client';

/**
 * @fileOverview Institutional Memory & Citations Module (Phase 8 Milestone 4 Task 4)
 *
 * Implements Module 3 of the Global Context Rail:
 * - Institutional memory records and grounded citations
 * - Rule 13 & 30: Untrusted content wrapped in `<untrusted_reference_data id="...">` container
 * - Confidence ratings and source indicators
 * - One-click verbatim copy with tactile feedback
 * - Rule 4 (Zero any/any[] strict typing)
 * - Rule 7 (Accessible touch targets >= 44px)
 */

import * as React from 'react';
import {
  Brain,
  Copy,
  Check,
  Sparkles,
  FileText,
  Mail,
  Phone,
  Video,
  Database,
  StickyNote,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { InstitutionalMemoryItem } from '@/platform/ui/context-rail';

export interface InstitutionalMemoryModuleProps {
  memories: InstitutionalMemoryItem[];
}

export function InstitutionalMemoryModule({ memories }: InstitutionalMemoryModuleProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const getSourceIcon = (source: InstitutionalMemoryItem['sourceType']) => {
    switch (source) {
      case 'crm':
        return <Database className="h-3 w-3" />;
      case 'email':
        return <Mail className="h-3 w-3" />;
      case 'call':
        return <Phone className="h-3 w-3" />;
      case 'meeting':
        return <Video className="h-3 w-3" />;
      case 'document':
        return <FileText className="h-3 w-3" />;
      case 'note':
        return <StickyNote className="h-3 w-3" />;
      default:
        return <Sparkles className="h-3 w-3" />;
    }
  };

  if (memories.length === 0) {
    return (
      <div
        data-testid="context-rail-memory-empty"
        className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/10 text-center space-y-1.5"
      >
        <Brain className="h-5 w-5 text-muted-foreground/60 mx-auto" />
        <p className="text-xs text-muted-foreground">No institutional memories indexed for this object.</p>
      </div>
    );
  }

  return (
    <div data-testid="context-rail-memory-module" className="space-y-3">
      {memories.map((item, index) => {
        const isCopied = copiedId === item.id;
        const confidencePct = Math.round(item.confidence * 100);

        return (
          <div
            key={item.id}
            className="p-3 rounded-xl border border-border/60 bg-muted/10 space-y-2 text-xs"
          >
            {/* Header: Citation Tag, Source & Confidence */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  [citation:{index + 1}]
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/60 capitalize">
                  {getSourceIcon(item.sourceType)}
                  {item.sourceType}
                </span>
                {item.sensitivity && item.sensitivity !== 'public' && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
                    {item.sensitivity}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono font-medium text-muted-foreground">
                  {confidencePct}% conf
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(item.id, item.snippet)}
                  aria-label={`Copy citation ${index + 1}`}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground active:scale-[0.95]"
                >
                  {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Title / Header */}
            {item.title && (
              <div className="font-medium text-foreground text-xs leading-snug">
                {item.title}
              </div>
            )}

            {/* Prompt Injection Isolation Boundary (Rule 13 & 30) */}
            <div
              data-testid="untrusted-reference-container"
              className="text-[11px] text-foreground/90 leading-relaxed font-mono whitespace-pre-wrap bg-background/60 p-2.5 rounded-lg border border-border/60 select-text overflow-x-auto"
            >
              {`<untrusted_reference_data id="citation_${item.id}">\n`}
              {item.snippet}
              {`\n</untrusted_reference_data>`}
            </div>

            {/* Footer Metadata */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
              <span className="truncate">Author: {item.author}</span>
              <span className="shrink-0 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: 'numeric',
                  day: 'numeric',
                  year: '2-digit',
                })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
