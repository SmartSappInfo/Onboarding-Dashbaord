'use client';

import React, { useState, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, Check, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { CampaignPageVersion, PageBlock } from '@/lib/types';
import UnifiedPromptInput, { StagedAttachment } from '@/components/shared/UnifiedPromptInput';
import { useLiveAiModel } from '@/hooks/use-live-ai-model';
import { modifyPageStructure } from '@/ai/flows/modify-page-flow';
import { WorkspaceContext } from '@/components/page-builder/WorkspaceContext';

interface AiCopilotPanelProps {
  readonly version: CampaignPageVersion;
  readonly onAppendSection: (sectionProps: Record<string, unknown>, blocks: PageBlock[]) => void;
  readonly onUpdateBlockProps: (blockId: string, props: Record<string, unknown>) => void;
  readonly selectedBlockId: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestedAction?: {
    type: 'add_section' | 'update_text';
    label: string;
    payload?: {
      blockId?: string;
      props?: Record<string, unknown>;
      sectionProps?: Record<string, unknown>;
      blocks?: PageBlock[];
    };
  };
}

export function AiCopilotPanel({
  version,
  onAppendSection,
  onUpdateBlockProps,
  selectedBlockId,
}: AiCopilotPanelProps) {
  const { toast } = useToast();
  const { provider: liveProvider, modelId: liveModelId } = useLiveAiModel();
  const { organizationId } = useContext(WorkspaceContext);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I am your SmartSapp AI Experience Copilot. I can draft copy, apply layout styles, or build high-converting sections tailored for Ghanaian school admissions and team workflows. Ask me anything!",
    }
  ]);

  const suggestions = [
    "Draft Ghana Admissions Copy",
    "Generate Sunset Hero Section",
    "Review Page CTA Placement",
    "Make styles minimal & dark"
  ];

  const handleSendPrompt = async (text: string) => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setPrompt('');

    // Capture staged attachment info and clear state immediately
    const firstFile = stagedFiles[0];
    const docContent = firstFile?.content;
    const docDataUri = firstFile?.dataUri;
    setStagedFiles([]);

    // Add user message
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await modifyPageStructure({
        userMessage: text,
        selectedBlockId,
        currentStructure: {
          sections: version.structureJson.sections
        },
        docContent,
        docDataUri,
        organizationId,
        provider: liveProvider,
        modelId: liveModelId,
      });

      const assistantMsg: Message = {
        role: 'assistant',
        content: response.aiSummary,
      };

      if (response.suggestedAction && response.suggestedAction.type !== 'none') {
        const payloadBlocks = response.suggestedAction.payload?.blocks?.map(b => ({
          id: b.id,
          type: b.type as import('@/lib/types').PageBlockType,
          props: b.props as Record<string, unknown>,
        }));

        assistantMsg.suggestedAction = {
          type: response.suggestedAction.type as 'add_section' | 'update_text',
          label: response.suggestedAction.label,
          payload: {
            blockId: response.suggestedAction.payload?.blockId,
            props: response.suggestedAction.payload?.props as Record<string, unknown> | undefined,
            sectionProps: response.suggestedAction.payload?.sectionProps as Record<string, unknown> | undefined,
            blocks: payloadBlocks,
          },
        };
      }

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      console.error('Page modifier error:', err);
      const errMsg = err instanceof Error ? err.message : "Failed to process request. Please check model preferences or API keys.";
      toast({
        title: "Copilot Error",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAction = (action: Exclude<Message['suggestedAction'], undefined>) => {
    if (action.type === 'add_section') {
      onAppendSection(action.payload?.sectionProps || {}, action.payload?.blocks || []);
      toast({
        title: "Section Inserted",
        description: "AI-generated layout appended to active workspace canvas.",
      });
    } else if (action.type === 'update_text') {
      if (action.payload?.blockId) {
        onUpdateBlockProps(action.payload.blockId, action.payload.props || {});
        toast({
          title: "Copy Updated",
          description: "Injected dynamic parent admissions copy into active block props.",
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/20 border-0 text-slate-200 select-none">
      {/* Panel header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <div className="p-1.5 bg-emerald-500/10 rounded-lg">
          <Sparkles className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-left">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Experience Copilot</h4>
          <p className="text-[9px] text-slate-500 font-medium">Contextual AI Page Assistant</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-left max-h-[350px]">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={cn(
              "flex gap-2.5 max-w-[85%] rounded-2xl p-3 text-[10px] leading-relaxed relative",
              m.role === 'user'
                ? "bg-emerald-600/10 border border-emerald-500/20 text-slate-100 ml-auto"
                : "bg-slate-900 border border-slate-850 text-slate-300"
            )}
          >
            {m.role === 'assistant' && (
              <Bot className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2.5 flex-1">
              <p>{m.content}</p>
              
              {/* Suggested action block inside chat response */}
              {m.suggestedAction && (
                <div className="border border-slate-800 bg-slate-950/80 rounded-xl p-2.5 mt-2 flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Suggested Layout</span>
                    <Wand2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleApplyAction(m.suggestedAction!)}
                    className="h-7 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] rounded-lg transition-all flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" /> {m.suggestedAction.label}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex gap-2.5 max-w-[80%] rounded-2xl p-3 bg-slate-900 border border-slate-850 text-[10px] text-slate-400">
            <Bot className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <div className="flex items-center gap-1">
              <span>Generating page structure...</span>
            </div>
          </div>
        )}
      </div>

      {/* suggestion chips */}
      <div className="px-4 py-2 flex gap-1.5 overflow-x-auto shrink-0 select-none custom-scrollbar">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendPrompt(s)}
            className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-slate-400 hover:text-slate-200 text-[8px] font-black uppercase tracking-wider rounded-full shrink-0 transition-all"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Prompt input form bar */}
      <div className="p-4 border-t border-slate-850 bg-slate-950/40">
        <UnifiedPromptInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => handleSendPrompt(prompt)}
          isLoading={isGenerating}
          stagedFiles={stagedFiles}
          onStagedFilesChange={setStagedFiles}
          placeholder="Ask Copilot to build page elements..."
        />
      </div>
    </div>
  );
}
