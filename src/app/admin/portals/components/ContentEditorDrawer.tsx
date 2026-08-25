'use client';

/**
 * {{Org_name}} Experience Platform — Content Editor Slide-Over Drawer
 *
 * Comprehensive editing environment for Articles, Documentation, Lessons,
 * Resources, and Announcements with rich text, media attachments, and scheduling.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { sanitizeSlug } from '@/lib/utils/slug-utils';
import {
  createContentItemAction,
  updateContentItemAction,
  publishContentItemAction,
} from '@/app/actions/content-actions';
import type {
  ContentItem,
  ContentItemType,
  ContentStatus,
  ContentMedia,
} from '@/lib/types/content';
import type { PortalVisibility } from '@/lib/types/portal';
import {
  Save,
  Rocket,
  FileText,
  Video,
  FileSpreadsheet,
  Globe,
  Share2,
  Calendar,
  Lock,
  Loader2,
  Image,
  Sparkles,
} from 'lucide-react';

interface ContentEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  organizationId: string;
  workspaceIds: string[];
  initialItem?: ContentItem | null;
  defaultType?: ContentItemType;
  onSaved?: (item: ContentItem) => void;
}

const TYPE_OPTIONS: { id: ContentItemType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'article', label: 'Article / Blog Post', icon: FileText },
  { id: 'lesson', label: 'Curriculum Lesson', icon: Sparkles },
  { id: 'resource', label: 'Downloadable Resource', icon: FileSpreadsheet },
  { id: 'page', label: 'Documentation Page', icon: Globe },
  { id: 'announcement', label: 'Announcement / News', icon: Share2 },
  { id: 'video', label: 'Video Lecture', icon: Video },
];

export function ContentEditorDrawer({
  open,
  onOpenChange,
  portalId,
  organizationId,
  workspaceIds,
  initialItem,
  defaultType = 'article',
  onSaved,
}: ContentEditorDrawerProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState('content');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [type, setType] = React.useState<ContentItemType>(defaultType);
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [content, setContent] = React.useState('');
  const [category, setCategory] = React.useState('General');
  const [tagInput, setTagInput] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<ContentStatus>('draft');
  const [visibility, setVisibility] = React.useState<PortalVisibility>('public');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [media, setMedia] = React.useState<ContentMedia>({});
  const [metaTitle, setMetaTitle] = React.useState('');
  const [metaDescription, setMetaDescription] = React.useState('');

  // Sync initial values
  React.useEffect(() => {
    if (initialItem) {
      setType(initialItem.type);
      setTitle(initialItem.title);
      setSlug(initialItem.slug);
      setSummary(initialItem.summary || '');
      setContent(initialItem.content || '');
      setCategory(initialItem.category || 'General');
      setTags(initialItem.tags || []);
      setStatus(initialItem.status);
      setVisibility(initialItem.visibility || 'public');
      setScheduledAt(initialItem.scheduledAt || '');
      setMedia(initialItem.media || {});
      setMetaTitle(initialItem.seo?.metaTitle || '');
      setMetaDescription(initialItem.seo?.metaDescription || '');
    } else {
      setType(defaultType);
      setTitle('');
      setSlug('');
      setSummary('');
      setContent('');
      setCategory('General');
      setTags([]);
      setStatus('draft');
      setVisibility('public');
      setScheduledAt('');
      setMedia({});
      setMetaTitle('');
      setMetaDescription('');
    }
  }, [initialItem, defaultType, open]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!initialItem) {
      setSlug(sanitizeSlug(val));
    }
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const clean = tagInput.trim().toLowerCase();
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = async (publishImmediately: boolean = false) => {
    if (!title.trim()) {
      toast({ title: 'Title Required', description: 'Please enter a title for this content item.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const targetStatus: ContentStatus = publishImmediately ? 'published' : status;

      if (initialItem) {
        // Update
        const res = await updateContentItemAction(
          initialItem.id,
          {
            title,
            slug,
            summary,
            content,
            category,
            tags,
            status: targetStatus,
            visibility,
            scheduledAt: scheduledAt || undefined,
            media,
            seo: {
              metaTitle: metaTitle || title,
              metaDescription: metaDescription || summary,
            },
          },
          portalId
        );

        if (!res.success || !res.data) throw new Error(res.error || 'Failed to update item.');

        toast({ title: 'Saved 🎉', description: `Updated "${title}".` });
        onSaved?.(res.data);
        onOpenChange(false);
      } else {
        // Create
        const res = await createContentItemAction({
          organizationId,
          portalId,
          workspaceIds,
          type,
          title,
          slug: slug || undefined,
          summary,
          content,
          category,
          tags,
          status: targetStatus,
          visibility,
          scheduledAt: scheduledAt || undefined,
          media,
          seo: {
            metaTitle: metaTitle || title,
            metaDescription: metaDescription || summary,
          },
        });

        if (!res.success || !res.data) throw new Error(res.error || 'Failed to create item.');

        toast({ title: 'Content Created! 🎉', description: `Created "${title}".` });
        onSaved?.(res.data);
        onOpenChange(false);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Save failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6 md:p-8 flex flex-col justify-between">
        <div className="space-y-6">
          <SheetHeader className="pb-2 border-b border-border">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <FileText className="w-4 h-4" /> Content Studio
            </div>
            <SheetTitle className="text-xl font-bold">
              {initialItem ? `Edit ${initialItem.title}` : 'Create Content Item'}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Author and publish articles, curriculum lessons, and downloadable toolkits.
            </SheetDescription>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full h-10 p-1 bg-muted/60 rounded-xl grid grid-cols-3">
              <TabsTrigger value="content" className="rounded-lg text-xs font-bold">
                Body & Text
              </TabsTrigger>
              <TabsTrigger value="media" className="rounded-lg text-xs font-bold">
                Media & Files
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg text-xs font-bold">
                Access & SEO
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Content Body ──────────────────────────────────── */}
            <TabsContent value="content" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Content Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map(opt => {
                    const IconComp = opt.icon;
                    const isSelected = type === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setType(opt.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold flex flex-col items-start gap-1 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary shadow-xs'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                        <span className="text-[11px] leading-tight">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content-title" className="text-xs font-bold">
                  Title <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="content-title"
                  placeholder="e.g. 5 Strategies for Prompt Fee Collection"
                  value={title}
                  onChange={handleTitleChange}
                  className="h-10 rounded-xl text-xs font-medium"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content-slug" className="text-xs font-bold">
                  URL Slug
                </Label>
                <Input
                  id="content-slug"
                  value={slug}
                  onChange={e => setSlug(sanitizeSlug(e.target.value))}
                  className="h-10 rounded-xl font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content-summary" className="text-xs font-bold">
                  Summary / Excerpt
                </Label>
                <Textarea
                  id="content-summary"
                  placeholder="Brief summary displayed on cards and search results..."
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  className="rounded-xl text-xs min-h-[64px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="content-body" className="text-xs font-bold">
                  Body Content (Markdown / Rich Text)
                </Label>
                <Textarea
                  id="content-body"
                  placeholder="# Enter your article or lesson content in markdown..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="rounded-xl text-xs font-mono min-h-[220px]"
                />
              </div>
            </TabsContent>

            {/* ── Tab 2: Media & Files ─────────────────────────────────── */}
            <TabsContent value="media" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Thumbnail / Cover Image URL</Label>
                <Input
                  placeholder="https://.../cover.png"
                  value={media.thumbnailUrl || ''}
                  onChange={e => setMedia({ ...media, thumbnailUrl: e.target.value })}
                  className="h-10 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Video URL (YouTube, Vimeo, Cloud Storage)</Label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={media.videoUrl || ''}
                  onChange={e => setMedia({ ...media, videoUrl: e.target.value })}
                  className="h-10 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Downloadable File URL</Label>
                <Input
                  placeholder="https://.../worksheet.xlsx"
                  value={media.downloadUrl || ''}
                  onChange={e => setMedia({ ...media, downloadUrl: e.target.value })}
                  className="h-10 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">File Format / MIME</Label>
                  <Input
                    placeholder="e.g. PDF or XLSX"
                    value={media.mimeType || ''}
                    onChange={e => setMedia({ ...media, mimeType: e.target.value })}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">File Size Text</Label>
                  <Input
                    placeholder="e.g. 2.4 MB"
                    value={media.fileName || ''}
                    onChange={e => setMedia({ ...media, fileName: e.target.value })}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── Tab 3: Access & SEO ──────────────────────────────────── */}
            <TabsContent value="settings" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Category</Label>
                  <Input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="h-10 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Visibility</Label>
                  <Select value={visibility} onValueChange={(val: PortalVisibility) => setVisibility(val)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="authenticated">Member Sign-in Required</SelectItem>
                      <SelectItem value="password_protected">Password Protected</SelectItem>
                      <SelectItem value="membership_required">Premium Membership Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Tags</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add tag and press Enter..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="h-10 rounded-xl text-xs"
                  />
                  <Button type="button" onClick={handleAddTag} size="sm" className="h-10 rounded-xl font-bold text-xs">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {tags.map(t => (
                    <Badge key={t} variant="secondary" className="text-xs rounded-lg gap-1">
                      #{t}
                      <button type="button" onClick={() => handleRemoveTag(t)} className="font-bold text-muted-foreground hover:text-rose-500">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border">
                <Label className="text-xs font-bold">SEO Meta Title</Label>
                <Input
                  value={metaTitle}
                  onChange={e => setMetaTitle(e.target.value)}
                  placeholder={title || 'Meta Title'}
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">SEO Meta Description</Label>
                <Textarea
                  value={metaDescription}
                  onChange={e => setMetaDescription(e.target.value)}
                  placeholder={summary || 'Meta Description'}
                  className="rounded-xl text-xs min-h-[64px] resize-none"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <SheetFooter className="flex flex-row items-center justify-between pt-6 border-t border-border mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold text-xs"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="rounded-xl font-bold text-xs gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </Button>

            <Button
              type="button"
              disabled={isSubmitting || !title.trim()}
              onClick={() => handleSave(true)}
              className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
              Publish Now
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
