'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Search,
  Loader2,
  Sparkles,
  ExternalLink,
  Info,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileText,
  Phone,
  Calendar,
  ListTodo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  hybridSearchKnowledgeAction,
  askSmartSappKnowledgeAction,
} from '@/lib/quick-notes-search-actions';
import { formatNoteDate } from './quick-notes-ui';
import type {
  HybridSearchResult,
  AskKnowledgeResponse,
  UnifiedNoteSource,
} from '@/lib/quick-notes-types';

const SOURCE_LABEL: Record<UnifiedNoteSource, string> = {
  quick_note: 'Note',
  entity_note: 'Entity',
  task_note: 'Task',
  call_note: 'Call',
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  quick_note: <FileText className="h-3 w-3 text-blue-500" />,
  entity_note: <FileText className="h-3 w-3 text-emerald-500" />,
  call_note: <Phone className="h-3 w-3 text-violet-500" />,
  task_note: <ListTodo className="h-3 w-3 text-rose-500" />,
};

export interface AskNotesDialogProps {
  workspaceId: string | null | undefined;
  userId: string | undefined;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTriggerButton?: boolean;
}

export default function AskNotesDialog({
  workspaceId,
  userId,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  showTriggerButton = true,
}: AskNotesDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? externalOnOpenChange || (() => {}) : setInternalOpen;

  const [activeTab, setActiveTab] = React.useState<'search' | 'ask'>('search');
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<HybridSearchResult[] | null>(null);
  const [askResponse, setAskResponse] = React.useState<AskKnowledgeResponse | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  const runSearch = async () => {
    if (!query.trim() || !workspaceId || !userId) return;
    setLoading(true);
    setMessage(null);
    setSearchResults(null);

    const res = await hybridSearchKnowledgeAction({
      workspaceId,
      userId,
      query,
      limit: 12,
    });

    if (res.success) {
      setSearchResults(res.data);
      if (res.data.length === 0) setMessage('No matching knowledge records found.');
      if (res.fallbackNotice) setMessage(res.fallbackNotice);
    } else {
      setMessage(res.error);
    }
    setLoading(false);
  };

  const runAsk = async () => {
    if (!query.trim() || !workspaceId || !userId) return;
    setLoading(true);
    setMessage(null);
    setAskResponse(null);

    const res = await askSmartSappKnowledgeAction({
      workspaceId,
      userId,
      query,
    });

    if (res.success) {
      setAskResponse(res.data);
    } else {
      setMessage(res.error);
    }
    setLoading(false);
  };

  const handleExecute = () => {
    if (activeTab === 'search') {
      void runSearch();
    } else {
      void runAsk();
    }
  };

  return (
    <>
      {showTriggerButton && (
        <Button
          type="button"
          variant="outline"
          className="gap-2 min-h-[44px] md:min-h-[36px]"
          onClick={() => setOpen(true)}
          disabled={!userId}
        >
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span>Ask Company Brain</span>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-4 md:p-6 overflow-hidden">
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-serif text-lg tracking-tight flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span>Company Brain Knowledge Hub</span>
              </DialogTitle>
              <Link href="/admin/quick-notes/ask" onClick={() => setOpen(false)}>
                <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground">
                  Open Dedicated Page
                </Button>
              </Link>
            </div>
          </DialogHeader>

          {/* Mode Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'search' | 'ask')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="search" className="text-xs gap-1.5 min-h-[36px]">
                <Search className="h-3.5 w-3.5" />
                <span>Instant Hybrid Search</span>
              </TabsTrigger>
              <TabsTrigger value="ask" className="text-xs gap-1.5 min-h-[36px]">
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                <span>Ask AI Grounded Answer</span>
              </TabsTrigger>
            </TabsList>

            {/* Omnibar Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleExecute();
                    }
                  }}
                  placeholder={
                    activeTab === 'search'
                      ? 'Search notes, entities, calls, or tags...'
                      : 'Ask a question (e.g., What concerns did schools raise?)...'
                  }
                  aria-label="Knowledge query input"
                  className="pl-9 min-h-[44px] bg-background border-border"
                />
              </div>
              <Button
                onClick={handleExecute}
                disabled={loading || !query.trim() || !userId}
                className="min-h-[44px] px-4 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : activeTab === 'search' ? 'Search' : 'Ask'}
              </Button>
            </div>

            {/* Tab Contents */}
            <div className="mt-3 flex-1 overflow-y-auto max-h-[55vh] pr-1 space-y-2">
              {message && (
                <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </p>
              )}

              {/* SEARCH RESULTS */}
              <TabsContent value="search" className="m-0 space-y-2">
                {searchResults?.map((row) => {
                  const href = row.originHref ?? '/admin/quick-notes';
                  return (
                    <Link
                      key={row.id}
                      href={href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 bg-card"
                    >
                      <div className="flex items-center gap-2">
                        {SOURCE_ICONS[row.source] || <FileText className="h-3.5 w-3.5" />}
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-semibold">
                          {SOURCE_LABEL[row.source] ?? row.source}
                        </Badge>
                        <span className="truncate text-sm font-medium text-foreground">
                          {row.title || 'Untitled note'}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          {formatNoteDate(row.createdAt)}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </div>

                      {row.matchedSnippets.length > 0 && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-1.5 rounded">
                          {row.matchedSnippets[0]}
                        </p>
                      )}

                      {row.matchedEntities.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-muted-foreground font-medium">Entities:</span>
                          {row.matchedEntities.map((ent, idx) => (
                            <Badge key={idx} variant="secondary" className="h-4 px-1.5 text-[9px]">
                              {ent}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </TabsContent>

              {/* ASK AI ANSWER */}
              <TabsContent value="ask" className="m-0 space-y-4">
                {askResponse && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-violet-600" />
                          <span className="text-xs font-semibold text-foreground">AI Grounded Synthesis</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 ${
                            askResponse.confidence === 'high'
                              ? 'text-emerald-700 dark:text-emerald-300 border-emerald-400'
                              : 'text-amber-700 dark:text-amber-300 border-amber-400'
                          }`}
                        >
                          {askResponse.confidence.toUpperCase()} CONFIDENCE ({askResponse.confidenceScore}%)
                        </Badge>
                      </div>

                      <p className="text-sm text-foreground leading-relaxed">
                        {askResponse.answer}
                      </p>

                      {askResponse.keyFindings.length > 0 && (
                        <div className="pt-2 border-t border-border/40 space-y-1">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Key Takeaways:</span>
                          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                            {askResponse.keyFindings.map((finding, idx) => (
                              <li key={idx}>{finding}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Citations */}
                    {askResponse.citations.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-muted-foreground">Supporting Citations ({askResponse.citations.length}):</span>
                        <div className="grid grid-cols-1 gap-2">
                          {askResponse.citations.map((c, idx) => (
                            <Link
                              key={idx}
                              href={c.originHref || '/admin/quick-notes'}
                              onClick={() => setOpen(false)}
                              className="p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors flex items-start justify-between gap-2"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                                    {c.sourceType}
                                  </Badge>
                                  <span className="text-xs font-medium text-foreground truncate max-w-[250px]">
                                    {c.title}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                                  "{c.excerpt}"
                                </p>
                              </div>
                              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
