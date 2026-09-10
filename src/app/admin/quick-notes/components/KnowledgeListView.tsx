'use client';

import * as React from 'react';
import { Pin, PinOff, Pencil, Trash2, Paperclip, School } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { QuickNote, QuickNoteCategory } from '@/lib/quick-notes-types';
import { categorySwatch, formatNoteDate } from './quick-notes-ui';
import { KNOWLEDGE_TYPE_META, normalizeKnowledgeType } from '@/lib/quick-notes-domain';

export interface KnowledgeListViewProps {
  notes: QuickNote[];
  categories: QuickNoteCategory[];
  onEdit: (note: QuickNote) => void;
  onTogglePin: (note: QuickNote) => void;
  onDelete: (note: QuickNote) => void;
}

interface RowProps {
  note: QuickNote;
  category?: QuickNoteCategory;
  onEdit: (note: QuickNote) => void;
  onTogglePin: (note: QuickNote) => void;
  onDelete: (note: QuickNote) => void;
}

const KnowledgeListRow = React.memo(function KnowledgeListRow({
  note,
  category,
  onEdit,
  onTogglePin,
  onDelete,
}: RowProps) {
  const swatch = categorySwatch(category?.color);
  const preview = (note.plainText || '').replace(/\s+/g, ' ').trim();
  const typeMeta = KNOWLEDGE_TYPE_META[normalizeKnowledgeType(note.knowledgeType)];
  const attachmentCount = note.attachments?.length ?? 0;

  return (
    <div
      className={cn(
        'group flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-left',
        swatch.edge,
        'border-l-[3px]'
      )}
    >
      {/* Left content area */}
      <div
        onClick={() => onEdit(note)}
        className="flex-1 min-w-0 cursor-pointer w-full flex items-start gap-3"
      >
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 mt-0.5',
            typeMeta.badgeColor
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', typeMeta.dotColor)} />
          {typeMeta.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-serif text-sm font-semibold text-foreground truncate">
              {note.title || 'Untitled'}
            </h4>
            {note.isPinned && (
              <Pin className="h-3 w-3 text-primary shrink-0 fill-primary/20" />
            )}
            {note.status === 'draft' && (
              <Badge variant="outline" className="h-4 px-1 text-[9px] text-amber-600 border-amber-300">
                Draft
              </Badge>
            )}
          </div>
          {preview && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {preview}
            </p>
          )}
        </div>
      </div>

      {/* Right meta and actions */}
      <div className="flex items-center gap-3 shrink-0 self-end md:self-auto w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-border/40">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {category && (
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', swatch.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', swatch.dot)} />
              {category.name}
            </span>
          )}

          {note.links?.entityName && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground/80 font-medium max-w-[120px] truncate">
              <School className="h-3 w-3 text-primary shrink-0" />
              <span className="truncate">{note.links.entityName}</span>
            </span>
          )}

          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px]">
              <Paperclip className="h-3 w-3" />
              {attachmentCount}
            </span>
          )}

          <span className="text-[11px] text-muted-foreground/70">{formatNoteDate(note.updatedAt || note.createdAt)}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:h-7 md:w-7 min-h-[36px] min-w-[36px] md:min-h-[28px] md:min-w-[28px]"
            title={note.isPinned ? 'Unpin' : 'Pin'}
            onClick={() => onTogglePin(note)}
          >
            {note.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:h-7 md:w-7 min-h-[36px] min-w-[36px] md:min-h-[28px] md:min-w-[28px]"
            title="Edit"
            onClick={() => onEdit(note)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:h-7 md:w-7 min-h-[36px] min-w-[36px] md:min-h-[28px] md:min-w-[28px] text-muted-foreground hover:text-destructive"
            title="Delete"
            onClick={() => onDelete(note)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});

export function KnowledgeListView({
  notes,
  categories,
  onEdit,
  onTogglePin,
  onDelete,
}: KnowledgeListViewProps) {
  const categoryMap = React.useMemo(() => {
    const map = new Map<string, QuickNoteCategory>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <KnowledgeListRow
          key={note.id}
          note={note}
          category={note.categoryId ? categoryMap.get(note.categoryId) : undefined}
          onEdit={onEdit}
          onTogglePin={onTogglePin}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
