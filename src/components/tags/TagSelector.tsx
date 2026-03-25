'use client';

import {
  useState,
  useMemo,
  useCallback,
  useOptimistic,
  useTransition,
  useRef,
  useEffect,
  useId,
} from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Tag, TagCategory } from '@/lib/types';
import { applyTagsAction, removeTagsAction, createTagAction } from '@/lib/tag-actions';
import { useToast } from '@/hooks/use-toast';
import { withRetryAction } from '@/lib/tag-retry';
import { HighlightedText } from './HighlightedText';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tag as TagIcon, X, Plus, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

const TAG_CATEGORIES: { value: TagCategory; label: string }[] = [
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'demographic', label: 'Demographic' },
  { value: 'interest', label: 'Interest' },
  { value: 'status', label: 'Status' },
  { value: 'lifecycle', label: 'Lifecycle' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'custom', label: 'Custom' },
];

const TAG_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
];

interface TagSelectorProps {
  contactId: string;
  contactType: 'school' | 'prospect';
  currentTagIds: string[];
  onTagsChange?: (tagIds: string[]) => void;
  className?: string;
}

export function TagSelector({
  contactId,
  contactType,
  currentTagIds,
  onTagsChange,
  className,
}: TagSelectorProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
  const { toast } = useToast();
  const isMobile = useMediaQuery('(max-width: 640px)');

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const searchId = useId();

  // aria-live announcement
  const [announcement, setAnnouncement] = useState('');

  const [optimisticTagIds, setOptimisticTagIds] = useOptimistic<string[]>(currentTagIds);
  const [isPending, startTransition] = useTransition();

  const recentTagsKey = `recent_tags_${activeWorkspaceId}`;

  const getRecentTagIds = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(recentTagsKey) || '[]'); }
    catch { return []; }
  }, [recentTagsKey]);

  const recordRecentTag = useCallback((tagId: string) => {
    if (typeof window === 'undefined') return;
    try {
      const prev = getRecentTagIds().filter(id => id !== tagId);
      localStorage.setItem(recentTagsKey, JSON.stringify([tagId, ...prev].slice(0, 10)));
    } catch { /* ignore */ }
  }, [recentTagsKey, getRecentTagIds]);

  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>('custom');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const currentTagObjects = useMemo(
    () => (allTags || []).filter(t => optimisticTagIds.includes(t.id)),
    [allTags, optimisticTagIds]
  );

  const flatAvailableTags = useMemo(() => {
    if (!allTags) return [];
    const lower = searchTerm.toLowerCase();
    const available = allTags.filter(t =>
      !optimisticTagIds.includes(t.id) &&
      (!lower || t.name.toLowerCase().includes(lower) || t.description?.toLowerCase().includes(lower))
    );
    if (!lower) {
      const recentIds = getRecentTagIds();
      const recentSet = new Set(recentIds);
      const recent = recentIds.map(id => available.find(t => t.id === id)).filter((t): t is Tag => !!t);
      return [...recent, ...available.filter(t => !recentSet.has(t.id))];
    }
    return available;
  }, [allTags, optimisticTagIds, searchTerm, getRecentTagIds]);

  const groupedAvailable = useMemo(() => {
    if (searchTerm) {
      const groups: Record<string, Tag[]> = {};
      flatAvailableTags.forEach(tag => {
        if (!groups[tag.category]) groups[tag.category] = [];
        groups[tag.category].push(tag);
      });
      return groups;
    }
    const recentIds = new Set(getRecentTagIds());
    const groups: Record<string, Tag[]> = {};
    const recentTags: Tag[] = [];
    flatAvailableTags.forEach(tag => {
      if (recentIds.has(tag.id)) { recentTags.push(tag); }
      else {
        if (!groups[tag.category]) groups[tag.category] = [];
        groups[tag.category].push(tag);
      }
    });
    return recentTags.length > 0 ? { 'Recent': recentTags, ...groups } : groups;
  }, [flatAvailableTags, searchTerm, getRecentTagIds]);

  // Reset focus when list changes
  useEffect(() => { setFocusedIndex(-1); }, [searchTerm, isOpen]);

  // Keyboard navigation handler for the tag list
  const handleListKeyDown = (e: React.KeyboardEvent) => {
    const total = flatAvailableTags.length;
    if (total === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => (i <= 0 ? total - 1 : i - 1));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      const tag = flatAvailableTags[focusedIndex];
      if (tag) { handleApply(tag.id); setIsOpen(false); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Sync DOM focus to focused list item
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[focusedIndex]?.focus();
  }, [focusedIndex]);

  const handleApply = async (tagId: string) => {
    if (!user) return;
    const tag = allTags?.find(t => t.id === tagId);
    startTransition(() => {
      setOptimisticTagIds(prev => prev.includes(tagId) ? prev : [...prev, tagId]);
    });
    const result = await withRetryAction(
      () => applyTagsAction(contactId, contactType, [tagId], user.uid, user.displayName || undefined),
      {
        onRetry: (attempt) => {
          setAnnouncement(`Retrying… attempt ${attempt + 1}`);
        },
      }
    );
    if (result.success) {
      recordRecentTag(tagId);
      onTagsChange?.([...currentTagIds, tagId]);
      setAnnouncement(`Tag "${tag?.name}" applied`);
      toast({
        title: 'Tag Applied',
        description: `"${tag?.name}" added to contact.`,
        action: (
          <button
            onClick={() => handleRemove(tagId)}
            className="text-xs font-bold underline underline-offset-2 hover:no-underline"
          >
            Undo
          </button>
        ),
      } as any);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
      setAnnouncement(`Failed to apply tag`);
    }
  };

  const handleRemove = async (tagId: string) => {
    if (!user) return;
    const tag = allTags?.find(t => t.id === tagId);
    startTransition(() => {
      setOptimisticTagIds(prev => prev.filter(id => id !== tagId));
    });
    const result = await withRetryAction(
      () => removeTagsAction(contactId, contactType, [tagId], user.uid, user.displayName || undefined),
      {
        onRetry: (attempt) => {
          setAnnouncement(`Retrying… attempt ${attempt + 1}`);
        },
      }
    );
    if (result.success) {
      onTagsChange?.(currentTagIds.filter(id => id !== tagId));
      setAnnouncement(`Tag "${tag?.name}" removed`);
      toast({
        title: 'Tag Removed',
        description: `"${tag?.name}" removed from contact.`,
        action: (
          <button
            onClick={() => handleApply(tagId)}
            className="text-xs font-bold underline underline-offset-2 hover:no-underline"
          >
            Undo
          </button>
        ),
      } as any);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleCreateAndApply = async () => {
    if (!newTagName.trim() || !user) return;
    setIsSubmitting(true);
    try {
      const result = await createTagAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || '',
        name: newTagName,
        description: newTagDescription || undefined,
        category: newTagCategory,
        color: newTagColor,
        userId: user.uid,
        userName: user.displayName || undefined,
      });
      if (result.success && result.data) {
        await handleApply(result.data.id);
        toast({ title: 'Tag Created & Applied', description: `"${newTagName}" added.` });
        setIsCreating(false);
        setNewTagName(''); setNewTagDescription('');
        setNewTagCategory('custom'); setNewTagColor('#3B82F6');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared tag list content used in both Popover and Drawer
  const TagListContent = () => (
    <>
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            ref={searchRef}
            id={searchId}
            placeholder="Search tags…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={handleListKeyDown}
            className="pl-8 h-9 rounded-xl text-xs border-none bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary"
            autoFocus
            aria-label="Search available tags"
            aria-controls={listboxId}
            aria-autocomplete="list"
            role="combobox"
            aria-expanded={true}
            aria-activedescendant={focusedIndex >= 0 ? `tag-option-${flatAvailableTags[focusedIndex]?.id}` : undefined}
          />
        </div>
      </div>

      {/* Tag list */}
      <div
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label="Available tags"
        aria-multiselectable="false"
        className="max-h-64 overflow-y-auto p-2"
        onKeyDown={handleListKeyDown}
      >
        {Object.entries(groupedAvailable).map(([category, tags]) => (
          <div key={category} role="group" aria-label={`${category} tags`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1" aria-hidden="true">
              {category}
            </p>
            {tags.map((tag, groupIdx) => {
              const globalIdx = flatAvailableTags.indexOf(tag);
              const isFocused = focusedIndex === globalIdx;
              return (
                <button
                  key={tag.id}
                  id={`tag-option-${tag.id}`}
                  role="option"
                  aria-selected={false}
                  tabIndex={isFocused ? 0 : -1}
                  onClick={() => { handleApply(tag.id); setIsOpen(false); }}
                  onFocus={() => setFocusedIndex(globalIdx)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-2 rounded-xl transition-colors text-left',
                    // min-h-[44px] ensures 44px touch target on mobile
                    'min-h-[44px] sm:min-h-0 sm:py-1.5',
                    'cursor-pointer touch-manipulation',
                    isFocused
                      ? 'bg-primary/10 outline-none ring-2 ring-primary ring-inset'
                      : 'hover:bg-muted/50 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
                  )}
                >
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                    aria-hidden="true"
                  />
                  <HighlightedText
                    text={tag.name}
                    query={searchTerm}
                    className="text-xs font-bold flex-1 truncate"
                  />
                  {tag.description && (
                    <HighlightedText
                      text={tag.description}
                      query={searchTerm}
                      className="text-[9px] text-muted-foreground truncate max-w-[80px] hidden sm:block"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
        {flatAvailableTags.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4 font-medium" role="status">
            {searchTerm ? 'No matching tags' : 'All tags applied'}
          </p>
        )}
      </div>

      {/* Create new tag */}
      <div className="p-2 border-t">
        <button
          onClick={() => { setIsCreating(true); setIsOpen(false); }}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-2 rounded-xl transition-colors text-primary',
            'min-h-[44px] sm:min-h-0',
            'cursor-pointer touch-manipulation',
            'hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
          )}
          aria-label="Create a new tag and apply it"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-xs font-black uppercase tracking-widest">Create New Tag</span>
        </button>
      </div>
    </>
  );

  const CreateTagForm = () => (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="new-tag-name" className="text-[10px] font-black uppercase tracking-widest">
          Name <span aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </Label>
        <Input
          id="new-tag-name"
          value={newTagName}
          onChange={e => setNewTagName(e.target.value)}
          placeholder="Tag name…"
          className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
          maxLength={50}
          aria-required="true"
          aria-describedby="new-tag-name-hint"
          onKeyDown={e => { if (e.key === 'Enter' && newTagName.trim()) handleCreateAndApply(); }}
        />
        <p id="new-tag-name-hint" className="text-[10px] text-muted-foreground">{newTagName.length}/50 characters</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-tag-desc" className="text-[10px] font-black uppercase tracking-widest">Description</Label>
        <Textarea
          id="new-tag-desc"
          value={newTagDescription}
          onChange={e => setNewTagDescription(e.target.value)}
          placeholder="Optional…"
          className="rounded-xl resize-none focus-visible:ring-2 focus-visible:ring-primary"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-tag-category" className="text-[10px] font-black uppercase tracking-widest">Category</Label>
          <Select value={newTagCategory} onValueChange={v => setNewTagCategory(v as TagCategory)}>
            <SelectTrigger id="new-tag-category" className="rounded-xl h-9 text-xs focus:ring-2 focus:ring-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {TAG_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest">Color</Label>
          <div className="flex flex-wrap gap-1.5 p-1.5 border rounded-xl" role="radiogroup" aria-label="Tag color">
            {TAG_COLORS.map(color => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={newTagColor === color}
                aria-label={`Color ${color}`}
                onClick={() => setNewTagColor(color)}
                className={cn(
                  'h-5 w-5 rounded-full transition-transform hover:scale-110',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  newTagColor === color && 'ring-2 ring-offset-1'
                )}
                style={{
                  backgroundColor: color,
                  // ring color matches the swatch for clear focus
                  ['--tw-ring-color' as string]: color,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      {/* aria-live region for screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {/* Applied tags */}
        {currentTagObjects.map(tag => (
          <Tooltip key={tag.id}>
            <TooltipTrigger asChild>
              <Badge
                className={cn(
                  'text-white border-none font-bold text-[10px] uppercase gap-1 pr-1 cursor-default transition-opacity',
                  isPending && 'opacity-70'
                )}
                style={{ backgroundColor: tag.color }}
                aria-label={`Tag: ${tag.name}${tag.description ? `. ${tag.description}` : ''}`}
              >
                {tag.name}
                <button
                  onClick={() => handleRemove(tag.id)}
                  disabled={isPending}
                  className={cn(
                    'ml-0.5 rounded-full p-0.5 transition-colors',
                    'hover:bg-black/20 disabled:cursor-not-allowed',
                    // Ensure 44px touch target on mobile via negative margin trick
                    'min-w-[24px] min-h-[24px] sm:min-w-0 sm:min-h-0',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1',
                  )}
                  style={{ ['--tw-ring-offset-color' as string]: tag.color }}
                  aria-label={`Remove tag ${tag.name}`}
                >
                  <X className="h-2.5 w-2.5" aria-hidden="true" />
                </button>
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px]">
              <p className="font-bold text-xs">{tag.name}</p>
              {tag.description && <p className="text-[10px] text-muted-foreground mt-0.5">{tag.description}</p>}
              <p className="text-[9px] uppercase font-black text-muted-foreground mt-1">{tag.category}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Add tag trigger — Drawer on mobile, Popover on desktop */}
        {isMobile ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-6 rounded-full border-dashed text-[10px] font-bold gap-1 px-2',
                'min-h-[44px] sm:min-h-0',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
              )}
              onClick={() => setIsOpen(true)}
              aria-label={`Add tag. ${currentTagObjects.length} tag${currentTagObjects.length !== 1 ? 's' : ''} applied`}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add Tag
            </Button>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetContent
                side="bottom"
                className="max-h-[85vh] rounded-t-2xl p-0 flex flex-col"
                aria-label="Tag selector"
              >
                <SheetHeader className="px-4 pt-4 pb-0">
                  <SheetTitle className="font-black uppercase tracking-tight text-sm">Add Tags</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                  <TagListContent />
                </div>
                <SheetFooter className="p-3 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl font-bold w-full min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Done
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <Popover open={isOpen} onOpenChange={open => { setIsOpen(open); if (!open) setSearchTerm(''); }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-6 rounded-full border-dashed text-[10px] font-bold gap-1 px-2',
                  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
                )}
                aria-label={`Add tag. ${currentTagObjects.length} tag${currentTagObjects.length !== 1 ? 's' : ''} applied`}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                Add Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-0 rounded-2xl shadow-2xl border-none"
              align="start"
              role="dialog"
              aria-label="Tag selector"
            >
              <TagListContent />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Create new tag dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Create & Apply Tag</DialogTitle>
          </DialogHeader>
          <CreateTagForm />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsCreating(false)}
              className="rounded-xl font-bold focus-visible:ring-2 focus-visible:ring-primary"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAndApply}
              disabled={isSubmitting || !newTagName.trim()}
              className="rounded-xl font-bold focus-visible:ring-2 focus-visible:ring-primary"
              size="sm"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create & Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
