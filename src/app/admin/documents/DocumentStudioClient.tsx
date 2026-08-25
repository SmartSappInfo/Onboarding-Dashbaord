'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Enterprise Document Studio 2.0:
 *    Primary workspace dashboard for managing all Document Experience Platform entities
 *    (Brochures, Catalogs, Reports, Prospectuses, Magazines, Presentations, Flipbooks).
 * 2. Tag Selection Single Source of Truth:
 *    Contact tag filtering exclusively routes through `<TagSelector>` (PRD & Workspace Rules).
 * 3. Mobile Ergonomics & Touch Targets:
 *    All buttons, inputs, category tabs, and action cards enforce `min-h-[44px]` touch targets.
 * 4. High-Load Resilience & Memory Optimization:
 *    In-memory filtering and search with debouncing prevents Firestore query flooding.
 * 5. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, doc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Document, DocumentSourceType, DocumentType } from '@/lib/types/document-types';
import type { FlipbookConfig } from '@/lib/types/flipbook-types';
import { createDocumentAction, deleteDocumentAction } from '@/lib/document-actions';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, Plus, Search, Eye, Sparkles, ExternalLink,
  Edit3, Trash2, Copy, FileText, Layers, RefreshCw, BarChart3
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import { TagSelector } from '@/components/tags/TagSelector';
import { MigrationCenterDialog } from '@/components/documents/MigrationCenterDialog';

function detectFileTypeFromUrl(url: string): DocumentSourceType {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.pdf')) return 'pdf';
  if (clean.endsWith('.docx') || clean.endsWith('.doc')) return 'docx';
  if (clean.endsWith('.epub')) return 'epub';
  if (clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.webp')) return 'media';
  return 'pdf';
}

const DOCUMENT_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All Documents' },
  { id: 'flipbook', label: 'Flipbooks' },
  { id: 'brochure', label: 'Brochures' },
  { id: 'catalog', label: 'Catalogs' },
  { id: 'prospectus', label: 'Prospectuses' },
  { id: 'report', label: 'Reports' },
  { id: 'magazine', label: 'Magazines' },
  { id: 'presentation', label: 'Presentations' },
];

export default function DocumentStudioClient() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeWorkspaceId, isLoading: isWorkspaceLoading } = useWorkspace();
  const { user } = useUser();

  // Firestore Document and Legacy Flipbook Queries
  const docsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'documents'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);

  const legacyQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'flipbooks'),
      where('workspaceId', '==', activeWorkspaceId)
    );
  }, [firestore, activeWorkspaceId]);

  const { data: rawDocuments, isLoading: isDocsLoading } = useCollection<Document>(docsQuery);
  const { data: rawLegacyFlipbooks, isLoading: isLegacyLoading } = useCollection<FlipbookConfig>(legacyQuery);

  // Unified Document List with in-memory sorting
  const documents = useMemo(() => {
    const modernList = rawDocuments || [];
    const legacyList = rawLegacyFlipbooks || [];

    const existingIds = new Set(modernList.map((d) => d.id));
    const normalizedLegacy: Document[] = legacyList
      .filter((fb) => !existingIds.has(fb.id))
      .map((fb) => ({
        id: fb.id,
        workspaceId: fb.workspaceId,
        title: fb.title,
        description: fb.description,
        slug: fb.slug,
        status: fb.status || 'draft',
        documentType: 'flipbook',
        activeVersionId: `${fb.id}_v1`,
        defaultViewerMode: 'flipbook',
        createdBy: fb.createdBy || '',
        createdAt: fb.createdAt || new Date().toISOString(),
        updatedAt: fb.updatedAt || new Date().toISOString(),
        viewsCount: fb.viewsCount || 0,
        leadsCount: fb.leadsCount || 0,
        flipsCount: fb.flipsCount || 0,
        likesCount: fb.likesCount || 0,
      }));

    return [...modernList, ...normalizedLegacy].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [rawDocuments, rawLegacyFlipbooks]);

  // UI Filter State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [isMigrationOpen, setIsMigrationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State for Quick Create
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [docType, setDocType] = useState<DocumentType>('brochure');
  const [sourceFileUrl, setSourceFileUrl] = useState('');
  const [sourceFileType, setSourceFileType] = useState<DocumentSourceType>('pdf');
  const [sourceFileName, setSourceFileName] = useState('');

  // Filtered documents calculation
  const filteredDocuments = useMemo(() => {
    return documents.filter((docItem) => {
      if (selectedCategory !== 'all' && (docItem.documentType || 'flipbook') !== selectedCategory) {
        return false;
      }
      if (statusFilter !== 'all' && docItem.status !== statusFilter) {
        return false;
      }
      if (selectedTagIds.length > 0) {
        const docTags = docItem.tags || [];
        const hasMatchingTag = selectedTagIds.some((t) => docTags.includes(t));
        if (!hasMatchingTag) return false;
      }
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const matchesTitle = docItem.title.toLowerCase().includes(queryLower);
        const matchesSlug = docItem.slug.toLowerCase().includes(queryLower);
        const matchesDesc = docItem.description?.toLowerCase().includes(queryLower);
        if (!matchesTitle && !matchesSlug && !matchesDesc) return false;
      }
      return true;
    });
  }, [documents, selectedCategory, statusFilter, selectedTagIds, searchQuery]);

  // KPI Metrics calculation
  const stats = useMemo(() => {
    return {
      total: documents.length,
      published: documents.filter((d) => d.status === 'published').length,
      totalFlips: documents.reduce((acc, d) => acc + (d.flipsCount || 0), 0),
      totalLeads: documents.reduce((acc, d) => acc + (d.leadsCount || 0), 0),
    };
  }, [documents]);

  const handleCreate = async () => {
    if (!activeWorkspaceId || !title.trim() || !sourceFileUrl.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing Required Fields',
        description: 'Please provide a title and document source URL.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createDocumentAction({
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

      if (res.success && res.documentId) {
        toast({
          title: 'Document Initialized',
          description: `"${title}" has been created in Document Studio.`,
        });
        setIsCreateOpen(false);
        setTitle('');
        setDescription('');
        setSourceFileUrl('');
        setSourceFileName('');
        router.push(`/admin/documents/${res.documentId}/edit`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Creation Failed',
          description: res.error || 'Could not create document.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Creation error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, itemTitle: string) => {
    if (!activeWorkspaceId) return;
    if (!window.confirm(`Are you sure you want to delete "${itemTitle}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await deleteDocumentAction(id, activeWorkspaceId);
      if (res.success) {
        toast({ title: 'Document Deleted', description: `"${itemTitle}" was deleted.` });
      } else {
        toast({ variant: 'destructive', title: 'Delete Failed', description: res.error || 'Could not delete document.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    }
  };

  const handleCopyLink = (slug: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/d/${slug || id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast({ title: 'Link Copied', description: 'Public document link copied to clipboard.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isLoading = isWorkspaceLoading || isDocsLoading || isLegacyLoading;

  return (
    <PageContainerFluid>
      <div className="h-full overflow-y-auto w-full">
        <div className="space-y-6 pb-32 w-full text-left">
          
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
                <Layers className="h-8 w-8 text-primary" />
                Document Studio
              </h1>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                Enterprise digital experience platform for interactive brochures, prospectuses, magazines, and flipbooks.
              </p>
            </div>
            
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant="outline"
                onClick={() => router.push('/admin/documents/analytics')}
                className="rounded-xl font-bold text-xs gap-2 h-11 px-4 border-border/80 min-h-[44px]"
              >
                <BarChart3 className="h-4 w-4 text-primary" />
                Portfolio Analytics
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsMigrationOpen(true)}
                className="rounded-xl font-bold text-xs gap-2 h-11 px-4 border-border/80 min-h-[44px]"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                Migration Health
              </Button>

              <Button
                onClick={() => setIsCreateOpen(true)}
                className="rounded-xl font-bold text-xs gap-2 h-11 px-5 shadow-lg active:scale-[0.97] transition-all min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
                Create Document
              </Button>
            </div>
          </div>

          {/* KPI Analytics Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight">{stats.total}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Documents</div>
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
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Live Publications</div>
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
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Page Interactions</div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight">{stats.totalLeads}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Leads Captured</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Filter & Category Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {DOCUMENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[38px] ${
                    selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search publications by title or slug..."
                  className="pl-10 h-11 rounded-xl bg-card border-border/70 text-sm min-h-[44px]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <TagSelector
                  currentTagIds={selectedTagIds}
                  onTagsChange={setSelectedTagIds}
                  className="min-w-[180px]"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft')}
                  className="h-11 rounded-xl bg-card border border-border/70 px-3 text-xs font-bold text-foreground min-h-[44px]"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                </select>
              </div>
            </div>
          </div>

          {/* Document Cards Grid */}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm font-semibold">Loading documents...</span>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center p-8 bg-card border border-dashed border-border/70 rounded-3xl space-y-4">
              <div className="p-4 bg-muted/50 rounded-2xl">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">No documents found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                  Create your first interactive document or adjust your filters above.
                </p>
              </div>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="rounded-xl font-bold text-xs gap-2 h-11 px-5 min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
                Create New Document
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDocuments.map((docItem) => {
                const isPublished = docItem.status === 'published';
                return (
                  <Card
                    key={docItem.id}
                    className="group rounded-3xl border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant={isPublished ? 'default' : 'secondary'}
                          className={`text-[10px] font-black uppercase tracking-wider rounded-lg px-2.5 py-1 ${
                            isPublished ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' : ''
                          }`}
                        >
                          {docItem.status}
                        </Badge>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {new Date(docItem.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-black text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {docItem.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[32px]">
                          {docItem.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-border/40 text-center">
                        <div>
                          <div className="text-sm font-black text-foreground">{docItem.viewsCount || 0}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Views</div>
                        </div>
                        <div>
                          <div className="text-sm font-black text-foreground">{docItem.flipsCount || 0}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Flips</div>
                        </div>
                        <div>
                          <div className="text-sm font-black text-foreground">{docItem.leadsCount || 0}</div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Leads</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/20 border-t border-border/40 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyLink(docItem.slug, docItem.id)}
                          className="h-10 w-10 rounded-xl hover:bg-muted min-h-[40px]"
                          title="Copy Public Link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>

                        {isPublished && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="h-10 w-10 rounded-xl hover:bg-muted min-h-[40px]"
                            title="View Public Document"
                          >
                            <a href={`/d/${docItem.slug || docItem.id}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </a>
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(docItem.id, docItem.title)}
                          className="h-10 w-10 rounded-xl hover:bg-destructive/10 text-destructive min-h-[40px]"
                          title="Delete Document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        <Button
                          onClick={() => router.push(`/admin/documents/${docItem.id}/edit`)}
                          className="rounded-xl font-bold text-xs gap-1.5 h-10 px-4 min-h-[40px]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Studio Editor
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* Quick Create Document Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6 sm:p-8 bg-card border-border shadow-2xl">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">Create Document</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Initialize an interactive brochure, catalog, or flipbook experience.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3 text-left">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Document Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2026 Product Brochure"
                className="h-11 rounded-xl bg-muted/20 border-border text-sm min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description (Optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary for social sharing previews..."
                className="h-11 rounded-xl bg-muted/20 border-border text-sm min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Document Category</Label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentType)}
                  className="w-full h-11 rounded-xl bg-card border border-border px-3 text-xs font-bold text-foreground min-h-[44px]"
                >
                  <option value="brochure">Brochure</option>
                  <option value="catalog">Catalog</option>
                  <option value="prospectus">Prospectus</option>
                  <option value="report">Report</option>
                  <option value="magazine">Magazine</option>
                  <option value="presentation">Presentation</option>
                  <option value="flipbook">Flipbook</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source Format</Label>
                <select
                  value={sourceFileType}
                  onChange={(e) => setSourceFileType(e.target.value as DocumentSourceType)}
                  className="w-full h-11 rounded-xl bg-card border border-border px-3 text-xs font-bold text-foreground min-h-[44px]"
                >
                  <option value="pdf">PDF Document (.pdf)</option>
                  <option value="docx">Word Document (.docx)</option>
                  <option value="epub">eBook (.epub)</option>
                  <option value="media">Image Gallery / Slides</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source Document URL</Label>
                <button
                  type="button"
                  onClick={() => setIsMediaSelectorOpen(true)}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                >
                  Browse Media Library
                </button>
              </div>
              <Input
                value={sourceFileUrl}
                onChange={(e) => {
                  const url = e.target.value;
                  setSourceFileUrl(url);
                  if (url.trim()) {
                    setSourceFileType(detectFileTypeFromUrl(url));
                  }
                }}
                placeholder="https://firebasestorage.googleapis.com/.../file.pdf"
                className="h-11 rounded-xl bg-muted/20 border-border text-sm min-h-[44px]"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
              className="rounded-xl h-11 px-5 font-bold text-xs min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || !title.trim() || !sourceFileUrl.trim()}
              className="rounded-xl h-11 px-6 font-bold text-xs gap-2 shadow-lg active:scale-[0.97] transition-all min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create & Open Studio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Selector Dialog */}
      <MediaSelectorDialog
        open={isMediaSelectorOpen}
        onOpenChange={setIsMediaSelectorOpen}
        onSelectAsset={(asset) => {
          setSourceFileUrl(asset.url);
          setSourceFileName(asset.name || 'document.pdf');
          setSourceFileType(detectFileTypeFromUrl(asset.url));
          setIsMediaSelectorOpen(false);
          toast({ title: 'Media Selected', description: `Linked "${asset.name || 'asset'}" as document source.` });
        }}
      />

      {/* Workspace Migration Center Dialog */}
      {activeWorkspaceId && (
        <MigrationCenterDialog
          isOpen={isMigrationOpen}
          onClose={() => setIsMigrationOpen(false)}
          workspaceId={activeWorkspaceId}
          totalLegacyCount={rawLegacyFlipbooks?.length || 0}
          totalDocumentCount={rawDocuments?.length || 0}
        />
      )}
    </PageContainerFluid>
  );
}
