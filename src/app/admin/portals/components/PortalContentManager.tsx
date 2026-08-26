'use client';

/**
 * {{Org_name}} Experience Platform — Portal Content Manager & Vault
 *
 * Tab component for authoring, filtering, and organizing Articles, Documentation,
 * Lessons, Resources, and Announcements inside the Portal Studio.
 */

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Rocket,
  Archive,
  Trash2,
  ExternalLink,
  Copy,
  BookOpen,
  FolderArchive,
  Sparkles,
  Share2,
  Video,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import { ContentEditorDrawer } from './ContentEditorDrawer';
import {
  listContentItemsByPortalAction,
  publishContentItemAction,
  archiveContentItemAction,
  deleteContentItemAction,
} from '@/app/actions/content-actions';
import type { ContentItem, ContentItemType } from '@/lib/types/content';

interface PortalContentManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds: string[];
}

const TYPE_ICONS: Record<ContentItemType, React.ComponentType<{ className?: string }>> = {
  article: FileText,
  lesson: Sparkles,
  resource: FolderArchive,
  page: Globe,
  announcement: Share2,
  video: Video,
  file: FolderArchive,
  embed: Globe,
};

export function PortalContentManager({
  portalId,
  portalSlug,
  organizationId,
  workspaceIds,
}: PortalContentManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<ContentItem | null>(null);
  const [serverItems, setServerItems] = React.useState<ContentItem[]>([]);
  const [isLoadingServer, setIsLoadingServer] = React.useState(true);

  const fetchServerItems = React.useCallback(async () => {
    if (!portalId) return;
    try {
      setIsLoadingServer(true);
      const res = await listContentItemsByPortalAction(portalId);
      if (res.success && res.data) {
        setServerItems(res.data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingServer(false);
    }
  }, [portalId]);

  React.useEffect(() => {
    fetchServerItems();
  }, [fetchServerItems]);

  // Firestore Query (realtime sync when available)
  const contentQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'content_items'),
            where('portalId', '==', portalId),
            orderBy('updatedAt', 'desc')
          )
        : null,
    [firestore, portalId]
  );

  const { data: contentItems, isLoading: isLoadingCollection } = useCollection<ContentItem>(contentQuery);

  const effectiveItems = (contentItems && contentItems.length > 0) ? contentItems : serverItems;
  const isLoading = isLoadingCollection && isLoadingServer && effectiveItems.length === 0;

  // Filter content items
  const filteredItems = React.useMemo(() => {
    return effectiveItems.filter(item => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.summary || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = selectedType === 'all' || item.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [effectiveItems, searchTerm, selectedType]);

  const handleOpenCreate = (type: ContentItemType = 'article') => {
    setEditingItem(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (item: ContentItem) => {
    setEditingItem(item);
    setIsEditorOpen(true);
  };

  const handlePublish = async (item: ContentItem) => {
    try {
      const res = await publishContentItemAction(item.id, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to publish.');
      toast({ title: 'Published! 🚀', description: `"${item.title}" is now live.` });
      fetchServerItems();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Publish failed.' });
    }
  };

  const handleArchive = async (item: ContentItem) => {
    try {
      const res = await archiveContentItemAction(item.id, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to archive.');
      toast({ title: 'Archived', description: `"${item.title}" moved to archive.` });
      fetchServerItems();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Archive failed.' });
    }
  };

  const handleDelete = async (item: ContentItem) => {
    if (!confirm(`Are you sure you want to permanently delete "${item.title}"?`)) return;
    try {
      const res = await deleteContentItemAction(item.id, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to delete.');
      toast({ title: 'Deleted', description: `"${item.title}" permanently removed.` });
      fetchServerItems();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Delete failed.' });
    }
  };

  const handleCopyLink = (item: ContentItem) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/portal/${portalSlug}/content/${item.type}/${item.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link Copied', description: 'Content URL ready to share.' });
  };

  return (
    <div className="space-y-6">
      {/* ── Action Bar & Filters ──────────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <FileText className="w-4 h-4" /> Content Vault & Library
              </div>
            </div>

            <Button
              onClick={() => handleOpenCreate('article')}
              className="h-10 px-4 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> Add Content Item
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by title, category, or slug..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-10 rounded-xl text-xs bg-background"
              />
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Content' },
                { id: 'article', label: 'Articles' },
                { id: 'page', label: 'Docs' },
                { id: 'lesson', label: 'Lessons' },
                { id: 'resource', label: 'Resources' },
                { id: 'announcement', label: 'News' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                    selectedType === t.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-card text-muted-foreground border border-border hover:border-primary/40'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Content Items Table / List ──────────────────────────────── */}
          {isLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-2xl space-y-3 bg-muted/20">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-foreground">
                  {searchTerm ? 'No content matches your filter' : 'No content items created yet'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {searchTerm ? 'Try a different search query.' : 'Create articles, docs, or downloads to populate this portal.'}
                </p>
              </div>
              <Button
                onClick={() => handleOpenCreate('article')}
                variant="outline"
                size="sm"
                className="rounded-xl font-bold text-xs gap-1.5 mt-2"
              >
                <Plus className="w-3.5 h-3.5" /> Create First Content Item
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5 pt-2">
              {filteredItems.map(item => {
                const IconComponent = TYPE_ICONS[item.type] || FileText;
                const publicUrl = `/portal/${portalSlug}/content/${item.type}/${item.slug}`;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card hover:bg-muted/20 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-foreground truncate max-w-sm">
                            {item.title}
                          </h5>
                          <Badge
                            variant={item.status === 'published' ? 'default' : 'secondary'}
                            className="text-[9px] uppercase font-bold px-1.5 py-0 rounded-md"
                          >
                            {item.status}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 rounded-md">
                            {item.category}
                          </Badge>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                          /content/{item.type}/{item.slug}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyLink(item)}
                        title="Copy Link"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>

                      <a href={publicUrl} target="_blank" rel="noopener noreferrer" title="View Live">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </a>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(item)}
                        className="h-8 w-8 rounded-lg text-primary"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-44">
                          <DropdownMenuItem onClick={() => handleOpenEdit(item)} className="text-xs font-semibold gap-2">
                            <Edit2 className="w-3.5 h-3.5" /> Edit Content
                          </DropdownMenuItem>
                          {item.status !== 'published' ? (
                            <DropdownMenuItem onClick={() => handlePublish(item)} className="text-xs font-semibold gap-2 text-emerald-600">
                              <Rocket className="w-3.5 h-3.5" /> Publish Now
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleArchive(item)} className="text-xs font-semibold gap-2 text-amber-600">
                              <Archive className="w-3.5 h-3.5" /> Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(item)} className="text-xs font-semibold gap-2 text-rose-500">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Slide-over Editor Drawer ──────────────────────────────────── */}
      <ContentEditorDrawer
        open={isEditorOpen}
        onOpenChange={(isOpen) => {
          setIsEditorOpen(isOpen);
          if (!isOpen) fetchServerItems();
        }}
        portalId={portalId}
        organizationId={organizationId}
        workspaceIds={workspaceIds}
        initialItem={editingItem}
      />
    </div>
  );
}
