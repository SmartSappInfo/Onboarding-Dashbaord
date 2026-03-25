'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Tag, TagCategory } from '@/lib/types';
import { previewCampaignAudience } from '@/lib/messaging-actions';
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Tag as TagIcon,
  X,
  Search,
  Users,
  Loader2,
  ChevronDown,
  Eye,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';

interface TagAudienceSelectorProps {
  /** Called whenever the segment changes */
  onChange: (segment: TagSegment) => void;
  className?: string;
}

export interface TagSegment {
  includeTagIds: string[];
  excludeTagIds: string[];
  includeLogic: 'AND' | 'OR';
}

const LOGIC_OPTIONS: { value: 'AND' | 'OR'; label: string; description: string }[] = [
  { value: 'OR', label: 'Any tag', description: 'Contact has at least one included tag' },
  { value: 'AND', label: 'All tags', description: 'Contact has every included tag' },
];

export function TagAudienceSelector({ onChange, className }: TagAudienceSelectorProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace() as any;

  const [includeTagIds, setIncludeTagIds] = React.useState<string[]>([]);
  const [excludeTagIds, setExcludeTagIds] = React.useState<string[]>([]);
  const [includeLogic, setIncludeLogic] = React.useState<'AND' | 'OR'>('OR');

  const [includeOpen, setIncludeOpen] = React.useState(false);
  const [excludeOpen, setExcludeOpen] = React.useState(false);
  const [includeSearch, setIncludeSearch] = React.useState('');
  const [excludeSearch, setExcludeSearch] = React.useState('');

  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [previewResult, setPreviewResult] = React.useState<{
    count: number;
    preview: { id: string; name: string; tags: string[] }[];
    tagDistribution: { tagId: string; tagName: string; count: number }[];
  } | null>(null);

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

  const emit = React.useCallback(
    (inc: string[], exc: string[], logic: 'AND' | 'OR') => {
      onChange({ includeTagIds: inc, excludeTagIds: exc, includeLogic: logic });
    },
    [onChange]
  );

  const toggleInclude = (tagId: string) => {
    const next = includeTagIds.includes(tagId)
      ? includeTagIds.filter(id => id !== tagId)
      : [...includeTagIds, tagId];
    setIncludeTagIds(next);
    emit(next, excludeTagIds, includeLogic);
  };

  const toggleExclude = (tagId: string) => {
    const next = excludeTagIds.includes(tagId)
      ? excludeTagIds.filter(id => id !== tagId)
      : [...excludeTagIds, tagId];
    setExcludeTagIds(next);
    emit(includeTagIds, next, includeLogic);
  };

  const handleLogicChange = (value: 'AND' | 'OR') => {
    setIncludeLogic(value);
    emit(includeTagIds, excludeTagIds, value);
  };

  const handlePreview = async () => {
    if (!activeWorkspaceId) return;
    setIsPreviewing(true);
    try {
      const result = await previewCampaignAudience({
        workspaceId: activeWorkspaceId,
        includeTagIds,
        excludeTagIds,
        includeLogic,
        limit: 5,
      });
      if (result.success) {
        setPreviewResult({
          count: result.count ?? 0,
          preview: result.preview ?? [],
          tagDistribution: result.tagDistribution ?? [],
        });
      }
    } finally {
      setIsPreviewing(false);
    }
  };

  const getTagById = (id: string) => allTags?.find(t => t.id === id);

  const filteredForInclude = React.useMemo(() => {
    if (!allTags) return [];
    const lower = includeSearch.toLowerCase();
    return allTags.filter(
      t =>
        !excludeTagIds.includes(t.id) &&
        (!lower || t.name.toLowerCase().includes(lower))
    );
  }, [allTags, excludeTagIds, includeSearch]);

  const filteredForExclude = React.useMemo(() => {
    if (!allTags) return [];
    const lower = excludeSearch.toLowerCase();
    return allTags.filter(
      t =>
        !includeTagIds.includes(t.id) &&
        (!lower || t.name.toLowerCase().includes(lower))
    );
  }, [allTags, includeTagIds, excludeSearch]);

  const hasFilters = includeTagIds.length > 0 || excludeTagIds.length > 0;

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <TagIcon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Tag-Based Audience</p>
          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
            Target contacts by tag segments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Include Tags */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
              <PlusCircle className="h-3 w-3" /> Include Tags
            </Label>
            {includeTagIds.length > 1 && (
              <Select value={includeLogic} onValueChange={v => handleLogicChange(v as 'AND' | 'OR')}>
                <SelectTrigger className="h-6 w-28 text-[9px] font-black uppercase border-emerald-200 text-emerald-700 bg-emerald-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {LOGIC_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      <span className="font-bold">{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Popover open={includeOpen} onOpenChange={setIncludeOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 rounded-xl border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold text-xs gap-2 justify-start"
              >
                <Search className="h-3.5 w-3.5" />
                {includeTagIds.length === 0 ? 'Select tags to include...' : `${includeTagIds.length} tag(s) selected`}
                <ChevronDown className="h-3 w-3 ml-auto opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 rounded-2xl shadow-2xl border-none" align="start">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search tags..."
                    value={includeSearch}
                    onChange={e => setIncludeSearch(e.target.value)}
                    className="pl-8 h-8 rounded-xl text-xs border-none bg-muted/30"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto p-2">
                {filteredForInclude.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleInclude(tag.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors text-left',
                      includeTagIds.includes(tag.id) ? 'bg-emerald-50' : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="text-xs font-bold flex-1 truncate">{tag.name}</span>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">{tag.category}</span>
                    {includeTagIds.includes(tag.id) && (
                      <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <X className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
                {filteredForInclude.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-4 font-medium">No tags found</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Selected include tags */}
          {includeTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {includeTagIds.map(id => {
                const tag = getTagById(id);
                if (!tag) return null;
                return (
                  <Badge
                    key={id}
                    className="text-white border-none font-bold text-[10px] uppercase gap-1 pr-1 rounded-lg"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => toggleInclude(id)}
                      className="ml-0.5 hover:bg-black/20 rounded-full p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Exclude Tags */}
        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-1.5">
            <MinusCircle className="h-3 w-3" /> Exclude Tags
          </Label>

          <Popover open={excludeOpen} onOpenChange={setExcludeOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 rounded-xl border-dashed border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs gap-2 justify-start"
              >
                <Search className="h-3.5 w-3.5" />
                {excludeTagIds.length === 0 ? 'Select tags to exclude...' : `${excludeTagIds.length} tag(s) excluded`}
                <ChevronDown className="h-3 w-3 ml-auto opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 rounded-2xl shadow-2xl border-none" align="start">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search tags..."
                    value={excludeSearch}
                    onChange={e => setExcludeSearch(e.target.value)}
                    className="pl-8 h-8 rounded-xl text-xs border-none bg-muted/30"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto p-2">
                {filteredForExclude.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleExclude(tag.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors text-left',
                      excludeTagIds.includes(tag.id) ? 'bg-rose-50' : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="text-xs font-bold flex-1 truncate">{tag.name}</span>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">{tag.category}</span>
                    {excludeTagIds.includes(tag.id) && (
                      <div className="h-4 w-4 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
                        <X className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
                {filteredForExclude.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-4 font-medium">No tags found</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Selected exclude tags */}
          {excludeTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {excludeTagIds.map(id => {
                const tag = getTagById(id);
                if (!tag) return null;
                return (
                  <Badge
                    key={id}
                    variant="outline"
                    className="font-bold text-[10px] uppercase gap-1 pr-1 rounded-lg border-rose-300 text-rose-700 bg-rose-50"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => toggleExclude(id)}
                      className="ml-0.5 hover:bg-rose-200 rounded-full p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview Button */}
      {hasFilters && (
        <>
          <Separator className="bg-border/50" />
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={isPreviewing}
              className="h-9 rounded-xl font-bold text-xs gap-2 border-primary/20 hover:bg-primary/5 text-primary"
            >
              {isPreviewing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              Preview Audience
            </Button>

            {previewResult && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-black text-primary">
                  {previewResult.count.toLocaleString()} recipient{previewResult.count !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Preview Results */}
          {previewResult && (
            <div className="rounded-2xl bg-muted/20 border p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
              {previewResult.preview.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    Sample Recipients
                  </p>
                  <div className="space-y-1.5">
                    {previewResult.preview.map(contact => (
                      <div key={contact.id} className="flex items-center gap-3 p-2 rounded-xl bg-white border">
                        <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{contact.name}</p>
                          <p className="text-[9px] text-muted-foreground truncate">
                            {contact.tags.slice(0, 3).join(', ')}
                            {contact.tags.length > 3 && ` +${contact.tags.length - 3} more`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewResult.tagDistribution.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    Tag Distribution
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {previewResult.tagDistribution.slice(0, 8).map(item => (
                      <Badge
                        key={item.tagId}
                        variant="outline"
                        className="text-[9px] font-bold uppercase rounded-lg"
                      >
                        {item.tagName}
                        <span className="ml-1 opacity-60">({item.count})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
