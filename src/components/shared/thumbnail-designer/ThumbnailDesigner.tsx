'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import type { CanvasElement, ThumbnailDesign } from '@/lib/thumbnail/thumbnail-types';
import { CTR_TEMPLATES, THUMBNAIL_FONT_OPTIONS, makeUniqueId } from '@/lib/thumbnail/thumbnail-types';
import ThumbnailCanvas from './ThumbnailCanvas';
import { runGenerateThumbnail, runModifyThumbnail } from '@/app/actions/thumbnail-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sparkles, Trash2, ArrowLeft, Wand2, RefreshCw, Save, Layers, Palette, Settings } from 'lucide-react';
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

  const [design, setDesign] = useState<ThumbnailDesign>(() => {
    if (initialDesign) return initialDesign;
    return {
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
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // AI Panel inputs
  const [aiPrompt, setAiPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('reaction-surprise');

  // Media selector dialogs triggers
  const [showMediaForSubject, setShowMediaForSubject] = useState(false);

  const selectedElement = design.elements.find((el) => el.id === selectedId) || null;

  const handleUpdateElement = (id: string, patch: Partial<CanvasElement>) => {
    setDesign((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    }));
  };

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
    setDesign((prev) => ({ ...prev, elements: [...prev.elements, textEl] }));
    setSelectedId(textEl.id);
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
    setDesign((prev) => ({ ...prev, elements: [...prev.elements, arrowEl] }));
    setSelectedId(arrowEl.id);
  };

  const handleDeleteElement = (id: string) => {
    setDesign((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== id),
    }));
    if (selectedId === id) setSelectedId(null);
  };

  const handleApplyTemplate = (tpl: typeof CTR_TEMPLATES[0]) => {
    setDesign((prev) => ({
      ...prev,
      backgroundColor: tpl.backgroundColor,
      backgroundGradient: tpl.backgroundGradient,
      elements: tpl.elements.map((el) => ({ ...el, id: makeUniqueId() })),
    }));
    setSelectedId(null);
    toast({ title: 'Template applied', description: `${tpl.name} is now loaded.` });
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

        setDesign((prev) => ({
          ...prev,
          backgroundColor: output.backgroundColor,
          backgroundGradient: output.backgroundGradient,
          elements: output.elements.map((el) => ({
            ...el,
            id: makeUniqueId(),
            type: el.type as 'text' | 'image' | 'rect' | 'circle' | 'arrow',
          })),
        }));

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

        setDesign((prev) => ({
          ...prev,
          backgroundColor: output.backgroundColor,
          backgroundGradient: output.backgroundGradient,
          elements: output.elements.map((el) => ({
            ...el,
            id: el.id || makeUniqueId(),
            type: el.type as 'text' | 'image' | 'rect' | 'circle' | 'arrow',
          })),
        }));

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

    // Deselect selection boxes before screenshotting
    setSelectedId(null);
    // Wait for DOM state updates
    await new Promise((r) => setTimeout(r, 200));

    // Force font loader checks to prevent fallback font rendering bugs
    await document.fonts.ready;

    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(container, {
        pixelRatio: 2,
        quality: 0.95,
        skipFonts: false,
      });

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
          setDesign((prev) => ({ ...prev, id: docRef.id }));
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
      console.error('Canvas serialization save failed:', err);
      toast({ variant: 'destructive', title: 'Save failed', description: 'Could not render or upload final image.' });
    }
  };

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Left Workspace Panel: Tools, Templates & AI */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0 overflow-y-auto">
        <Tabs defaultValue="ai" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-slate-950 rounded-none h-12">
            <TabsTrigger value="ai" className="text-xs font-bold data-[state=active]:bg-slate-900">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Architect
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs font-bold data-[state=active]:bg-slate-900">
              Templates
            </TabsTrigger>
            <TabsTrigger value="layers" className="text-xs font-bold data-[state=active]:bg-slate-900">
              Layers
            </TabsTrigger>
          </TabsList>

          {/* AI Panel */}
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

          {/* Templates Panel */}
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

          {/* Layers Control Panel */}
          <TabsContent value="layers" className="p-4 space-y-3">
            <div className="flex gap-2">
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
                  onClick={() => setSelectedId(el.id)}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs border border-transparent transition-all",
                    selectedId === el.id ? "bg-slate-800 border-slate-750" : "hover:bg-slate-850"
                  )}
                >
                  <span className="capitalize font-bold text-slate-300">{el.type} Layer</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteElement(el.id);
                    }}
                    className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </aside>

      {/* Main Canvas Workstation Area */}
      <main className="flex-1 bg-slate-950 p-8 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Designer Header Controls */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {onClose && (
              <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800">
                <ArrowLeft className="w-5 h-5 text-slate-350" />
              </Button>
            )}
            <Input
              value={design.name}
              onChange={(e) => setDesign((prev) => ({ ...prev, name: e.target.value }))}
              className="bg-transparent border-transparent focus:border-slate-800 text-lg font-black text-white w-64"
            />
          </div>
          <Button onClick={handleSaveDesign} className="bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl text-xs h-10 px-5 active:scale-[0.97]">
            <Save className="w-4 h-4 mr-1.5" /> Save Design
          </Button>
        </div>

        {/* Scaled Responsive Canvas Container */}
        <div className="w-full max-w-4xl">
          <ThumbnailCanvas
            backgroundColor={design.backgroundColor}
            backgroundGradient={design.backgroundGradient}
            backgroundImage={design.backgroundImage}
            elements={design.elements}
            selectedId={selectedId}
            onSelectElement={setSelectedId}
            onUpdateElement={handleUpdateElement}
          />
        </div>
      </main>

      {/* Right Canvas Element Properties Sidebar */}
      {selectedElement && (
        <aside className="w-72 border-l border-slate-800 bg-slate-900 p-4 shrink-0 overflow-y-auto space-y-4 text-left">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-2 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Layer Settings ({selectedElement.type})
          </div>

          {selectedElement.type === 'text' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Text Content</Label>
                <Input
                  value={selectedElement.text || ''}
                  onChange={(e) => handleUpdateElement(selectedElement.id, { text: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Font Family</Label>
                <Select
                  value={selectedElement.fontFamily || 'Inter'}
                  onValueChange={(val) => handleUpdateElement(selectedElement.id, { fontFamily: val })}
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
                <Label className="text-[10px] font-bold text-slate-400">Font Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedElement.fill || '#ffffff'}
                    onChange={(e) => handleUpdateElement(selectedElement.id, { fill: e.target.value })}
                    className="w-9 h-9 rounded-xl border border-slate-800 cursor-pointer shrink-0"
                  />
                  <Input
                    value={selectedElement.fill || ''}
                    onChange={(e) => handleUpdateElement(selectedElement.id, { fill: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs font-mono rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400">Font Size ({selectedElement.fontSize || 24}px)</Label>
                <Slider
                  min={12}
                  max={96}
                  step={1}
                  value={[selectedElement.fontSize || 24]}
                  onValueChange={([val]) => handleUpdateElement(selectedElement.id, { fontSize: val })}
                />
              </div>

              {/* Text Outline config */}
              <div className="space-y-1 border-t border-slate-800 pt-3">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Text Outline / Stroke</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={selectedElement.textStrokeColor || '#000000'}
                    onChange={(e) => handleUpdateElement(selectedElement.id, { textStrokeColor: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-800 cursor-pointer shrink-0"
                  />
                  <Slider
                    min={0}
                    max={8}
                    step={1}
                    value={[selectedElement.textStrokeWidth || 0]}
                    onValueChange={([val]) => handleUpdateElement(selectedElement.id, { textStrokeWidth: val })}
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
                    onChange={(e) => handleUpdateElement(selectedElement.id, { badgeColor: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-800 cursor-pointer shrink-0"
                  />
                  <Slider
                    min={0}
                    max={100}
                    step={10}
                    value={[(selectedElement.badgeOpacity !== undefined ? selectedElement.badgeOpacity : 1) * 100]}
                    onValueChange={([val]) => handleUpdateElement(selectedElement.id, { badgeOpacity: val / 100 })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedElement.type === 'image' && (
            <div className="space-y-3">
              <Button onClick={() => setShowMediaForSubject(true)} variant="outline" className="w-full text-xs rounded-xl active:scale-[0.97]">
                Replace Subject Image
              </Button>

              {/* Outline glow configuration */}
              <div className="space-y-1 border-t border-slate-800 pt-3">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Outline POP Glow</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={selectedElement.imageOutlineColor || '#facc15'}
                    onChange={(e) => handleUpdateElement(selectedElement.id, { imageOutlineColor: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-800 cursor-pointer shrink-0"
                  />
                  <Slider
                    min={0}
                    max={12}
                    step={1}
                    value={[selectedElement.imageOutlineWidth || 0]}
                    onValueChange={([val]) => handleUpdateElement(selectedElement.id, { imageOutlineWidth: val })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1 border-t border-slate-800 pt-4">
            <Label className="text-[10px] font-bold uppercase text-slate-400">Element Controls</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateElement(selectedElement.id, { zIndex: selectedElement.zIndex + 1 })}
                className="flex-1 text-xs rounded-xl active:scale-[0.97]"
              >
                Bring Front
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUpdateElement(selectedElement.id, { zIndex: Math.max(1, selectedElement.zIndex - 1) })}
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
            handleUpdateElement(selectedElement.id, { imageSrc: asset.url });
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
            setDesign((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
            setSelectedId(newEl.id);
          }
          setShowMediaForSubject(false);
        }}
        filterType="image"
        workspaceId={workspaceId}
      />
    </div>
  );
}
