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
import { createPortal } from 'react-dom';
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
  Lock,
  Undo2,
  Redo2,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sanitizeSlug } from '@/lib/utils/slug-utils';
import { TagSelector } from '@/components/tags/TagSelector';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import {
  createContentItemAction,
  updateContentItemAction,
  createPortalContentTemplateAction,
} from '@/app/actions/content-actions';
import {
  saveContentStudioDraftAction,
  discardContentStudioDraftAction,
} from '@/app/actions/draft-actions';
import type { ContentItem, ContentItemType, ContentStatus, ContentMedia, PageBlock, PageBlockType, ResolvedTheme, BuilderResources } from '@/lib/types';
import type { PortalVisibility } from '@/lib/types/portal';
import type { MembershipPlan } from '@/lib/types/membership';
import type { ContentTeaserMode, CustomPaywallConfig, ContentStudioDraft } from '@/lib/types/content';
import { getBlock, normalizeBlockType } from '@/lib/page-builder/registry';
import { DEFAULT_THEME } from '@/lib/portal-presets';
import { ContentBlockCanvas } from './studio/ContentBlockCanvas';
import { ContentBlockPalette } from './studio/ContentBlockPalette';
import { ContentBlockInspector } from './studio/ContentBlockInspector';
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';

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
  const [viewMode, setViewMode] = useState<'studio' | 'preview' | 'details'>('studio');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Hydration & DOM Mount Guard for Body Portal
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background body scroll when full-screen studio modal is open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

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

  // Entitlement & Paywall State
  const firestore = useFirestore();
  const plansQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'membership_plans'),
            where('portalId', '==', portalId),
            where('status', '==', 'active')
          )
        : null,
    [firestore, portalId]
  );
  const { data: plans } = useCollection<MembershipPlan>(plansQuery);

  const [requiredPlanIds, setRequiredPlanIds] = useState<string[]>([]);
  const [teaserMode, setTeaserMode] = useState<ContentTeaserMode>('first_block');
  const [customPaywallTitle, setCustomPaywallTitle] = useState('');
  const [customPaywallDesc, setCustomPaywallDesc] = useState('');
  const [customPaywallPerks, setCustomPaywallPerks] = useState('');
  const [customPaywallCta, setCustomPaywallCta] = useState('');

  // Current user for cloud draft authorship
  const { user } = useUser();

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);
  const [localDraftNotice, setLocalDraftNotice] = useState<string | null>(null);

  // ─── Undo / Redo History Stack (Bounded to 50 snapshots) ───
  const MAX_HISTORY = 50;
  const [history, setHistory] = useState<{
    past: PageBlock[][];
    future: PageBlock[][];
  }>({ past: [], future: [] });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

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
      setRequiredPlanIds(initialItem.requiredPlanIds || []);
      setTeaserMode(initialItem.teaserMode || 'first_block');
      setCustomPaywallTitle(initialItem.customPaywall?.title || '');
      setCustomPaywallDesc(initialItem.customPaywall?.description || '');
      setCustomPaywallPerks((initialItem.customPaywall?.perks || []).join('\n'));
      setCustomPaywallCta(initialItem.customPaywall?.ctaText || '');
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
      setRequiredPlanIds([]);
      setTeaserMode('first_block');
      setCustomPaywallTitle('');
      setCustomPaywallDesc('');
      setCustomPaywallPerks('');
      setCustomPaywallCta('');
      setBlocks([]);
      setSelectedBlockId(null);
    }

    setHistory({ past: [], future: [] });
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
          const blockCount = savedDraft.blocks?.length || 0;
          setLocalDraftNotice(
            `Unsaved draft from ${draftDate.toLocaleTimeString()} (${blockCount} blocks) detected.`
          );
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [open, initialItem, defaultType, draftStorageKey]);

  // ─── Tier 1: Fast Debounced (400ms) Auto-Save to LocalStorage ───
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
        // Track active editing session for root Content Manager detection upon reload
        localStorage.setItem(
          `content_studio_active_session_${portalId}`,
          JSON.stringify({
            itemId: initialItem?.id || null,
            title: title || 'Untitled Document',
            type,
            timestamp: Date.now(),
          })
        );
      } catch {
        // Storage limit exceeded or disabled
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    open,
    isDirty,
    draftStorageKey,
    portalId,
    initialItem,
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

  // ─── Emergency Synchronous Flush on Window Reload / Unload ───
  useEffect(() => {
    if (!open || !isDirty) return;

    const handleBeforeUnload = () => {
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
        localStorage.setItem(
          `content_studio_active_session_${portalId}`,
          JSON.stringify({
            itemId: initialItem?.id || null,
            title: title || 'Untitled Document',
            type,
            timestamp: Date.now(),
          })
        );
      } catch {
        // Ignore errors on emergency unload
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    open,
    isDirty,
    draftStorageKey,
    portalId,
    initialItem,
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

  // ─── Tier 2: Debounced (3000ms) Cloud Draft Snapshot Sync ───
  useEffect(() => {
    if (!open || !isDirty || !portalId || !organizationId) return;

    const cloudTimer = setTimeout(() => {
      const draftPayload: ContentStudioDraft = {
        id: `${portalId}_${initialItem?.id || 'new_' + (user?.uid || 'user')}`,
        portalId,
        organizationId,
        contentItemId: initialItem?.id || null,
        title: title || 'Untitled Document',
        slug,
        type,
        summary,
        category,
        tags,
        blocks,
        visibility,
        media,
        seo: { metaTitle, metaDescription },
        authorId: user?.uid || 'admin_user',
        authorName: user?.displayName || user?.email || 'Author',
        authorEmail: user?.email || undefined,
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: initialItem?.version ? initialItem.version + 1 : 1,
      };

      saveContentStudioDraftAction(draftPayload).catch(() => {
        // Non-blocking background sync failure fallback
      });
    }, 3000);

    return () => clearTimeout(cloudTimer);
  }, [
    open,
    isDirty,
    portalId,
    organizationId,
    initialItem,
    user,
    title,
    slug,
    type,
    summary,
    category,
    tags,
    blocks,
    visibility,
    media,
    metaTitle,
    metaDescription,
  ]);

  // Helper to commit new blocks state with undo history snapshot
  const commitBlocksWithHistory = useCallback(
    (nextBlocks: PageBlock[]) => {
      setHistory((prev) => ({
        past: [...prev.past.slice(-(MAX_HISTORY - 1)), blocks],
        future: [],
      }));
      setBlocks(nextBlocks);
      setIsDirty(true);
    },
    [blocks]
  );

  // Undo Handler
  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);
      setBlocks(previous);
      setIsDirty(true);
      return {
        past: newPast,
        future: [blocks, ...prev.future],
      };
    });
  }, [blocks]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      setBlocks(next);
      setIsDirty(true);
      return {
        past: [...prev.past, blocks],
        future: newFuture,
      };
    });
  }, [blocks]);

  // Reversible Restore local draft handler
  const handleRestoreDraft = () => {
    try {
      const savedDraftJson = localStorage.getItem(draftStorageKey);
      if (!savedDraftJson) return;
      const saved = JSON.parse(savedDraftJson);

      // Push current canvas into undo history so the restoration is 100% reversible!
      if (saved.blocks) {
        commitBlocksWithHistory(saved.blocks);
      }
      if (saved.title) setTitle(saved.title);
      if (saved.slug) setSlug(saved.slug);
      if (saved.summary) setSummary(saved.summary);
      if (saved.category) setCategory(saved.category);
      if (saved.tags) setTags(saved.tags);
      if (saved.type) setType(saved.type);
      if (saved.visibility) setVisibility(saved.visibility);
      if (saved.media) setMedia(saved.media);
      if (saved.seo?.metaTitle) setMetaTitle(saved.seo.metaTitle);
      if (saved.seo?.metaDescription) setMetaDescription(saved.seo.metaDescription);

      setLocalDraftNotice(null);
      setIsDirty(true);
      toast({
        title: 'Draft Restored 🎉',
        description: `Restored ${saved.blocks?.length || 0} blocks. You can press ⌘Z to undo anytime.`,
      });
    } catch {
      toast({ title: 'Error', description: 'Could not restore local draft.' });
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(draftStorageKey);
    localStorage.removeItem(`content_studio_active_session_${portalId}`);
    discardContentStudioDraftAction(portalId, initialItem?.id || null).catch(() => {});
    setLocalDraftNotice(null);
    toast({ title: 'Draft Discarded', description: 'Local draft backup cleared.' });
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
  const handleBlocksChange = useCallback(
    (updated: PageBlock[]) => {
      commitBlocksWithHistory(updated);
    },
    [commitBlocksWithHistory]
  );

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

  // Block palette addition callback (supports direct in-situ index or sidebar palette)
  const handleAddBlockOfType = useCallback(
    (blockType: PageBlockType, targetIndex?: number) => {
      const def = getBlock(normalizeBlockType(blockType));
      const uniqueSuffix = Math.random().toString(36).slice(2, 7);
      const newBlock: PageBlock = {
        id: `blk_${blockType}_${Date.now()}_${uniqueSuffix}`,
        type: blockType,
        props: def ? { ...def.defaults } : {},
      };

      const insertPos =
        targetIndex !== undefined
          ? targetIndex
          : paletteInsertIndex !== null
          ? paletteInsertIndex
          : blocks.length;

      const updated = [...blocks];
      updated.splice(insertPos, 0, newBlock);
      commitBlocksWithHistory(updated);
      setSelectedBlockId(newBlock.id);
      setPaletteInsertIndex(null);
      setMobilePaletteOpen(false);
      setMobileInspectorOpen(true);

      toast({
        title: 'Block Added',
        description: `Added ${def?.label || blockType} to document.`,
      });
    },
    [blocks, paletteInsertIndex, commitBlocksWithHistory, toast]
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
      const updated = blocks.filter((b) => b.id !== blockId);
      commitBlocksWithHistory(updated);
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
        setMobileInspectorOpen(false);
      }
    },
    [blocks, selectedBlockId, commitBlocksWithHistory]
  );

  const handleResetBlockDefaults = useCallback(
    (blockId: string) => {
      const updated = blocks.map((b) => {
        if (b.id !== blockId) return b;
        const def = getBlock(normalizeBlockType(b.type));
        return def ? { ...b, props: { ...def.defaults } } : b;
      });
      commitBlocksWithHistory(updated);
    },
    [blocks, commitBlocksWithHistory]
  );

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

        const perksArray = customPaywallPerks
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean);

        const customPaywall: CustomPaywallConfig | undefined =
          customPaywallTitle.trim() || customPaywallDesc.trim() || perksArray.length > 0 || customPaywallCta.trim()
            ? {
                title: customPaywallTitle.trim() || undefined,
                description: customPaywallDesc.trim() || undefined,
                perks: perksArray.length > 0 ? perksArray : undefined,
                ctaText: customPaywallCta.trim() || undefined,
              }
            : undefined;

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
              requiredPlanIds,
              teaserMode,
              customPaywall,
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
          localStorage.removeItem(`content_studio_active_session_${portalId}`);
          discardContentStudioDraftAction(portalId, initialItem?.id || null).catch(() => {});
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
            requiredPlanIds,
            teaserMode,
            customPaywall,
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
          localStorage.removeItem(`content_studio_active_session_${portalId}`);
          discardContentStudioDraftAction(portalId, null).catch(() => {});
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
      requiredPlanIds,
      teaserMode,
      customPaywallTitle,
      customPaywallDesc,
      customPaywallCta,
      customPaywallPerks,
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

  // Keyboard shortcut listener (Cmd/Ctrl + S for Save, Cmd/Ctrl + Z for Undo, Cmd/Ctrl + Shift + Z / Ctrl + Y for Redo)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing inside an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
        return;
      }

      // If user is focused on a text input, let browser handle native text undo/redo
      if (isTextInput) return;

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleSave, handleUndo, handleRedo]);

  // Exit Guard
  const handleRequestClose = () => {
    if (isDirty) {
      setConfirmExitOpen(true);
    } else {
      onOpenChange(false);
    }
  };

  if (!open || !mounted) return null;
  if (typeof document === 'undefined') return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-background text-foreground flex flex-col overflow-hidden animate-in fade-in duration-200">
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

        {/* Center: View Switcher & History Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* History Controls */}
          <div className="hidden sm:flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo canvas change (⌘Z)"
              aria-label="Undo canvas change"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-background/80 active:scale-[0.97] transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-800" />
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo canvas change (⌘⇧Z)"
              aria-label="Redo canvas change"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-background/80 active:scale-[0.97] transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
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
              onClick={() => setViewMode('preview')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                viewMode === 'preview'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              <span>Preview</span>
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

          {/* Center: Canvas Workspace (Realistic Editorial WYSIWYG Document Sheet) */}
          <main className="flex-1 h-full overflow-y-auto bg-slate-100/70 dark:bg-zinc-950/70 p-4 sm:p-8">
            <div className="max-w-3xl mx-auto bg-card border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-xs transition-all min-h-[70vh]">
              {/* Document Header in Canvas (Integrated directly into document paper) */}
              <div className="pb-6 mb-6 border-b border-slate-100 dark:border-slate-800/60 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {type}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono truncate">
                    /portal/[slug]/content/{type}/{slug || 'auto-generated'}
                  </span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter document title..."
                  className="w-full text-2xl sm:text-3xl font-extrabold bg-transparent text-foreground placeholder:text-muted-foreground/40 border-none outline-none focus:ring-0 p-0"
                />
              </div>

              {/* Modular Block Canvas */}
              <ContentBlockCanvas
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={handleSelectBlock}
                onChangeBlocks={handleBlocksChange}
                onInsertAtIndex={handleInsertAtIndex}
                onAddBlockOfType={handleAddBlockOfType}
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
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
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
            <div className="md:hidden fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex flex-col justify-end">
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
            <div className="lg:hidden fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex flex-col justify-end">
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
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  className="border-none"
                />
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'preview' ? (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-zinc-950/50 flex flex-col relative">
          {/* Device Viewport Selector */}
          <div className="sticky top-0 z-10 w-full flex justify-center py-3 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                className={cn(
                  'min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.97]',
                  previewViewport === 'desktop'
                    ? 'bg-background shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Desktop preview"
              >
                <Monitor className="w-4 h-4" />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('tablet')}
                className={cn(
                  'min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.97]',
                  previewViewport === 'tablet'
                    ? 'bg-background shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Tablet preview"
              >
                <Tablet className="w-4 h-4" />
                <span className="hidden sm:inline">Tablet</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('mobile')}
                className={cn(
                  'min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.97]',
                  previewViewport === 'mobile'
                    ? 'bg-background shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Mobile preview"
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-6 flex flex-col items-center">
            <div 
              className="w-full bg-card border border-border shadow-sm min-h-[60vh] transition-all duration-300 mx-auto rounded-2xl overflow-hidden"
              style={{
                maxWidth: previewViewport === 'desktop' ? '800px' : previewViewport === 'tablet' ? '600px' : '390px'
              }}
            >
              <div className="p-8 md:p-12">
                <h1 className="text-3xl font-extrabold tracking-tight mb-4 text-foreground">{title || 'Untitled Document'}</h1>
                {summary && <p className="text-lg text-muted-foreground mb-8">{summary}</p>}
                {blocks.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-border rounded-xl">
                    <p className="text-sm font-semibold text-muted-foreground">No content blocks added yet.</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">Switch to Block Studio view to add and design blocks.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {blocks.map(block => {
                      const def = getBlock(normalizeBlockType(block.type));
                      return (
                        <div key={block.id} className="relative">
                          {def ? (
                            <BlockRenderer 
                              block={block} 
                              ctx={{ 
                                mode: 'view', 
                                viewport: previewViewport, 
                                theme: { 
                                  ...DEFAULT_THEME, 
                                  colors: { ...DEFAULT_THEME.colors, primary: portalPrimaryColor || DEFAULT_THEME.colors.primary },
                                  typography: { headingFont: 'Figtree, sans-serif', bodyFont: 'Figtree, sans-serif', baseSize: '16px' }
                                } as ResolvedTheme, 
                                interpolate: (t: string) => t,
                                resources: {} as BuilderResources
                              }} 
                            />
                          ) : (
                            <div className="p-4 rounded-xl border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                              Block preview unavailable for type: <span className="font-mono font-semibold">{block.type}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
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
                  <option value="membership_required">Membership Required (Tier Gated)</option>
                  <option value="authenticated">Authenticated (Any Logged-in User)</option>
                  <option value="invite_only">Invite Only (Explicit Grant)</option>
                  <option value="password_protected">Password Protected</option>
                </select>
              </div>
            </div>

            {/* Visibility & Entitlements Governance Panel */}
            {visibility !== 'public' && (
              <div className="p-4 rounded-2xl border border-[var(--portal-primary,#3B82F6)]/20 bg-[var(--portal-primary,#3B82F6)]/[0.02] space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--portal-primary,#3B82F6)]/10 flex items-center justify-center text-[var(--portal-primary,#3B82F6)]">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Access Entitlements & Paywall</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Configure which membership tiers unlock this content and customize the teaser paywall.
                    </p>
                  </div>
                </div>

                {/* Membership Tiers Selector */}
                {plans && plans.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground">Restricted to Specific Plans</label>
                      <span className="text-[10px] text-muted-foreground">
                        {requiredPlanIds.length === 0
                          ? 'All active plans included'
                          : `${requiredPlanIds.length} plan(s) selected`}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {plans.map((p) => {
                        const isChecked = requiredPlanIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              'flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all',
                              isChecked
                                ? 'border-[var(--portal-primary,#3B82F6)] bg-[var(--portal-primary,#3B82F6)]/10 text-foreground'
                                : 'border-slate-200 dark:border-slate-800 bg-background text-muted-foreground hover:border-slate-300 dark:hover:border-slate-700'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setRequiredPlanIds((prev) =>
                                  prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                                );
                                setIsDirty(true);
                              }}
                              className="rounded border-slate-300 text-[var(--portal-primary,#3B82F6)] focus:ring-[var(--portal-primary,#3B82F6)] h-4 w-4"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground truncate">{p.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {p.price === 0 ? 'Free' : `${(p.currency || 'USD').toUpperCase()} ${p.price}`}
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Tip: Leave all unselected to grant access to every active membership tier.
                    </p>
                  </div>
                )}

                {/* Teaser Mode Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Teaser Preview Boundary</label>
                  <select
                    value={teaserMode}
                    onChange={(e) => {
                      setTeaserMode(e.target.value as ContentTeaserMode);
                      setIsDirty(true);
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
                  >
                    <option value="first_block">First Block Preview (Recommended — shows intro before paywall)</option>
                    <option value="two_blocks">Two Blocks Preview (Extended intro preview)</option>
                    <option value="summary">Summary Only (Only card overview visible, all blocks gated)</option>
                    <option value="none">Immediate Lock (No content preview without access)</option>
                  </select>
                </div>

                {/* Custom Paywall Copywriting */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">Paywall Customization (Optional)</label>
                    <span className="text-[10px] text-muted-foreground">Overrides default paywall copy</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">Custom Paywall Title</label>
                    <input
                      type="text"
                      value={customPaywallTitle}
                      onChange={(e) => {
                        setCustomPaywallTitle(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Unlock Full Framework & Worksheets"
                      className="w-full h-9 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">Custom Description</label>
                    <textarea
                      value={customPaywallDesc}
                      onChange={(e) => {
                        setCustomPaywallDesc(e.target.value);
                        setIsDirty(true);
                      }}
                      rows={2}
                      placeholder="e.g. Join the membership tier to unlock download links and coaching..."
                      className="w-full p-2.5 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">Perks Checklist (One perk per line)</label>
                    <textarea
                      value={customPaywallPerks}
                      onChange={(e) => {
                        setCustomPaywallPerks(e.target.value);
                        setIsDirty(true);
                      }}
                      rows={3}
                      placeholder={"Full downloadable toolkit\nDirect instructor feedback\nLifetime access to updates"}
                      className="w-full p-2.5 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">Custom Call-To-Action Button Text</label>
                    <input
                      type="text"
                      value={customPaywallCta}
                      onChange={(e) => {
                        setCustomPaywallCta(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. Upgrade to Pro Access"
                      className="w-full h-9 px-3 rounded-xl bg-background border border-slate-200 dark:border-slate-800 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

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
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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

  return createPortal(modalContent, document.body);
}
