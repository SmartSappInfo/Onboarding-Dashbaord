'use client';

import * as React from 'react';
import Link from 'next/link';
import { NotebookPen, ArrowRight, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLinkedQuickNotes } from '@/lib/quick-notes-hooks';
import { formatNoteDate } from './quick-notes-ui';

export interface LinkedQuickNotesPanelProps {
  workspaceId: string | null | undefined;
  /** Which link field to match on. */
  by: 'entity' | 'task';
  /** The entity or task id this record is keyed by. */
  recordId: string;
  /** Optional heading override. */
  title?: string;
}

/**
 * Reverse panel: Quick Notes linked to this entity/task. Additive and
 * self-contained — mounted alongside existing detail-page content without
 * touching any legacy notes UI (design spec F6).
 */
export default function LinkedQuickNotesPanel({
  workspaceId,
  by,
  recordId,
  title = 'Quick Notes',
}: LinkedQuickNotesPanelProps) {
  const { data: notes, isLoading } = useLinkedQuickNotes(workspaceId, by, recordId);
  const items = notes ?? [];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <NotebookPen className="h-4 w-4 text-muted-foreground" />
          {title}
          {items.length > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {items.length}
            </Badge>
          )}
        </h3>
        <Link
          href="/admin/quick-notes"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open Quick Notes
          <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No quick notes linked yet. Link one from the Quick Notes editor.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((note) => (
            <li key={note.id} className="rounded-lg border border-border/60 p-2.5">
              <div className="flex items-center gap-1.5">
                {note.isPinned && <Pin className="h-3 w-3 text-primary" />}
                <span className="truncate text-sm font-medium text-foreground">
                  {note.title || 'Untitled note'}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {formatNoteDate(note.updatedAt || note.createdAt)}
                </span>
              </div>
              {note.plainText && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note.plainText}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
