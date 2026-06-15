'use client';

import * as React from 'react';
import Link from 'next/link';
import { School, CheckSquare, PhoneCall, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UnifiedNote, UnifiedNoteSource } from '@/lib/quick-notes-types';
import { formatNoteDate } from './quick-notes-ui';

const SOURCE_META: Record<
  Exclude<UnifiedNoteSource, 'quick_note'>,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  entity_note: { label: 'Entity', icon: School, className: 'text-sky-600 dark:text-sky-300' },
  task_note: { label: 'Task', icon: CheckSquare, className: 'text-violet-600 dark:text-violet-300' },
  call_note: { label: 'Call', icon: PhoneCall, className: 'text-emerald-600 dark:text-emerald-300' },
};

export interface AggregatedNoteCardProps {
  note: UnifiedNote;
}

function AggregatedNoteCardImpl({ note }: AggregatedNoteCardProps) {
  const meta = SOURCE_META[note.source as Exclude<UnifiedNoteSource, 'quick_note'>] ?? SOURCE_META.entity_note;
  const Icon = meta.icon;
  const preview = (note.plainText || '').trim();

  return (
    <article className="group relative flex flex-col rounded-xl border border-dashed border-border bg-muted/20 p-4 text-left">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', meta.className)} />
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', meta.className)}>
          {meta.label}
        </span>
        <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal text-muted-foreground">
          read-only
        </Badge>
      </div>

      {note.title && (
        <h3 className="font-serif text-sm font-semibold leading-snug tracking-tight text-foreground line-clamp-1">
          {note.title}
        </h3>
      )}
      {preview ? (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{preview}</p>
      ) : (
        <p className="mt-1 text-sm italic text-muted-foreground/60">No text</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{formatNoteDate(note.createdAt)}</span>
          {note.createdByName && <span className="truncate max-w-[100px]">· {note.createdByName}</span>}
        </div>
        {note.originHref && (
          <Link
            href={note.originHref}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity hover:underline group-hover:opacity-100 focus:opacity-100"
          >
            Open in context
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </article>
  );
}

export const AggregatedNoteCard = React.memo(AggregatedNoteCardImpl);
