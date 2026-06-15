'use client';

import * as React from 'react';
import { LayoutGrid, Pin, Plus, Trash2, NotebookPen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { QuickNoteCategory } from '@/lib/quick-notes-types';
import { CATEGORY_COLOR_KEYS, categorySwatch } from './quick-notes-ui';

export type BoardFilter =
  | { kind: 'all' }
  | { kind: 'pinned' }
  | { kind: 'category'; categoryId: string }
  | { kind: 'sources' };

export interface CategoryRailProps {
  categories: QuickNoteCategory[];
  counts: { all: number; pinned: number; byCategory: Record<string, number> };
  /** When the board hit its load cap, counts are partial — display them as "N+". */
  capped?: boolean;
  active: BoardFilter;
  onSelect: (filter: BoardFilter) => void;
  onCreateCategory: (name: string, color: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => void;
}

function RailItem({
  active,
  onClick,
  icon,
  label,
  count,
  dot,
  onDelete,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  count: number | string;
  dot?: string;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
        active ? 'bg-primary/10 text-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {dot ? <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', dot)} /> : icon}
      <span className="flex-1 truncate">{label}</span>
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete ${label}`}
          className="hidden text-muted-foreground hover:text-destructive group-hover:block"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

export default function CategoryRail({
  categories,
  counts,
  capped = false,
  active,
  onSelect,
  onCreateCategory,
  onDeleteCategory,
}: CategoryRailProps) {
  const fmt = (n: number) => (capped ? `${n}+` : n);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState(CATEGORY_COLOR_KEYS[1] ?? 'amber');
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreateCategory(name.trim(), color);
      setName('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <nav className="w-full md:w-56 shrink-0 space-y-1" aria-label="Note filters">
      <RailItem
        active={active.kind === 'all'}
        onClick={() => onSelect({ kind: 'all' })}
        icon={<LayoutGrid className="h-4 w-4" />}
        label="All notes"
        count={fmt(counts.all)}
      />
      <RailItem
        active={active.kind === 'pinned'}
        onClick={() => onSelect({ kind: 'pinned' })}
        icon={<Pin className="h-4 w-4" />}
        label="Pinned"
        count={fmt(counts.pinned)}
      />
      <RailItem
        active={active.kind === 'sources'}
        onClick={() => onSelect({ kind: 'sources' })}
        icon={<Layers className="h-4 w-4" />}
        label="All sources"
        count={fmt(counts.all)}
      />

      <div className="flex items-center justify-between px-3 pb-1 pt-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Categories</span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" title="New category">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3">
            <p className="text-sm font-medium">New category</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`Color ${key}`}
                  onClick={() => setColor(key)}
                  className={cn(
                    'h-6 w-6 rounded-full ring-offset-2 ring-offset-background transition',
                    categorySwatch(key).dot,
                    color === key && 'ring-2 ring-primary'
                  )}
                />
              ))}
            </div>
            <Button size="sm" className="w-full" onClick={submit} disabled={saving || !name.trim()}>
              Create
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {categories.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground/70">
          <NotebookPen className="mb-1 h-4 w-4" />
          Group notes into categories.
        </p>
      ) : (
        categories.map((c) => (
          <RailItem
            key={c.id}
            active={active.kind === 'category' && active.categoryId === c.id}
            onClick={() => onSelect({ kind: 'category', categoryId: c.id })}
            dot={categorySwatch(c.color).dot}
            label={c.name}
            count={fmt(counts.byCategory[c.id] ?? 0)}
            onDelete={() => onDeleteCategory(c.id)}
          />
        ))
      )}
    </nav>
  );
}
