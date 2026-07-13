'use client';

import * as React from 'react';
import { useState, useEffect, useTransition } from 'react';
import type { CanvasElement, ThumbnailDesign, BrandKit, DesignComment, ActivityLog } from '@/lib/thumbnail/thumbnail-types';
import { CTR_TEMPLATES, THUMBNAIL_FONT_OPTIONS, makeUniqueId } from '@/lib/thumbnail/thumbnail-types';
import { useThumbnailEditor, EditorState } from '@/lib/thumbnail/use-thumbnail-editor';
import { FONT_PAIRINGS, SHAPE_PATH_REGISTRY, getEffectStyle } from '@/lib/thumbnail/design-system-presets';
import { analyzeThumbnailCTR } from '@/lib/thumbnail/ctr-evaluator';
import ThumbnailCanvas from './ThumbnailCanvas';
import { runGenerateThumbnail, runModifyThumbnail, runGenerateHooks } from '@/app/actions/thumbnail-actions';
import { removeImageBackgroundAction } from '@/app/actions/media-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { 
  Sparkles, Trash2, ArrowLeft, Wand2, RefreshCw, Save, 
  Layers, Lock, Unlock, Eye, EyeOff, Copy, ZoomIn, ZoomOut, Move,
  Smile, Search, Settings, HelpCircle, Palette, Download,
  MessageSquare, Check, Send, X
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { uploadPageImage } from '@/lib/page-builder/upload';
import { cn } from '@/lib/utils';

interface ThumbnailDesignerProps {
  initialDesign?: ThumbnailDesign;
  workspaceId: string;
  onSave: (imageUrl: string) => void;
  onClose?: () => void;
}

const EMOJI_OPTIONS = ['🔥', '😱', '🚨', '👉', '💡', '💰', '❌', '✅', '👑', '💥', '👀', '💯', '📈', '🚀'];

const PRESET_ICONS = [
  'Play', 'TrendingUp', 'AlertCircle', 'CheckCircle2', 'XCircle', 
  'ThumbsUp', 'Bell', 'Video', 'DollarSign', 'Flame', 'Sparkles'
];

export default function ThumbnailDesigner({
  initialDesign,
  workspaceId,
  onSave,
  onClose,
}: ThumbnailDesignerProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isPending, startTransition] = useTransition();
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // Zustand Store states and actions
  const design = useThumbnailEditor((s: EditorState) => s.design);
  const selectedId = useThumbnailEditor((s: EditorState) => s.selectedId);
  const initializeStore = useThumbnailEditor((s: EditorState) => s.initialize);
  const selectElement = useThumbnailEditor((s: EditorState) => s.selectElement);
  const addElement = useThumbnailEditor((s: EditorState) => s.addElement);
  const updateElement = useThumbnailEditor((s: EditorState) => s.updateElement);
  const deleteElement = useThumbnailEditor((s: EditorState) => s.deleteElement);
  const undo = useThumbnailEditor((s: EditorState) => s.undo);
  const redo = useThumbnailEditor((s: EditorState) => s.redo);

  // Viewport Zoom & Pan states
  const [zoomPercent, setZoomPercent] = useState(100);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Exporter configs
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp' | 'transparent-png'>('png');
  const [ctrScore, setCtrScore] = useState(90);
  const [ctrRecommendations, setCtrRecommendations] = useState<{ id: string; type: string; severity: string; message: string; }[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const result = analyzeThumbnailCTR(design);
      setCtrScore(result.score);
      setCtrRecommendations(result.recommendations);
    }, 150);
    return () => clearTimeout(timer);
  }, [design]);

  const getBackgroundStyle = (): React.CSSProperties => {
    if (design.backgroundImage) {
      return { 
        backgroundImage: `url(${design.backgroundImage})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center' 
      };
    }
    if (design.backgroundGradient && design.backgroundGradient.colors.length > 0) {
      const colorsStr = design.backgroundGradient.colors.join(', ');
      if (design.backgroundGradient.type === 'radial') {
        return { background: `radial-gradient(circle, ${colorsStr})` };
      }
      const angle = design.backgroundGradient.angle !== undefined ? `${design.backgroundGradient.angle}deg` : '135deg';
      return { background: `linear-gradient(${angle}, ${colorsStr})` };
    }
    return { backgroundColor: design.backgroundColor || '#0f172a' };
  };


  const [exportScale, setExportScale] = useState<1 | 2 | 4>(1);

  // AI Panel inputs
  const [aiPrompt, setAiPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('reaction-surprise');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [confirmTemplateId, setConfirmTemplateId] = useState<string | null>(null);
  const [copywriterTopic, setCopywriterTopic] = useState('');
  const [generatedHooks, setGeneratedHooks] = useState<{ text: string; score: number; emotion: string; readability: string; }[]>([]);
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);

  // Brand Kit states
  const [brandKit, setBrandKit] = useState<BrandKit>({
    colors: ['#0f172a', '#1e293b', '#facc15'],
    fontFamily: 'Impact',
    watermarkUrl: 'https://picsum.photos/id/1025/120/120'
  });

  useEffect(() => {
    const saved = localStorage.getItem(`brand-kit-${design.workspaceId || 'default'}`);
    if (saved) {
      try {
        setBrandKit(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse brand kit:', err);
      }
    }
  }, [design.workspaceId]);

  const saveBrandKit = (newKit: BrandKit) => {
    setBrandKit(newKit);
    localStorage.setItem(`brand-kit-${design.workspaceId || 'default'}`, JSON.stringify(newKit));
    toast({ title: 'Brand Kit Saved', description: 'Your brand assets are updated.' });
  };

  // Collaboration States
  const [comments, setComments] = useState<DesignComment[]>([]);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [reviewerName, setReviewerName] = useState('Joseph Aidoo');
  const [reviewerEmail, setReviewerEmail] = useState('joseph@smartsapp.com');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([
    { id: 'l-seed-1', user: 'Joseph Aidoo', action: 'Created design workspace', time: '1:10 PM' },
    { id: 'l-seed-2', user: 'AI Assistant', action: 'Suggested CTR topic alignment guidelines', time: '1:12 PM' },
  ]);

  // Load comments from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`design-comments-${design.id || 'default'}`);
    if (saved) {
      try {
        setComments(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse comments:', err);
      }
    }
  }, [design.id]);

  const saveCommentsList = (newList: DesignComment[]) => {
    setComments(newList);
    localStorage.setItem(`design-comments-${design.id || 'default'}`, JSON.stringify(newList));
  };

  const logActivity = (actionText: string) => {
    const newLog: ActivityLog = {
      id: makeUniqueId(),
      user: reviewerName,
      action: actionText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setActivityLogs(prev => [newLog, ...prev.slice(0, 19)]);
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const newComment: DesignComment = {
      id: makeUniqueId(),
      authorName: reviewerName,
      authorEmail: reviewerEmail,
      text: newCommentText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      resolved: false,
    };
    const newList = [...comments, newComment];
    saveCommentsList(newList);
    setNewCommentText('');
    logActivity(`Added feedback comment: "${newCommentText.substring(0, 20)}..."`);
    toast({ title: 'Feedback Added', description: 'Review comment posted successfully.' });
  };

  const handleResolveComment = (commentId: string) => {
    const newList = comments.map(c => c.id === commentId ? { ...c, resolved: true } : c);
    saveCommentsList(newList);
    logActivity('Resolved design feedback comment');
    toast({ title: 'Feedback Resolved', description: 'Comment status marked as resolved.' });
  };

  // Search filter for icons library
  const [iconSearch, setIconSearch] = useState('');

  // Media selector dialogs triggers
  const [showMediaForSubject, setShowMediaForSubject] = useState(false);

  // Load and enrich design elements inside the Zustand store
  useEffect(() => {
    const defaultDesign: ThumbnailDesign = initialDesign || {
      workspaceId,
      name: 'Untitled Thumbnail Design',
      backgroundColor: '#0f172a',
      backgroundGradient: {
        type: 'linear',
        angle: 135,
        colors: ['#0f172a', '#1e1b4b'],
      },
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    initializeStore(defaultDesign);
  }, [initialDesign, workspaceId, initializeStore]);

  const selectedElement = design.elements.find((el) => el.id === selectedId) || null;

  const handleAddText = () => {
    const textEl: CanvasElement = {
      id: makeUniqueId(),
      type: 'text',
      x: 25,
      y: 40,
      width: 50,
      height: 15,
      zIndex: design.elements.length + 1,
      text: 'BOLD TITLE',
      fontSize: 48,
      fontFamily: 'Impact',
      fill: '#facc15',
      textAlign: 'center',
      textStrokeColor: '#000000',
      textStrokeWidth: 3,
    };
    addElement(textEl);
  };

  const handleAddEmoji = (emoji: string) => {
    const emojiEl: CanvasElement = {
      id: makeUniqueId(),
      type: 'emoji',
      x: 45,
      y: 45,
      width: 10,
      height: 10,
      zIndex: design.elements.length + 1,
      text: emoji,
    };
    addElement(emojiEl);
  };

  const handleAddIcon = (iconName: string) => {
    const iconEl: CanvasElement = {
      id: makeUniqueId(),
      type: 'icon',
      x: 45,
      y: 45,
      width: 10,
      height: 10,
      zIndex: design.elements.length + 1,
      iconName,
      shapeFill: '#ffffff',
    };
    addElement(iconEl);
  };

  const handleAddArrow = () => {
    const arrowEl: CanvasElement = {
      id: makeUniqueId(),
      type: 'arrow',
      x: 45,
      y: 45,
      width: 12,
      height: 12,
      zIndex: design.elements.length + 1,
      rotation: 0,
      shapeFill: '#ef4444',
    };
    addElement(arrowEl);
  };  const handleAddSvgShape = (path: string) => {
    const svgEl: CanvasElement = {
      id: makeUniqueId(),
      type: 'svg',
      x: 40,
      y: 40,
      width: 20,
      height: 20,
      zIndex: design.elements.length + 1,
      svgPath: path,
      shapeFill: '#38bdf8',
      shapeStroke: '#0284c7',
      shapeStrokeWidth: 1,
    };
    addElement(svgEl);
  };

  const handleDuplicateElement = (element: CanvasElement) => {
    const copyEl: CanvasElement = {
      ...element,
      id: makeUniqueId(),
      x: Math.min(80, element.x + 5),
      y: Math.min(80, element.y + 5),
      zIndex: design.elements.length + 1,
    };
    addElement(copyEl);
  };

  const handleApplyTemplate = (tpl: typeof CTR_TEMPLATES[0]) => {
    // If canvas has layers, require double tap confirmation
    if (design.elements.length > 0 && confirmTemplateId !== tpl.id) {
      setConfirmTemplateId(tpl.id);
      toast({
        title: 'Overwrite Canvas?',
        description: 'Click again to confirm applying this template. Your current layers will be cleared.',
      });
      // Clear confirmation status after 4 seconds
      setTimeout(() => setConfirmTemplateId(null), 4000);
      return;
    }

    setConfirmTemplateId(null);
    const enrichedTemplate: ThumbnailDesign = {
      ...design,
      backgroundColor: tpl.backgroundColor,
      backgroundGradient: tpl.backgroundGradient,
      elements: tpl.elements.map((el) => ({ ...el, id: makeUniqueId() })),
      updatedAt: new Date().toISOString()
    };
    initializeStore(enrichedTemplate);
    logActivity('Applied layout template: ' + tpl.name);
    toast({ title: 'Template applied', description: `${tpl.name} is now loaded.` });
  };

  const handleApplyBrand = () => {
    // 1. Update background gradient using brand colors
    const updatedColors = brandKit.colors.slice(0, 3);
    const backgroundGradient = updatedColors.length > 1 ? {
      type: 'linear' as const,
      angle: 135,
      colors: updatedColors
    } : undefined;
    
    const backgroundColor = updatedColors[0] || '#0f172a';

    // 2. Update typography font-family for all existing text layers
    let updatedElements = design.elements.map((el) => {
      if (el.type === 'text') {
        return {
          ...el,
          fontFamily: brandKit.fontFamily,
          // Enforce contrast: if background is dark and text is dark, invert to yellow
          fill: (el.fill === '#000000' || el.fill === '#0f172a' || el.fill === '#09090b') ? '#facc15' : el.fill
        };
      }
      return el;
    });

    // 3. Add brand watermark overlay (avoid duplicates)
    if (brandKit.watermarkUrl) {
      const existingWatermarkIdx = updatedElements.findIndex(el => el.id === 'brand-watermark');
      const watermarkEl: CanvasElement = {
        id: 'brand-watermark',
        type: 'image',
        x: 5,
        y: 80,
        width: 12,
        height: 12,
        zIndex: design.elements.length + 5,
        imageSrc: brandKit.watermarkUrl,
        imageOutlineColor: '#ffffff',
        imageOutlineWidth: 0,
      };

      if (existingWatermarkIdx >= 0) {
        updatedElements[existingWatermarkIdx] = watermarkEl;
      } else {
        updatedElements.push(watermarkEl);
      }
    }

    const updatedDesign: ThumbnailDesign = {
      ...design,
      backgroundColor,
      backgroundGradient,
      elements: updatedElements,
      updatedAt: new Date().toISOString()
    };

    initializeStore(updatedDesign);
    logActivity('Applied Workspace Brand Kit styles');
    toast({ title: 'Brand applied', description: 'Updated canvas styling to match your Brand Kit.' });
  };

  const handleRemoveBackground = async () => {
    if (!selectedElement || !selectedElement.imageSrc) return;
    setIsRemovingBg(true);
    try {
      const cutoutUrl = await removeImageBackgroundAction(selectedElement.imageSrc);
      updateElement(selectedElement.id, { imageSrc: cutoutUrl });
      toast({ title: 'Background removed', description: 'AI successfully extracted the subject.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Background extraction failed', description: 'AI could not cut out subject.' });
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleSwapHeadline = (newText: string) => {
    // If a text element is currently selected, update it
    if (selectedId) {
      const el = design.elements.find(item => item.id === selectedId);
      if (el && el.type === 'text') {
        updateElement(el.id, { text: newText });
        toast({ title: 'Headline swapped', description: `Updated text to "${newText}"` });
        return;
      }
    }
    // Otherwise, find the first text layer on the canvas and update it
    const firstText = design.elements.find(item => item.type === 'text');
    if (firstText) {
      updateElement(firstText.id, { text: newText });
      toast({ title: 'Headline swapped', description: `Updated text layer to "${newText}"` });
    } else {
      toast({ variant: 'destructive', title: 'No text layer found', description: 'Please select or add a text layer first.' });
    }
  };

  const handleGenerateHooks = () => {
    if (!copywriterTopic.trim()) {
      toast({ variant: 'destructive', title: 'Topic required', description: 'Please enter a description or topic for hooks.' });
      return;
    }

    setIsGeneratingHooks(true);
    startTransition(async () => {
      try {
        const output = await runGenerateHooks({ topic: copywriterTopic });
        setGeneratedHooks(output.hooks);
        toast({ title: 'AI Hooks Generated!', description: 'Brainstorm list is now ready.' });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Brainstorm failed', description: 'AI could not generate hooks.' });
      } finally {
        setIsGeneratingHooks(false);
      }
    });
  };

  const handleApplyHook = (hookText: string) => {
    // If text layer is selected, update it
    if (selectedId) {
      const el = design.elements.find(item => item.id === selectedId);
      if (el && el.type === 'text') {
        updateElement(el.id, { text: hookText });
        toast({ title: 'Hook applied', description: `Updated text to "${hookText}"` });
        return;
      }
    }
    
    // Fallback: update the first text layer found on canvas
    const firstText = design.elements.find(item => item.type === 'text');
    if (firstText) {
      updateElement(firstText.id, { text: hookText });
      toast({ title: 'Hook applied', description: `Updated text layer to "${hookText}"` });
    } else {
      // Automatic fallback text layer creator
      const newEl: CanvasElement = {
        id: makeUniqueId(),
        type: 'text',
        x: 20,
        y: 35,
        width: 60,
        height: 25,
        zIndex: design.elements.length + 1,
        text: hookText,
        fontSize: 42,
        fontFamily: 'Impact',
        fill: '#facc15',
        textAlign: 'center',
        textStrokeColor: '#000000',
        textStrokeWidth: 4,
      };
      addElement(newEl);
      toast({ title: 'Text Layer Created', description: `Added new hook text layer "${hookText}" to canvas.` });
    }
  };

  const handleGenerateAI = () => {
    if (!aiPrompt.trim()) {
      toast({ variant: 'destructive', title: 'Prompt required', description: 'Please enter a description or topic.' });
      return;
    }

    startTransition(async () => {
      try {
        const output = await runGenerateThumbnail({
          prompt: aiPrompt,
          videoUrl: videoUrl || undefined,
          templateId: selectedTemplateId || undefined,
        });

        const newDesign: ThumbnailDesign = {
          ...design,
          backgroundColor: output.backgroundColor,
          backgroundGradient: output.backgroundGradient,
          elements: output.elements.map((el) => ({
            ...el,
            id: makeUniqueId(),
            type: el.type as CanvasElement['type'],
            blendMode: el.blendMode as CanvasElement['blendMode'],
            textEffect: el.textEffect as CanvasElement['textEffect'],
            textAlign: el.textAlign as CanvasElement['textAlign'],
          })),
          explanation: output.explanation,
          alternativeCopies: output.alternativeCopies,
          updatedAt: new Date().toISOString()
        };
        initializeStore(newDesign);

        toast({
          title: 'AI Generated Thumbnail!',
          description: output.explanation || 'Composition ready for editing.',
        });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Generation failed', description: 'AI could not process your layout.' });
      }
    });
  };

  const handlePromptUpdate = () => {
    if (!aiInstructions.trim()) return;

    startTransition(async () => {
      try {
        const output = await runModifyThumbnail({
          elements: design.elements,
          backgroundColor: design.backgroundColor,
          backgroundGradient: design.backgroundGradient,
          instruction: aiInstructions,
        });

        const updatedDesign: ThumbnailDesign = {
          ...design,
          backgroundColor: output.backgroundColor,
          backgroundGradient: output.backgroundGradient,
          elements: output.elements.map((el) => ({
            ...el,
            id: el.id || makeUniqueId(),
            type: el.type as CanvasElement['type'],
            blendMode: el.blendMode as CanvasElement['blendMode'],
            textEffect: el.textEffect as CanvasElement['textEffect'],
            textAlign: el.textAlign as CanvasElement['textAlign'],
          })),
          explanation: output.explanation,
          updatedAt: new Date().toISOString()
        };
        initializeStore(updatedDesign);

        setAiInstructions('');
        toast({ title: 'AI Canvas Updated!', description: output.explanation });
      } catch (err) {
        toast({ variant: 'destructive', title: 'AI Edit Failed', description: 'Could not apply instructions.' });
      }
    });
  };

  const handleSaveDesign = async () => {
    const container = document.getElementById('thumbnail-canvas-container');
    if (!container) return;

    // Deselect selection frames before screenshotting
    selectElement(null);
    await new Promise((r) => setTimeout(r, 200));

    // Force font preloading checks
    await document.fonts.ready;

    try {
      interface HtmlToImageOptions {
        pixelRatio?: number;
        quality?: number;
        skipFonts?: boolean;
        style?: Record<string, string | undefined>;
      }

      const htmlToImage = (await import('html-to-image')) as unknown as {
        toPng: (node: HTMLElement, options?: HtmlToImageOptions) => Promise<string>;
        toJpeg: (node: HTMLElement, options?: HtmlToImageOptions) => Promise<string>;
        toWebp: (node: HTMLElement, options?: HtmlToImageOptions) => Promise<string>;
        toBlob: (node: HTMLElement, options?: HtmlToImageOptions) => Promise<Blob>;
      };
      
      let dataUrl = '';
      const exportOptions: HtmlToImageOptions = {
        pixelRatio: exportScale,
        quality: 0.95,
        skipFonts: false,
        style: exportFormat === 'transparent-png' ? { background: 'transparent' } : undefined
      };

      if (exportFormat === 'webp') {
        dataUrl = await htmlToImage.toWebp(container, exportOptions);
      } else if (exportFormat === 'jpeg') {
        dataUrl = await htmlToImage.toJpeg(container, exportOptions);
      } else {
        dataUrl = await htmlToImage.toPng(container, exportOptions);
      }

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File(
        [blob], 
        `${design.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.png`, 
        { type: 'image/png' }
      );

      const downloadUrl = await uploadPageImage(file, workspaceId);

      if (firestore && user) {
        // 1. Save JSON Design Composition
        const designsCol = collection(firestore, 'thumbnail_designs');
        const designData = {
          workspaceId,
          name: design.name,
          backgroundColor: design.backgroundColor,
          backgroundGradient: design.backgroundGradient || null,
          elements: design.elements,
          thumbnailUrl: downloadUrl,
          createdAt: design.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (design.id) {
          await setDoc(doc(firestore, 'thumbnail_designs', design.id), designData);
        } else {
          const docRef = await addDoc(designsCol, designData);
          useThumbnailEditor.setState((prev: EditorState) => ({ 
            design: { ...prev.design, id: docRef.id } 
          }));
        }

        // 2. Sync to central Media library under seeded 'Thumbnails' category
        const mediaCol = collection(firestore, 'media');
        const newAssetData = {
          name: `${design.name}.png`,
          originalName: `${design.name}.png`,
          url: downloadUrl,
          fullPath: `media/page-builder/${workspaceId}/${design.name}-${Date.now()}.png`,
          type: 'image' as const,
          mimeType: 'image/png',
          size: file.size,
          uploadedBy: user.uid,
          workspaceIds: [workspaceId],
          category: 'Thumbnails',
          createdAt: new Date().toISOString()
        };
        await addDoc(mediaCol, newAssetData);
      }

      onSave(downloadUrl);
      toast({ title: 'Thumbnail saved!', description: 'Design successfully synced to Media Library.' });
    } catch (err) {
      console.error('Canvas export failed:', err);
      toast({ variant: 'destructive', title: 'Save failed', description: 'Could not export final image.' });
    }
  };

  const filteredIcons = PRESET_ICONS.filter(name => 
    name.toLowerCase().includes(iconSearch.toLowerCase())
  );

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Left Tools Sidebar */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0 overflow-y-auto">
        <Tabs defaultValue="ai" className="w-full">
          <TabsList className="w-full grid grid-cols-5 bg-slate-950 rounded-none h-12">
            <TabsTrigger value="ai" className="text-[10px] font-bold data-[state=active]:bg-slate-900 px-0">
              <Sparkles className="w-3 h-3 mr-0.5" /> AI
            </TabsTrigger>
            <TabsTrigger value="elements" className="text-[10px] font-bold data-[state=active]:bg-slate-900 px-0">
              Layers
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-[10px] font-bold data-[state=active]:bg-slate-900 px-0">
              Templates
            </TabsTrigger>
            <TabsTrigger value="library" className="text-[10px] font-bold data-[state=active]:bg-slate-900 px-0">
              Library
            </TabsTrigger>
            <TabsTrigger value="brand" className="text-[10px] font-bold data-[state=active]:bg-slate-900 px-0">
              <Palette className="w-3 h-3 mr-0.5" /> Brand
            </TabsTrigger>
          </TabsList>

          {/* AI Tab */}
          <TabsContent value="ai" className="p-4 space-y-4">
            <div className="space-y-1 text-left">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Topic or Description</Label>
              <Input
                placeholder="e.g. 5 rules of choosing a school"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs rounded-xl h-10"
              />
            </div>
            
            <div className="space-y-1 text-left">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Video URL Link (Optional Context)</Label>
              <Input
                placeholder="e.g. YouTube or Loom URL"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs rounded-xl h-10"
              />
            </div>

            <div className="space-y-1 text-left">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Target Layout Formula</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-xs rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                  <SelectItem value="reaction-surprise">Reaction Formula</SelectItem>
                  <SelectItem value="before-after-split">Before/After Split</SelectItem>
                  <SelectItem value="one-question-bold">Bold Question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerateAI}
              disabled={isPending}
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] active:duration-75 font-bold text-xs h-10 rounded-xl transition-all"
            >
              {isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Wand2 className="w-4 h-4 mr-1" />
              )}
              Generate Design Layout
            </Button>

            <div className="border-t border-slate-800 my-4 pt-4 space-y-3 text-left">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Prompt Canvas Modification</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Make title yellow..."
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs rounded-xl h-10"
                />
                <Button
                  onClick={handlePromptUpdate}
                  disabled={isPending}
                  className="bg-slate-800 hover:bg-slate-700 active:scale-[0.97] text-xs font-bold rounded-xl"
                >
                  Apply
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-800 my-4 pt-4 space-y-3 text-left">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">AI Copywriting Hook Generator</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. How to build a SaaS..."
                  value={copywriterTopic}
                  onChange={(e) => setCopywriterTopic(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs rounded-xl h-10"
                />
                <Button
                  onClick={handleGenerateHooks}
                  disabled={isGeneratingHooks || isPending}
                  className="bg-slate-800 hover:bg-slate-700 active:scale-[0.97] text-xs font-bold rounded-xl whitespace-nowrap shrink-0 px-3"
                >
                  {isGeneratingHooks ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Brainstorm'
                  )}
                </Button>
              </div>

              {/* Hook brainstorming list */}
              {generatedHooks.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {generatedHooks.map((hk, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleApplyHook(hk.text)}
                      className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl flex flex-col justify-between hover:border-violet-500 cursor-pointer transition-all active:scale-[0.98] select-none"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-xs text-slate-100 uppercase tracking-tight truncate">
                          {hk.text}
                        </span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                          CTR: {hk.score}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={cn(
                          "text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0",
                          hk.emotion === 'Greed' ? "bg-emerald-500/10 text-emerald-400" :
                          hk.emotion === 'Curiosity' ? "bg-violet-500/10 text-violet-400" :
                          hk.emotion === 'Fear' ? "bg-red-500/10 text-red-400" :
                          "bg-blue-500/10 text-blue-400"
                        )}>
                          {hk.emotion}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                          Readability: {hk.readability}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {design.alternativeCopies && design.alternativeCopies.length > 0 && (
              <div className="border-t border-slate-800 mt-4 pt-4 text-left space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Alternative Copy Options</Label>
                <div className="flex flex-col gap-2 mt-1">
                  {design.alternativeCopies.map((copyText, idx) => (
                    <Button
                      key={idx}
                      onClick={() => handleSwapHeadline(copyText)}
                      variant="outline"
                      className="w-full text-[10px] justify-start h-auto py-2 rounded-xl text-left border-slate-800 hover:border-violet-500 font-medium leading-normal active:scale-[0.98] select-none text-slate-300"
                    >
                      {copyText}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {design.explanation && (
              <div className="border-t border-slate-800 mt-4 pt-4 text-left space-y-2">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">AI Creative Strategy</Label>
                <div className="text-[11px] text-slate-350 bg-slate-950 border border-slate-850 p-3 rounded-xl leading-relaxed whitespace-pre-wrap font-medium">
                  {design.explanation}
                </div>
              </div>
            )}

            {/* Mobile Feed Preview Simulator */}
            <div className="border-t border-slate-800 mt-4 pt-4 text-left space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Mobile Feed Preview (120px scale)</Label>
              <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-start gap-2.5">
                {/* 120px mini thumbnail replica */}
                <div className="w-[120px] aspect-video bg-slate-900 rounded border border-slate-850 overflow-hidden relative shrink-0">
                  <div
                    className="w-[1280px] h-[720px] origin-top-left scale-[0.09375] absolute pointer-events-none select-none"
                    style={{
                      ...getBackgroundStyle(),
                    }}
                  >
                    {design.elements.map((el) => {
                      if (el.isHidden) return null;
                      
                      // Text visual effect/glow styles
                      const isText = el.type === 'text';
                      const effectStyle = isText
                        ? getEffectStyle(el.textEffect || 'none', el.fill || '#facc15')
                        : {};
                      const isGradient = isText && (el.textEffect === 'gradient' || el.textEffect === 'metallic');

                      const shadowStyle = el.type === 'image' && el.imageOutlineWidth
                        ? `0 0 ${el.imageOutlineWidth * 2}px ${el.imageOutlineColor || '#facc15'}`
                        : undefined;

                      const filterStr = el.type === 'image'
                        ? `brightness(${el.brightness ?? 100}%) contrast(${el.contrast ?? 100}%) blur(${el.blurRadius ?? 0}px) hue-rotate(${el.hueRotate ?? 0}deg) saturate(${el.saturate ?? 100}%)`
                        : undefined;

                      const transformStr = `
                        rotate(${el.rotation || 0}deg)
                        scaleX(${el.flipHorizontal ? -1 : 1})
                        scaleY(${el.flipVertical ? -1 : 1})
                      `.trim().replace(/\s+/g, ' ');

                      return (
                        <div
                          key={el.id}
                          style={{
                            position: 'absolute',
                            left: `${el.x}%`,
                            top: `${el.y}%`,
                            width: `${el.width}%`,
                            height: `${el.height}%`,
                            zIndex: el.zIndex,
                            transform: transformStr,
                            opacity: el.opacity !== undefined ? el.opacity : 1,
                            mixBlendMode: el.blendMode || 'normal',
                          }}
                        >
                          {isText && (
                            <div
                              className="w-full h-full flex items-center justify-center font-black select-none text-[64px] leading-tight text-center uppercase"
                              style={{
                                fontFamily: el.fontFamily || 'Inter',
                                color: isGradient ? undefined : (el.fill || '#ffffff'),
                                textShadow: shadowStyle || (effectStyle as React.CSSProperties).textShadow,
                                WebkitTextStroke: el.textStrokeWidth ? `${el.textStrokeWidth * 2}px ${el.textStrokeColor || '#000000'}` : undefined,
                                ...effectStyle,
                              }}
                            >
                              {el.text || 'TEXT'}
                            </div>
                          )}
                          {el.type === 'image' && el.imageSrc && (
                            <img
                              src={el.imageSrc}
                              alt=""
                              className="w-full h-full object-cover"
                              style={{ filter: filterStr, borderRadius: `${el.borderRadius || 12}px` }}
                            />
                          )}
                          {el.type === 'emoji' && (
                            <div className="w-full h-full flex items-center justify-center select-none text-[64px]">
                              {el.text || '😀'}
                            </div>
                          )}
                          {el.type === 'svg' && (
                            <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                              <path
                                d={el.svgPath || 'M0 0 H100 V100 H0 Z'}
                                fill={el.shapeFill || '#ffffff'}
                                stroke={el.shapeStroke || '#000000'}
                                strokeWidth={el.shapeStrokeWidth !== undefined ? el.shapeStrokeWidth * 2 : 0}
                              />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dummy Video Metadata text */}
                <div className="flex-1 space-y-1 min-w-0 text-left">
                  <div className="text-[10px] font-bold text-slate-200 leading-snug truncate w-full">
                    {design.name || 'My High CTR Video Title'}
                  </div>
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                    Creative Studio • 1.2M views
                  </div>
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                    2 hours ago
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Layers Tab */}
          <TabsContent value="elements" className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleAddText} size="sm" variant="outline" className="flex-1 rounded-xl text-xs active:scale-[0.97]">
                + Text
              </Button>
              <Button onClick={() => setShowMediaForSubject(true)} size="sm" variant="outline" className="flex-1 rounded-xl text-xs active:scale-[0.97]">
                + Image
              </Button>
              <Button onClick={handleAddArrow} size="sm" variant="outline" className="flex-1 rounded-xl text-xs active:scale-[0.97]">
                + Arrow
              </Button>
            </div>
            
            <div className="space-y-1 mt-4 text-left">
              {design.elements.map((el) => (
                <div
                  key={el.id}
                  onClick={() => selectElement(el.id)}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs border border-transparent transition-all",
                    selectedId === el.id ? "bg-slate-800 border-slate-700" : "hover:bg-slate-850"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="capitalize font-bold text-slate-300">{el.type} Layer</span>
                    {el.isLocked && <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    {el.isHidden && <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateElement(el.id, { isHidden: !el.isHidden });
                      }}
                      className="text-slate-400 hover:bg-slate-700 p-1 rounded"
                    >
                      {el.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteElement(el.id);
                      }}
                      className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="p-4 space-y-3 text-left">
            {/* Category Filter Chips scrollable list */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none select-none -mx-4 px-4">
              {[
                { id: 'all', label: 'All' },
                { id: 'business', label: 'Business' },
                { id: 'gaming', label: 'Gaming' },
                { id: 'finance', label: 'Finance' },
                { id: 'podcast', label: 'Podcast' },
                { id: 'education', label: 'Education' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 border transition-all active:scale-[0.96]",
                    selectedCategory === cat.id
                      ? "bg-slate-100 text-slate-900 border-slate-100"
                      : "bg-slate-950 text-slate-450 border-slate-850 hover:text-slate-200 hover:border-slate-800"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-1">
              {(selectedCategory === 'all'
                ? CTR_TEMPLATES
                : CTR_TEMPLATES.filter(t => t.category === selectedCategory)
              ).map((tpl) => {
                const isConfirmed = confirmTemplateId === tpl.id;
                
                const getTplBackground = (): React.CSSProperties => {
                  if (tpl.backgroundImage) {
                    return { backgroundImage: `url(${tpl.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' };
                  }
                  if (tpl.backgroundGradient && tpl.backgroundGradient.colors.length > 0) {
                    const colorsStr = tpl.backgroundGradient.colors.join(', ');
                    if (tpl.backgroundGradient.type === 'radial') {
                      return { background: `radial-gradient(circle, ${colorsStr})` };
                    }
                    const angle = tpl.backgroundGradient.angle !== undefined ? `${tpl.backgroundGradient.angle}deg` : '135deg';
                    return { background: `linear-gradient(${angle}, ${colorsStr})` };
                  }
                  return { backgroundColor: tpl.backgroundColor || '#0f172a' };
                };

                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleApplyTemplate(tpl)}
                    className={cn(
                      "border bg-slate-950 p-2.5 rounded-xl hover:border-emerald-500 cursor-pointer transition-all space-y-2 group flex flex-col justify-between select-none relative",
                      isConfirmed ? "border-amber-500 hover:border-amber-500" : "border-slate-800"
                    )}
                  >
                    <div className="w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-850 relative shrink-0">
                      <div
                        className="w-[1280px] h-[720px] origin-top-left scale-[0.09375] absolute pointer-events-none"
                        style={{
                          ...getTplBackground(),
                          width: '1280px',
                          height: '720px'
                        }}
                      >
                        {tpl.elements.map((el) => {
                          const isText = el.type === 'text';
                          const effectStyle = isText
                            ? getEffectStyle(el.textEffect || 'none', el.fill || '#facc15')
                            : {};
                          const isGradient = isText && (el.textEffect === 'gradient' || el.textEffect === 'metallic');

                          const shadowStyle = el.type === 'image' && el.imageOutlineWidth
                            ? `0 0 ${el.imageOutlineWidth * 2}px ${el.imageOutlineColor || '#facc15'}`
                            : undefined;

                          const transformStr = `
                            rotate(${el.rotation || 0}deg)
                            scaleX(${el.flipHorizontal ? -1 : 1})
                            scaleY(${el.flipVertical ? -1 : 1})
                          `.trim().replace(/\s+/g, ' ');

                          return (
                            <div
                              key={el.id}
                              style={{
                                position: 'absolute',
                                left: `${el.x}%`,
                                top: `${el.y}%`,
                                width: `${el.width}%`,
                                height: `${el.height}%`,
                                zIndex: el.zIndex,
                                transform: transformStr,
                                opacity: el.opacity !== undefined ? el.opacity : 1,
                              }}
                            >
                              {isText && (
                                <div
                                  className="w-full h-full flex items-center justify-center font-black text-[64px] leading-tight text-center uppercase"
                                  style={{
                                    fontFamily: el.fontFamily || 'Inter',
                                    color: isGradient ? undefined : (el.fill || '#ffffff'),
                                    textShadow: shadowStyle || (effectStyle as React.CSSProperties).textShadow,
                                    WebkitTextStroke: el.textStrokeWidth ? `${el.textStrokeWidth * 2}px ${el.textStrokeColor || '#000000'}` : undefined,
                                    ...effectStyle,
                                  }}
                                >
                                  {el.text || 'TEXT'}
                                </div>
                              )}
                              {el.type === 'image' && el.imageSrc && (
                                <img
                                  src={el.imageSrc}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  style={{ borderRadius: `${el.borderRadius || 12}px` }}
                                />
                              )}
                              {el.type === 'emoji' && (
                                <div className="w-full h-full flex items-center justify-center text-[64px]">
                                  {el.text || '😀'}
                                </div>
                              )}
                              {el.type === 'svg' && (
                                <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                                  <path
                                    d={el.svgPath || 'M0 0 H100 V100 H0 Z'}
                                    fill={el.shapeFill || '#ffffff'}
                                    stroke={el.shapeStroke || '#000000'}
                                    strokeWidth={el.shapeStrokeWidth !== undefined ? el.shapeStrokeWidth * 2 : 0}
                                  />
                                </svg>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="absolute bottom-1 right-1 bg-slate-950/80 border border-slate-800 text-[8px] font-black px-1.5 py-0.5 rounded text-emerald-400">
                        CTR: {tpl.baselineCtr}%
                      </div>
                    </div>

                    <div className="space-y-0.5 text-left">
                      <div className={cn(
                        "font-bold text-[10px] leading-tight truncate group-hover:text-emerald-400 transition-colors",
                        isConfirmed ? "text-amber-400 group-hover:text-amber-400" : "text-slate-200"
                      )}>
                        {isConfirmed ? 'Confirm Overwrite' : tpl.name}
                      </div>
                      <div className="text-[8px] text-slate-500 truncate leading-snug font-medium">
                        {tpl.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Icons and Emojis Library Tab */}
          <TabsContent value="library" className="p-4 space-y-4 text-left">
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Stickers / Emojis</Label>
              <div className="grid grid-cols-5 gap-2 mt-1.5">
                {EMOJI_OPTIONS.map(em => (
                  <button
                    key={em}
                    onClick={() => handleAddEmoji(em)}
                    className="h-10 text-xl flex items-center justify-center bg-slate-950 border border-slate-800 rounded-xl hover:border-emerald-500 active:scale-[0.97]"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Lucide Vector Icons</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search icons..."
                  value={iconSearch}
                  onChange={e => setIconSearch(e.target.value)}
                  className="pl-8 h-9 text-xs bg-slate-950 border-slate-800 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 max-h-48 overflow-y-auto pr-1">
                {filteredIcons.map(name => {
                  const Icon = (LucideIcons as any)[name] || HelpCircle;
                  return (
                    <button
                      key={name}
                      onClick={() => handleAddIcon(name)}
                      className="h-12 flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-xl hover:border-emerald-500 active:scale-[0.97] text-slate-350 p-1"
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[8px] mt-1 font-bold truncate w-full text-center">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">SVG Shapes & Callouts</Label>
              <div className="grid grid-cols-3 gap-2 mt-2 max-h-36 overflow-y-auto pr-1">
                {SHAPE_PATH_REGISTRY.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => handleAddSvgShape(shape.path)}
                    className="h-14 flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-xl hover:border-emerald-500 active:scale-[0.97] p-2 text-slate-355"
                  >
                    <svg viewBox="0 0 100 100" className="w-6 h-6 fill-slate-300 stroke-slate-400 stroke-2">
                      <path d={shape.path} />
                    </svg>
                    <span className="text-[8px] mt-1 font-bold truncate w-full text-center">{shape.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Brand Kit Tab */}
          <TabsContent value="brand" className="p-4 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="font-bold text-xs uppercase tracking-wider text-slate-400">Workspace Brand Kit</div>
              <Button
                onClick={handleApplyBrand}
                size="sm"
                className="bg-violet-600 hover:bg-violet-500 active:scale-[0.97] text-[10px] font-black rounded-lg h-7 px-3"
              >
                Apply Brand
              </Button>
            </div>

            {/* 1. Brand Colors */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Brand Color Swatches</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {brandKit.colors.map((color, index) => (
                  <div key={index} className="flex flex-col gap-1 items-center bg-slate-950 p-2 border border-slate-850 rounded-xl">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        const newColors = [...brandKit.colors];
                        newColors[index] = e.target.value;
                        saveBrandKit({ ...brandKit, colors: newColors });
                      }}
                      className="w-10 h-10 rounded-full border border-slate-800 cursor-pointer shrink-0"
                    />
                    <span className="text-[8px] font-mono text-slate-500">{color.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Brand Font Family */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Default Brand Font</Label>
              <Select
                value={brandKit.fontFamily}
                onValueChange={(val) => saveBrandKit({ ...brandKit, fontFamily: val })}
              >
                <SelectTrigger className="bg-slate-950 border-slate-800 text-xs rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-850 text-slate-100">
                  {THUMBNAIL_FONT_OPTIONS.map(f => (
                    <SelectItem key={f} value={f} className="text-xs">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Watermarks & Brand Logos */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Default Brand Watermark Logo</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { name: 'Default Watermark', url: 'https://picsum.photos/id/1025/120/120' },
                  { name: 'Branded Shield', url: 'https://picsum.photos/id/1043/120/120' }
                ].map((wt) => {
                  const isActive = brandKit.watermarkUrl === wt.url;
                  return (
                    <div
                      key={wt.name}
                      onClick={() => saveBrandKit({ ...brandKit, watermarkUrl: wt.url })}
                      className={cn(
                        "border bg-slate-950 p-2 rounded-xl cursor-pointer transition-all hover:border-violet-500 text-center space-y-1.5",
                        isActive ? "border-violet-500" : "border-slate-850"
                      )}
                    >
                      <img
                        src={wt.url}
                        alt=""
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      <div className="text-[8px] font-bold text-slate-350 truncate">{wt.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </aside>

      {/* Main Workstation Viewport */}
      <main className="flex-1 bg-slate-950 p-8 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Editor Main Topbar */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {onClose && (
              <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800">
                <ArrowLeft className="w-5 h-5 text-slate-350" />
              </Button>
            )}
            <Input
              value={design.name}
              onChange={(e) => useThumbnailEditor.setState((prev: EditorState) => ({ 
                design: { ...prev.design, name: e.target.value } 
              }))}
              className="bg-transparent border-transparent focus:border-slate-800 text-lg font-black text-white w-64"
            />
          </div>

          {/* Undo/Redo controls */}
          <div className="flex gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 shrink-0">
            <Button onClick={undo} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:bg-slate-800">
              <UndoIcon className="w-4 h-4" />
            </Button>
            <Button onClick={redo} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:bg-slate-800">
              <RedoIcon className="w-4 h-4" />
            </Button>
          </div>

          {/* Exporter selector and actions */}
          <div className="flex items-center gap-2">
            <Select value={exportFormat} onValueChange={(val: any) => setExportFormat(val)}>
              <SelectTrigger className="w-28 bg-slate-900 border-slate-800 text-xs rounded-xl h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
                <SelectItem value="transparent-png">Transparent PNG</SelectItem>
              </SelectContent>
            </Select>

            <Select value={String(exportScale)} onValueChange={(val) => setExportScale(Number(val) as any)}>
              <SelectTrigger className="w-20 bg-slate-900 border-slate-800 text-xs rounded-xl h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="4">4x</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => setIsCommentsOpen(!isCommentsOpen)}
              variant={isCommentsOpen ? 'secondary' : 'ghost'}
              size="icon"
              className={cn(
                "rounded-xl border h-9 w-9 bg-slate-900 border-slate-800 text-slate-355 hover:bg-slate-800 active:scale-[0.97]",
                isCommentsOpen ? "bg-violet-600/10 border-violet-500 text-violet-400 hover:bg-violet-600/20" : ""
              )}
            >
              <MessageSquare className="w-4 h-4" />
            </Button>

            <Button onClick={handleSaveDesign} className="bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl text-xs h-9 px-4 active:scale-[0.97]">
              <Save className="w-4 h-4 mr-1.5" /> Save Design
            </Button>
          </div>
        </div>

        {/* Scaled viewport canvas container */}
        <div className="w-full max-w-4xl relative">
          <ThumbnailCanvas
            backgroundColor={design.backgroundColor}
            backgroundGradient={design.backgroundGradient}
            backgroundImage={design.backgroundImage}
            elements={design.elements}
            selectedId={selectedId}
            onSelectElement={selectElement}
            onUpdateElement={updateElement}
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
          />

          {/* Floating Contextual Element Settings Toolbar */}
          {selectedElement && (
            <div 
              className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 rounded-xl p-1.5 shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <button
                onClick={() => updateElement(selectedElement.id, { isLocked: !selectedElement.isLocked })}
                className={cn(
                  "p-1.5 rounded-lg hover:bg-slate-800 transition-colors",
                  selectedElement.isLocked ? "text-red-400 bg-red-500/10" : "text-slate-350"
                )}
                title={selectedElement.isLocked ? "Unlock Layer" : "Lock Layer"}
              >
                {selectedElement.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              <button
                onClick={() => updateElement(selectedElement.id, { isHidden: !selectedElement.isHidden })}
                className="p-1.5 rounded-lg text-slate-350 hover:bg-slate-800 transition-colors"
                title="Hide Layer"
              >
                <EyeOff className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDuplicateElement(selectedElement)}
                className="p-1.5 rounded-lg text-slate-350 hover:bg-slate-800 transition-colors"
                title="Duplicate Layer"
              >
                <Copy className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-6 bg-slate-800 mx-1" />
              <button
                onClick={() => deleteElement(selectedElement.id)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                title="Delete Layer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Viewport Zoom bottom panel */}
        <div className="absolute bottom-6 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-3 shadow-lg z-10 select-none">
          <Button
            onClick={() => setZoomPercent(prev => Math.max(10, prev - 10))}
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-[10px] font-bold text-slate-300 min-w-8 text-center">{zoomPercent}%</span>
          <Button
            onClick={() => setZoomPercent(prev => Math.min(200, prev + 10))}
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="w-[1px] h-4 bg-slate-800" />
          <Button
            onClick={() => {
              setZoomPercent(100);
              setPanX(0);
              setPanY(0);
            }}
            variant="ghost"
            className="text-[9px] font-bold h-7 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 px-2"
          >
            Reset
          </Button>
        </div>
      </main>

      {/* Right Canvas Element Properties Sidebar */}
      <aside className="w-72 border-l border-slate-800 bg-slate-900 p-4 shrink-0 overflow-y-auto space-y-4 text-left">
        {/* AI CTR Health Widget */}
        <div className="space-y-3 bg-slate-950 border border-slate-850 p-3 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400">CTR Health Score</span>
            <span className={cn(
              "text-[10px] font-black px-2 py-0.5 rounded-full",
              ctrScore >= 80 ? "bg-emerald-500/10 text-emerald-400" :
              ctrScore >= 50 ? "bg-amber-500/10 text-amber-400" :
              "bg-red-500/10 text-red-400"
            )}>
              {ctrScore}/100
            </span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                ctrScore >= 80 ? "bg-emerald-500" :
                ctrScore >= 50 ? "bg-amber-500" :
                "bg-red-500"
              )}
              style={{ width: `${ctrScore}%` }}
            />
          </div>

          {ctrRecommendations.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-[9px] leading-normal pt-1">
              {ctrRecommendations.map((rec) => (
                <div key={rec.id} className="flex gap-1.5 text-slate-350 font-medium">
                  <span className={cn(
                    "font-black shrink-0",
                    rec.severity === 'high' ? "text-red-400" :
                    rec.severity === 'medium' ? "text-amber-400" :
                    "text-slate-500"
                  )}>
                    •
                  </span>
                  <span>{rec.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[9px] text-emerald-400 font-bold leading-normal pt-1">
              ✓ Layout is CTR optimized! Safe zones, contrast and scales look clean.
            </div>
          )}
        </div>

        {selectedElement ? (
          <>
            <div className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-2 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Layer Settings ({selectedElement.type})
          </div>

          {selectedElement.isLocked && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-xl text-[10px] font-bold flex items-center gap-2">
              <Lock className="w-4 h-4" /> Layer is locked. Unlock to resize or move.
            </div>
          )}

          {selectedElement.type === 'text' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Text Content</Label>
                <Input
                  value={selectedElement.text || ''}
                  onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                  disabled={selectedElement.isLocked}
                  className="bg-slate-950 border-slate-800 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Font Family</Label>
                <Select
                  value={selectedElement.fontFamily || 'Inter'}
                  onValueChange={(val) => updateElement(selectedElement.id, { fontFamily: val })}
                  disabled={selectedElement.isLocked}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-xs rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                    {THUMBNAIL_FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">CTR Font Pairing</Label>
                <Select
                  value=""
                  onValueChange={(val) => {
                    const pair = FONT_PAIRINGS.find(p => p.name === val);
                    if (pair) {
                      updateElement(selectedElement.id, { 
                        fontFamily: pair.headline
                      });
                      const otherText = design.elements.find(el => el.type === 'text' && el.id !== selectedElement.id);
                      if (otherText) {
                        updateElement(otherText.id, { fontFamily: pair.sub });
                      }
                    }
                  }}
                  disabled={selectedElement.isLocked}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-xs rounded-xl h-10">
                    <SelectValue placeholder="Apply font pair..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                    {FONT_PAIRINGS.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name} ({p.headline} / {p.sub})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Typography Visual Effect</Label>
                <Select
                  value={selectedElement.textEffect || 'none'}
                  onValueChange={(val: any) => updateElement(selectedElement.id, { textEffect: val })}
                  disabled={selectedElement.isLocked}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-xs rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                    <SelectItem value="none">None (Plain)</SelectItem>
                    <SelectItem value="neon">Neon Glow</SelectItem>
                    <SelectItem value="3d">3D Offset</SelectItem>
                    <SelectItem value="gradient">Gradient Fills</SelectItem>
                    <SelectItem value="metallic">Metallic Shimmer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Font Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedElement.fill || '#ffffff'}
                    onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                    disabled={selectedElement.isLocked}
                    className="w-9 h-9 rounded-xl border border-slate-800 cursor-pointer shrink-0"
                  />
                  <Input
                    value={selectedElement.fill || ''}
                    onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                    disabled={selectedElement.isLocked}
                    className="bg-slate-950 border-slate-800 text-xs font-mono rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Font Size ({selectedElement.fontSize || 24}px)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => updateElement(selectedElement.id, { fontSize: Math.max(12, (selectedElement.fontSize || 24) - 2) })}
                    disabled={selectedElement.isLocked}
                    variant="outline"
                    className="w-8 h-8 rounded-lg p-0 shrink-0 text-slate-350 active:scale-[0.95]"
                  >
                    -
                  </Button>
                  <Slider
                    min={12}
                    max={96}
                    step={1}
                    value={[selectedElement.fontSize || 24]}
                    onValueChange={([val]) => updateElement(selectedElement.id, { fontSize: val })}
                    disabled={selectedElement.isLocked}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => updateElement(selectedElement.id, { fontSize: Math.min(120, (selectedElement.fontSize || 24) + 2) })}
                    disabled={selectedElement.isLocked}
                    variant="outline"
                    className="w-8 h-8 rounded-lg p-0 shrink-0 text-slate-350 active:scale-[0.95]"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Text Outline config */}
              <div className="space-y-1 border-t border-slate-800 pt-3">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Text Outline / Stroke</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={selectedElement.textStrokeColor || '#000000'}
                    onChange={(e) => updateElement(selectedElement.id, { textStrokeColor: e.target.value })}
                    disabled={selectedElement.isLocked}
                    className="w-7 h-7 rounded border border-slate-800 cursor-pointer shrink-0"
                  />
                  <Slider
                    min={0}
                    max={8}
                    step={1}
                    value={[selectedElement.textStrokeWidth || 0]}
                    onValueChange={([val]) => updateElement(selectedElement.id, { textStrokeWidth: val })}
                    disabled={selectedElement.isLocked}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Text Badge Background config */}
              <div className="space-y-1 border-t border-slate-800 pt-3">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Text Background Badge</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={selectedElement.badgeColor || '#000000'}
                    onChange={(e) => updateElement(selectedElement.id, { badgeColor: e.target.value })}
                    disabled={selectedElement.isLocked}
                    className="w-7 h-7 rounded border border-slate-800 cursor-pointer shrink-0"
                  />
                  <Slider
                    min={0}
                    max={100}
                    step={10}
                    value={[(selectedElement.badgeOpacity !== undefined ? selectedElement.badgeOpacity : 1) * 100]}
                    onValueChange={([val]) => updateElement(selectedElement.id, { badgeOpacity: val / 100 })}
                    disabled={selectedElement.isLocked}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedElement.type === 'image' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={() => setShowMediaForSubject(true)} disabled={selectedElement.isLocked} variant="outline" className="flex-1 text-xs rounded-xl active:scale-[0.97]">
                  Replace Image
                </Button>
                <Button
                  onClick={handleRemoveBackground}
                  disabled={selectedElement.isLocked || isRemovingBg}
                  className="flex-1 bg-violet-600 hover:bg-violet-750 text-xs rounded-xl active:scale-[0.97] text-white flex items-center justify-center"
                >
                  {isRemovingBg ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1 shrink-0" /> : <Sparkles className="w-3.5 h-3.5 mr-1 shrink-0" />}
                  Cutout Face/Obj
                </Button>
              </div>

              {/* Crop Mask configuration */}
              <div className="space-y-1 border-t border-slate-800 pt-3">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Crop Frame Mask</Label>
                <Select
                  value={selectedElement.maskShape || 'none'}
                  onValueChange={(val: any) => updateElement(selectedElement.id, { maskShape: val })}
                  disabled={selectedElement.isLocked}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-xs rounded-xl h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                    <SelectItem value="none">Rectangle (None)</SelectItem>
                    <SelectItem value="circle">Circle Mask</SelectItem>
                    <SelectItem value="hexagon">Hexagon Mask</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Outline glow configuration */}
              <div className="space-y-1 border-t border-slate-800 pt-3">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Outline POP Glow</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={selectedElement.imageOutlineColor || '#facc15'}
                    onChange={(e) => updateElement(selectedElement.id, { imageOutlineColor: e.target.value })}
                    disabled={selectedElement.isLocked}
                    className="w-7 h-7 rounded border border-slate-800 cursor-pointer shrink-0"
                  />
                  <Slider
                    min={0}
                    max={12}
                    step={1}
                    value={[selectedElement.imageOutlineWidth || 0]}
                    onValueChange={([val]) => updateElement(selectedElement.id, { imageOutlineWidth: val })}
                    disabled={selectedElement.isLocked}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Image adjustment filters */}
              <div className="space-y-3 border-t border-slate-800 pt-3">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Image Adjustments (Double-Tap ResetLabel)</Label>
                
                <div className="space-y-1">
                  <Label
                    onDoubleClick={() => updateElement(selectedElement.id, { brightness: 100 })}
                    className="text-[10px] font-bold text-slate-450 cursor-pointer hover:text-slate-205 select-none"
                  >
                    Brightness ({selectedElement.brightness !== undefined ? selectedElement.brightness : 100}%)
                  </Label>
                  <Slider
                    min={50}
                    max={150}
                    step={1}
                    value={[selectedElement.brightness !== undefined ? selectedElement.brightness : 100]}
                    onValueChange={([val]) => updateElement(selectedElement.id, { brightness: val })}
                    disabled={selectedElement.isLocked}
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    onDoubleClick={() => updateElement(selectedElement.id, { contrast: 100 })}
                    className="text-[10px] font-bold text-slate-450 cursor-pointer hover:text-slate-205 select-none"
                  >
                    Contrast ({selectedElement.contrast !== undefined ? selectedElement.contrast : 100}%)
                  </Label>
                  <Slider
                    min={50}
                    max={150}
                    step={1}
                    value={[selectedElement.contrast !== undefined ? selectedElement.contrast : 100]}
                    onValueChange={([val]) => updateElement(selectedElement.id, { contrast: val })}
                    disabled={selectedElement.isLocked}
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    onDoubleClick={() => updateElement(selectedElement.id, { saturate: 100 })}
                    className="text-[10px] font-bold text-slate-450 cursor-pointer hover:text-slate-205 select-none"
                  >
                    Saturation ({selectedElement.saturate !== undefined ? selectedElement.saturate : 100}%)
                  </Label>
                  <Slider
                    min={0}
                    max={200}
                    step={1}
                    value={[selectedElement.saturate !== undefined ? selectedElement.saturate : 100]}
                    onValueChange={([val]) => updateElement(selectedElement.id, { saturate: val })}
                    disabled={selectedElement.isLocked}
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    onDoubleClick={() => updateElement(selectedElement.id, { blurRadius: 0 })}
                    className="text-[10px] font-bold text-slate-450 cursor-pointer hover:text-slate-205 select-none"
                  >
                    Blur ({selectedElement.blurRadius || 0}px)
                  </Label>
                  <Slider
                    min={0}
                    max={20}
                    step={1}
                    value={[selectedElement.blurRadius || 0]}
                    onValueChange={([val]) => updateElement(selectedElement.id, { blurRadius: val })}
                    disabled={selectedElement.isLocked}
                  />
                </div>

                <div className="space-y-1">
                  <Label
                    onDoubleClick={() => updateElement(selectedElement.id, { hueRotate: 0 })}
                    className="text-[10px] font-bold text-slate-450 cursor-pointer hover:text-slate-205 select-none"
                  >
                    Hue Rotation ({selectedElement.hueRotate || 0}°)
                  </Label>
                  <Slider
                    min={0}
                    max={360}
                    step={5}
                    value={[selectedElement.hueRotate || 0]}
                    onValueChange={([val]) => updateElement(selectedElement.id, { hueRotate: val })}
                    disabled={selectedElement.isLocked}
                  />
                </div>
              </div>

              {/* Flip configurations */}
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Flip Transformations</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateElement(selectedElement.id, { flipHorizontal: !selectedElement.flipHorizontal })}
                    disabled={selectedElement.isLocked}
                    variant={selectedElement.flipHorizontal ? "secondary" : "outline"}
                    className="flex-1 text-xs rounded-xl active:scale-[0.97]"
                  >
                    Flip Horiz
                  </Button>
                  <Button
                    onClick={() => updateElement(selectedElement.id, { flipVertical: !selectedElement.flipVertical })}
                    disabled={selectedElement.isLocked}
                    variant={selectedElement.flipVertical ? "secondary" : "outline"}
                    className="flex-1 text-xs rounded-xl active:scale-[0.97]"
                  >
                    Flip Vert
                  </Button>
                </div>
              </div>
            </div>
          )}

          {(selectedElement.type === 'icon' || selectedElement.type === 'arrow' || selectedElement.type === 'svg') && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Fill Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedElement.shapeFill || '#ffffff'}
                    onChange={(e) => updateElement(selectedElement.id, { shapeFill: e.target.value })}
                    disabled={selectedElement.isLocked}
                    className="w-9 h-9 rounded-xl border border-slate-800 cursor-pointer shrink-0"
                  />
                  <Input
                    value={selectedElement.shapeFill || ''}
                    onChange={(e) => updateElement(selectedElement.id, { shapeFill: e.target.value })}
                    disabled={selectedElement.isLocked}
                    className="bg-slate-950 border-slate-800 text-xs font-mono rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Rotation ({selectedElement.rotation || 0}°)</Label>
                <Slider
                  min={0}
                  max={360}
                  step={5}
                  value={[selectedElement.rotation || 0]}
                  onValueChange={([val]) => updateElement(selectedElement.id, { rotation: val })}
                  disabled={selectedElement.isLocked}
                />
              </div>

              {selectedElement.type === 'svg' && (
                <>
                  <div className="space-y-1 border-t border-slate-800 pt-3">
                    <Label className="text-[10px] font-bold text-slate-400">Stroke Color</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={selectedElement.shapeStroke || '#000000'}
                        onChange={(e) => updateElement(selectedElement.id, { shapeStroke: e.target.value })}
                        disabled={selectedElement.isLocked}
                        className="w-7 h-7 rounded border border-slate-800 cursor-pointer shrink-0"
                      />
                      <Input
                        value={selectedElement.shapeStroke || ''}
                        onChange={(e) => updateElement(selectedElement.id, { shapeStroke: e.target.value })}
                        disabled={selectedElement.isLocked}
                        className="bg-slate-950 border-slate-800 text-[10px] font-mono rounded-xl h-7"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-400">Stroke Width ({selectedElement.shapeStrokeWidth || 0}px)</Label>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[selectedElement.shapeStrokeWidth || 0]}
                      onValueChange={([val]) => updateElement(selectedElement.id, { shapeStrokeWidth: val })}
                      disabled={selectedElement.isLocked}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-1 border-t border-slate-800 pt-4">
            <Label className="text-[10px] font-bold uppercase text-slate-400">Layer Blend Mode</Label>
            <Select
              value={selectedElement.blendMode || 'normal'}
              onValueChange={(val: any) => updateElement(selectedElement.id, { blendMode: val })}
              disabled={selectedElement.isLocked}
            >
              <SelectTrigger className="bg-slate-950 border-slate-800 text-xs rounded-xl h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="multiply">Multiply</SelectItem>
                <SelectItem value="screen">Screen</SelectItem>
                <SelectItem value="overlay">Overlay</SelectItem>
                <SelectItem value="darken">Darken</SelectItem>
                <SelectItem value="lighten">Lighten</SelectItem>
                <SelectItem value="color-dodge">Color Dodge</SelectItem>
                <SelectItem value="color-burn">Color Burn</SelectItem>
                <SelectItem value="difference">Difference</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 border-t border-slate-800 pt-4">
            <Label className="text-[10px] font-bold uppercase text-slate-400">Depth Arrangements</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateElement(selectedElement.id, { zIndex: selectedElement.zIndex + 1 })}
                disabled={selectedElement.isLocked}
                className="flex-1 text-xs rounded-xl active:scale-[0.97]"
              >
                Bring Front
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateElement(selectedElement.id, { zIndex: Math.max(1, selectedElement.zIndex - 1) })}
                disabled={selectedElement.isLocked}
                className="flex-1 text-xs rounded-xl active:scale-[0.97]"
              >
                Send Back
              </Button>
            </div>
          </div>
        </>
      ) : (
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-center text-[10px] text-slate-500 font-bold uppercase mt-2 select-none">
            Select a layer to edit properties
          </div>
        )}
      </aside>

      {/* Media Selector Dialog */}
      <MediaSelectorDialog
        open={showMediaForSubject}
        onOpenChange={setShowMediaForSubject}
        onSelectAsset={(asset) => {
          if (selectedElement && selectedElement.type === 'image') {
            updateElement(selectedElement.id, { imageSrc: asset.url });
          } else {
            const newEl: CanvasElement = {
              id: makeUniqueId(),
              type: 'image',
              x: 30,
              y: 20,
              width: 30,
              height: 40,
              zIndex: design.elements.length + 1,
              imageSrc: asset.url,
              imageOutlineColor: '#ffffff',
              imageOutlineWidth: 0,
            };
            addElement(newEl);
          }
          setShowMediaForSubject(false);
        }}
        filterType="image"
        workspaceId={workspaceId}
      />

      {/* Right Collaboration Drawer */}
      {isCommentsOpen && (
        <aside className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col shrink-0 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200">Reviews & Team Feed</span>
            </div>
            <Button
              onClick={() => setIsCommentsOpen(false)}
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-slate-400 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Reviewer Details Settings */}
            <div className="bg-slate-950/50 border border-slate-850 p-3 rounded-xl space-y-2">
              <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Reviewer Profile</Label>
              <div className="space-y-1.5">
                <Input
                  placeholder="Reviewer Name"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-[11px] rounded-lg h-8"
                />
                <Input
                  placeholder="Reviewer Email"
                  value={reviewerEmail}
                  onChange={(e) => setReviewerEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-[11px] rounded-lg h-8"
                />
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Design Feedbacks</Label>
              
              {comments.filter(c => !c.resolved).length === 0 ? (
                <div className="text-center py-4 bg-slate-950/30 border border-dashed border-slate-850 rounded-xl">
                  <p className="text-[10px] text-slate-500 italic">No active feedback. Design approved!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {comments.filter(c => !c.resolved).map((c) => (
                    <div key={c.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl space-y-1.5 text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-bold text-[11px] text-slate-200">{c.authorName}</span>
                          <span className="text-[8px] text-slate-500">{c.authorEmail}</span>
                        </div>
                        <span className="text-[8px] text-slate-500">{c.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{c.text}</p>
                      <div className="flex justify-end pt-1">
                        <Button
                          onClick={() => handleResolveComment(c.id)}
                          size="sm"
                          variant="ghost"
                          className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-6 px-2 rounded-lg"
                        >
                          <Check className="w-3 h-3 mr-1" /> Mark Resolved
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* New Comment Form */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Add Feedback Comment</Label>
              <div className="space-y-2">
                <textarea
                  placeholder="e.g. Can you make the title outline black to improve contrast?..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2.5 h-20 outline-none text-slate-100 placeholder:text-slate-500 focus:border-violet-500 transition-colors resize-none"
                />
                <Button
                  onClick={handleAddComment}
                  className="w-full bg-violet-600 hover:bg-violet-500 active:scale-[0.97] text-xs font-bold rounded-xl h-9"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Post Comment
                </Button>
              </div>
            </div>

            {/* Team Activity Logs Feed */}
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Team Activity Feed</Label>
              <div className="relative border-l border-slate-850 pl-3.5 space-y-4 text-left">
                {activityLogs.map((log) => (
                  <div key={log.id} className="relative text-xs">
                    {/* Circle Node */}
                    <div className="absolute -left-[20.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-slate-700 border border-slate-900" />
                    <div className="flex items-center justify-between text-[9px] text-slate-500">
                      <span className="font-bold text-slate-350">{log.user}</span>
                      <span>{log.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">{log.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

// Inline custom mini Icons for Undo/Redo
function UndoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={cn("w-5 h-5", className)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  );
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={cn("w-5 h-5", className)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
    </svg>
  );
}
