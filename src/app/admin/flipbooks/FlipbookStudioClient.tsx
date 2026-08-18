'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Workspace Scoping & Listener Efficiency:
 *    Queries `flipbooks` collection where `workspaceId == activeWorkspaceId`.
 * 2. Mobile Touch Compliance:
 *    All buttons, inputs, dropdowns, and card items enforce `min-h-[44px]` touch target bounds.
 * 3. Strict Typing Standard:
 *    No `any` or `any[]` types are permitted.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { FlipbookConfig } from '@/lib/types/flipbook-types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  BookOpen, Plus, Search, Eye, Sparkles, 
  Trash2, Edit3, ExternalLink, Copy, Check, Users, FileText
} from 'lucide-react';
import { createFlipbookAction, deleteFlipbookAction } from '@/lib/flipbook-actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function FlipbookStudioClient() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, isLoading: isWorkspaceLoading } = useWorkspace();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  
  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceFileUrl, setSourceFileUrl] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourceFileType, setSourceFileType] = useState<'pdf' | 'docx' | 'epub' | 'media'>('pdf');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Copied link toast feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const flipbooksCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'flipbooks');
  }, [firestore]);

  /**
   * MEMOIZED QUERY & RESILIENT SORTING:
   * Rule 10 Maintainer Guidance:
   * Queries workspace flipbooks by equality `workspaceId == activeWorkspaceId`.
   * Date sorting is performed in-memory inside `filteredFlipbooks` to prevent compound index
   * evaluation errors while maintaining strict reverse-chronological document ordering.
   */
  const flipbooksQuery = useMemoFirebase(() => {
    if (!flipbooksCol || !activeWorkspaceId) return null;
    return query(
      flipbooksCol,
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [flipbooksCol, activeWorkspaceId]);

  const { data: flipbooks, isLoading: isFlipbooksLoading } = useCollection<FlipbookConfig>(flipbooksQuery);

  const filteredFlipbooks = useMemo(() => {
    if (!flipbooks) return [];
    return flipbooks
      .filter((item) => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'ALL' || item.status.toUpperCase() === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [flipbooks, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    if (!flipbooks) return { total: 0, published: 0, totalFlips: 0, totalLeads: 0 };
    return {
      total: flipbooks.length,
      published: flipbooks.filter(f => f.status === 'published').length,
      totalFlips: flipbooks.reduce((acc, f) => acc + (f.flipsCount || 0), 0),
      totalLeads: flipbooks.reduce((acc, f) => acc + (f.leadsCount || 0), 0),
    };
  }, [flipbooks]);

  const handleCreate = async () => {
    if (!activeWorkspaceId || !title.trim() || !sourceFileUrl.trim()) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please enter a title and document URL.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createFlipbookAction({
        workspaceId: activeWorkspaceId,
        title: title.trim(),
        description: description.trim(),
        sourceFileUrl: sourceFileUrl.trim(),
        sourceFileType,
        sourceFileName: sourceFileName.trim() || 'document.pdf',
        pageCount: 1,
        aspectRatio: 1.414,
        userId: user?.uid || 'admin',
      });

      if (res.success && res.flipbookId) {
        toast({ title: 'Flipbook Created', description: `"${title}" has been initialized.` });
        setIsCreateOpen(false);
        setTitle('');
        setDescription('');
        setSourceFileUrl('');
        setSourceFileName('');
        router.push(`/admin/flipbooks/${res.flipbookId}/edit`);
      } else {
        toast({ variant: 'destructive', title: 'Creation Failed', description: res.error || 'Could not create flipbook.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, itemTitle: string) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await deleteFlipbookAction(id, activeWorkspaceId);
      if (res.success) {
        toast({ title: 'Flipbook Removed', description: `"${itemTitle}" has been deleted.` });
      } else {
        toast({ variant: 'destructive', title: 'Delete Failed', description: res.error || 'Could not delete flipbook.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    }
  };

  const handleCopyLink = (slug: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/f/${slug || id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: 'Link Copied', description: 'Flipbook reader URL copied to clipboard.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isLoading = isWorkspaceLoading || isFlipbooksLoading;

  return (
    <PageContainerFluid>
      <div className="h-full overflow-y-auto w-full">
        <div className="space-y-6 pb-32 w-full text-left">
          
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2.5">
                <BookOpen className="h-8 w-8 text-primary" />
                Flipbook Studio
              </h1>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                Convert PDFs, Word documents, and eBooks into interactive 3D Flipbooks and public landing pages.
              </p>
            </div>
            
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl font-bold text-xs gap-2 h-11 px-5 shadow-lg active:scale-[0.97] transition-all min-h-[44px] shrink-0"
            >
              <Plus className="h-4 w-4" />
              Create Flipbook
            </Button>
          </div>

          {/* KPI Analytics Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight">{stats.total}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Flipbooks</div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight">{stats.published}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Published Landing Pages</div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight">{stats.totalFlips}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Page Flips</div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight">{stats.totalLeads}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Captured Leads</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 p-3 rounded-2xl border border-border/40">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/40" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search flipbooks by title..."
                className="pl-9 h-11 rounded-xl bg-background border-none shadow-none text-sm min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(['ALL', 'PUBLISHED', 'DRAFT'] as const).map((st) => (
                <Button
                  key={st}
                  variant={statusFilter === st ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(st)}
                  className="rounded-xl font-bold text-xs h-10 px-3.5 min-h-[44px]"
                >
                  {st === 'ALL' ? 'All Status' : st}
                </Button>
              ))}
            </div>
          </div>

          {/* Flipbooks Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-64 rounded-3xl bg-muted/30 animate-pulse border border-border/30" />
              ))}
            </div>
          ) : filteredFlipbooks.length === 0 ? (
            <Card className="p-12 text-center rounded-3xl border-dashed border-border/60 bg-muted/5">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">No Flipbooks Found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Convert your first PDF, DOCX, or eBook into a 3D interactive flipbook and public landing page.
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 rounded-xl font-bold text-xs h-11 px-5 min-h-[44px]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Flipbook
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredFlipbooks.map((fb) => (
                <Card 
                  key={fb.id}
                  className="group relative overflow-hidden rounded-3xl border-border/50 hover:shadow-2xl transition-all duration-300 bg-card flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <Badge 
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          fb.status === 'published' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {fb.status}
                      </Badge>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/admin/flipbooks/${fb.id}/edit`)}
                          className="h-9 w-9 rounded-xl hover:bg-muted min-h-[44px] min-w-[44px]"
                          title="Edit Studio"
                        >
                          <Edit3 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(fb.id, fb.title)}
                          className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive min-h-[44px] min-w-[44px]"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Book Cover Visual Placeholder */}
                    <div 
                      onClick={() => router.push(`/admin/flipbooks/${fb.id}/edit`)}
                      className="aspect-[3/4] w-full rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 border border-white/10 flex flex-col items-center justify-center p-4 text-center cursor-pointer shadow-lg group-hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
                      <div className="relative z-10 space-y-2">
                        <BookOpen className="h-10 w-10 text-indigo-400 mx-auto" />
                        <h4 className="text-sm font-black text-white line-clamp-2 leading-tight px-2">{fb.title}</h4>
                        <span className="text-[10px] font-bold text-indigo-200/80 uppercase tracking-widest">{fb.pageCount || 1} Pages</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground truncate">{fb.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {fb.description || `Source: ${fb.sourceFileName}`}
                      </p>
                    </div>
                  </CardContent>

                  <div className="p-4 pt-0 border-t border-border/30 flex items-center justify-between gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(fb.slug, fb.id)}
                      className="w-1/2 rounded-xl text-xs font-bold gap-1.5 h-10 min-h-[44px]"
                    >
                      {copiedId === fb.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      Link
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => window.open(`/f/${fb.slug || fb.id}`, '_blank')}
                      className="w-1/2 rounded-xl text-xs font-bold gap-1.5 h-10 min-h-[44px]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Read
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create New Flipbook Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Create New Flipbook
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide a document URL (PDF, Word, or eBook) to generate an interactive flipbook page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-left">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Flipbook Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2026 Parent Prospectus Guide"
                className="h-11 rounded-xl bg-muted/20 font-semibold text-sm min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Document Format</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['pdf', 'docx', 'epub', 'media'] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    type="button"
                    variant={sourceFileType === fmt ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSourceFileType(fmt)}
                    className="rounded-xl font-extrabold text-xs uppercase h-10 min-h-[44px]"
                  >
                    {fmt}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Document File URL</Label>
              <Input
                value={sourceFileUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setSourceFileUrl(val);
                  if (val.includes('/') && val.length > 10) {
                    const extracted = val.split('/').pop()?.split('?')[0];
                    if (extracted && extracted.includes('.')) {
                      setSourceFileName(extracted);
                    }
                  }
                }}
                placeholder="https://storage.googleapis.com/.../document.pdf"
                className="h-11 rounded-xl bg-muted/20 text-xs font-mono min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Short Description (Optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary for readers..."
                className="h-11 rounded-xl bg-muted/20 text-xs min-h-[44px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl font-bold text-xs h-11 px-4 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreate}
              className="rounded-xl font-bold text-xs h-11 px-5 shadow-md min-h-[44px]"
            >
              {isSubmitting ? 'Initializing...' : 'Create & Edit Studio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainerFluid>
  );
}
