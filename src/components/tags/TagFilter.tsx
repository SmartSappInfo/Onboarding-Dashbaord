'use client';

import { useState, useMemo, useRef, useEffect, useId } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Tag, TagCategory } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Filter, Search, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HighlightedText } from './HighlightedText';

export interface TagFilter {
  tagIds: string[];
  logic: 'AND' | 'OR' | 'NOT';
  categoryFilter?: TagCategory;
}

interface TagFilterProps {
  onFilterChange: (filter: TagFilter) => void;
  className?: string;
}

const TAG_CATEGORIES: { value: TagCategory; label: string }[] = [
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'demographic', label: 'Demographic' },
  { value: 'interest', label: 'Interest' },
  { value: 'status', label: 'Status' },
  { value: 'lifecycle', label: 'Lifecycle' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'custom', label: 'Custom' },
];

const LOGIC_OPTIONS: { value: TagFilter['logic']; label: string; description: string }[] = [
  { value: 'AND', label: 'All tags', description: 'Contact must have all selected tags' },
  { value: 'OR', label: 'Any tag', description: 'Contact must have at least one selected tag' },
  { value: 'NOT', label: 'None of tags', description: 'Contact must not have any selected tag' },
];

export function TagFilter({ onFilterChange, className }: TagFilterProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace() as any;

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [logic, setLogic] = useState<TagFilter['logic']>('OR');
  const [categoryFilter, setCategoryFilter] = useState<TagCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const searchId = useId();

  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'tags'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('category', 'asc'),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: allTags } = useCollection<Tag>(tagsQuery);

  const filteredTags = useMemo(() => {
    if (!allTags) return [];
    const lower = searchTerm.toLowerCase();
    return allTags.filter(t => {
      const matchesSearch =
        !lower ||
        t.name.toLowerCase().includes(lower) ||
        t.description?.toLowerCase().includes(lower);
      const matchesCategory =
        categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [allTags, searchTerm, categoryFilter]);

  const selectedTagObjects = useMemo(
    () => (allTags || []).filter(t => selectedTagIds.includes(t.id)),
    [allTags, selectedTagIds]
  );

  const activeFilterCount =
    selectedTagIds.length + (categoryFilter !== 'all' ? 1 : 0);

  const emitChange = (
    nextTagIds: string[],
    nextLogic: TagFilter['logic'],
    nextCategory: TagCategory | 'all'
  ) => {
    onFilterChange({
      tagIds: nextTagIds,
      logic: nextLogic,
      categoryFilter: nextCategory !== 'all' ? nextCategory : undefined,
    });
  };

  const toggleTag = (tagId: string) => {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId];
    setSelectedTagIds(next);
    emitChange(next, logic, categoryFilter);
  };

  const handleLogicChange = (value: TagFilter['logic']) => {
    setLogic(value);
    emitChange(selectedTagIds, value, categoryFilter);
  };

  const handleCategoryChange = (value: TagCategory | 'all') => {
    setCategoryFilter(value);
    emitChange(selectedTagIds, logic, value);
  };

  const handleReset = () => {
    setSelectedTagIds([]);
    setLogic('OR');
    setCategoryFilter('all');
    setSearchTerm('');
    onFilterChange({ tagIds: [], logic: 'OR', categoryFilter: undefined });
  };

  // Reset focus when list changes
  useEffect(() => { setFocusedIndex(-1); }, [searchTerm, isOpen]);

  // Sync DOM focus to focused list item
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[focusedIndex]?.focus();
  }, [focusedIndex]);

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    const total = filteredTags.length;
    if (total === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => (i <= 0 ? total - 1 : i - 1));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      toggleTag(filteredTags[focusedIndex].id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const currentLogicLabel = LOGIC_OPTIONS.find(o => o.value === logic)?.label ?? 'Any tag';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Tag multi-select popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 rounded-xl font-bold text-xs gap-1.5 px-3',
              'min-h-[44px] sm:min-h-[32px]',
              'touch-manipulation cursor-pointer',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              activeFilterCount > 0 && 'border-primary text-primary'
            )}
            aria-label={`Filter by tags${activeFilterCount > 0 ? `. ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active` : ''}`}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Filter by Tags
            {activeFilterCount > 0 && (
              <Badge className="h-4 min-w-4 px-1 text-[9px] font-black bg-primary text-white border-none rounded-full" aria-hidden="true">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0 rounded-2xl shadow-2xl border-none"
          align="start"
          role="dialog"
          aria-label="Tag filter options"
        >
          <div className="p-3 border-b space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" aria-hidden="true">
              Filter by Tags
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
              <Input
                id={searchId}
                placeholder="Search tags…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={handleListKeyDown}
                className="pl-8 h-8 rounded-xl text-xs border-none bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary"
                autoFocus
                aria-label="Search tags to filter"
                aria-controls={listboxId}
                role="combobox"
                aria-expanded={true}
                aria-autocomplete="list"
                aria-activedescendant={focusedIndex >= 0 ? `filter-option-${filteredTags[focusedIndex]?.id}` : undefined}
              />
            </div>
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Available tags"
            aria-multiselectable="true"
            className="max-h-56 overflow-y-auto p-2"
            onKeyDown={handleListKeyDown}
          >
            {filteredTags.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4 font-medium" role="status">
                No tags found
              </p>
            ) : (
              filteredTags.map((tag, idx) => {
                const isSelected = selectedTagIds.includes(tag.id);
                const isFocused = focusedIndex === idx;
                return (
                  <button
                    key={tag.id}
                    id={`filter-option-${tag.id}`}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={isFocused ? 0 : -1}
                    onClick={() => toggleTag(tag.id)}
                    onFocus={() => setFocusedIndex(idx)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-2 rounded-xl transition-colors text-left',
                      'min-h-[44px] sm:min-h-0 sm:py-1.5',
                      'cursor-pointer touch-manipulation',
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                      isFocused
                        ? 'outline-none ring-2 ring-primary ring-inset'
                        : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
                    )}
                  >
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold flex-1 truncate">
                      <HighlightedText text={tag.name} query={searchTerm} />
                    </span>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold hidden sm:block">
                      {tag.category}
                    </span>
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0" aria-hidden="true">
                        <X className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="p-3 border-t space-y-3">
            {/* Logic selector */}
            <div className="space-y-1.5">
              <Label htmlFor="filter-logic" className="text-[10px] font-black uppercase tracking-widest">Match Logic</Label>
              <Select value={logic} onValueChange={v => handleLogicChange(v as TagFilter['logic'])}>
                <SelectTrigger id="filter-logic" className="h-8 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {LOGIC_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      <span className="font-bold">{opt.label}</span>
                      <span className="text-muted-foreground ml-1">— {opt.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category filter */}
            <div className="space-y-1.5">
              <Label htmlFor="filter-category" className="text-[10px] font-black uppercase tracking-widest">Category</Label>
              <Select
                value={categoryFilter}
                onValueChange={v => handleCategoryChange(v as TagCategory | 'all')}
              >
                <SelectTrigger id="filter-category" className="h-8 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold">All Categories</SelectItem>
                  {TAG_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Logic badge (shown when multiple tags selected) */}
      {selectedTagIds.length > 1 && (
        <Badge
          variant="outline"
          className={cn(
            'h-8 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer border-dashed',
            'min-h-[44px] sm:min-h-[32px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
          )}
          tabIndex={0}
          role="button"
          aria-label={`Match logic: ${currentLogicLabel}. Click to cycle`}
          onClick={() => {
            const next = logic === 'AND' ? 'OR' : logic === 'OR' ? 'NOT' : 'AND';
            handleLogicChange(next);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const next = logic === 'AND' ? 'OR' : logic === 'OR' ? 'NOT' : 'AND';
              handleLogicChange(next);
            }
          }}
        >
          {currentLogicLabel}
        </Badge>
      )}

      {/* Category filter badge */}
      {categoryFilter !== 'all' && (
        <Badge
          variant="outline"
          className="h-8 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest gap-1"
          aria-label={`Category filter: ${TAG_CATEGORIES.find(c => c.value === categoryFilter)?.label}`}
        >
          {TAG_CATEGORIES.find(c => c.value === categoryFilter)?.label}
          <button
            onClick={() => handleCategoryChange('all')}
            className={cn(
              'hover:bg-black/10 rounded-full p-0.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground'
            )}
            aria-label="Remove category filter"
          >
            <X className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        </Badge>
      )}

      {/* Selected tag badges */}
      {selectedTagObjects.map(tag => (
        <Badge
          key={tag.id}
          className="h-8 text-white border-none font-bold text-[10px] uppercase gap-1 pr-1.5 rounded-xl"
          style={{ backgroundColor: tag.color }}
          aria-label={`Active filter: ${tag.name}`}
        >
          {tag.name}
          <button
            onClick={() => toggleTag(tag.id)}
            className={cn(
              'ml-0.5 hover:bg-black/20 rounded-full p-0.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1'
            )}
            style={{ ['--tw-ring-offset-color' as string]: tag.color }}
            aria-label={`Remove ${tag.name} filter`}
          >
            <X className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        </Badge>
      ))}

      {/* Clear all button */}
      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className={cn(
            'h-8 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground px-2',
            'min-h-[44px] sm:min-h-[32px]',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
          )}
          aria-label={`Clear all ${activeFilterCount} tag filter${activeFilterCount !== 1 ? 's' : ''}`}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
