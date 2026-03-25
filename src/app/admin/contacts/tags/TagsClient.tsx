'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { TagCacheProvider, useTagCache } from '@/context/TagCacheContext';
import type { Tag, TagCategory } from '@/lib/types';
import { createTagAction, updateTagAction, deleteTagAction } from '@/lib/tag-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Tag as TagIcon, Edit, Trash2, Hash, TrendingUp, Users, Search, BarChart3, Wrench, History } from 'lucide-react';
import { TagUsageDashboard } from '@/components/tags/TagUsageDashboard';
import { TagCleanupTools } from '@/components/tags/TagCleanupTools';
import { TagAuditLogViewer } from '@/components/tags/TagAuditLogViewer';

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
  '#6B7280', '#0EA5E9', '#10B981', '#F59E0B',
];

const CATEGORY_COLORS: Record<TagCategory, string> = {
  behavioral: 'bg-blue-100 text-blue-700 border-blue-200',
  demographic: 'bg-purple-100 text-purple-700 border-purple-200',
  interest: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  status: 'bg-red-100 text-red-700 border-red-200',
  lifecycle: 'bg-amber-100 text-amber-700 border-amber-200',
  engagement: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  custom: 'bg-gray-100 text-gray-700 border-gray-200',
};

interface TagFormData {
  name: string;
  description: string;
  category: TagCategory;
  color: string;
}

const defaultFormData: TagFormData = {
  name: '',
  description: '',
  category: 'custom',
  color: '#3B82F6',
};

const PAGE_SIZE = 50;

function TagsClientInner() {
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as any;
  const { toast } = useToast();
  const { tags, isLoading, invalidate } = useTagCache();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<TagCategory | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState<TagFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mainTab, setMainTab] = useState<'tags' | 'analytics' | 'cleanup' | 'audit'>('tags');
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  // Pagination state
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredTags = useMemo(() => {
    if (!tags) return [];
    let result = tags;
    if (activeCategory !== 'all') {
      result = result.filter(t => t.category === activeCategory);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(lower) ||
        t.description?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [tags, activeCategory, searchTerm]);

  // Paginated slice of filtered tags
  const paginatedTags = useMemo(() => filteredTags.slice(0, visibleCount), [filteredTags, visibleCount]);
  const hasMore = filteredTags.length > visibleCount;

  const tagsByCategory = useMemo(() => {
    if (!tags) return {} as Record<TagCategory, Tag[]>;
    return TAG_CATEGORIES.reduce((acc, cat) => {
      acc[cat.value] = tags.filter(t => t.category === cat.value);
      return acc;
    }, {} as Record<TagCategory, Tag[]>);
  }, [tags]);

  const totalUsage = useMemo(() => tags?.reduce((sum, t) => sum + (t.usageCount || 0), 0) || 0, [tags]);
  const mostUsedTag = useMemo(() => tags?.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0], [tags]);

  const openCreate = () => {
    setFormData(defaultFormData);
    setIsCreateOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setFormData({
      name: tag.name,
      description: tag.description || '',
      category: tag.category,
      color: tag.color,
    });
    setEditingTag(tag);
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !user) return;
    setIsSubmitting(true);
    try {
      const result = await createTagAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || '',
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category,
        color: formData.color,
        userId: user.uid,
        userName: user.displayName || undefined,
      });
      if (result.success) {
        toast({ title: 'Tag Created', description: `"${formData.name}" has been added.` });
        invalidate();
        setIsCreateOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingTag || !formData.name.trim() || !user) return;
    setIsSubmitting(true);
    try {
      const result = await updateTagAction(
        editingTag.id,
        {
          name: formData.name,
          description: formData.description || undefined,
          category: formData.category,
          color: formData.color,
        },
        user.uid,
        user.displayName || undefined
      );
      if (result.success) {
        toast({ title: 'Tag Updated', description: `"${formData.name}" has been updated.` });
        invalidate();
        setEditingTag(null);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag || !user) return;
    setIsSubmitting(true);
    // Capture snapshot for undo
    const deletedTag = { ...deletingTag };
    const deletedUser = user;
    try {
      const result = await deleteTagAction(deletingTag.id, user.uid, user.displayName || undefined);
      if (result.success) {
        toast({
          title: 'Tag Deleted',
          description: `"${deletedTag.name}" removed from ${result.affectedCount} contacts.`,
          action: (
            <button
              onClick={async () => {
                await createTagAction({
                  workspaceId: activeWorkspaceId,
                  organizationId: activeOrganizationId || '',
                  name: deletedTag.name,
                  description: deletedTag.description,
                  category: deletedTag.category,
                  color: deletedTag.color,
                  userId: deletedUser.uid,
                  userName: deletedUser.displayName || undefined,
                });
                invalidate();
              }}
              className="text-xs font-bold underline underline-offset-2 hover:no-underline"
            >
              Undo
            </button>
          ),
        } as any);
        invalidate();
        setDeletingTag(null);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const TagForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest">Tag Name *</Label>
        <Input
          value={formData.name}
          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Hot Lead"
          className="rounded-xl"
          maxLength={50}
        />
        <p className="text-[10px] text-muted-foreground">{formData.name.length}/50 characters</p>
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest">Description</Label>
        <Textarea
          value={formData.description}
          onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
          placeholder="Optional description..."
          className="rounded-xl resize-none"
          rows={2}
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">Category</Label>
          <Select
            value={formData.category}
            onValueChange={v => setFormData(p => ({ ...p, category: v as TagCategory }))}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {TAG_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">Color</Label>
          <div className="flex flex-wrap gap-2 p-2 border rounded-xl">
            {TAG_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData(p => ({ ...p, color }))}
                className="h-6 w-6 rounded-full transition-transform hover:scale-110 ring-offset-2"
                style={{
                  backgroundColor: color,
                  outline: formData.color === color ? `2px solid ${color}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preview:</span>
        <Badge
          className="text-white border-none font-bold text-xs"
          style={{ backgroundColor: formData.color }}
        >
          {formData.name || 'Tag Name'}
        </Badge>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Tag Management</h1>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Organize contacts with flexible labels for intelligent segmentation
            </p>
          </div>
          <Button onClick={openCreate} className="rounded-xl font-bold shadow-lg h-11 px-6 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Create new tag">
            <PlusCircle className="mr-2 h-5 w-5" aria-hidden="true" />
            Create Tag
          </Button>
        </div>

        {/* Main navigation tabs */}
        <Tabs value={mainTab} onValueChange={v => setMainTab(v as any)}>
          <TabsList className="bg-background border shadow-sm p-1 h-12 rounded-2xl gap-1">
            <TabsTrigger value="tags" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4 gap-1.5">
              <TagIcon className="h-3.5 w-3.5" /> Tags
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4 gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="cleanup" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4 gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> Cleanup
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4 gap-1.5">
              <History className="h-3.5 w-3.5" /> Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Tags tab */}
          <TabsContent value="tags" className="mt-6 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-none shadow-sm rounded-2xl bg-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl"><Hash className="h-4 w-4 text-primary" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Tags</p>
                      <p className="text-2xl font-black tabular-nums">{isLoading ? '—' : (tags?.length || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm rounded-2xl bg-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-xl"><Users className="h-4 w-4 text-emerald-600" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Usages</p>
                      <p className="text-2xl font-black tabular-nums">{isLoading ? '—' : totalUsage}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm rounded-2xl bg-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-xl"><TrendingUp className="h-4 w-4 text-amber-600" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Most Used</p>
                      <p className="text-sm font-black truncate max-w-[100px]">{isLoading ? '—' : (mostUsedTag?.name || 'None')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm rounded-2xl bg-card">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl"><TagIcon className="h-4 w-4 text-blue-600" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categories</p>
                      <p className="text-2xl font-black tabular-nums">
                        {isLoading ? '—' : Object.values(tagsByCategory).filter(arr => arr.length > 0).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <Card className="border-none shadow-sm rounded-2xl bg-card">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  <Input
                    id="tag-search"
                    placeholder="Search tags by name or description…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Search tags"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tags by Category */}
            <Tabs value={activeCategory} onValueChange={v => setActiveCategory(v as TagCategory | 'all')}>
              <TabsList className="bg-background border shadow-sm p-1 h-12 rounded-2xl flex-wrap h-auto gap-1">
                <TabsTrigger value="all" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4">
                  All ({tags?.length || 0})
                </TabsTrigger>
                {TAG_CATEGORIES.map(cat => (
                  <TabsTrigger key={cat.value} value={cat.value} className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4">
                    {cat.label} ({tagsByCategory[cat.value]?.length || 0})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeCategory} className="mt-6">
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                  </div>
                ) : filteredTags.length === 0 ? (
                  <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-muted/10">
                    <TagIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {searchTerm ? 'No tags match your search' : 'No tags in this category'}
                    </p>
                    {!searchTerm && (
                      <Button variant="outline" size="sm" onClick={openCreate} className="mt-4 rounded-xl font-bold">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create First Tag
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paginatedTags.map(tag => (
                        <Card key={tag.id} className="border-border/50 shadow-sm rounded-2xl bg-card hover:shadow-md transition-all group">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="h-10 w-10 rounded-xl shrink-0 shadow-sm"
                                  style={{ backgroundColor: tag.color }}
                                />
                                <div className="min-w-0">
                                  <p className="font-black text-sm uppercase tracking-tight truncate">{tag.name}</p>
                                  {tag.description && (
                                    <p className="text-[10px] text-muted-foreground font-medium mt-0.5 line-clamp-1">{tag.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                {!tag.isSystem && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                                      onClick={() => openEdit(tag)}
                                      aria-label={`Edit tag ${tag.name}`}
                                    >
                                      <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
                                      onClick={() => setDeletingTag(tag)}
                                      aria-label={`Delete tag ${tag.name}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-black uppercase tracking-widest border ${CATEGORY_COLORS[tag.category]}`}
                              >
                                {tag.category}
                              </Badge>
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {tag.usageCount || 0} contacts
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {/* Load More */}
                    {hasMore && (
                      <div className="flex justify-center pt-4">
                        <Button
                          variant="outline"
                          className="rounded-xl font-bold"
                          onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                        >
                          Load More ({filteredTags.length - visibleCount} remaining)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Analytics tab */}
          <TabsContent value="analytics" className="mt-6">
            <TagUsageDashboard refreshKey={analyticsRefreshKey} />
          </TabsContent>

          {/* Cleanup tab */}
          <TabsContent value="cleanup" className="mt-6">
            <TagCleanupTools onTagsChanged={() => setAnalyticsRefreshKey(k => k + 1)} />
          </TabsContent>

          {/* Audit log tab */}
          <TabsContent value="audit" className="mt-6">
            <Card className="border-none shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Tag Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TagAuditLogViewer />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Create New Tag</DialogTitle>
            <DialogDescription>Add a new tag to organize your contacts.</DialogDescription>
          </DialogHeader>
          <TagForm />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button onClick={handleCreate} disabled={isSubmitting || !formData.name.trim()} className="rounded-xl font-bold">
              {isSubmitting ? 'Creating...' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTag} onOpenChange={open => !open && setEditingTag(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Edit Tag</DialogTitle>
            <DialogDescription>Update tag properties.</DialogDescription>
          </DialogHeader>
          <TagForm />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingTag(null)} className="rounded-xl font-bold">Cancel</Button>
            <Button onClick={handleUpdate} disabled={isSubmitting || !formData.name.trim()} className="rounded-xl font-bold">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTag} onOpenChange={open => !open && setDeletingTag(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">Delete Tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-bold">"{deletingTag?.name}"</span> from all{' '}
              <span className="font-bold">{deletingTag?.usageCount || 0} contacts</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Tag'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TagsClient() {
  return (
    <TagCacheProvider>
      <TagsClientInner />
    </TagCacheProvider>
  );
}
