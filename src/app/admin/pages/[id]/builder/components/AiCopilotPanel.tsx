'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Bot, Check, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { CampaignPageVersion } from '@/lib/types';
import UnifiedPromptInput, { StagedAttachment } from '@/components/shared/UnifiedPromptInput';

interface AiCopilotPanelProps {
  readonly version: CampaignPageVersion;
  readonly onAppendSection: (sectionProps: Record<string, unknown>, blocks: any[]) => void;
  readonly onUpdateBlockProps: (blockId: string, props: Record<string, unknown>) => void;
  readonly selectedBlockId: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestedAction?: {
    type: 'add_section' | 'update_text';
    label: string;
    payload: any;
  };
}

export function AiCopilotPanel({
  version,
  onAppendSection,
  onUpdateBlockProps,
  selectedBlockId,
}: AiCopilotPanelProps) {
  const { toast } = useToast();
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
    setStagedFiles([]);

    // Add user message
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    // Simulate AI generation delay
    setTimeout(() => {
      let assistantMsg: Message;
      const lower = text.toLowerCase();

      if (lower.includes('hero') || lower.includes('section') || lower.includes('sunset')) {
        assistantMsg = {
          role: 'assistant',
          content: "I have generated a responsive 'SmartSapp Sunset Hero' section with a dual-column layout, sunset gradient theme background, pre-configured CTA action link buttons, and Ghana-focused copy.",
          suggestedAction: {
            type: 'add_section',
            label: 'Insert Sunset Hero Section',
            payload: {
              sectionProps: {
                backgroundType: 'gradient',
                gradientAngle: 135,
                gradientFrom: '#f97316', // Orange
                gradientTo: '#7c3aed',   // Purple
                paddingTop: '4rem',
                paddingBottom: '4rem',
              },
              blocks: [
                {
                  id: `hero-${Date.now()}`,
                  type: 'hero',
                  props: {
                    heading: 'Secure Admissions Online in Ghana',
                    subheading: 'Register your child, track requirements, and connect with administrators instantly.',
                    ctaText: 'Apply Now',
                    ctaHref: '#register',
                    secondaryCtaText: 'View Fees structure',
                    secondaryCtaHref: '#pricing'
                  }
                }
              ]
            }
          }
        };
      } else if (selectedBlockId) {
        assistantMsg = {
          role: 'assistant',
          content: "I reviewed your active block and drafted high-converting Ghanaian parent copy tailored for the enrollment call-to-action.",
          suggestedAction: {
            type: 'update_text',
            label: 'Apply Parent Enrollment Copy',
            payload: {
              blockId: selectedBlockId,
              props: {
                heading: 'Join Kwame & Ama at SmartSapp Academy',
                subheading: 'Enrolling your children has never been this smooth. Sign up to secure their seat today.'
              }
            }
          }
        };
      } else {
        assistantMsg = {
          role: 'assistant',
          content: "I analyzed the workspace context. To improve conversion rates for Ghanaian parents: add an 'Onboarding Countdown' section to build urgency for the enrollment registration window.",
          suggestedAction: {
            type: 'add_section',
            label: 'Add Countdown Timer Section',
            payload: {
              sectionProps: {
                backgroundType: 'color',
                backgroundColor: '#0f172a',
                paddingTop: '3rem',
                paddingBottom: '3rem',
              },
              blocks: [
                {
                  id: `countdown-${Date.now()}`,
                  type: 'countdown',
                  props: {
                    targetDate: '2026-12-31T23:59:59Z',
                    heading: 'Enrollment Window Closes Soon',
                    subtext: 'Complete your parent profile register submission today.'
                  }
                }
              ]
            }
          }
        };
      }

      setMessages(prev => [...prev, assistantMsg]);
      setIsGenerating(false);
    }, 1500);
  };

  const handleApplyAction = (action: Exclude<Message['suggestedAction'], undefined>) => {
    if (action.type === 'add_section') {
      onAppendSection(action.payload.sectionProps, action.payload.blocks);
      toast({
        title: "Section Inserted",
        description: "AI-generated layout appended to active workspace canvas.",
      });
    } else if (action.type === 'update_text') {
      onUpdateBlockProps(action.payload.blockId, action.payload.props);
      toast({
        title: "Copy Updated",
        description: "Injected dynamic parent admissions copy into active block props.",
      });
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
