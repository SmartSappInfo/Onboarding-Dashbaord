'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Context Citations Slide-Over Drawer
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deep Evidence Traceability:
 *    - Renders verbatim evidence quotes, timestamps, authors, and source types
 *      for all facts and memories included in the ContextPackage.
 * 2. Mobile Ergonomics & Accessibility (Rule 7):
 *    - All interactive surfaces adhere to >= 44px min-height (`min-h-[44px]`).
 *    - Accessible keyboard dismiss and ARIA labeling.
 * 3. Emil Kowalski Micro-Interactions:
 *    - Action buttons feature tactile compression (`active:scale-[0.97]`).
 * 4. Zero-`any` Standard:
 *    - Strictly typed with `ContextSourceCitation`.
 *
 * @testability Interactive UI drawer verified across desktop and mobile viewports.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Quote,
  ExternalLink,
  Copy,
  Check,
  Building2,
  FileText,
  Briefcase,
  Calendar,
  CheckSquare,
  Network,
  ShieldAlert,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { ContextSourceCitation } from '@/lib/memory/context-types';

export interface ContextCitationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  citations: ContextSourceCitation[];
  selectedCitationId?: string | null;
}

const SOURCE_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  crm: { label: 'CRM Profile', icon: Building2, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  crm_entity: { label: 'CRM Entity', icon: Building2, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  note: { label: 'Quick Note', icon: FileText, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  user_note: { label: 'User Note', icon: FileText, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  memory: { label: 'Memory Object', icon: FileText, color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  deal: { label: 'Deal Record', icon: Briefcase, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  meeting: { label: 'Meeting', icon: Calendar, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  task: { label: 'Task Item', icon: CheckSquare, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  graph: { label: 'Knowledge Graph', icon: Network, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' },
  conflict: { label: 'Contradiction Audit', icon: ShieldAlert, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' },
  call: { label: 'Phone Call', icon: Calendar, color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300' },
  email: { label: 'Email Thread', icon: FileText, color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' },
  whatsapp: { label: 'WhatsApp', icon: FileText, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  ai_flow: { label: 'AI Synthesis', icon: Network, color: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300' },
  agent: { label: 'Agent Insight', icon: Network, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
};

function getSourceConfig(type: string) {
  return SOURCE_TYPE_CONFIG[type] || {
    label: type.toUpperCase(),
    icon: FileText,
    color: 'bg-muted text-muted-foreground',
  };
}

export function ContextCitationDrawer({
  open,
  onOpenChange,
  citations,
  selectedCitationId,
}: ContextCitationDrawerProps) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (citation: ContextSourceCitation) => {
    navigator.clipboard.writeText(`"${citation.quoteSnippet || citation.excerpt || ''}" — Source: ${citation.title || citation.sourceTitle || 'Knowledge'}`);
    setCopiedId(citation.id || citation.sourceId);
    toast({
      title: 'Evidence Copied',
      description: 'Quotation copied to clipboard with source citation.',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col h-full bg-background border-l shadow-2xl"
      >
        <SheetHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Quote className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold tracking-tight">
                Grounded Citations
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                {citations.length} verified evidence source(s) backing this context package
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {citations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Quote className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium">No citations recorded</p>
                <p className="text-xs mt-1">This context package contains synthesized system facts.</p>
              </div>
            ) : (
              citations.map((citation, index) => {
                const config = getSourceConfig(citation.sourceType);
                const Icon = config.icon;
                const isSelected = selectedCitationId === citation.id;

                return (
                  <div
                    key={citation.id}
                    className={cn(
                      'rounded-xl border p-4 transition-all duration-150',
                      isSelected
                        ? 'border-primary bg-primary/[0.03] ring-2 ring-primary/20 shadow-sm'
                        : 'border-border/70 bg-card hover:border-border'
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-muted-foreground w-5">
                          #{index + 1}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn('text-[11px] font-medium flex items-center gap-1.5 px-2 py-0.5', config.color)}
                        >
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(citation)}
                          className="h-9 min-h-[44px] min-w-[44px] px-2 text-xs text-muted-foreground hover:text-foreground active:scale-[0.97] transition-transform flex items-center justify-center"
                          title="Copy quote and citation"
                        >
                          {copiedId === citation.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>

                        {citation.deepLinkPath && (
                          <Link href={citation.deepLinkPath}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 min-h-[44px] min-w-[44px] px-2 text-xs text-muted-foreground hover:text-foreground active:scale-[0.97] transition-transform flex items-center justify-center"
                              title="Open source record"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-semibold text-foreground mb-2 line-clamp-1">
                      {citation.title}
                    </h4>

                    {/* Verbatim snippet */}
                    <div className="relative rounded-lg bg-muted/40 border border-border/50 p-3 text-xs text-foreground/90 leading-relaxed font-sans italic">
                      &ldquo;{citation.quoteSnippet}&rdquo;
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40 text-[11px] text-muted-foreground">
                      <span>{citation.authorName ? `By ${citation.authorName}` : 'System Record'}</span>
                      <span className="font-mono">
                        {new Date(citation.timestamp || Date.now()).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
