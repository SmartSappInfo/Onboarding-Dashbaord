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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AssignContactsToTagDialog } from '@/components/tags/AssignContactsToTagDialog';
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
import { PlusCircle, Tag as TagIcon, Edit, Trash2, Hash, TrendingUp, Users, Search, BarChart3, Wrench, History, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
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

function TagForm({ formData, setFormData }: { formData: TagFormData, setFormData: React.Dispatch<React.SetStateAction<TagFormData>> }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[10px] font-semibold ">Tag Name *</Label>
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
        <Label className="text-[10px] font-semibold ">Description</Label>
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
          <Label className="text-[10px] font-semibold ">Category</Label>
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
          <Label className="text-[10px] font-semibold ">Color</Label>
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
        <span className="text-[10px] font-semibold text-muted-foreground">Preview:</span>
        <Badge
          className="text-white border-none font-bold text-xs"
          style={{ backgroundColor: formData.color }}
        >
          {formData.name || 'Tag Name'}
        </Badge>
      </div>
    </div>
  );
}

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
  const [assigningTag, setAssigningTag] = useState<Tag | null>(null);
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-8 pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="flex flex-col items-start">
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-foreground ">
                <TagIcon className="h-10 w-10 text-primary" />
                Tag Management
            </h1>
            <p className="text-muted-foreground font-medium text-lg mt-1">
              Intelligent contact labeling and segmentation registry
            </p>
          </div>
          <Button onClick={openCreate} className="rounded-xl font-bold shadow-lg h-11 px-8 transform active:scale-95 transition-all w-full sm:w-auto">
            <PlusCircle className="mr-2 h-5 w-5" />
            Create Tag
          </Button>
        </div>

        {/* Main navigation tabs */}
         <Tabs value={mainTab} onValueChange={v => setMainTab(v as any)}>
          <TabsList className="bg-transparent border border-border shadow-sm h-12 p-1 rounded-2xl gap-1 ring-1 ring-border">
            <TabsTrigger value="tags" className="rounded-xl font-bold text-[10px] px-6 gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md transition-all">
              <TagIcon className="h-4 w-4" /> Tag Registry
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl font-bold text-[10px] px-6 gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md transition-all">
              <BarChart3 className="h-4 w-4" /> Analytics Hub
            </TabsTrigger>
            <TabsTrigger value="cleanup" className="rounded-xl font-bold text-[10px] px-6 gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md transition-all">
              <Wrench className="h-4 w-4" /> Schema Cleanup
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-xl font-bold text-[10px] px-6 gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md transition-all">
              <History className="h-4 w-4" /> Audit Ledger
            </TabsTrigger>
          </TabsList>

          {/* Tags tab */}
          <TabsContent value="tags" className="mt-6 space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border border-border bg-transparent shadow-sm rounded-2xl ring-1 ring-border">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0"><Hash className="h-5 w-5" /></div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total Tags</p>
                      <p className="text-3xl font-bold tabular-nums tracking-tighter">{isLoading ? '—' : (tags?.length || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border bg-transparent shadow-sm rounded-2xl ring-1 ring-border">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 shrink-0"><Users className="h-5 w-5" /></div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Aggregate Registry</p>
                      <p className="text-3xl font-bold tabular-nums tracking-tighter">{isLoading ? '—' : totalUsage}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border bg-transparent shadow-sm rounded-2xl ring-1 ring-border">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 shrink-0"><TrendingUp className="h-5 w-5" /></div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Top Performer</p>
                      <p className="text-3xl font-bold tracking-tighter truncate max-w-[120px]">{isLoading ? '—' : (mostUsedTag?.name || 'None')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border bg-transparent shadow-sm rounded-2xl ring-1 ring-border">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 shrink-0"><TagIcon className="h-5 w-5" /></div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Taxonomies</p>
                      <p className="text-3xl font-bold tabular-nums tracking-tighter">
                        {isLoading ? '—' : Object.values(tagsByCategory).filter(arr => arr.length > 0).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

             {/* Search */}
             <Card className="border border-border shadow-sm rounded-2xl bg-transparent ring-1 ring-border">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-40" />
                  <Input
                    id="tag-search"
                    placeholder="Search the tag index by name or technical description…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 rounded-xl border border-border bg-background shadow-sm font-bold text-sm focus:ring-1 focus:ring-primary/20"
                    aria-label="Search tags"
                  />
                </div>
              </CardContent>
            </Card>

             {/* Tags by Category */}
            <Tabs value={activeCategory} onValueChange={v => setActiveCategory(v as TagCategory | 'all')}>
              <TabsList className="bg-transparent border border-border shadow-sm h-12 p-1 rounded-2xl flex-wrap h-auto gap-1 ring-1 ring-border mb-8">
                <TabsTrigger value="all" className="rounded-xl font-bold text-[10px] px-6 data-[state=active]:bg-background data-[state=active]:text-primary transition-all uppercase tracking-widest">
                  All Items ({tags?.length || 0})
                </TabsTrigger>
                {TAG_CATEGORIES.map(cat => (
                  <TabsTrigger key={cat.value} value={cat.value} className="rounded-xl font-bold text-[10px] px-6 data-[state=active]:bg-background data-[state=active]:text-primary transition-all uppercase tracking-widest">
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
 <div className="py-20 text-center border-2 border-dashed rounded-2xl">
 <TagIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
 <p className="text-[10px] font-semibold text-muted-foreground">
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
                               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {paginatedTags.map(tag => (
                        <Card key={tag.id} className="border border-border bg-transparent shadow-sm rounded-2xl ring-1 ring-border hover:shadow-md transition-all group overflow-hidden">
                          <div className="h-1.5 w-full transition-all group-hover:h-2" style={{ backgroundColor: tag.color }} />
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <p className="font-bold text-base tracking-tight truncate group-hover:text-primary transition-colors">{tag.name}</p>
                                {tag.description && (
                                  <p className="text-[10px] text-muted-foreground font-semibold line-clamp-1 opacity-70 italic">{tag.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 shrink-0">
                                {!tag.isSystem && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                                      onClick={() => setAssigningTag(tag)}
                                      title="Assign to Contacts"
                                    >
                                      <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                                      onClick={() => openEdit(tag)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => setDeletingTag(tag)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                              <Badge
                                variant="outline"
                                className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md", CATEGORY_COLORS[tag.category])}
                              >
                                {tag.category}
                              </Badge>
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] font-bold text-foreground">
                                  {tag.usageCount || 0} items
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {/* Load More */}
                    {hasMore && (
                      <div className="flex justify-center pt-12">
                        <Button
                          variant="outline"
                          className="rounded-xl font-bold h-11 px-8 bg-transparent ring-1 ring-border hover:bg-primary/5 hover:text-primary transition-all shadow-sm"
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
 <CardTitle className="text-sm font-semibold flex items-center gap-2">
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
 <DialogTitle className="font-semibold tracking-tight">Create New Tag</DialogTitle>
            <DialogDescription>Add a new tag to organize your contacts.</DialogDescription>
          </DialogHeader>
          <TagForm formData={formData} setFormData={setFormData} />
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
 <DialogTitle className="font-semibold tracking-tight">Edit Tag</DialogTitle>
            <DialogDescription>Update tag properties.</DialogDescription>
          </DialogHeader>
          <TagForm formData={formData} setFormData={setFormData} />
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
 <AlertDialogTitle className="font-semibold">Delete Tag?</AlertDialogTitle>
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

      <AssignContactsToTagDialog 
        open={!!assigningTag} 
        onOpenChange={(open) => !open && setAssigningTag(null)} 
        tag={assigningTag} 
        onComplete={() => invalidate()}
      />
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
