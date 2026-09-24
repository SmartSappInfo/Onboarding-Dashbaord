'use client';

/**
 * {{Org_name}} Experience Platform — Full-Screen Content Studio Modal
 *
 * Industry-grade, distraction-free full-screen authoring studio for portal content.
 * Replaces the cramped slide-over drawer with a 3-pane responsive block builder:
 * - Left Pane: ContentBlockPalette (categorized modular blocks)
 * - Center Canvas: ContentBlockCanvas (sortable, 60fps drag-and-drop, starter templates)
 * - Right Pane: ContentBlockInspector (metadata-driven property controls via AutoBlockEditor)
 *
 * Core Features:
 * - Dual-view mode switcher: "Block Studio" & "Details & SEO".
 * - Standardized `<TagSelector>` running in client/draft mode.
 * - No-code "Save as Template" workflow to `portal_content_templates`.
 * - Dirty state tracking with exit confirmation and debounced localStorage draft recovery.
 * - Keyboard shortcuts (Cmd/Ctrl + S to save).
 * - Mobile responsive drawer/sheet fallbacks.
 *
 * Conforms to:
 * - `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`.
 * - Zero `any` or `any[]` typing.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Save,
  Rocket,
  Layers,
  SlidersHorizontal,
  BookmarkPlus,
  Sparkles,
  FileText,
  Video,
  FileSpreadsheet,
  Globe,
  Share2,
  AlertTriangle,
  ChevronDown,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sanitizeSlug } from '@/lib/utils/slug-utils';
import { TagSelector } from '@/components/tags/TagSelector';
import {
  createContentItemAction,
  updateContentItemAction,
  createPortalContentTemplateAction,
} from '@/app/actions/content-actions';
import type {
  ContentItem,
  ContentItemType,
  ContentStatus,
  ContentMedia,
  PageBlock,
  PageBlockType,
} from '@/lib/types';
import type { PortalVisibility } from '@/lib/types/portal';
import { getBlock, normalizeBlockType } from '@/lib/page-builder/registry';
import { ContentBlockCanvas } from './studio/ContentBlockCanvas';
import { ContentBlockPalette } from './studio/ContentBlockPalette';
import { ContentBlockInspector } from './studio/ContentBlockInspector';

export interface ContentEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  organizationId: string;
  workspaceIds: string[];
  initialItem?: ContentItem | null;
  defaultType?: ContentItemType;
  portalPrimaryColor?: string;
  onSaved?: (item: ContentItem) => void;
}

const TYPE_OPTIONS: { id: ContentItemType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'article', label: 'Article / Guide', icon: FileText },
  { id: 'lesson', label: 'Curriculum Lesson', icon: Sparkles },
  { id: 'resource', label: 'Downloadable Toolkit', icon: FileSpreadsheet },
  { id: 'page', label: 'Documentation Page', icon: Globe },
  { id: 'announcement', label: 'Announcement', icon: Share2 },
  { id: 'video', label: 'Video Lecture', icon: Video },
];

export function ContentEditorModal({
  open,
  onOpenChange,
  portalId,
  organizationId,
  workspaceIds,
  initialItem,
  defaultType = 'article',
  portalPrimaryColor,
  onSaved,
}: ContentEditorModalProps) {
  const { toast } = useToast();

  // Active view tab
  const [viewMode, setViewMode] = useState<'studio' | 'details'>('studio');

  // Panel collapse toggles for desktop
  const [showLeftPalette, setShowLeftPalette] = useState(true);
  const [showRightInspector, setShowRightInspector] = useState(true);

  // Mobile drawer states
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  // Insertion target index for palette
  const [paletteInsertIndex, setPaletteInsertIndex] = useState<number | null>(null);

  // Selection
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Unsaved changes confirmation dialog
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  // "Save as Template" dialog state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState<ContentItemType>(defaultType);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<ContentStatus>('draft');
  const [visibility, setVisibility] = useState<PortalVisibility>('public');
  const [scheduledAt, setScheduledAt] = useState('');
  const [media, setMedia] = useState<ContentMedia>({});
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [blocks, setBlocks] = useState<PageBlock[]>([]);

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);
  const [localDraftNotice, setLocalDraftNotice] = useState<string | null>(null);

  const draftStorageKey = useMemo(() => {
    return `content_studio_draft_${portalId}_${initialItem?.id || 'new'}`;
  }, [portalId, initialItem]);

  // Synchronize initial state when opening modal
  useEffect(() => {
    if (!open) return;

    if (initialItem) {
      setType(initialItem.type);
      setTitle(initialItem.title);
      setSlug(initialItem.slug);
      setSummary(initialItem.summary || '');
      setCategory(initialItem.category || 'General');
      setTags(initialItem.tags || []);
      setStatus(initialItem.status);
      setVisibility(initialItem.visibility || 'public');
      setScheduledAt(initialItem.scheduledAt || '');
      setMedia(initialItem.media || {});
      setMetaTitle(initialItem.seo?.metaTitle || '');
      setMetaDescription(initialItem.seo?.metaDescription || '');
      const initialBlocks: PageBlock[] =
        initialItem.blocks && initialItem.blocks.length > 0
          ? initialItem.blocks
          : initialItem.content && initialItem.content.trim()
            ? [
                {
                  id: `blk_text_${Date.now()}_legacy`,
                  type: 'text',
                  props: {
                    content: initialItem.content,
                    preset: 'paragraph',
                  },
                },
              ]
            : [];
      setBlocks(initialBlocks);
      setSelectedBlockId(initialBlocks[0]?.id || null);
    } else {
      setType(defaultType);
      setTitle('');
      setSlug('');
      setSummary('');
      setCategory('General');
      setTags([]);
      setStatus('draft');
      setVisibility('public');
      setScheduledAt('');
      setMedia({});
      setMetaTitle('');
      setMetaDescription('');
      setBlocks([]);
      setSelectedBlockId(null);
    }

    setIsDirty(false);
    setViewMode('studio');

    // Check for local draft backup
    try {
      const savedDraftJson = localStorage.getItem(draftStorageKey);
      if (savedDraftJson) {
        const savedDraft = JSON.parse(savedDraftJson);
        const draftDate = new Date(savedDraft.timestamp);
        const itemUpdatedDate = initialItem ? new Date(initialItem.updatedAt) : new Date(0);

        if (draftDate > itemUpdatedDate) {
          setLocalDraftNotice(
            `A local auto-save draft from ${draftDate.toLocaleTimeString()} is available.`
          );
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [open, initialItem, defaultType, draftStorageKey]);

  // Debounced auto-save backup to localStorage when dirty
  useEffect(() => {
    if (!open || !isDirty) return;

    const timer = setTimeout(() => {
      try {
        const draftPayload = {
          timestamp: new Date().toISOString(),
          title,
          slug,
          summary,
          category,
          tags,
          blocks,
          type,
          visibility,
          media,
          seo: { metaTitle, metaDescription },
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(draftPayload));
      } catch {
        // Storage limit exceeded or disabled
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    open,
    isDirty,
    draftStorageKey,
    title,
    slug,
    summary,
    category,
    tags,
    blocks,
    type,
    visibility,
    media,
    metaTitle,
    metaDescription,
  ]);

  // Restore local draft handler
  const handleRestoreDraft = () => {
    try {
      const savedDraftJson = localStorage.getItem(draftStorageKey);
      if (!savedDraftJson) return;
      const saved = JSON.parse(savedDraftJson);
      if (saved.title) setTitle(saved.title);
      if (saved.slug) setSlug(saved.slug);
      if (saved.summary) setSummary(saved.summary);
      if (saved.category) setCategory(saved.category);
      if (saved.tags) setTags(saved.tags);
      if (saved.blocks) setBlocks(saved.blocks);
      if (saved.type) setType(saved.type);
      if (saved.visibility) setVisibility(saved.visibility);
      if (saved.media) setMedia(saved.media);
      if (saved.seo?.metaTitle) setMetaTitle(saved.seo.metaTitle);
      if (saved.seo?.metaDescription) setMetaDescription(saved.seo.metaDescription);

      setLocalDraftNotice(null);
      setIsDirty(true);
      toast({ title: 'Draft Restored', description: 'Restored your unsaved changes.' });
    } catch {
      toast({ title: 'Error', description: 'Could not restore local draft.' });
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(draftStorageKey);
    setLocalDraftNotice(null);
  };

  // Title change with auto-slug
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setIsDirty(true);
    if (!initialItem) {
      setSlug(sanitizeSlug(newTitle));
    }
  };

  // Block canvas callbacks
  const handleBlocksChange = useCallback((updated: PageBlock[]) => {
    setBlocks(updated);
    setIsDirty(true);
  }, []);

  const handleSelectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
    if (id) {
      setMobileInspectorOpen(true);
    }
  }, []);

  const handleInsertAtIndex = useCallback((index: number) => {
    setPaletteInsertIndex(index);
    setShowLeftPalette(true);
    setMobilePaletteOpen(true);
  }, []);

  // Block palette addition callback
  const handleAddBlockOfType = useCallback(
    (blockType: PageBlockType) => {
      const def = getBlock(normalizeBlockType(blockType));
      const uniqueSuffix = Math.random().toString(36).slice(2, 7);
      const newBlock: PageBlock = {
        id: `blk_${blockType}_${Date.now()}_${uniqueSuffix}`,
        type: blockType,
        props: def ? { ...def.defaults } : {},
      };

      const insertPos =
        paletteInsertIndex !== null ? paletteInsertIndex : blocks.length;

      const updated = [...blocks];
      updated.splice(insertPos, 0, newBlock);
      setBlocks(updated);
      setSelectedBlockId(newBlock.id);
      setIsDirty(true);
      setPaletteInsertIndex(null);
      setMobilePaletteOpen(false);
      setMobileInspectorOpen(true);

      toast({
        title: 'Block Added',
        description: `Added ${def?.label || blockType} to document.`,
      });
    },
    [blocks, paletteInsertIndex, toast]
  );

  // Block inspector updates
  const handleUpdateBlockProps = useCallback(
    (blockId: string, patch: Record<string, unknown>) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, props: { ...b.props, ...patch } } : b))
      );
      setIsDirty(true);
    },
    []
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
        setMobileInspectorOpen(false);
      }
      setIsDirty(true);
    },
    [selectedBlockId]
  );

  const handleResetBlockDefaults = useCallback((blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const def = getBlock(normalizeBlockType(b.type));
        return def ? { ...b, props: { ...def.defaults } } : b;
      })
    );
    setIsDirty(true);
  }, []);

  // Currently selected block reference
  const selectedBlock = useMemo(() => {
    if (!selectedBlockId) return null;
    return blocks.find((b) => b.id === selectedBlockId) || null;
  }, [blocks, selectedBlockId]);

  // Save Content Item Handler
  const handleSave = useCallback(
    async (publishImmediately: boolean = false) => {
      if (!title.trim()) {
        toast({
          title: 'Title Required',
          description: 'Please provide a title for this content item.',
        });
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
              title: title.trim(),
              slug: slug.trim() || undefined,
              summary: summary.trim(),
              category: category.trim(),
              tags,
              blocks,
              status: targetStatus,
              visibility,
              scheduledAt: scheduledAt || undefined,
              media,
              seo: {
                metaTitle: metaTitle.trim() || title.trim(),
                metaDescription: metaDescription.trim() || summary.trim(),
              },
            },
            portalId
          );

          if (!res.success || !res.data) {
            throw new Error(res.error || 'Failed to update content item.');
          }

          localStorage.removeItem(draftStorageKey);
          setIsDirty(false);
          toast({
            title: publishImmediately ? 'Published! 🎉' : 'Changes Saved',
            description: `"${title}" has been successfully updated.`,
          });
          onSaved?.(res.data);
          onOpenChange(false);
        } else {
          // Create
          const res = await createContentItemAction({
            organizationId,
            portalId,
            workspaceIds,
            type,
            title: title.trim(),
            slug: slug.trim() || undefined,
            summary: summary.trim(),
            category: category.trim(),
            tags,
            blocks,
            status: targetStatus,
            visibility,
            scheduledAt: scheduledAt || undefined,
            media,
            seo: {
              metaTitle: metaTitle.trim() || title.trim(),
              metaDescription: metaDescription.trim() || summary.trim(),
            },
          });

          if (!res.success || !res.data) {
            throw new Error(res.error || 'Failed to create content item.');
          }

          localStorage.removeItem(draftStorageKey);
          setIsDirty(false);
          toast({
            title: publishImmediately ? 'Published! 🎉' : 'Draft Created',
            description: `"${title}" is ready.`,
          });
          onSaved?.(res.data);
          onOpenChange(false);
        }
      } catch (err) {
        toast({
          title: 'Save Failed',
          description: err instanceof Error ? err.message : 'An error occurred while saving.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      title,
      status,
      initialItem,
      portalId,
      slug,
      summary,
      category,
      tags,
      blocks,
      visibility,
      scheduledAt,
      media,
      metaTitle,
      metaDescription,
      draftStorageKey,
      onSaved,
      onOpenChange,
      organizationId,
      workspaceIds,
      type,
      toast,
    ]
  );

  // "Save as Template" Handler
  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: 'Template Name Required', description: 'Please enter a name for the template.' });
      return;
    }
    if (blocks.length === 0) {
      toast({ title: 'Canvas is Empty', description: 'Add at least one block before saving a template.' });
      return;
    }

    setIsSavingTemplate(true);
    try {
      const res = await createPortalContentTemplateAction({
        portalId,
        organizationId,
        name: templateName.trim(),
        description: templateDescription.trim(),
        category: 'custom',
        blocks,
      });

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save template.');
      }

      toast({
        title: 'Template Saved 🎉',
        description: `"${templateName}" is now available in your starter templates catalog.`,
      });
      setTemplateDialogOpen(false);
      setTemplateName('');
      setTemplateDescription('');
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not save template.',
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Keyboard shortcut listener (Cmd/Ctrl + S)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleSave]);

  // Exit Guard
  const handleRequestClose = () => {
    if (isDirty) {
      setConfirmExitOpen(true);
    } else {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Local Auto-Save Recovery Banner */}
      {localDraftNotice && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 z-30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>{localDraftNotice}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-2.5 py-1 rounded-md bg-amber-500 text-white font-bold hover:bg-amber-600 active:scale-[0.97] transition-all"
            >
              Restore Draft
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-2 py-1 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Top Studio Bar */}
      <header className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 bg-background flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Close Button & Title / Type info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="Exit Content Studio"
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Type Selector Dropdown */}
          <div className="relative shrink-0">
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as ContentItemType);
                setIsDirty(true);
              }}
              className="h-9 px-3 pr-8 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] cursor-pointer"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          {/* Inline Title Editor */}
          <div className="min-w-0 flex-1 max-w-md hidden sm:block">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled Document..."
              className="w-full h-9 px-3 rounded-lg bg-transparent hover:bg-slate-100/60 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 focus:bg-background focus:border-[var(--portal-primary,#3B82F6)] text-sm font-bold text-foreground truncate focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Center: View Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('studio')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
              viewMode === 'studio'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Layers className="w-3.5 h-3.5 text-[var(--portal-primary,#3B82F6)]" />
            <span>Block Studio</span>
            <span className="hidden md:inline text-[10px] opacity-60">({blocks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('details')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
              viewMode === 'details'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />
            <span>Details & SEO</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Unsaved indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isDirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              )}
            />
            <span className="text-[11px]">{isDirty ? 'Unsaved' : 'Saved'}</span>
          </div>

          {/* Save as Template */}
          <button
            type="button"
            onClick={() => setTemplateDialogOpen(true)}
            title="Save arrangement as reusable template"
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>Save as Template</span>
          </button>

          {/* Save Draft */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSave(false)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-background hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all disabled:opacity-50 min-h-[44px] sm:min-h-0"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="hidden sm:inline">Save Draft</span>
          </button>

          {/* Publish Now */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSave(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--portal-primary,#3B82F6)] hover:opacity-95 shadow-md shadow-[var(--portal-primary,#3B82F6)]/20 active:scale-[0.97] transition-all disabled:opacity-50 min-h-[44px] sm:min-h-0"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            <span>Publish</span>
          </button>
        </div>
      </header>

      {/* Main Studio Workspace Body */}
      {viewMode === 'studio' ? (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Panel: Block Palette (Desktop) */}
          {showLeftPalette && (
            <aside className="hidden md:block w-72 h-full shrink-0">
              <ContentBlockPalette
                onSelectBlockType={handleAddBlockOfType}
                className="h-full"
              />
            </aside>
          )}

          {/* Left Panel Toggle (Desktop) */}
          <button
            type="button"
            onClick={() => setShowLeftPalette((p) => !p)}
            title={showLeftPalette ? 'Collapse palette' : 'Expand palette'}
            className="hidden md:flex absolute left-0 top-3 z-30 items-center justify-center w-6 h-6 rounded-r bg-background border-r border-y border-slate-200 dark:border-slate-800 text-muted-foreground hover:text-foreground shadow-sm transition-all"
            style={{ left: showLeftPalette ? '18rem' : '0' }}
          >
            {showLeftPalette ? (
              <PanelLeftClose className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Center: Canvas Workspace */}
          <main className="flex-1 h-full overflow-y-auto bg-slate-50/50 dark:bg-zinc-950/50 p-4 sm:p-8">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Document Header in Canvas */}
              <div className="p-6 bg-card border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /portal/[slug]/content/{type}/{slug || 'auto-generated'}
                  </span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter document title..."
                  className="w-full text-2xl sm:text-3xl font-extrabold bg-transparent text-foreground placeholder:text-muted-foreground/50 border-none outline-none focus:ring-0 p-0"
                />
              </div>

              {/* Modular Block Canvas */}
              <ContentBlockCanvas
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={handleSelectBlock}
                onChangeBlocks={handleBlocksChange}
                onInsertAtIndex={handleInsertAtIndex}
                portalPrimaryColor={portalPrimaryColor}
              />
            </div>
          </main>

          {/* Right Panel Toggle (Desktop) */}
          <button
            type="button"
            onClick={() => setShowRightInspector((p) => !p)}
            title={showRightInspector ? 'Collapse inspector' : 'Expand inspector'}
            className="hidden lg:flex absolute right-0 top-3 z-30 items-center justify-center w-6 h-6 rounded-l bg-background border-l border-y border-slate-200 dark:border-slate-800 text-muted-foreground hover:text-foreground shadow-sm transition-all"
            style={{ right: showRightInspector ? '22rem' : '0' }}
          >
            {showRightInspector ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Right Panel: Block Inspector (Desktop) */}
          {showRightInspector && (
            <aside className="hidden lg:block w-[22rem] h-full shrink-0">
              <ContentBlockInspector
                selectedBlock={selectedBlock}
                onUpdateProps={handleUpdateBlockProps}
                onDeleteBlock={handleDeleteBlock}
                onDeselect={() => setSelectedBlockId(null)}
                onResetDefaults={handleResetBlockDefaults}
                className="h-full"
              />
            </aside>
          )}

          {/* Mobile Floating Action Bar */}
          <div className="md:hidden fixed bottom-4 left-4 right-4 flex items-center justify-between p-2 rounded-2xl bg-background/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl z-40">
            <button
              type="button"
              onClick={() => setMobilePaletteOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <Layers className="w-4 h-4 text-[var(--portal-primary,#3B82F6)]" />
              <span>+ Add Block</span>
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
            <button
              type="button"
              disabled={!selectedBlock}
              onClick={() => setMobileInspectorOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
              <span>Block Settings</span>
            </button>
          </div>

          {/* Mobile Palette Sheet Modal */}
          {mobilePaletteOpen && (
            <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
              <div className="bg-background rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
                <ContentBlockPalette
                  onSelectBlockType={handleAddBlockOfType}
                  onClose={() => setMobilePaletteOpen(false)}
                  className="border-none"
                />
              </div>
            </div>
          )}

          {/* Mobile Inspector Sheet Modal */}
          {mobileInspectorOpen && selectedBlock && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
              <div className="bg-background rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
                <ContentBlockInspector
                  selectedBlock={selectedBlock}
                  onUpdateProps={handleUpdateBlockProps}
                  onDeleteBlock={handleDeleteBlock}
                  onDeselect={() => {
                    setSelectedBlockId(null);
                    setMobileInspectorOpen(false);
                  }}
                  onResetDefaults={handleResetBlockDefaults}
                  className="border-none"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Details, Media & SEO View */
        <div className="flex-1 overflow-y-auto p-6 sm:p-12 bg-slate-50/50 dark:bg-zinc-950/50">
          <div className="max-w-2xl mx-auto space-y-8 bg-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                Document Details & Visibility
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure taxonomy, search metadata, and membership access permissions.
              </p>
            </div>

            {/* Title & Slug */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Document Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Masterclass: Building Modular Dashboards"
                  className="w-full h-10 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">URL Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(sanitizeSlug(e.target.value));
                    setIsDirty(true);
                  }}
                  placeholder="masterclass-building-modular-dashboards"
                  className="w-full h-10 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all font-mono"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Summary / Excerpt</label>
              <textarea
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  setIsDirty(true);
                }}
                rows={3}
                placeholder="Brief synopsis displayed on catalog cards and search previews..."
                className="w-full p-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all resize-none"
              />
            </div>

            {/* Category & Visibility */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="e.g. General, Engineering, Marketing"
                  className="w-full h-10 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Access Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => {
                    setVisibility(e.target.value as PortalVisibility);
                    setIsDirty(true);
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
                >
                  <option value="public">Public (Everyone)</option>
                  <option value="members_only">Members Only</option>
                  <option value="tier_restricted">Tier Restricted</option>
                  <option value="private">Private (Admins Only)</option>
                </select>
              </div>
            </div>

            {/* Tag Selection — Standardized TagSelector in Client/Draft Mode */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Contact & Content Tags</label>
              <TagSelector
                currentTagIds={tags}
                onTagsChange={(newTags) => {
                  setTags(newTags);
                  setIsDirty(true);
                }}
              />
            </div>

            {/* Scheduling */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Publish Date / Schedule</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => {
                  setScheduledAt(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full h-10 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
              />
            </div>

            {/* SEO Settings */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Search Engine Optimization (SEO)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Custom meta tags for web crawlers and social share cards.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">SEO Meta Title</label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => {
                      setMetaTitle(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder={title || 'Document title for Google search...'}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">SEO Meta Description</label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => {
                      setMetaDescription(e.target.value);
                      setIsDirty(true);
                    }}
                    rows={2}
                    placeholder={summary || 'Brief summary for search engine snippets...'}
                    className="w-full p-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {confirmExitOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Unsaved Changes</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You have unsaved edits in this document.
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Are you sure you want to leave? Changes will remain saved in local auto-backup.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmExitOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmExitOpen(false);
                  onOpenChange(false);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-[0.97] transition-all"
              >
                Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Save as Template" Modal Dialog */}
      {templateDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--portal-primary,#3B82F6)]/10 text-[var(--portal-primary,#3B82F6)] shrink-0">
                <BookmarkPlus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Save as Template</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reuse this {blocks.length}-block structure across your portals.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Masterclass Workshop Blueprint"
                  className="w-full h-10 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Description</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={2}
                  placeholder="Explain when and how this layout should be used..."
                  className="w-full p-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSavingTemplate}
                onClick={() => setTemplateDialogOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingTemplate}
                onClick={handleSaveAsTemplate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--portal-primary,#3B82F6)] hover:opacity-95 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {isSavingTemplate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Template</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
