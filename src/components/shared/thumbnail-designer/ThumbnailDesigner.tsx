'use client';

import * as React from 'react';
import { useState, useEffect, useTransition } from 'react';
import type { CanvasElement, ThumbnailDesign } from '@/lib/thumbnail/thumbnail-types';
import { CTR_TEMPLATES, THUMBNAIL_FONT_OPTIONS, makeUniqueId } from '@/lib/thumbnail/thumbnail-types';
import { useThumbnailEditor, EditorState } from '@/lib/thumbnail/use-thumbnail-editor';
import { FONT_PAIRINGS, SHAPE_PATH_REGISTRY } from '@/lib/thumbnail/design-system-presets';
import ThumbnailCanvas from './ThumbnailCanvas';
import { runGenerateThumbnail, runModifyThumbnail } from '@/app/actions/thumbnail-actions';
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
  Smile, Search, Settings, HelpCircle, Palette, Download
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
  const [exportScale, setExportScale] = useState<1 | 2 | 4>(1);

  // AI Panel inputs
  const [aiPrompt, setAiPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('reaction-surprise');

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
    const enrichedTemplate: ThumbnailDesign = {
      ...design,
      backgroundColor: tpl.backgroundColor,
      backgroundGradient: tpl.backgroundGradient,
      elements: tpl.elements.map((el) => ({ ...el, id: makeUniqueId() })),
      updatedAt: new Date().toISOString()
    };
    initializeStore(enrichedTemplate);
    toast({ title: 'Template applied', description: `${tpl.name} is now loaded.` });
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
            type: el.type as any,
          })),
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
            type: el.type as any,
          })),
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
          <TabsList className="w-full grid grid-cols-4 bg-slate-950 rounded-none h-12">
            <TabsTrigger value="ai" className="text-[10px] font-bold data-[state=active]:bg-slate-900">
              <Sparkles className="w-3 h-3 mr-1" /> AI
            </TabsTrigger>
            <TabsTrigger value="elements" className="text-[10px] font-bold data-[state=active]:bg-slate-900">
              Layers
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-[10px] font-bold data-[state=active]:bg-slate-900">
              Templates
            </TabsTrigger>
            <TabsTrigger value="library" className="text-[10px] font-bold data-[state=active]:bg-slate-900">
              Library
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
            {CTR_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => handleApplyTemplate(tpl)}
                className="border border-slate-800 bg-slate-950 p-3 rounded-xl hover:border-emerald-500 cursor-pointer transition-all space-y-1 group"
              >
                <div className="font-bold text-xs group-hover:text-emerald-400">{tpl.name}</div>
                <div className="text-[10px] text-slate-400 font-medium leading-relaxed">{tpl.description}</div>
              </div>
            ))}
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
      {selectedElement && (
        <aside className="w-72 border-l border-slate-800 bg-slate-900 p-4 shrink-0 overflow-y-auto space-y-4 text-left">
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
        </aside>
      )}

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
