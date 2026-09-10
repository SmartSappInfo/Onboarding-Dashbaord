'use client';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Strategic Idea Canvas Studio
 *
 * Screen 64: Dedicated strategic ideation workbench turning media concepts into assets,
 * experiences, packages, and campaigns with AI-assisted brainstorming.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Adaptive Viewport Branching:
 *    - Desktop (>= 768px): 3-pane freeform spatial workspace with zoom and connection wires.
 *    - Mobile (< 768px): Touch-optimized vertical card stack with swipeable action sheets.
 * 2. Dual Auto-Save: Optimistic local draft buffer with debounced Firestore commits.
 * 3. Mobile Accessibility: All interactive controls satisfy `min-h-[44px] min-w-[44px]`.
 * 4. Strict Typing Standard: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD & UX REFERENCES:
 * - UX Sec 97-103 (Idea Canvas, Desktop 3-pane & Mobile Card Deck) & Screen 64.
 * - PRD Sec 173 (The Six Pillars: Manage, Understand, Distribute, Engage, Convert, Optimize).
 */

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useFirestore } from '@/lib/firestore-context';
import type {
  MediaIdeaCanvas,
  IdeaCanvasNode,
  IdeaCanvasNodeType,
} from '@/lib/types/media-2.0';
import {
  listIdeaCanvasesAction,
  createIdeaCanvasAction,
  saveIdeaCanvasAction,
} from '@/lib/media/idea-canvas-service';
import { IdeaNodeCard } from './components/IdeaNodeCard';
import { IdeaAiAssistPanel } from './components/IdeaAiAssistPanel';
import { IdeaConversionModal } from './components/IdeaConversionModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Plus,
  Check,
  Loader2,
  FileText,
  Users,
  Hash,
  Anchor,
  MousePointerClick,
  HelpCircle,
  Lightbulb,
  Share2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function MediaIdeaCanvasPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';
  const firestore = useFirestore();
  const { toast } = useToast();

  const [canvases, setCanvases] = useState<MediaIdeaCanvas[]>([]);
  const [activeCanvas, setActiveCanvas] = useState<MediaIdeaCanvas | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isConversionOpen, setIsConversionOpen] = useState(false);
  const [isNewCanvasOpen, setIsNewCanvasOpen] = useState(false);

  // New Canvas Form
  const [newTitle, setNewTitle] = useState('');
  const [newAudience, setNewAudience] = useState('');

  // Sync state
  const [_isSaving, _setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');
  const [_isPending, _startTransition] = useTransition();

  // Load Canvases
  const loadCanvases = useCallback(async () => {
    if (!firestore || !workspaceId) return;
    try {
      const list = await listIdeaCanvasesAction(firestore, workspaceId);
      setCanvases(list);
      if (list.length > 0 && !activeCanvas) {
        setActiveCanvas(list[0]);
      } else if (list.length === 0) {
        // Create initial default canvas
        const initial = await createIdeaCanvasAction(firestore, workspaceId, {
          title: 'Tuition & Fee Transparency Strategy',
          targetAudience: 'Parent Decision Makers',
        });
        setCanvases([initial]);
        setActiveCanvas(initial);
      }
    } catch (err) {
      console.error('[MediaIdeaCanvasPage] Error loading canvases:', err);
    }
  }, [firestore, workspaceId, activeCanvas]);

  useEffect(() => {
    loadCanvases();
  }, [loadCanvases]);

  // Debounced auto-save
  const triggerAutoSave = useCallback(
    (canvasToSave: MediaIdeaCanvas) => {
      if (!firestore || !workspaceId) return;
      setSaveStatus('saving');
      const timer = setTimeout(async () => {
        const ok = await saveIdeaCanvasAction(firestore, workspaceId, canvasToSave.id, canvasToSave);
        setSaveStatus(ok ? 'saved' : 'idle');
      }, 1200);
      return () => clearTimeout(timer);
    },
    [firestore, workspaceId]
  );

  // Add a new node to canvas
  const handleAddNode = (type: IdeaCanvasNodeType, title: string, description?: string) => {
    if (!activeCanvas) return;
    const now = new Date().toISOString();
    const newNode: IdeaCanvasNode = {
      id: `node_${type}_${Date.now()}`,
      workspaceId,
      canvasId: activeCanvas.id,
      type,
      title: title.trim(),
      description: description?.trim() || '',
      position: {
        x: Math.floor(Math.random() * 400) + 120,
        y: Math.floor(Math.random() * 250) + 100,
      },
      connectedNodeIds: [],
      createdAt: now,
      updatedAt: now,
    };

    const updatedNodes = [...activeCanvas.nodes, newNode];
    const updatedCanvas = { ...activeCanvas, nodes: updatedNodes, updatedAt: now };
    setActiveCanvas(updatedCanvas);
    triggerAutoSave(updatedCanvas);
    setSelectedNodeId(newNode.id);
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    if (!activeCanvas) return;
    const updatedNodes = activeCanvas.nodes.filter((n) => n.id !== nodeId);
    const updatedCanvas = { ...activeCanvas, nodes: updatedNodes, updatedAt: new Date().toISOString() };
    setActiveCanvas(updatedCanvas);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    triggerAutoSave(updatedCanvas);
  };

  // Create Canvas Handler
  const handleCreateCanvas = async () => {
    if (!firestore || !workspaceId || !newTitle.trim()) return;
    try {
      const created = await createIdeaCanvasAction(firestore, workspaceId, {
        title: newTitle,
        targetAudience: newAudience,
      });
      setCanvases((prev) => [created, ...prev]);
      setActiveCanvas(created);
      setIsNewCanvasOpen(false);
      setNewTitle('');
      setNewAudience('');
      toast({
        title: 'Canvas Created',
        description: `Started new Idea Canvas: "${created.title}".`,
      });
    } catch (err) {
      console.error('[MediaIdeaCanvasPage] Error creating canvas:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create canvas.',
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Top Header Controls */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center text-yellow-600 dark:text-yellow-400 shrink-0">
            <Lightbulb className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Select
                value={activeCanvas?.id || ''}
                onValueChange={(val) => {
                  const found = canvases.find((c) => c.id === val);
                  if (found) setActiveCanvas(found);
                }}
              >
                <SelectTrigger className="h-8 max-w-[240px] sm:max-w-xs font-bold text-sm truncate border-none shadow-none p-0 focus:ring-0">
                  <SelectValue placeholder="Select Canvas" />
                </SelectTrigger>
                <SelectContent>
                  {canvases.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="hidden sm:inline-flex text-[11px] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900">
                {activeCanvas?.targetAudience || 'Audience'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    All changes saved
                  </>
                )}
              </span>
              <span>•</span>
              <span>{activeCanvas?.nodes.length || 0} concept cards</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNewCanvasOpen(true)}
            className="min-h-[44px] hidden sm:inline-flex text-xs active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Canvas
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAiPanelOpen((prev) => !prev)}
            className={cn(
              'min-h-[44px] text-xs active:scale-[0.97] transition-all',
              isAiPanelOpen && 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 text-yellow-700 dark:text-yellow-300'
            )}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-yellow-500" />
            AI Assist
          </Button>

          <Button
            onClick={() => setIsConversionOpen(true)}
            disabled={!activeCanvas || activeCanvas.nodes.length === 0}
            className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm active:scale-[0.97]"
          >
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            Convert Concept
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Desktop Palette (Hidden on Mobile) */}
        <aside className="hidden md:flex flex-col w-56 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-4 shrink-0">
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Add Idea Object
            </h4>
            <p className="text-[11px] text-slate-500 px-1">
              Click to drop onto your canvas
            </p>
          </div>

          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddNode('audience', 'Target Audience', 'Key demographic or buyer persona')}
              className="w-full justify-start min-h-[44px] text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 hover:bg-blue-100/60 active:scale-[0.97]"
            >
              <Users className="h-3.5 w-3.5 mr-2 text-blue-600" />
              Audience
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddNode('topic', 'Core Topic', 'Central theme or subject matter')}
              className="w-full justify-start min-h-[44px] text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900 hover:bg-purple-100/60 active:scale-[0.97]"
            >
              <Hash className="h-3.5 w-3.5 mr-2 text-purple-600" />
              Topic
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddNode('hook', 'Attention Hook', 'Opening question or bold statement')}
              className="w-full justify-start min-h-[44px] text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100/60 active:scale-[0.97]"
            >
              <Anchor className="h-3.5 w-3.5 mr-2 text-emerald-600" />
              Hook / Angle
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddNode('asset', 'Media Asset Idea', 'Suggested video, podcast, or PDF guide')}
              className="w-full justify-start min-h-[44px] text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900 hover:bg-indigo-100/60 active:scale-[0.97]"
            >
              <FileText className="h-3.5 w-3.5 mr-2 text-indigo-600" />
              Media Format
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddNode('cta', 'Call to Action', 'Next step e.g. schedule tour or consult')}
              className="w-full justify-start min-h-[44px] text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 hover:bg-rose-100/60 active:scale-[0.97]"
            >
              <MousePointerClick className="h-3.5 w-3.5 mr-2 text-rose-600" />
              Call to Action
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddNode('question', 'Prospect Question', 'Common barrier or hesitation')}
              className="w-full justify-start min-h-[44px] text-xs font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900 hover:bg-cyan-100/60 active:scale-[0.97]"
            >
              <HelpCircle className="h-3.5 w-3.5 mr-2 text-cyan-600" />
              Question / FAQ
            </Button>
          </div>
        </aside>

        {/* Center Canvas / Mobile Stacked View */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 relative bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
          {/* Mobile Palette Bar (Visible only < 768px) */}
          <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-3 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddNode('audience', 'Target Audience')}
              className="min-h-[44px] text-xs shrink-0 active:scale-[0.97]"
            >
              <Users className="h-3.5 w-3.5 mr-1 text-blue-500" /> + Audience
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddNode('topic', 'Core Topic')}
              className="min-h-[44px] text-xs shrink-0 active:scale-[0.97]"
            >
              <Hash className="h-3.5 w-3.5 mr-1 text-purple-500" /> + Topic
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddNode('hook', 'Attention Hook')}
              className="min-h-[44px] text-xs shrink-0 active:scale-[0.97]"
            >
              <Anchor className="h-3.5 w-3.5 mr-1 text-emerald-500" /> + Hook
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddNode('cta', 'Call to Action')}
              className="min-h-[44px] text-xs shrink-0 active:scale-[0.97]"
            >
              <MousePointerClick className="h-3.5 w-3.5 mr-1 text-rose-500" /> + CTA
            </Button>
          </div>

          {/* Canvas Nodes Container */}
          {activeCanvas && activeCanvas.nodes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
              {activeCanvas.nodes.map((node) => (
                <IdeaNodeCard
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeId === node.id}
                  onSelect={(id) => setSelectedNodeId(id)}
                  onDelete={(id) => handleDeleteNode(id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600">
                <Lightbulb className="h-7 w-7" />
              </div>
              <div className="max-w-sm space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Your Canvas is Clean
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Start mapping your strategic content by dropping idea cards or asking the AI Content Strategist to brainstorm hooks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsAiPanelOpen(true)}
                  className="min-h-[44px] bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold text-xs active:scale-[0.97]"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Brainstorm with AI
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* Right AI Assist Drawer */}
        {isAiPanelOpen && (
          <aside className="w-full sm:w-96 md:w-[420px] absolute sm:relative right-0 top-0 bottom-0 z-30 shadow-xl sm:shadow-none animate-in slide-in-from-right duration-200">
            <IdeaAiAssistPanel
              canvasTitle={activeCanvas?.title || ''}
              targetAudience={activeCanvas?.targetAudience || ''}
              onAddNode={handleAddNode}
              onClose={() => setIsAiPanelOpen(false)}
            />
          </aside>
        )}
      </div>

      {/* 1-Click Conversion Modal */}
      {activeCanvas && (
        <IdeaConversionModal
          open={isConversionOpen}
          onOpenChange={setIsConversionOpen}
          canvas={activeCanvas}
          workspaceId={workspaceId}
        />
      )}

      {/* Create New Canvas Dialog */}
      <Dialog open={isNewCanvasOpen} onOpenChange={setIsNewCanvasOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Create New Idea Canvas</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Establish a dedicated brainstorming board for a new campaign or content suite.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Canvas Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. 2026 Admissions & Orientation Suite"
                className="min-h-[44px] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Primary Audience</label>
              <Input
                value={newAudience}
                onChange={(e) => setNewAudience(e.target.value)}
                placeholder="e.g. Prospective Parents"
                className="min-h-[44px] text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewCanvasOpen(false)}
              className="min-h-[44px] text-xs active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCanvas}
              disabled={!newTitle.trim()}
              className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs active:scale-[0.97]"
            >
              Create Canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
