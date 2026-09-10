'use client';

import * as React from 'react';
import { Pin, Pencil, Trash2, CheckSquare, School, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { QuickNote, QuickNoteCategory } from '@/lib/quick-notes-types';
import { categorySwatch, formatNoteDate } from './quick-notes-ui';
import { KNOWLEDGE_TYPE_META, normalizeKnowledgeType } from '@/lib/quick-notes-domain';

export interface KnowledgeTableViewProps {
  notes: QuickNote[];
  categories: QuickNoteCategory[];
  onEdit: (note: QuickNote) => void;
  onTogglePin: (note: QuickNote) => void;
  onDelete: (note: QuickNote) => void;
}

export function KnowledgeTableView({
  notes,
  categories,
  onEdit,
  onTogglePin,
  onDelete,
}: KnowledgeTableViewProps) {
  const [sortField, setSortField] = React.useState<'title' | 'updatedAt' | 'type'>('updatedAt');
  const [sortAsc, setSortAsc] = React.useState(false);

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, QuickNoteCategory>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const sortedNotes = React.useMemo(() => {
    const copy = [...notes];
    copy.sort((a, b) => {
      // Pinned items always float to top
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

      if (sortField === 'title') {
        const cmp = (a.title || '').localeCompare(b.title || '');
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'type') {
        const typeA = a.knowledgeType || 'note';
        const typeB = b.knowledgeType || 'note';
        const cmp = typeA.localeCompare(typeB);
        return sortAsc ? cmp : -cmp;
      }
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return sortAsc ? timeA - timeB : timeB - timeA;
    });
    return copy;
  }, [notes, sortField, sortAsc]);

  const toggleSort = (field: 'title' | 'updatedAt' | 'type') => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
            <tr>
              <th className="py-3 px-4 w-[40px] text-center">Pin</th>
              <th className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort('title')}>
                <div className="flex items-center gap-1.5">
                  <span>Title</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort('type')}>
                <div className="flex items-center gap-1.5">
                  <span>Type</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Linked Context</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4 cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort('updatedAt')}>
                <div className="flex items-center gap-1.5">
                  <span>Updated</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </div>
              </th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sortedNotes.map((note) => {
              const category = note.categoryId ? categoryMap.get(note.categoryId) : undefined;
              const swatch = categorySwatch(category?.color);
              const typeMeta = KNOWLEDGE_TYPE_META[normalizeKnowledgeType(note.knowledgeType)];

              return (
                <tr
                  key={note.id}
                  className="hover:bg-muted/40 transition-colors group cursor-pointer"
                  onClick={() => onEdit(note)}
                >
                  <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onTogglePin(note)}
                      className="text-muted-foreground hover:text-primary transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center mx-auto"
                      title={note.isPinned ? 'Unpin' : 'Pin'}
                    >
                      {note.isPinned ? (
                        <Pin className="h-4 w-4 text-primary fill-primary/30" />
                      ) : (
                        <Pin className="h-3.5 w-3.5 opacity-30 hover:opacity-100" />
                      )}
                    </button>
                  </td>

                  <td className="py-3 px-4 font-medium text-foreground max-w-[280px]">
                    <div className="flex flex-col">
                      <span className="font-serif font-semibold text-sm truncate">{note.title || 'Untitled'}</span>
                      {note.plainText && (
                        <span className="text-xs text-muted-foreground truncate font-sans">
                          {note.plainText}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border',
                        typeMeta.badgeColor
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', typeMeta.dotColor)} />
                      {typeMeta.label}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    {category ? (
                      <span className={cn('inline-flex items-center gap-1 text-xs font-medium', swatch.text)}>
                        <span className={cn('h-2 w-2 rounded-full', swatch.dot)} />
                        {category.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {note.links?.entityName ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted font-medium text-foreground/90 max-w-[150px] truncate">
                        <School className="h-3 w-3 text-primary shrink-0" />
                        <span className="truncate">{note.links.entityName}</span>
                      </span>
                    ) : note.links?.taskName ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted font-medium text-foreground/90 max-w-[150px] truncate">
                        <CheckSquare className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="truncate">{note.links.taskName}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                      {note.tags?.slice(0, 2).map((t) => (
                        <Badge key={t} variant="outline" className="h-4 px-1 text-[9px] font-normal">
                          {t}
                        </Badge>
                      ))}
                      {note.tags && note.tags.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{note.tags.length - 2}</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                    {formatNoteDate(note.updatedAt || note.createdAt)}
                  </td>

                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
