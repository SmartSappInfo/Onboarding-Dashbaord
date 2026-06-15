'use client';

import * as React from 'react';
import { Pin, PinOff, Pencil, Trash2, Link2, CheckSquare, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { QuickNote, QuickNoteCategory } from '@/lib/quick-notes-types';
import { categorySwatch, formatNoteDate } from './quick-notes-ui';

export interface QuickNoteCardProps {
  note: QuickNote;
  category?: QuickNoteCategory;
  onEdit: (note: QuickNote) => void;
  onTogglePin: (note: QuickNote) => void;
  onDelete: (note: QuickNote) => void;
}

function QuickNoteCardImpl({ note, category, onEdit, onTogglePin, onDelete }: QuickNoteCardProps) {
  const swatch = categorySwatch(category?.color);
  const preview = (note.plainText || '').trim();
  const hasLinks = !!(note.links?.entityId || note.links?.taskId || note.links?.dealId);
  const attachmentCount = note.attachments?.length ?? 0;

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-xl border border-border border-l-[3px] bg-card p-4 text-left',
        'shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        swatch.edge,
        category && swatch.soft
      )}
    >
      {/* Pinned dog-ear motif */}
      {note.isPinned && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[18px] border-t-[18px] border-l-transparent border-t-primary/40 rounded-tr-xl"
        />
      )}

      <button
        type="button"
        onClick={() => onEdit(note)}
        className="flex-1 text-left outline-none"
        aria-label={`Open note: ${note.title}`}
      >
        <h3 className="font-serif text-base font-semibold leading-snug tracking-tight text-foreground line-clamp-2">
          {note.title || 'Untitled note'}
        </h3>
        {preview ? (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{preview}</p>
        ) : (
          <p className="mt-1.5 text-sm italic text-muted-foreground/60">No additional text</p>
        )}
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {category && (
          <span className={cn('inline-flex items-center gap-1 text-xs font-medium', swatch.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', swatch.dot)} />
            {category.name}
          </span>
        )}
        {note.tags?.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
            {tag}
          </Badge>
        ))}
        {note.tags && note.tags.length > 3 && (
          <span className="text-[10px] text-muted-foreground">+{note.tags.length - 3}</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{formatNoteDate(note.updatedAt || note.createdAt)}</span>
          {note.links?.entityId && <Link2 className="h-3 w-3" aria-label="Linked to a record" />}
          {note.links?.taskId && <CheckSquare className="h-3 w-3" aria-label="Linked to a task" />}
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5" aria-label={`${attachmentCount} attachments`}>
              <Paperclip className="h-3 w-3" />
              {attachmentCount}
            </span>
          )}
          {hasLinks && note.links?.entityName && (
            <span className="truncate max-w-[120px]">{note.links.entityName}</span>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={note.isPinned ? 'Unpin' : 'Pin'}
            onClick={() => onTogglePin(note)}
          >
            {note.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => onEdit(note)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete"
            onClick={() => onDelete(note)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

/**
 * Memoized so the board can re-render (search/filter) without re-rendering every
 * card. Props are stable references from the parent (callbacks via useCallback).
 */
export const QuickNoteCard = React.memo(QuickNoteCardImpl);
