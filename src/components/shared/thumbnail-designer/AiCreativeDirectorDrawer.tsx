'use client';

/**
 * ARCHITECTURE:
 * AI Creative Director Collaborator Drawer (Phase 3 - AI Creative Director)
 * 
 * Multi-functional AI panel offering conversational design iterations,
 * multi-concept generation, psychological copy matrices, and diff preview cards.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import type {
  CreativeConcept,
  CreativeElement,
  BrandKit,
} from '@/lib/creative/creative-types';
import {
  generateCreativeConceptsAction,
  executeAiCanvasCommandAction,
} from '@/app/actions/creative-ai-actions';
import { ConceptVariationCarousel } from './ConceptVariationCarousel';
import { CopyVariationMatrix } from './CopyVariationMatrix';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sparkles,
  Wand2,
  X,
  Send,
  Loader2,
  Check,
  Type,
  Layout,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiCreativeDirectorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentElements: CreativeElement[];
  brandKit?: BrandKit | null;
  onApplyConcept: (concept: CreativeConcept) => void;
  onApplyModifiedElements: (elements: CreativeElement[]) => void;
  onApplyHeadlineText: (text: string, subtitle?: string, badge?: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  actionSummary?: string;
  proposedElements?: CreativeElement[];
  applied?: boolean;
}

export function AiCreativeDirectorDrawer({
  open,
  onOpenChange,
  projectId,
  currentElements,
  brandKit,
  onApplyConcept,
  onApplyModifiedElements,
  onApplyHeadlineText,
}: AiCreativeDirectorDrawerProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'concepts' | 'copy'>('chat');
  const [instruction, setInstruction] = useState('');
  const [conceptsTopic, setConceptsTopic] = useState('');
  const [concepts, setConcepts] = useState<CreativeConcept[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'ai',
      text: "I'm your AI Creative Director. Tell me what you'd like to achieve with this design, or choose one of the strategic tools above.",
    },
  ]);
  const [isPending, startTransition] = useTransition();

  const handleSendInstruction = async (customText?: string) => {
    const textToSend = customText || instruction;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInstruction('');

    startTransition(async () => {
      const res = await executeAiCanvasCommandAction(
        projectId,
        currentElements,
        textToSend.trim(),
        brandKit
      );

      if (res.success && res.data) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.data.explanation,
          actionSummary: res.data.actionSummary,
          proposedElements: res.data.modifiedElements,
          applied: false,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: res.error || 'Could not process that command. Please try again.',
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    });
  };

  const handleGenerateConcepts = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!conceptsTopic.trim()) return;

    startTransition(async () => {
      const res = await generateCreativeConceptsAction(
        projectId,
        conceptsTopic.trim(),
        undefined,
        brandKit
      );
      if (res.success && res.data) {
        setConcepts(res.data);
      }
    });
  };

  const handleAcceptProposal = (msgId: string, elements: CreativeElement[]) => {
    onApplyModifiedElements(elements);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
    );
  };

  if (!open) return null;

  return (
    <aside className="w-full sm:w-96 md:w-[420px] border-l border-slate-850 bg-slate-950/95 backdrop-blur-xl flex flex-col fixed sm:relative inset-y-0 right-0 z-40 animate-in slide-in-from-right duration-200 shadow-2xl">
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-850 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Wand2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-black text-xs text-white">AI Creative Director</div>
            <div className="text-[10px] text-slate-500">Semantic Design Collaborator</div>
          </div>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val: string) => setActiveTab(val as 'chat' | 'concepts' | 'copy')}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="h-11 bg-slate-900/60 p-1 border-b border-slate-850 rounded-none w-full grid grid-cols-3">
          <TabsTrigger
            value="chat"
            className="text-xs font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 rounded-lg flex items-center gap-1"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Directives
          </TabsTrigger>
          <TabsTrigger
            value="concepts"
            className="text-xs font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 rounded-lg flex items-center gap-1"
          >
            <Layout className="w-3.5 h-3.5" /> 3 Concepts
          </TabsTrigger>
          <TabsTrigger
            value="copy"
            className="text-xs font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 rounded-lg flex items-center gap-1"
          >
            <Type className="w-3.5 h-3.5" /> Copy Matrix
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Conversational Chat & Action Cards */}
        <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-none">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'p-3 rounded-2xl text-xs space-y-2 max-w-[90%]',
                  msg.sender === 'user'
                    ? 'ml-auto bg-emerald-500/20 text-emerald-100 border border-emerald-500/30'
                    : 'mr-auto bg-slate-900 border border-slate-800 text-slate-200'
                )}
              >
                <div className="leading-relaxed">{msg.text}</div>

                {/* Proposed Action Card */}
                {msg.proposedElements && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 mt-1">
                    <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{msg.actionSummary || 'Proposed Layout Transformation'}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAcceptProposal(msg.id, msg.proposedElements!)}
                        disabled={msg.applied}
                        size="sm"
                        className={cn(
                          'h-7 px-3 text-[10px] font-bold rounded-lg w-full',
                          msg.applied
                            ? 'bg-slate-800 text-slate-500'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                        )}
                      >
                        {msg.applied ? (
                          <>
                            <Check className="w-3 h-3 mr-1" /> Applied to Canvas
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3 mr-1" /> Accept Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isPending && (
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2 mr-auto">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Creative Director is reasoning and adjusting composition...</span>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-slate-850 space-y-2 bg-slate-950">
            {/* Quick Action Chips */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
              <button
                type="button"
                onClick={() => handleSendInstruction('Make headline bolder and pop more')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-bold text-slate-300 whitespace-nowrap active:scale-[0.95]"
              >
                💥 Make Headline Pop
              </button>
              <button
                type="button"
                onClick={() => handleSendInstruction('Optimize layout for mobile readability')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-bold text-slate-300 whitespace-nowrap active:scale-[0.95]"
              >
                📱 Mobile Fit
              </button>
              <button
                type="button"
                onClick={() => handleSendInstruction('Apply workspace brand colors')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-bold text-slate-300 whitespace-nowrap active:scale-[0.95]"
              >
                🎨 Match Brand
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendInstruction();
              }}
              className="flex gap-2"
            >
              <Input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Direct AI (e.g. 'Shift subject left')..."
                className="h-10 bg-slate-900 border-slate-800 text-xs text-white rounded-xl"
                disabled={isPending}
              />
              <Button
                type="submit"
                disabled={isPending || !instruction.trim()}
                className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-slate-950 font-black text-xs rounded-xl shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* Tab 2: 3 Concepts Variation Matrix */}
        <TabsContent value="concepts" className="flex-1 overflow-y-auto p-4 space-y-4 m-0 scrollbar-none">
          <form onSubmit={handleGenerateConcepts} className="space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Concept Generator</div>
            <div className="flex gap-2">
              <Input
                value={conceptsTopic}
                onChange={(e) => setConceptsTopic(e.target.value)}
                placeholder="Topic or narrative for 3 concepts..."
                className="h-10 bg-slate-900 border-slate-800 text-xs text-white rounded-xl"
              />
              <Button
                type="submit"
                disabled={isPending || !conceptsTopic.trim()}
                className="h-10 px-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shrink-0"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
          </form>

          <ConceptVariationCarousel
            concepts={concepts}
            onApplyConcept={onApplyConcept}
          />
        </TabsContent>

        {/* Tab 3: Copy Variation Matrix */}
        <TabsContent value="copy" className="flex-1 overflow-y-auto p-4 m-0 scrollbar-none">
          <CopyVariationMatrix
            initialTopic={conceptsTopic}
            onApplyCopy={onApplyHeadlineText}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
