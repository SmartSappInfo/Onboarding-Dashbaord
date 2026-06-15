'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, Loader2, Sparkles, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { semanticSearchNotes } from '@/lib/quick-notes-search-actions';
import { formatNoteDate } from './quick-notes-ui';
import type { NoteIndexRow, UnifiedNoteSource } from '@/lib/quick-notes-types';

const SOURCE_LABEL: Record<UnifiedNoteSource, string> = {
  quick_note: 'Note',
  entity_note: 'Entity',
  task_note: 'Task',
  call_note: 'Call',
};

export interface AskNotesDialogProps {
  workspaceId: string | null | undefined;
  userId: string | undefined;
}

export default function AskNotesDialog({ workspaceId, userId }: AskNotesDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<NoteIndexRow[] | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const run = async () => {
    if (!query.trim() || !workspaceId || !userId) return;
    setLoading(true);
    setMessage(null);
    setResults(null);
    const res = await semanticSearchNotes({ workspaceId, query, userId });
    if (res.success) {
      setResults(res.data);
      if (res.data.length === 0) setMessage('No matching notes found.');
    } else {
      setMessage(res.error);
    }
    setLoading(false);
  };

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)} disabled={!userId}>
        <Sparkles className="h-4 w-4" />
        Ask your notes
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg tracking-tight">Ask your notes</DialogTitle>
          </DialogHeader>

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
                    void run();
                  }
                }}
                placeholder="e.g. what did we promise the client about pricing?"
                aria-label="Ask your notes — semantic search query"
                className="pl-9"
              />
            </div>
            <Button onClick={run} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          <div className="mt-2 max-h-[50vh] space-y-2 overflow-y-auto">
            {message && (
              <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                {message}
              </p>
            )}

            {results?.map((row) => {
              const href = row.originHref ?? '/admin/quick-notes';
              return (
                <Link
                  key={row.id}
                  href={href}
                  className="block rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
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
                  {row.plainText && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.plainText}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
