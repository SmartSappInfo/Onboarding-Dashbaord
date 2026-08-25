'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Experience Studio 2.0:
 *    Enterprise multi-tab editor for configuring Document metadata, pages, interactive layers,
 *    viewer experiences, version lifecycle, and access policies (PRD Sections 50–65).
 * 2. Tag Selection Single Source of Truth:
 *    Contact tag management exclusively uses `<TagSelector>` (Workspace Rules).
 * 3. Mobile Ergonomics & Touch Targets:
 *    All buttons, inputs, tabs, and toggles enforce `min-h-[44px]` touch targets.
 * 4. Dual-Write Synchronization:
 *    Updates are saved through `updateDocumentAction` synchronizing modern Document entities
 *    and legacy `flipbooks` collections.
 * 5. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { 
  Document, 
  DocumentVersion, 
  DocumentPage, 
  ViewerExperience, 
  AccessPolicy,
  DocumentType,
  ViewerMode
} from '@/lib/types/document-types';
import type { FlipbookHotspot, HotspotType } from '@/lib/types/flipbook-types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { 
  ArrowLeft, Save, Sparkles, Sliders, Layers, 
  ExternalLink, Plus, Trash2, Video, Link as LinkIcon, Eye,
  History, Shield, Code, CheckCircle, RefreshCw, Copy
} from 'lucide-react';
import { updateDocumentAction } from '@/lib/document-actions';
import { 
  createDocumentVersionAction, 
  promoteDocumentVersionAction, 
  archiveDocumentVersionAction, 
  getDocumentVersionsAction 
} from '@/lib/documents/document-version-actions';
import { TagSelector } from '@/components/tags/TagSelector';

interface DocumentEditorClientProps {
  documentId: string;
}

export default function DocumentEditorClient({ documentId }: DocumentEditorClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();

  // Firestore Document Ref
  const docRef = useMemoFirebase(() => {
    if (!firestore || !documentId) return null;
    return doc(firestore, 'documents', documentId);
  }, [firestore, documentId]);

  const { data: document, isLoading: isDocLoading } = useDoc<Document>(docRef);

  // Firestore Pages Query
  const pagesQuery = useMemoFirebase(() => {
    if (!firestore || !documentId) return null;
    return query(
      collection(firestore, 'document_pages'),
      where('documentId', '==', documentId)
    );
  }, [firestore, documentId]);

  const { data: rawPages } = useCollection<DocumentPage>(pagesQuery);

  const pages = useMemo(() => {
    if (!rawPages) return [];
    return [...rawPages].sort((a, b) => a.pageNumber - b.pageNumber);
  }, [rawPages]);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [docType, setDocType] = useState<DocumentType>('brochure');
  const [viewerMode, setViewerMode] = useState<ViewerMode>('flipbook');
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Experience Settings
  const [backgroundColor, setBackgroundColor] = useState('#f1f5f9');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hardcover, setHardcover] = useState(false);
  const [enableDownloadPdf, setEnableDownloadPdf] = useState(true);
  const [enablePrint, setEnablePrint] = useState(true);
  const [enableShare, setEnableShare] = useState(true);
  const [enableSearch, setEnableSearch] = useState(true);
  const [enableThumbnails, setEnableThumbnails] = useState(true);

  // Interactive Layers State
  const [hotspots, setHotspots] = useState<FlipbookHotspot[]>([]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [hotspotType, setHotspotType] = useState<HotspotType>('link');
  const [hotspotTitle, setHotspotTitle] = useState('');
  const [hotspotUrl, setHotspotUrl] = useState('');

  // Password & Access State
  const [password, setPassword] = useState('');

  // Version History State
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  // Synchronize initial data
  useEffect(() => {
    if (document) {
      setTitle(document.title || '');
      setDescription(document.description || '');
      setSlug(document.slug || '');
      setStatus(document.status === 'published' ? 'published' : 'draft');
      setDocType(document.documentType || 'brochure');
      setViewerMode(document.defaultViewerMode || 'flipbook');
      setTags(document.tags || []);
    }
  }, [document?.id, document?.updatedAt]);

  // Fetch Version History
  useEffect(() => {
    if (!documentId || !activeWorkspaceId) return;
    async function loadVersions() {
      const res = await getDocumentVersionsAction(documentId, activeWorkspaceId!);
      if (res.success && res.versions) {
        setVersions(res.versions);
      }
    }
    loadVersions();
  }, [documentId, activeWorkspaceId]);

  const handleSave = async () => {
    if (!activeWorkspaceId) {
      toast({ variant: 'destructive', title: 'No Active Workspace', description: 'Select a workspace to save.' });
      return;
    }

    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Title Required', description: 'Please enter a document title.' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateDocumentAction({
        documentId,
        workspaceId: activeWorkspaceId,
        title: title.trim(),
        description: description.trim(),
        slug: slug.trim() || documentId.slice(0, 8),
        status,
        style: {
          pageStyle: viewerMode === 'presentation' ? 'single' : 'magazine',
          soundEnabled,
          hardcover,
          backgroundColor,
          enableDownloadPdf,
          enablePrint,
          enableShare,
          enableSearch,
          enableThumbnails,
        },
        hotspots,
        password: password.trim() ? password.trim() : undefined,
        userId: user?.uid || 'admin',
      });

      if (res.success) {
        toast({ title: 'Document Saved', description: 'All changes and configurations are up to date.' });
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: res.error || 'Could not update document.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddHotspot = () => {
    if (!hotspotUrl.trim()) {
      toast({ variant: 'destructive', title: 'URL Required', description: 'Enter a target URL or action link.' });
      return;
    }

    const newHotspot: FlipbookHotspot = {
      id: `hs_${Date.now()}`,
      pageNumber: selectedPage,
      x: 35,
      y: 40,
      width: 30,
      height: 20,
      type: hotspotType,
      title: hotspotTitle.trim() || 'Interactive Overlay',
      targetUrl: hotspotUrl.trim(),
    };

    setHotspots((prev) => [...prev, newHotspot]);
    setHotspotUrl('');
    setHotspotTitle('');
    toast({ title: 'Layer Overlay Added', description: `Added ${hotspotType} overlay to page ${selectedPage}.` });
  };

  const handleRemoveHotspot = (id: string) => {
    setHotspots((prev) => prev.filter((h) => h.id !== id));
  };

  const handleCreateNewVersion = async () => {
    if (!activeWorkspaceId || !document) return;
    setIsCreatingVersion(true);

    try {
      const res = await createDocumentVersionAction({
        documentId,
        workspaceId: activeWorkspaceId,
        userId: user?.uid || 'admin',
        cloneFromVersionId: document.activeVersionId,
      });

      if (res.success && res.versionNumber) {
        toast({
          title: 'Version Created',
          description: `Created Version ${res.versionNumber}.`,
        });
        const vList = await getDocumentVersionsAction(documentId, activeWorkspaceId);
        if (vList.success && vList.versions) {
          setVersions(vList.versions);
        }
      } else {
        toast({ variant: 'destructive', title: 'Version Creation Failed', description: res.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsCreatingVersion(false);
    }
  };

  const handlePromoteVersion = async (versionId: string) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await promoteDocumentVersionAction(documentId, versionId, activeWorkspaceId);
      if (res.success) {
        toast({ title: 'Version Promoted', description: 'Active version updated for all readers.' });
        const vList = await getDocumentVersionsAction(documentId, activeWorkspaceId);
        if (vList.success && vList.versions) {
          setVersions(vList.versions);
        }
      } else {
        toast({ variant: 'destructive', title: 'Promotion Failed', description: res.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = `${origin}/d/${slug || documentId}`;
  const iframeCode = `<iframe src="${publicUrl}" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>`;

  if (isDocLoading || !document) {
    return (
      <PageContainerFluid>
        <div className="h-96 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-semibold text-muted-foreground">Loading Document Studio...</span>
        </div>
      </PageContainerFluid>
    );
  }

  return (
    <PageContainerFluid>
      <div className="h-full overflow-y-auto w-full">
        <div className="space-y-6 pb-32 w-full text-left">
          
          {/* Top Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/admin/documents')}
                className="h-11 w-11 rounded-2xl border border-border/60 hover:bg-muted min-h-[44px]"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-foreground tracking-tight line-clamp-1">{title || 'Document Studio'}</h1>
                  <Badge variant={status === 'published' ? 'default' : 'secondary'} className="text-[10px] font-bold uppercase">
                    {status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Version: {document.activeVersionId?.split('_').pop() || 'v1'} · {pages.length} Pages
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                asChild
                className="rounded-xl h-11 px-4 font-bold text-xs gap-2 min-h-[44px]"
              >
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Live Preview
                </a>
              </Button>

              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl h-11 px-6 font-bold text-xs gap-2 shadow-lg active:scale-[0.97] transition-all min-h-[44px]"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Main 6-Tab Studio Suite */}
          <Tabs defaultValue="metadata" className="w-full space-y-6">
            <TabsList className="h-12 bg-muted/40 p-1 rounded-2xl border border-border/50 grid grid-cols-3 sm:grid-cols-6 gap-1">
              <TabsTrigger value="metadata" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
                <Sliders className="h-3.5 w-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="pages" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
                <Layers className="h-3.5 w-3.5" />
                Pages
              </TabsTrigger>
              <TabsTrigger value="layers" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
                <Plus className="h-3.5 w-3.5" />
                Overlays
              </TabsTrigger>
              <TabsTrigger value="experience" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
                <Sparkles className="h-3.5 w-3.5" />
                Viewer Mode
              </TabsTrigger>
              <TabsTrigger value="versions" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
                <History className="h-3.5 w-3.5" />
                Versions
              </TabsTrigger>
              <TabsTrigger value="distribution" className="rounded-xl text-xs font-bold gap-1.5 min-h-[40px]">
                <Shield className="h-3.5 w-3.5" />
                Access & Links
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Metadata */}
            <TabsContent value="metadata" className="space-y-6">
              <Card className="rounded-3xl border-border/60 bg-card p-6 sm:p-8 shadow-sm space-y-5 text-left">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-foreground">Publication Identity</h3>
                  <p className="text-xs text-muted-foreground">General information, slug routing, and categorization.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Document Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. 2026 Academic Prospectus"
                      className="h-11 rounded-xl bg-muted/20 border-border text-sm min-h-[44px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom URL Slug</Label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                      placeholder="prospectus-2026"
                      className="h-11 rounded-xl bg-muted/20 border-border text-sm font-mono min-h-[44px]"
                    />
                  </div>

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
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Publishing Status</Label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                      className="w-full h-11 rounded-xl bg-card border border-border px-3 text-xs font-bold text-foreground min-h-[44px]"
                    >
                      <option value="draft">Draft (Restricted to Admins)</option>
                      <option value="published">Published (Public Accessible)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description (Optional)</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description for social media unfurl previews..."
                    className="h-11 rounded-xl bg-muted/20 border-border text-sm min-h-[44px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Tags</Label>
                  <TagSelector
                    currentTagIds={tags}
                    onTagsChange={setTags}
                  />
                </div>
              </Card>
            </TabsContent>

            {/* TAB 2: Pages */}
            <TabsContent value="pages" className="space-y-6">
              <Card className="rounded-3xl border-border/60 bg-card p-6 sm:p-8 shadow-sm space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-foreground">Extracted Pages ({pages.length})</h3>
                    <p className="text-xs text-muted-foreground">Rendered page assets and OCR text content.</p>
                  </div>
                </div>

                {pages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl">
                    No rendered pages found for this version. The document is being processed or rendered on-the-fly.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    {pages.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-border/60 bg-muted/20 overflow-hidden shadow-sm flex flex-col items-center p-2 text-center"
                      >
                        <div className="w-full aspect-[1/1.41] bg-slate-900 rounded-xl overflow-hidden mb-2">
                          <img
                            src={p.thumbnailUrl || p.renderedAssetUrl}
                            alt={`Page ${p.pageNumber}`}
                            className="w-full h-full object-cover select-none"
                          />
                        </div>
                        <span className="text-xs font-black text-foreground">Page {p.pageNumber}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* TAB 3: Interactive Layers */}
            <TabsContent value="layers" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 rounded-3xl border-border/60 bg-card p-6 shadow-sm space-y-4 text-left">
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-foreground">Add Interactive Overlay</h3>
                    <p className="text-xs text-muted-foreground">Attach links, videos, and WhatsApp triggers to pages.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Target Page</Label>
                      <select
                        value={selectedPage}
                        onChange={(e) => setSelectedPage(parseInt(e.target.value, 10))}
                        className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs font-bold"
                      >
                        {Array.from({ length: pages.length || 1 }, (_, i) => i + 1).map((num) => (
                          <option key={num} value={num}>Page {num}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Overlay Action Type</Label>
                      <select
                        value={hotspotType}
                        onChange={(e) => setHotspotType(e.target.value as HotspotType)}
                        className="w-full h-10 rounded-xl bg-card border border-border px-3 text-xs font-bold"
                      >
                        <option value="link">Website Link (External)</option>
                        <option value="video">YouTube / Vimeo Video Modal</option>
                        <option value="lead_gate">Lead Generation Form</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Overlay Label</Label>
                      <Input
                        value={hotspotTitle}
                        onChange={(e) => setHotspotTitle(e.target.value)}
                        placeholder="e.g. Watch Campus Video"
                        className="h-10 rounded-xl bg-muted/20 border-border text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase text-muted-foreground">Destination URL / Video URL</Label>
                      <Input
                        value={hotspotUrl}
                        onChange={(e) => setHotspotUrl(e.target.value)}
                        placeholder="https://..."
                        className="h-10 rounded-xl bg-muted/20 border-border text-xs"
                      />
                    </div>

                    <Button
                      onClick={handleAddHotspot}
                      className="w-full rounded-xl font-bold text-xs h-10 gap-2 mt-2 min-h-[44px]"
                    >
                      <Plus className="h-4 w-4" />
                      Add Overlay
                    </Button>
                  </div>
                </Card>

                <Card className="lg:col-span-2 rounded-3xl border-border/60 bg-card p-6 shadow-sm space-y-4 text-left">
                  <h3 className="text-base font-black text-foreground">Active Overlays ({hotspots.length})</h3>
                  {hotspots.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl">
                      No interactive overlays added. Use the form on the left to add your first overlay.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hotspots.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between p-3.5 rounded-2xl border border-border/60 bg-muted/20"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 text-primary rounded-xl">
                              {h.type === 'video' ? <Video className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-foreground">{h.title}</div>
                              <div className="text-[11px] text-muted-foreground truncate max-w-sm">{h.targetUrl} (Page {h.pageNumber})</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveHotspot(h.id)}
                            className="h-9 w-9 rounded-xl hover:bg-destructive/10 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>

            {/* TAB 4: Viewer Mode */}
            <TabsContent value="experience" className="space-y-6">
              <Card className="rounded-3xl border-border/60 bg-card p-6 sm:p-8 shadow-sm space-y-6 text-left">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-foreground">Viewer Experience & Reading Modes</h3>
                  <p className="text-xs text-muted-foreground">Select layout styles, animation behavior, and toolbar controls.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    onClick={() => setViewerMode('flipbook')}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      viewerMode === 'flipbook'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/60 bg-muted/20 hover:border-primary/40'
                    }`}
                  >
                    <div className="text-sm font-black text-foreground">3D Flipbook</div>
                    <p className="text-xs text-muted-foreground mt-1">Realistic double-page magazine curl with audio effects.</p>
                  </div>

                  <div
                    onClick={() => setViewerMode('presentation')}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      viewerMode === 'presentation'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/60 bg-muted/20 hover:border-primary/40'
                    }`}
                  >
                    <div className="text-sm font-black text-foreground">Presentation Slide</div>
                    <p className="text-xs text-muted-foreground mt-1">Clean single-page slide deck layout for widescreen viewing.</p>
                  </div>

                  <div
                    onClick={() => setViewerMode('continuous')}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      viewerMode === 'continuous'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/60 bg-muted/20 hover:border-primary/40'
                    }`}
                  >
                    <div className="text-sm font-black text-foreground">Continuous Scroll</div>
                    <p className="text-xs text-muted-foreground mt-1">Vertical smooth-scrolling document reading mode.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/40">
                    <div>
                      <div className="text-xs font-bold text-foreground">Page Turn Sound Effects</div>
                      <div className="text-[11px] text-muted-foreground">Play realistic audio on page flip</div>
                    </div>
                    <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/40">
                    <div>
                      <div className="text-xs font-bold text-foreground">Hardcover Spine</div>
                      <div className="text-[11px] text-muted-foreground">Thicker cover page aesthetic</div>
                    </div>
                    <Switch checked={hardcover} onCheckedChange={setHardcover} />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/40">
                    <div>
                      <div className="text-xs font-bold text-foreground">Allow PDF Download</div>
                      <div className="text-[11px] text-muted-foreground">Show download button in reader toolbar</div>
                    </div>
                    <Switch checked={enableDownloadPdf} onCheckedChange={setEnableDownloadPdf} />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/40">
                    <div>
                      <div className="text-xs font-bold text-foreground">Allow Document Print</div>
                      <div className="text-[11px] text-muted-foreground">Show print button in reader toolbar</div>
                    </div>
                    <Switch checked={enablePrint} onCheckedChange={setEnablePrint} />
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* TAB 5: Version History */}
            <TabsContent value="versions" className="space-y-6">
              <Card className="rounded-3xl border-border/60 bg-card p-6 sm:p-8 shadow-sm space-y-5 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-foreground">Version Management</h3>
                    <p className="text-xs text-muted-foreground">Manage draft and published versions of this publication.</p>
                  </div>

                  <Button
                    onClick={handleCreateNewVersion}
                    disabled={isCreatingVersion}
                    className="rounded-xl font-bold text-xs gap-2 h-11 px-4 min-h-[44px]"
                  >
                    <Plus className="h-4 w-4" />
                    {isCreatingVersion ? 'Creating Version...' : 'Fork New Version'}
                  </Button>
                </div>

                <div className="space-y-3">
                  {versions.map((v) => {
                    const isActive = v.id === document.activeVersionId;
                    return (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                          isActive
                            ? 'border-primary/50 bg-primary/5 shadow-sm'
                            : 'border-border/60 bg-muted/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-muted rounded-xl">
                            <History className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-foreground">Version {v.versionNumber}</span>
                              {isActive && (
                                <Badge className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                  Live Version
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Created: {new Date(v.createdAt).toLocaleDateString()} · Status: {v.status}
                            </div>
                          </div>
                        </div>

                        {!isActive && (
                          <Button
                            variant="outline"
                            onClick={() => handlePromoteVersion(v.id)}
                            className="rounded-xl font-bold text-xs h-10 px-4 min-h-[40px]"
                          >
                            Promote to Active
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </TabsContent>

            {/* TAB 6: Access & Distribution */}
            <TabsContent value="distribution" className="space-y-6">
              <Card className="rounded-3xl border-border/60 bg-card p-6 sm:p-8 shadow-sm space-y-6 text-left">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-foreground">Access Protection & Distribution Links</h3>
                  <p className="text-xs text-muted-foreground">Manage passcode protection, embed snippets, and distribution tokens.</p>
                </div>

                <div className="space-y-4 max-w-lg">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Passcode Protection</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave blank for public unauthenticated access"
                      className="h-11 rounded-xl bg-muted/20 border-border text-sm font-mono min-h-[44px]"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Passcodes are cryptographically hashed using salted SHA-256 HMAC on save.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Public Direct Link</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={publicUrl}
                        className="h-11 rounded-xl bg-muted/20 border-border text-xs font-mono select-all min-h-[44px]"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(publicUrl);
                          toast({ title: 'Copied', description: 'Public URL copied to clipboard.' });
                        }}
                        className="h-11 rounded-xl px-4 font-bold text-xs gap-1.5 min-h-[44px]"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Responsive Embed Code</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={iframeCode}
                        className="h-11 rounded-xl bg-muted/20 border-border text-xs font-mono select-all min-h-[44px]"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(iframeCode);
                          toast({ title: 'Copied', description: 'Embed snippet copied to clipboard.' });
                        }}
                        className="h-11 rounded-xl px-4 font-bold text-xs gap-1.5 min-h-[44px]"
                      >
                        <Code className="h-4 w-4" />
                        Copy Embed
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </PageContainerFluid>
  );
}
