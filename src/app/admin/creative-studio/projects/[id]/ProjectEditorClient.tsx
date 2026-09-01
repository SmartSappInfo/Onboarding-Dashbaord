'use client';

/**
 * ARCHITECTURE:
 * Creative Project Full Canvas Editor Client (Phase 7 - Real-Time Collaboration & Editorial Approvals)
 * 
 * Professional WYSIWYG editor integrating real-time team presence, interactive canvas pin comments,
 * editorial sign-off workflows, Rule 1 merge variable resolution, live contact preview simulation,
 * Brand Studio compliance, AI design rules, Creative Health diagnostics, and precision canvas tools.
 * 
 * CAUTION:
 * Mid-drag updates must specify `commitToHistory = false`.
 * Pin comment click must stop event propagation to avoid accidental layer manipulation.
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-collab.test.ts
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useCreativeEditor } from '@/lib/creative/use-creative-editor';
import type {
  CreativeElement,
  CreativeComment,
  CreativeVersion,
  CreativeConcept,
  CreativeHealthReport,
  CreativeHealthIssue,
  CreativeTemplate,
  BrandKit,
  CrmCampaignContext,
  CrmContactPreview,
  PresenceUser,
} from '@/lib/creative/creative-types';
import { makeUniqueId, THUMBNAIL_FONT_OPTIONS } from '@/lib/creative/creative-types';
import type { MediaAsset } from '@/lib/types';
import { evaluateCreativeHealth } from '@/lib/creative/creative-health-engine';
import { applyHealthFix, applyImproveAllFixes } from '@/lib/creative/creative-health-fixes';
import { evaluateBrandCompliance, applyBrandRulesToElements } from '@/lib/creative/brand-intelligence';
import { resolveElementsForContact } from '@/lib/creative/creative-crm-engine';
import ThumbnailCanvas from '@/components/shared/thumbnail-designer/ThumbnailCanvas';
import { ContextualActionBar } from '@/components/shared/thumbnail-designer/ContextualActionBar';
import { LayersTreePanel } from '@/components/shared/thumbnail-designer/LayersTreePanel';
import { CreativeHealthPanel } from '@/components/shared/thumbnail-designer/CreativeHealthPanel';
import { BatchPersonalizationModal } from '@/components/shared/thumbnail-designer/BatchPersonalizationModal';
import { ApprovalWorkflowModal } from '@/components/shared/thumbnail-designer/ApprovalWorkflowModal';
import { PublishingModal } from '@/components/shared/thumbnail-designer/PublishingModal';
import { ExperimentBuilderModal } from '@/components/shared/thumbnail-designer/ExperimentBuilderModal';
import {
  KeyboardShortcutsDialog,
  useKeyboardShortcuts,
} from '@/components/shared/thumbnail-designer/KeyboardShortcutsDialog';
import { ResponsiveViewportSimulator } from '@/components/shared/thumbnail-designer/ResponsiveViewportSimulator';
import { AiCommandBar } from '@/components/shared/thumbnail-designer/AiCommandBar';
import { AiCreativeDirectorDrawer } from '@/components/shared/thumbnail-designer/AiCreativeDirectorDrawer';
import {
  getCreativeProjectWithDocumentAction,
  saveCreativeDocumentAction,
  createVersionSnapshotAction,
  listCreativeVersionsAction,
} from '@/app/actions/creative-project-actions';
import { getWorkspaceBrandKitAction } from '@/app/actions/brand-kit-actions';
import { saveCanvasAsTemplateAction } from '@/app/actions/creative-template-actions';
import {
  listCrmCampaignsAction,
  getCrmContactPreviewDataAction,
  linkCreativeToCrmCampaignAction,
  SAMPLE_CAMPAIGNS,
  SAMPLE_CONTACTS,
} from '@/app/actions/creative-crm-actions';
import {
  listProjectCommentsAction,
  addProjectCommentAction,
  resolveProjectCommentAction,
} from '@/app/actions/creative-comment-actions';
import {
  submitProjectForReviewAction,
  approveCreativeProjectAction,
  requestProjectChangesAction,
  addCanvasPinCommentAction,
} from '@/app/actions/creative-collab-actions';
import { executeAiCanvasCommandAction } from '@/app/actions/creative-ai-actions';
import { removeImageBackgroundAction } from '@/app/actions/media-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Sparkles,
  Trash2,
  ArrowLeft,
  Wand2,
  Save,
  Copy,
  ZoomIn,
  ZoomOut,
  Search,
  Palette,
  MessageSquare,
  History,
  Check,
  Send,
  X,
  Globe,
  Loader2,
  Smartphone,
  Keyboard,
  Eye,
  ShieldCheck,
  BookmarkPlus,
  Users,
  Target,
  UserCheck,
  MapPin,
  Clock,
  AlertTriangle,
  FlaskConical,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import { cn } from '@/lib/utils';

const EMOJI_OPTIONS = ['🔥', '😱', '🚨', '👉', '💡', '💰', '❌', '✅', '👑', '💥', '👀', '💯', '📈', '🚀'];
const PRESET_ICONS = [
  'Play', 'TrendingUp', 'AlertCircle', 'CheckCircle2', 'XCircle',
  'ThumbsUp', 'Bell', 'Video', 'DollarSign', 'Flame', 'Sparkles',
];

const CRM_VARIABLE_SHORTCUTS = [
  { label: 'First Name', tag: '{{contact.first_name}}' },
  { label: 'Last Name', tag: '{{contact.last_name}}' },
  { label: 'Company / School', tag: '{{contact.company}}' },
  { label: 'Campaign Title', tag: '{{campaign.name}}' },
];

interface ProjectEditorClientProps {
  projectId: string;
}

export function ProjectEditorClient({ projectId }: ProjectEditorClientProps) {
  const { toast } = useToast();

  // Zustand Store
  const project = useCreativeEditor((s) => s.project);
  const document = useCreativeEditor((s) => s.document);
  const selectedIds = useCreativeEditor((s) => s.selectedIds);
  const isDirty = useCreativeEditor((s) => s.isDirty);
  const isSaving = useCreativeEditor((s) => s.isSaving);

  const initialize = useCreativeEditor((s) => s.initialize);
  const selectElement = useCreativeEditor((s) => s.selectElement);
  const selectMultiple = useCreativeEditor((s) => s.selectMultiple);
  const selectAll = useCreativeEditor((s) => s.selectAll);
  const clearSelection = useCreativeEditor((s) => s.clearSelection);

  const addElement = useCreativeEditor((s) => s.addElement);
  const updateElement = useCreativeEditor((s) => s.updateElement);
  const updateElementsBatch = useCreativeEditor((s) => s.updateElementsBatch);
  const deleteElement = useCreativeEditor((s) => s.deleteElement);
  const deleteSelected = useCreativeEditor((s) => s.deleteSelected);
  const duplicateSelected = useCreativeEditor((s) => s.duplicateSelected);
  const reorderElement = useCreativeEditor((s) => s.reorderElement);

  const groupSelected = useCreativeEditor((s) => s.groupSelected);
  const ungroupSelected = useCreativeEditor((s) => s.ungroupSelected);
  const toggleGroupLock = useCreativeEditor((s) => s.toggleGroupLock);
  const toggleGroupVisibility = useCreativeEditor((s) => s.toggleGroupVisibility);

  const alignSelected = useCreativeEditor((s) => s.alignSelected);
  const distributeSelected = useCreativeEditor((s) => s.distributeSelected);
  const nudgeSelected = useCreativeEditor((s) => s.nudgeSelected);

  const updateBackground = useCreativeEditor((s) => s.updateBackground);
  const undo = useCreativeEditor((s) => s.undo);
  const redo = useCreativeEditor((s) => s.redo);
  const setSaving = useCreativeEditor((s) => s.setSaving);
  const markSaved = useCreativeEditor((s) => s.markSaved);

  // Local UI States
  const [isLoading, setIsLoading] = useState(true);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [iconSearch, setIconSearch] = useState('');
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showViewportSimulator, setShowViewportSimulator] = useState(false);

  // AI Creative Director Drawer & Command Bar States (Phase 3)
  const [isAiCommandBarOpen, setIsAiCommandBarOpen] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  // Attention & Creative Health State (Phase 4)
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [healthReport, setHealthReport] = useState<CreativeHealthReport>({
    overallScore: 92,
    status: 'optimal',
    vectors: [],
    issues: [],
    saliencyHotspots: [],
    evaluatedAt: new Date().toISOString(),
  });

  // Brand Kit State (Phase 5)
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);

  // Save as Template Dialog State (Phase 5)
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState<CreativeTemplate['category']>('general');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // CRM Integration State (Phase 6)
  const [campaigns, setCampaigns] = useState<CrmCampaignContext[]>(SAMPLE_CAMPAIGNS);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('camp-q3-enrollment');
  const [contacts, setContacts] = useState<CrmContactPreview[]>(SAMPLE_CONTACTS);
  const [previewContactId, setPreviewContactId] = useState<string>('none');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Real-Time Collaboration & Presence States (Phase 7)
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isPinDropperActive, setIsPinDropperActive] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [liveUsers] = useState<PresenceUser[]>([
    {
      id: 'usr-alex',
      name: 'Alex Design',
      email: 'alex@smartsapp.com',
      color: '#10b981',
      cursorX: 35,
      cursorY: 42,
      lastActive: new Date().toISOString(),
    },
    {
      id: 'usr-clara',
      name: 'Clara Art Lead',
      email: 'clara@smartsapp.com',
      color: '#06b6d4',
      cursorX: 68,
      cursorY: 28,
      lastActive: new Date().toISOString(),
    },
  ]);

  // Cloud Comments State
  const [comments, setComments] = useState<CreativeComment[]>([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const authorName = 'Creative Lead';
  const authorEmail = 'lead@smartsapp.com';

  // Version History State
  const [versions, setVersions] = useState<CreativeVersion[]>([]);
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState('');

  // Direct Publish Dialog (Phase 8)
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);

  // A/B Experiment Dialog (Phase 9)
  const [isExperimentModalOpen, setIsExperimentModalOpen] = useState(false);

  // 1. Initial Load
  useEffect(() => {
    let active = true;
    async function loadData() {
      setIsLoading(true);
      const res = await getCreativeProjectWithDocumentAction(projectId);
      if (!active) return;

      if (res.success && res.data) {
        initialize(res.data.project, res.data.document);

        // Load Brand Kit
        const brandRes = await getWorkspaceBrandKitAction(res.data.project.workspaceId);
        if (brandRes.success && brandRes.data) {
          setBrandKit(brandRes.data);
        }

        // Load CRM Campaigns
        const campRes = await listCrmCampaignsAction(res.data.project.workspaceId);
        if (campRes.success && campRes.data) {
          setCampaigns(campRes.data);
        }

        // Load CRM Contacts
        const contactsRes = await getCrmContactPreviewDataAction(res.data.project.workspaceId);
        if (contactsRes.success && contactsRes.data) {
          setContacts(contactsRes.data);
        }

        // Load Comments
        const commentsRes = await listProjectCommentsAction(projectId);
        if (commentsRes.success && commentsRes.data) {
          setComments(commentsRes.data);
        }

        // Load Versions
        const versionsRes = await listCreativeVersionsAction(res.data.document.id);
        if (versionsRes.success && versionsRes.data) {
          setVersions(versionsRes.data);
        }
      } else {
        toast({ title: 'Load Error', description: res.error || 'Could not load project', variant: 'destructive' });
      }
      setIsLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, [projectId, initialize, toast]);

  // Active CRM Campaign Object
  const activeCampaign = useMemo(() => {
    return campaigns.find((c) => c.campaignId === selectedCampaignId) || campaigns[0];
  }, [campaigns, selectedCampaignId]);

  // Active Live Contact Object for Preview Simulator
  const activeContact = useMemo(() => {
    if (previewContactId === 'none') return null;
    return contacts.find((c) => c.id === previewContactId) || null;
  }, [contacts, previewContactId]);

  // Computed Dynamic Elements (Personalized during preview simulation)
  const displayedCanvasElements = useMemo(() => {
    if (!activeContact) return document.elements;
    return resolveElementsForContact(document.elements, activeContact, activeCampaign);
  }, [document.elements, activeContact, activeCampaign]);

  // 2. Debounced Creative Health Evaluator (Phase 4)
  useEffect(() => {
    const timer = setTimeout(() => {
      const report = evaluateCreativeHealth(
        displayedCanvasElements,
        document.backgroundColor,
        document.backgroundGradient,
        brandKit
      );
      setHealthReport(report);
    }, 250);
    return () => clearTimeout(timer);
  }, [displayedCanvasElements, document.backgroundColor, document.backgroundGradient, brandKit]);

  // Brand Compliance Report (Phase 5)
  const brandCompliance = useMemo(() => {
    return evaluateBrandCompliance(displayedCanvasElements, brandKit);
  }, [displayedCanvasElements, brandKit]);

  // 3. Debounced Autosave (1500ms)
  const saveDocumentNow = useCallback(async () => {
    if (!project || !document) return;
    setSaving(true);

    const res = await saveCreativeDocumentAction(
      document.id,
      project.id,
      project.workspaceId,
      document.elements,
      document.thumbnailUrl,
      {
        backgroundColor: document.backgroundColor,
        backgroundGradient: document.backgroundGradient,
        backgroundImage: document.backgroundImage,
      }
    );

    setSaving(false);
    if (res.success) {
      markSaved();
    }
  }, [project, document, setSaving, markSaved]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      saveDocumentNow();
    }, 1500);
    return () => clearTimeout(timer);
  }, [isDirty, saveDocumentNow]);

  // 4. Global Keyboard Shortcuts Listener
  useKeyboardShortcuts({
    onSelectAll: selectAll,
    onClearSelection: clearSelection,
    onGroupSelected: groupSelected,
    onUngroupSelected: ungroupSelected,
    onDuplicateSelected: duplicateSelected,
    onDeleteSelected: deleteSelected,
    onNudgeSelected: nudgeSelected,
    onUndo: undo,
    onRedo: redo,
    onOpenShortcutsHelp: () => setShowShortcutsModal(true),
  });

  // Selected Elements Array
  const selectedElements = useMemo(() => {
    const set = new Set(selectedIds);
    return document.elements.filter((el) => set.has(el.id));
  }, [document.elements, selectedIds]);

  const selectedPrimaryElement = selectedElements.length === 1 ? selectedElements[0] : null;

  // Actions
  const handleAddText = (type: 'headline' | 'subtitle' | 'badge') => {
    const newEl: CreativeElement = {
      id: makeUniqueId(),
      type: 'text',
      x: 20,
      y: type === 'headline' ? 30 : type === 'subtitle' ? 55 : 75,
      width: 60,
      height: 18,
      zIndex: document.elements.length + 1,
      text: type === 'headline' ? 'BOLD HEADLINE' : type === 'subtitle' ? 'Subheading text here' : 'LIMITED TIME',
      fontSize: type === 'headline' ? 52 : type === 'subtitle' ? 28 : 20,
      fontFamily: brandKit?.typography?.displayFont || 'Impact',
      fill: type === 'badge' ? '#ffffff' : '#facc15',
      textAlign: 'center',
      textStrokeColor: '#000000',
      textStrokeWidth: type === 'headline' ? 3 : 0,
      badgeColor: type === 'badge' ? '#dc2626' : undefined,
      semanticRole: type === 'headline' ? 'headline' : type === 'subtitle' ? 'subtitle' : 'badge',
    };
    addElement(newEl);
  };

  const handleAddShape = (shapeType: 'rect' | 'circle' | 'arrow') => {
    const newEl: CreativeElement = {
      id: makeUniqueId(),
      type: shapeType,
      x: 40,
      y: 40,
      width: shapeType === 'arrow' ? 12 : 20,
      height: shapeType === 'arrow' ? 12 : 20,
      zIndex: document.elements.length + 1,
      shapeFill: '#10b981',
      borderRadius: shapeType === 'circle' ? 9999 : 12,
      semanticRole: 'decoration',
    };
    addElement(newEl);
  };

  const handleAddIcon = (iconName: string) => {
    const newEl: CreativeElement = {
      id: makeUniqueId(),
      type: 'icon',
      x: 45,
      y: 45,
      width: 10,
      height: 10,
      zIndex: document.elements.length + 1,
      iconName,
      shapeFill: '#ffffff',
      semanticRole: 'decoration',
    };
    addElement(newEl);
  };

  const handleAddEmoji = (emoji: string) => {
    const newEl: CreativeElement = {
      id: makeUniqueId(),
      type: 'emoji',
      x: 45,
      y: 45,
      width: 10,
      height: 10,
      zIndex: document.elements.length + 1,
      text: emoji,
      semanticRole: 'decoration',
    };
    addElement(newEl);
  };

  const handleApplyBrandKit = () => {
    if (!brandKit) return;
    updateBackground({
      backgroundColor: brandKit.colors.primary[0] || '#0f172a',
      backgroundGradient: {
        type: 'linear',
        angle: 135,
        colors: [brandKit.colors.primary[0], brandKit.colors.primary[1] || '#1e293b'],
      },
    });

    if (brandKit.watermarkUrl) {
      const watermarkEl: CreativeElement = {
        id: makeUniqueId(),
        type: 'image',
        x: 85,
        y: 80,
        width: 10,
        height: 12,
        zIndex: 99,
        imageSrc: brandKit.watermarkUrl,
        opacity: 0.8,
        semanticRole: 'brand_logo',
      };
      addElement(watermarkEl);
    }

    toast({ title: 'Brand Theme Applied', description: 'Applied brand kit colors, typography, and watermark.' });
  };

  const handleApplyBrandRules = () => {
    if (!brandKit) return;
    const enforced = applyBrandRulesToElements(document.elements, brandKit);
    useCreativeEditor.setState((s) => ({
      document: {
        ...s.document,
        elements: enforced,
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
      history: {
        past: [...s.history.past, s.history.present],
        present: { ...s.document, elements: enforced },
        future: [],
      },
    }));
    toast({
      title: 'Brand Rules Enforced',
      description: `Synchronized typography to ${brandKit.typography.displayFont} and primary palette.`,
    });
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || !project || !document) return;
    setIsSavingTemplate(true);
    const res = await saveCanvasAsTemplateAction(
      document.id,
      project.workspaceId,
      templateName.trim(),
      templateDescription.trim(),
      templateCategory,
      'workspace'
    );
    setIsSavingTemplate(false);

    if (res.success) {
      setIsSaveTemplateOpen(false);
      setTemplateName('');
      setTemplateDescription('');
      toast({
        title: 'Template Saved to Library',
        description: `"${res.data?.name}" is now available in your Template Marketplace.`,
      });
    } else {
      toast({
        title: 'Save Failed',
        description: res.error || 'Could not save template.',
        variant: 'destructive',
      });
    }
  };

  const handleLinkCampaign = async (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    const camp = campaigns.find((c) => c.campaignId === campaignId);
    if (camp && project) {
      await linkCreativeToCrmCampaignAction(project.id, camp);
      toast({
        title: 'CRM Campaign Linked',
        description: `Associated with "${camp.campaignName}".`,
      });
    }
  };

  const handleInsertMergeVariable = (tag: string) => {
    if (selectedPrimaryElement?.type === 'text') {
      const currentText = selectedPrimaryElement.text || '';
      updateElement(selectedPrimaryElement.id, {
        text: `${currentText} ${tag}`.trim(),
      });
      toast({ title: 'Variable Inserted', description: `Injected ${tag}` });
    } else {
      toast({
        title: 'Select a Text Element',
        description: 'Click on any text box on the canvas to insert this dynamic variable.',
      });
    }
  };

  // -------------------------------------------------------------
  // Real-Time Editorial Approval Handlers (Phase 7)
  // -------------------------------------------------------------

  const handleSubmitForReview = async (note: string) => {
    if (!project) return;
    const res = await submitProjectForReviewAction(project.id, authorName, note);
    if (res.success && res.data) {
      useCreativeEditor.setState((s) => ({
        project: s.project ? { ...s.project, status: 'in_review' } : null,
      }));
      toast({ title: 'Submitted for Review', description: 'Art director notified of pending review.' });
    }
  };

  const handleApproveProject = async (note: string) => {
    if (!project) return;
    const res = await approveCreativeProjectAction(project.id, authorName, authorEmail, note);
    if (res.success && res.data) {
      useCreativeEditor.setState((s) => ({
        project: s.project ? { ...s.project, status: 'approved' } : null,
      }));
      toast({ title: 'Creative Approved', description: 'Design sign-off complete. Ready for publishing.' });
    }
  };

  const handleRequestChanges = async (changeNotes: string) => {
    if (!project) return;
    const res = await requestProjectChangesAction(project.id, authorName, authorEmail, changeNotes);
    if (res.success && res.data) {
      useCreativeEditor.setState((s) => ({
        project: s.project ? { ...s.project, status: 'changes_requested' } : null,
      }));
      toast({ title: 'Changes Requested', description: 'Feedback sent back to designer.' });
    }
  };

  const handleDropCanvasPin = async (xPercent: number, yPercent: number) => {
    if (!project || !document) return;
    const pinText = prompt('Enter your comment note for this pin:');
    if (!pinText?.trim()) {
      setIsPinDropperActive(false);
      return;
    }

    const res = await addCanvasPinCommentAction(
      project.id,
      xPercent,
      yPercent,
      pinText,
      authorName,
      authorEmail,
      document.id
    );

    setIsPinDropperActive(false);

    if (res.success && res.data) {
      setComments((prev) => [...prev, res.data!]);
      setActiveCommentId(res.data.id);
      setIsCommentsOpen(true);
      toast({ title: 'Comment Pin Dropped', description: `Pinned at (${xPercent}%, ${yPercent}%).` });
    }
  };

  const handleSelectCanvasPin = (comment: CreativeComment) => {
    setActiveCommentId(comment.id);
    setIsCommentsOpen(true);
  };

  // -------------------------------------------------------------
  // Creative Health Auto-Fix Handlers (Phase 4)
  // -------------------------------------------------------------

  const handleApplyHealthFix = (issue: CreativeHealthIssue) => {
    const fixed = applyHealthFix(document.elements, issue, brandKit);
    useCreativeEditor.setState((s) => ({
      document: {
        ...s.document,
        elements: fixed,
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
      history: {
        past: [...s.history.past, s.history.present],
        present: { ...s.document, elements: fixed },
        future: [],
      },
    }));

    toast({
      title: 'Fix Applied',
      description: issue.title,
    });
  };

  const handleImproveAllHealthFixes = () => {
    const fixed = applyImproveAllFixes(document.elements, healthReport.issues, brandKit);
    useCreativeEditor.setState((s) => ({
      document: {
        ...s.document,
        elements: fixed,
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
      history: {
        past: [...s.history.past, s.history.present],
        present: { ...s.document, elements: fixed },
        future: [],
      },
    }));

    toast({
      title: 'Improved All Diagnostic Issues',
      description: `Optimized ${healthReport.issues.length} health dimensions.`,
    });
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim() || !project) return;
    const res = await addProjectCommentAction(project.id, {
      authorName,
      authorEmail,
      text: newCommentText.trim(),
      documentId: document.id,
      elementId: selectedIds.length > 0 ? selectedIds[0] : undefined,
    });

    if (res.success && res.data) {
      setComments((prev) => [...prev, res.data!]);
      setNewCommentText('');
      toast({ title: 'Comment Posted', description: 'Feedback attached to creative project.' });
    }
  };

  const handleResolveComment = async (commentId: string) => {
    const res = await resolveProjectCommentAction(commentId, true);
    if (res.success) {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)));
      toast({ title: 'Resolved', description: 'Comment marked as resolved.' });
    }
  };

  const handleCreateSnapshot = async () => {
    if (!project || !document) return;
    const res = await createVersionSnapshotAction(
      document.id,
      project.id,
      document.elements,
      document.thumbnailUrl,
      snapshotNote.trim() || undefined
    );
    if (res.success && res.data) {
      setVersions((prev) => [res.data!, ...prev]);
      setSnapshotNote('');
      toast({ title: 'Version Snapshot Saved', description: `Saved ${res.data.note}` });
    }
  };

  const handleRestoreVersion = (ver: CreativeVersion) => {
    updateBackground({
      backgroundColor: ver.backgroundColor,
      backgroundGradient: ver.backgroundGradient,
      backgroundImage: ver.backgroundImage,
    });
    useCreativeEditor.setState((s) => ({
      document: {
        ...s.document,
        elements: ver.elements,
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));
    toast({ title: 'Version Restored', description: `Restored snapshot ${ver.note}` });
  };

  // -------------------------------------------------------------
  // AI Creative Director Handlers (Phase 3)
  // -------------------------------------------------------------

  const handleApplyConcept = (concept: CreativeConcept) => {
    const elements = concept.elements || concept.documentData?.elements || [];
    const bgGrad = concept.backgroundGradient || concept.documentData?.backgroundGradient;
    const bgColor = concept.backgroundColor || concept.documentData?.backgroundColor || '#0f172a';

    updateBackground({
      backgroundColor: bgColor,
      backgroundGradient: bgGrad,
    });

    useCreativeEditor.setState((s) => ({
      document: {
        ...s.document,
        elements,
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));

    toast({
      title: 'Concept Applied',
      description: `Applied ${concept.name} (${concept.predictedCTRScore || concept.healthScore}/100 CTR).`,
    });
  };

  const handleApplyModifiedElements = (modified: CreativeElement[]) => {
    useCreativeEditor.setState((s) => ({
      document: {
        ...s.document,
        elements: modified,
        updatedAt: new Date().toISOString(),
      },
      isDirty: true,
    }));
    toast({ title: 'Visuals Transformed', description: 'AI adjustments committed to canvas.' });
  };

  const handleApplyHeadlineText = (headline: string, subtitle?: string, badge?: string) => {
    const existingHeadline = document.elements.find((el) => el.semanticRole === 'headline' || el.type === 'text');

    if (existingHeadline) {
      updateElement(existingHeadline.id, { text: headline });
    } else {
      handleAddText('headline');
    }

    if (subtitle) {
      const existingSub = document.elements.find((el) => el.semanticRole === 'subtitle');
      if (existingSub) {
        updateElement(existingSub.id, { text: subtitle });
      }
    }

    if (badge) {
      const existingBadge = document.elements.find((el) => el.semanticRole === 'badge');
      if (existingBadge) {
        updateElement(existingBadge.id, { text: badge });
      }
    }

    toast({ title: 'Copy Injected', description: `Updated headline to "${headline}".` });
  };

  const handleSubmitAiCommand = async (instruction: string) => {
    const res = await executeAiCanvasCommandAction(
      projectId,
      document.elements,
      instruction,
      brandKit
    );

    if (res.success && res.data) {
      handleApplyModifiedElements(res.data.modifiedElements);
      toast({
        title: 'Creative Director Adjusted Layout',
        description: res.data.actionSummary,
      });
    } else {
      toast({
        title: 'Command Failed',
        description: res.error || 'Could not execute AI command.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveBackground = async (imageUrl: string) => {
    toast({ title: 'Extracting Subject...', description: 'Running AI background removal cutout model.' });
    try {
      const cutoutUrl = await removeImageBackgroundAction(imageUrl);
      if (selectedPrimaryElement) {
        updateElement(selectedPrimaryElement.id, { imageSrc: cutoutUrl });
      }
      toast({ title: 'Subject Isolated', description: 'Background removed successfully.' });
    } catch {
      toast({ title: 'Cutout Error', description: 'Failed to remove background.', variant: 'destructive' });
    }
  };

  if (isLoading || !project) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center space-y-4 bg-slate-950 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <div className="text-sm font-bold">Loading Creative Studio Workspace...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Editor Bar */}
      <div className="h-14 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Back Link, Name & Status Badges */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/creative-studio/projects"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 active:scale-[0.95] transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 truncate">
            <span className="font-black text-sm text-white truncate max-w-[180px] sm:max-w-[280px]">
              {project.name}
            </span>
            <span
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-md uppercase hidden sm:inline-flex items-center gap-1',
                project.status === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : project.status === 'in_review'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : project.status === 'changes_requested'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400'
              )}
            >
              {project.status === 'approved' ? (
                <Check className="w-3 h-3" />
              ) : project.status === 'in_review' ? (
                <Clock className="w-3 h-3" />
              ) : project.status === 'changes_requested' ? (
                <AlertTriangle className="w-3 h-3" />
              ) : null}
              {project.status?.replace('_', ' ') || 'draft'}
            </span>
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                  <span className="text-slate-400">Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  <span>Saved</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Center: Undo/Redo & Zoom Controls */}
        <div className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80">
          <Button
            onClick={undo}
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg active:scale-[0.95]"
          >
            Undo
          </Button>
          <Button
            onClick={redo}
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg active:scale-[0.95]"
          >
            Redo
          </Button>
          <div className="w-[1px] h-4 bg-slate-800 mx-1" />
          <Button
            onClick={() => setZoomPercent((z) => Math.max(z - 10, 20))}
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-bold text-slate-300 w-10 text-center">{zoomPercent}%</span>
          <Button
            onClick={() => setZoomPercent((z) => Math.min(z + 10, 200))}
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* Approval Sign-Off Trigger (Phase 7) */}
          <Button
            onClick={() => setIsApprovalModalOpen(true)}
            variant="outline"
            size="sm"
            className={cn(
              'text-xs h-9 px-3 rounded-xl min-h-[36px] active:scale-[0.97] transition-all flex items-center gap-1.5',
              project.status === 'approved'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                : project.status === 'in_review'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/40'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">
              {project.status === 'approved' ? 'Approved' : project.status === 'in_review' ? 'In Review' : 'Review'}
            </span>
          </Button>

          {/* Canvas Pin Dropper Toggle (Phase 7) */}
          <Button
            onClick={() => setIsPinDropperActive(!isPinDropperActive)}
            variant="outline"
            size="sm"
            className={cn(
              'text-xs h-9 px-3 rounded-xl min-h-[36px] active:scale-[0.97] transition-all',
              isPinDropperActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            )}
          >
            <MapPin className="w-3.5 h-3.5 mr-1 text-cyan-400" />
            <span className="hidden sm:inline">Pin Note</span>
          </Button>

          {/* Attention Heatmap Toggle (Phase 4) */}
          <Button
            onClick={() => setHeatmapVisible(!heatmapVisible)}
            variant="outline"
            size="sm"
            className={cn(
              'border-slate-800 text-xs h-9 px-3 rounded-xl min-h-[36px] active:scale-[0.97] transition-all',
              heatmapVisible
                ? 'bg-red-500/15 text-red-400 border-red-500/40 shadow-lg shadow-red-500/10'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            )}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Heatmap</span>
          </Button>

          {/* AI Command Bar Quick Launch (Cmd+K) */}
          <Button
            onClick={() => setIsAiCommandBarOpen(true)}
            variant="outline"
            size="sm"
            className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-9 px-3 rounded-xl min-h-[36px] active:scale-[0.97] hidden lg:flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Directives</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-slate-400">⌘K</kbd>
          </Button>

          {/* AI Creative Director Drawer Trigger (Phase 3) */}
          <Button
            onClick={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
            size="sm"
            className={cn(
              'font-black text-xs h-9 px-3.5 rounded-xl shadow-lg active:scale-[0.97] transition-all min-h-[36px]',
              isAiDrawerOpen
                ? 'bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-emerald-500/10'
            )}
          >
            <Wand2 className="w-3.5 h-3.5 mr-1.5" /> AI Director
          </Button>

          {/* Save as Template Trigger (Phase 5) */}
          <Button
            onClick={() => {
              setTemplateName(`${project.name} Template`);
              setIsSaveTemplateOpen(true);
            }}
            variant="outline"
            size="sm"
            className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-9 px-3 rounded-xl min-h-[36px] active:scale-[0.97] hidden sm:flex items-center"
          >
            <BookmarkPlus className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            <span>Template</span>
          </Button>

          {/* Viewport Preview Simulator */}
          <Button
            onClick={() => setShowViewportSimulator(true)}
            variant="outline"
            size="sm"
            className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-9 px-3 rounded-xl min-h-[36px] active:scale-[0.97]"
          >
            <Smartphone className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            <span className="hidden sm:inline">Preview</span>
          </Button>

          {/* Comments Toggle */}
          <Button
            onClick={() => setIsCommentsOpen(!isCommentsOpen)}
            variant="outline"
            size="sm"
            className={cn(
              'border-slate-800 text-xs h-9 px-3 rounded-xl min-h-[36px] active:scale-[0.97]',
              isCommentsOpen ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-slate-300'
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Comments</span>
            {comments.filter((c) => !c.resolved).length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                {comments.filter((c) => !c.resolved).length}
              </span>
            )}
          </Button>

          {/* Version History Toggle */}
          <Button
            onClick={() => setIsVersionsOpen(!isVersionsOpen)}
            variant="outline"
            size="sm"
            className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs h-9 px-3 rounded-xl min-h-[36px] active:scale-[0.97]"
          >
            <History className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
            <span className="hidden sm:inline">Versions</span>
          </Button>

          {/* Keyboard Shortcuts Trigger */}
          <Button
            onClick={() => setShowShortcutsModal(true)}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-slate-400 hover:text-white rounded-xl"
            title="Keyboard Shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </Button>

          {/* A/B Experiment Trigger (Phase 9) */}
          <Button
            onClick={() => setIsExperimentModalOpen(true)}
            variant="outline"
            size="sm"
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs h-9 px-3 rounded-xl min-h-[36px] active:scale-[0.97] hidden sm:flex items-center gap-1.5"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>A/B Test</span>
          </Button>

          {/* Publish Trigger (Phase 8) */}
          <Button
            onClick={() => setIsPublishDialogOpen(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs h-9 px-3.5 rounded-xl active:scale-[0.97] transition-all min-h-[36px]"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5" /> Publish
          </Button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Tool Tabs Sidebar */}
        <aside className="w-72 sm:w-80 border-r border-slate-850 bg-slate-950 flex flex-col shrink-0 z-10">
          <Tabs defaultValue="add" className="flex-1 flex flex-col">
            <TabsList className="h-11 bg-slate-900/60 p-1 border-b border-slate-850 rounded-none w-full grid grid-cols-5">
              <TabsTrigger value="add" className="text-xs font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 rounded-lg">
                Add
              </TabsTrigger>
              <TabsTrigger value="brand" className="text-xs font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 rounded-lg">
                Brand
              </TabsTrigger>
              <TabsTrigger value="crm" className="text-xs font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 rounded-lg">
                CRM
              </TabsTrigger>
              <TabsTrigger value="layers" className="text-xs font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 rounded-lg">
                Layers
              </TabsTrigger>
              <TabsTrigger value="health" className="text-xs font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 rounded-lg">
                Health
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Add Elements */}
            <TabsContent value="add" className="flex-1 overflow-y-auto p-4 space-y-6 m-0 scrollbar-none">
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Typography</div>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    onClick={() => handleAddText('headline')}
                    className="w-full justify-start bg-slate-900 hover:bg-slate-850 text-white font-black text-sm h-11 rounded-xl border border-slate-800 active:scale-[0.98]"
                  >
                    + Add Big Headline
                  </Button>
                  <Button
                    onClick={() => handleAddText('subtitle')}
                    className="w-full justify-start bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs h-9 rounded-xl border border-slate-800 active:scale-[0.98]"
                  >
                    + Add Subtitle Hook
                  </Button>
                  <Button
                    onClick={() => handleAddText('badge')}
                    className="w-full justify-start bg-red-600/20 hover:bg-red-600/30 text-red-400 font-black text-xs h-9 rounded-xl border border-red-500/30 active:scale-[0.98]"
                  >
                    + Add Urgent Badge
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shapes & Arrows</div>
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => handleAddShape('rect')} variant="outline" className="h-10 bg-slate-900 border-slate-800 text-xs font-bold rounded-xl">
                    Rectangle
                  </Button>
                  <Button onClick={() => handleAddShape('circle')} variant="outline" className="h-10 bg-slate-900 border-slate-800 text-xs font-bold rounded-xl">
                    Circle
                  </Button>
                  <Button onClick={() => handleAddShape('arrow')} variant="outline" className="h-10 bg-slate-900 border-slate-800 text-xs font-bold rounded-xl text-emerald-400">
                    Focus Arrow
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subject & Media</div>
                <Button
                  onClick={() => setShowMediaDialog(true)}
                  className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 font-bold text-xs h-10 rounded-xl border border-slate-800 active:scale-[0.98]"
                >
                  <Palette className="w-4 h-4 mr-2 text-emerald-400" /> Browse Workspace Assets
                </Button>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">High CTR Emojis</div>
                <div className="grid grid-cols-7 gap-1.5">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleAddEmoji(emoji)}
                      className="h-9 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800/80 flex items-center justify-center text-lg active:scale-[0.9]"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Icons Hub</div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons..."
                    className="pl-8 h-8 text-xs bg-slate-900 border-slate-800 rounded-lg text-slate-200"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_ICONS.filter((name) =>
                    !iconSearch.trim() || name.toLowerCase().includes(iconSearch.toLowerCase())
                  ).map((iconName) => {
                    const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
                    if (!IconComp) return null;
                    return (
                      <button
                        key={iconName}
                        onClick={() => handleAddIcon(iconName)}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-white transition-colors active:scale-[0.95]"
                      >
                        <IconComp className="w-5 h-5 text-emerald-400" />
                        <span className="text-[9px] font-semibold truncate w-full text-center">{iconName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Brand Studio (Phase 5) */}
            <TabsContent value="brand" className="flex-1 overflow-y-auto p-4 space-y-4 m-0 scrollbar-none">
              {brandKit ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Brand Health</div>
                    <div
                      className={cn(
                        'text-3xl font-black font-mono',
                        brandCompliance.overallScore >= 90
                          ? 'text-emerald-400'
                          : brandCompliance.overallScore >= 75
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      )}
                    >
                      {brandCompliance.overallScore}/100
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {brandCompliance.isCompliant
                        ? '✓ All required brand guidelines satisfied.'
                        : '⚠ Some elements deviate from workspace guidelines.'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-white">{brandKit.name}</div>
                      <Link href="/admin/creative-studio/brand" className="text-[10px] text-emerald-400 hover:underline font-bold">
                        Edit in Studio
                      </Link>
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 mb-1.5">Brand Colors</div>
                      <div className="flex gap-1.5">
                        {brandKit.colors.primary.concat(brandKit.colors.accent).map((c, i) => (
                          <div key={i} style={{ backgroundColor: c }} className="w-6 h-6 rounded-md border border-slate-700 shadow-sm" title={c} />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold text-slate-400">Display Typography</div>
                      <div className="text-xs font-bold text-emerald-400">{brandKit.typography.displayFont}</div>
                    </div>

                    <div className="pt-2 flex gap-2">
                      <Button onClick={handleApplyBrandKit} variant="outline" className="flex-1 border-slate-800 bg-slate-950 text-slate-200 text-xs font-bold h-9 rounded-xl active:scale-[0.98]">
                        Apply Theme
                      </Button>
                      <Button onClick={handleApplyBrandRules} className="flex-1 bg-emerald-500 hover:bg-emerald-600 font-black text-xs text-slate-950 rounded-xl h-9 active:scale-[0.98]">
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Enforce Rules
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 p-4 text-center">No Brand Kit configured.</div>
              )}
            </TabsContent>

            {/* Tab 3: CRM Campaign (Phase 6) */}
            <TabsContent value="crm" className="flex-1 overflow-y-auto p-4 space-y-4 m-0 scrollbar-none">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Target className="w-4 h-4 text-emerald-400" />
                  <span>Campaign Context</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase">Target Campaign</Label>
                  <Select value={selectedCampaignId} onValueChange={handleLinkCampaign}>
                    <SelectTrigger className="h-9 bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      {campaigns.map((camp) => (
                        <SelectItem key={camp.campaignId} value={camp.campaignId!} className="text-xs font-bold">
                          {camp.campaignName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                    <span>Live Contact Simulator</span>
                  </div>
                  {activeContact && (
                    <button onClick={() => setPreviewContactId('none')} className="text-[10px] font-bold text-slate-400 hover:text-white">
                      Reset
                    </button>
                  )}
                </div>

                <Select value={previewContactId} onValueChange={setPreviewContactId}>
                  <SelectTrigger className="h-9 bg-slate-950 border-slate-800 text-xs font-bold text-white rounded-xl">
                    <SelectValue placeholder="Select Contact to Simulate..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="none" className="text-xs font-bold">None (Raw Tokens View)</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs font-bold">
                        {c.firstName} {c.lastName} ({c.company || 'Private'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Insert CRM Variables</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {CRM_VARIABLE_SHORTCUTS.map((item) => (
                    <Button
                      key={item.tag}
                      onClick={() => handleInsertMergeVariable(item.tag)}
                      variant="outline"
                      size="sm"
                      className="h-8 justify-start text-[11px] font-bold bg-slate-950 border-slate-800 text-slate-200 hover:text-emerald-400 rounded-lg active:scale-[0.97]"
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => setIsBatchModalOpen(true)}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs h-10 rounded-xl shadow-lg active:scale-[0.98]"
              >
                <Users className="w-4 h-4 mr-2" /> Batch Personalize ({contacts.length})
              </Button>
            </TabsContent>

            {/* Tab 4: Layers Tree Panel (Phase 2) */}
            <TabsContent value="layers" className="flex-1 overflow-y-auto p-4 m-0 scrollbar-none">
              <LayersTreePanel
                elements={document.elements}
                selectedIds={selectedIds}
                onSelectElement={selectElement}
                onUpdateElement={updateElement}
                onDeleteElement={deleteElement}
                onReorderElement={reorderElement}
                onGroupSelected={groupSelected}
                onUngroupSelected={ungroupSelected}
                onToggleGroupLock={toggleGroupLock}
                onToggleGroupVisibility={toggleGroupVisibility}
              />
            </TabsContent>

            {/* Tab 5: Creative Health Panel (Phase 4) */}
            <TabsContent value="health" className="flex-1 overflow-y-auto p-4 m-0 scrollbar-none">
              <CreativeHealthPanel
                report={healthReport}
                brandKit={brandKit}
                heatmapVisible={heatmapVisible}
                onToggleHeatmap={() => setHeatmapVisible(!heatmapVisible)}
                onApplyFix={handleApplyHealthFix}
                onImproveAll={handleImproveAllHealthFixes}
              />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Center Viewport Canvas & Floating Contextual Bar */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-950 overflow-hidden relative">
          <ContextualActionBar
            selectedElements={selectedElements}
            onUpdateElement={updateElement}
            onAlignSelected={alignSelected}
            onDistributeSelected={distributeSelected}
            onGroupSelected={groupSelected}
            onUngroupSelected={ungroupSelected}
            onDuplicateSelected={duplicateSelected}
            onDeleteSelected={deleteSelected}
            onRemoveBackground={handleRemoveBackground}
          />

          <ThumbnailCanvas
            backgroundColor={document.backgroundColor}
            backgroundGradient={document.backgroundGradient}
            backgroundImage={document.backgroundImage}
            elements={displayedCanvasElements}
            selectedIds={selectedIds}
            onSelectElement={selectElement}
            onSelectMultiple={selectMultiple}
            onUpdateElement={updateElement}
            onUpdateElementsBatch={updateElementsBatch}
            onDeleteElement={deleteElement}
            onUndo={undo}
            onRedo={redo}
            zoomPercent={zoomPercent}
            panX={panX}
            panY={panY}
            onPanChange={(x, y) => {
              setPanX(x);
              setPanY(y);
            }}
            heatmapVisible={heatmapVisible}
            saliencyHotspots={healthReport.saliencyHotspots}
            liveUsers={liveUsers}
            comments={comments}
            isPinDropperActive={isPinDropperActive}
            onDropCommentPin={handleDropCanvasPin}
            onSelectCommentPin={handleSelectCanvasPin}
            activeCommentId={activeCommentId}
          />
        </main>

        {/* Right Property Inspector */}
        {selectedElements.length > 0 && !isAiDrawerOpen && (
          <aside className="w-72 sm:w-80 border-l border-slate-850 bg-slate-950 p-4 overflow-y-auto space-y-5 shrink-0 z-10 scrollbar-none">
            <div className="flex items-center justify-between pb-2 border-b border-slate-850">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {selectedElements.length > 1 ? `${selectedElements.length} Items Selected` : `${selectedPrimaryElement?.type} Properties`}
              </span>
              <button onClick={() => clearSelection()} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedPrimaryElement?.type === 'text' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Text Content</Label>
                  <Input
                    value={selectedPrimaryElement.text || ''}
                    onChange={(e) => updateElement(selectedPrimaryElement.id, { text: e.target.value })}
                    className="h-9 bg-slate-900 border-slate-800 text-xs font-bold text-white rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Font Family</Label>
                  <Select
                    value={selectedPrimaryElement.fontFamily || 'Impact'}
                    onValueChange={(val) => updateElement(selectedPrimaryElement.id, { fontFamily: val })}
                  >
                    <SelectTrigger className="h-9 bg-slate-900 border-slate-800 text-xs font-bold text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      {THUMBNAIL_FONT_OPTIONS.map((f: string) => (
                        <SelectItem key={f} value={f} className="text-xs font-bold">{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-300">
                    <span>Font Size</span>
                    <span className="text-emerald-400 font-bold">{selectedPrimaryElement.fontSize || 48}px</span>
                  </div>
                  <Slider
                    min={14}
                    max={120}
                    step={1}
                    value={[selectedPrimaryElement.fontSize || 48]}
                    onValueChange={([val]) => updateElement(selectedPrimaryElement.id, { fontSize: val }, false)}
                    className="py-2"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-850 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={duplicateSelected} variant="outline" className="h-8 bg-slate-900 border-slate-800 text-xs font-bold rounded-xl">
                  <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                </Button>
                <Button onClick={deleteSelected} variant="outline" className="h-8 bg-slate-900 border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-xl">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </aside>
        )}

        {/* AI Creative Director Drawer (Phase 3) */}
        <AiCreativeDirectorDrawer
          open={isAiDrawerOpen}
          onOpenChange={setIsAiDrawerOpen}
          projectId={project.id}
          currentElements={document.elements}
          brandKit={brandKit}
          onApplyConcept={handleApplyConcept}
          onApplyModifiedElements={handleApplyModifiedElements}
          onApplyHeadlineText={handleApplyHeadlineText}
        />

        {/* Multi-User Cloud Comments Drawer */}
        {isCommentsOpen && (
          <aside className="w-80 border-l border-slate-850 bg-slate-950 p-4 flex flex-col shrink-0 z-20 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white">Team Comments & Pins</span>
              </div>
              <button onClick={() => setIsCommentsOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3 scrollbar-none">
              {comments.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-8">No feedback comments yet.</div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      'p-3 rounded-xl border text-xs space-y-1.5 transition-colors',
                      activeCommentId === c.id
                        ? 'bg-slate-900 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                        : c.resolved
                        ? 'bg-slate-900/30 border-slate-850 text-slate-500 opacity-60'
                        : 'bg-slate-900 border-slate-800 text-slate-200'
                    )}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px]">
                      <span className="text-emerald-400 flex items-center gap-1">
                        {c.pinX !== undefined && <MapPin className="w-3 h-3 text-cyan-400" />} {c.authorName}
                      </span>
                      <span className="text-slate-500 text-[10px]">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{c.text}</p>
                    {!c.resolved && (
                      <div className="pt-1 flex justify-end">
                        <Button
                          onClick={() => handleResolveComment(c.id)}
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 px-2 rounded-md"
                        >
                          <Check className="w-3 h-3 mr-1" /> Resolve
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-850 space-y-2">
              <Input
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Leave feedback note..."
                className="h-9 bg-slate-900 border-slate-800 text-xs text-white rounded-xl"
              />
              <Button
                onClick={handleAddComment}
                disabled={!newCommentText.trim()}
                className="w-full bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-slate-950 h-9 rounded-xl active:scale-[0.98]"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" /> Post Comment
              </Button>
            </div>
          </aside>
        )}

        {/* Version History Drawer */}
        {isVersionsOpen && (
          <aside className="w-80 border-l border-slate-850 bg-slate-950 p-4 flex flex-col shrink-0 z-20 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white">Version Snapshots</span>
              </div>
              <button onClick={() => setIsVersionsOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 border-b border-slate-850 space-y-2">
              <Input
                value={snapshotNote}
                onChange={(e) => setSnapshotNote(e.target.value)}
                placeholder="Snapshot label (e.g. Pre-review)..."
                className="h-9 bg-slate-900 border-slate-800 text-xs text-white rounded-xl"
              />
              <Button
                onClick={handleCreateSnapshot}
                className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-bold text-xs h-9 rounded-xl active:scale-[0.98]"
              >
                <Save className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Save Version Snapshot
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2 scrollbar-none">
              {versions.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-8">No saved version snapshots.</div>
              ) : (
                versions.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-white">{v.note || `Version ${v.versionNumber}`}</div>
                      <div className="text-[10px] text-slate-400">{new Date(v.createdAt).toLocaleDateString()}</div>
                    </div>
                    <Button
                      onClick={() => handleRestoreVersion(v)}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-bold border-slate-800 bg-slate-950 text-emerald-400 hover:bg-emerald-500/10 px-2.5 rounded-lg"
                    >
                      Restore
                    </Button>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Save Canvas As Workspace Template Dialog (Phase 5) */}
      <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
        <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
              <BookmarkPlus className="w-5 h-5 text-amber-400" /> Save as Workspace Template
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Template Title</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Weekly Masterclass Thumbnail"
                className="h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-white rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Category</Label>
              <Select
                value={templateCategory}
                onValueChange={(val: CreativeTemplate['category']) => setTemplateCategory(val)}
              >
                <SelectTrigger className="h-10 bg-slate-900 border-slate-800 text-xs font-bold text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="business">Business & SaaS</SelectItem>
                  <SelectItem value="education">Education & Courses</SelectItem>
                  <SelectItem value="podcast">Podcast & Shows</SelectItem>
                  <SelectItem value="finance">Finance & Markets</SelectItem>
                  <SelectItem value="social">Social & Reels</SelectItem>
                  <SelectItem value="ads">Performance Ads</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Description</Label>
              <Input
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Reusable layout description..."
                className="h-10 bg-slate-900 border-slate-800 text-xs font-semibold text-white rounded-xl"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                onClick={() => setIsSaveTemplateOpen(false)}
                variant="outline"
                className="h-10 text-xs font-bold border-slate-800 bg-slate-900 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAsTemplate}
                disabled={isSavingTemplate || !templateName.trim()}
                className="h-10 px-5 bg-emerald-500 hover:bg-emerald-600 font-black text-xs text-slate-950 rounded-xl active:scale-[0.97]"
              >
                {isSavingTemplate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editorial Review & Sign-Off Approval Modal (Phase 7) */}
      {isApprovalModalOpen && project && (
        <ApprovalWorkflowModal
          open={isApprovalModalOpen}
          onOpenChange={setIsApprovalModalOpen}
          projectId={project.id}
          projectName={project.name}
          currentStatus={project.status}
          onSubmitForReview={handleSubmitForReview}
          onApprove={handleApproveProject}
          onRequestChanges={handleRequestChanges}
        />
      )}

      {/* Programmatic Batch Personalization Modal (Phase 6) */}
      {isBatchModalOpen && project && (
        <BatchPersonalizationModal
          open={isBatchModalOpen}
          onOpenChange={setIsBatchModalOpen}
          projectId={project.id}
          workspaceId={project.workspaceId}
          contacts={contacts}
        />
      )}

      {/* Floating AI Command Bar (Cmd+K) (Phase 3) */}
      <AiCommandBar
        open={isAiCommandBarOpen}
        onOpenChange={setIsAiCommandBarOpen}
        onSubmitCommand={handleSubmitAiCommand}
        onOpenConcepts={() => setIsAiDrawerOpen(true)}
        onOpenCopyMatrix={() => setIsAiDrawerOpen(true)}
      />

      {/* Multi-Platform Publishing & Distribution Modal (Phase 8) */}
      {isPublishDialogOpen && project && document && (
        <PublishingModal
          open={isPublishDialogOpen}
          onOpenChange={setIsPublishDialogOpen}
          project={project}
          document={document}
        />
      )}

      {/* A/B Experiment Builder Modal (Phase 9) */}
      {isExperimentModalOpen && project && document && (
        <ExperimentBuilderModal
          open={isExperimentModalOpen}
          onOpenChange={setIsExperimentModalOpen}
          project={project}
          document={document}
        />
      )}

      {/* Media Selector Dialog */}
      {showMediaDialog && project && (
        <MediaSelectorDialog
          open={showMediaDialog}
          onOpenChange={setShowMediaDialog}
          workspaceId={project.workspaceId}
          onSelectAsset={(asset: MediaAsset) => {
            if (asset?.url) {
              const imageEl: CreativeElement = {
                id: makeUniqueId(),
                type: 'image',
                x: 25,
                y: 25,
                width: 50,
                height: 50,
                zIndex: document.elements.length + 1,
                imageSrc: asset.url,
                semanticRole: 'subject',
              };
              addElement(imageEl);
            }
            setShowMediaDialog(false);
          }}
        />
      )}

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={showShortcutsModal}
        onOpenChange={setShowShortcutsModal}
      />

      {/* Responsive Viewport Simulator */}
      <ResponsiveViewportSimulator
        open={showViewportSimulator}
        onOpenChange={setShowViewportSimulator}
        document={document}
      />
    </div>
  );
}
