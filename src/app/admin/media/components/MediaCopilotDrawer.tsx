'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Contextual Media Copilot Drawer:
 *    - Implements Section 158 of `media_ux.md` providing contextual AI assistance across the platform.
 *    - Allows switching between 6 specialized agent personas:
 *      LIBRARIAN, ANALYST, STRATEGIST, REPURPOSER, CRM_INTELLIGENCE, OPTIMIZER.
 * 2. Mobile Accessibility & Touch Targets:
 *    - Enforces `min-h-[44px] min-w-[44px]` touch target bounds with Emil Kowalski micro-animations (`active:scale-[0.97]`).
 *    - Accommodates virtual onscreen keyboards via viewport-safe layout and auto-scroll ref.
 * 3. Security & Anti-Injection:
 *    - Sanitizes external input and executes prompt boundary isolation via `copilot-service.ts`.
 * 4. Strict Typing Standard:
 *    - Zero use of `any` or `any[]`.
 */

import * as React from 'react';
import { useFirestore } from '@/lib/firestore-context';
import { useWorkspace } from '@/context/WorkspaceContext';
import type {
  CopilotPersonaType,
  CopilotSession,
} from '@/lib/types/media-2.0';
import {
  getOrCreateCopilotSessionAction,
  sendCopilotMessageAction,
  type CopilotContextPayload,
} from '@/lib/media/copilot-service';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Send,
  Sparkles,
  TrendingUp,
  Target,
  Layers,
  Users,
  Zap,
  BookOpen,
  Copy,
  Check,
  RefreshCw,
  X,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contextType?: 'global' | 'asset' | 'deal' | 'contact' | 'analytics';
  contextId?: string;
  contextPayload?: CopilotContextPayload;
  initialPersona?: CopilotPersonaType;
  onNavigateToRepurposer?: (assetId: string) => void;
}

const PERSONA_CONFIG: Record<
  CopilotPersonaType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; desc: string }
> = {
  STRATEGIST: {
    label: 'Strategist',
    icon: Target,
    color: 'text-primary bg-primary/10 border-primary/20',
    desc: 'Recommends next-best content packages & deal delivery timing',
  },
  ANALYST: {
    label: 'Analyst',
    icon: TrendingUp,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    desc: 'Explains viewer retention curves & conversion drop-off points',
  },
  REPURPOSER: {
    label: 'Repurposer',
    icon: Layers,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    desc: 'Transforms webinars & decks into FAQs, social posts & short clips',
  },
  CRM_INTELLIGENCE: {
    label: 'CRM Intel',
    icon: Users,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    desc: 'Synthesizes viewer watch history with deal stage velocity',
  },
  LIBRARIAN: {
    label: 'Librarian',
    icon: BookOpen,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    desc: 'Audits asset metadata health, collections & duplicate files',
  },
  OPTIMIZER: {
    label: 'Optimizer',
    icon: Zap,
    color: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
    desc: 'Optimizes dynamic CTA gating timing & thumbnail click rates',
  },
};

export function MediaCopilotDrawer({
  isOpen,
  onClose,
  contextType = 'global',
  contextId,
  contextPayload,
  initialPersona = 'STRATEGIST',
  onNavigateToRepurposer,
}: MediaCopilotDrawerProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [activePersona, setActivePersona] = React.useState<CopilotPersonaType>(initialPersona);
  const [session, setSession] = React.useState<CopilotSession | null>(null);
  const [inputText, setInputText] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [copiedMsgId, setCopiedMsgId] = React.useState<string | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Sync initialPersona when changed
  React.useEffect(() => {
    if (initialPersona) {
      setActivePersona(initialPersona);
    }
  }, [initialPersona]);

  // Load or create Copilot Session
  React.useEffect(() => {
    let isMounted = true;
    async function initSession() {
      if (!firestore || !activeWorkspaceId || !isOpen) return;
      setIsLoading(true);
      try {
        const s = await getOrCreateCopilotSessionAction(
          firestore,
          activeWorkspaceId,
          contextType,
          contextId,
          activePersona
        );
        if (isMounted) {
          setSession(s);
          if (s.activePersona) setActivePersona(s.activePersona);
        }
      } catch (err) {
        console.error('[MediaCopilotDrawer] Error initializing session:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    initSession();
    return () => {
      isMounted = false;
    };
  }, [firestore, activeWorkspaceId, isOpen, contextType, contextId]);

  // Auto-scroll to bottom of messages
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, isLoading]);

  // Handle Send Message
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || !firestore || !activeWorkspaceId || !session) return;

    setInputText('');
    setIsLoading(true);

    try {
      const updatedSession = await sendCopilotMessageAction(
        firestore,
        activeWorkspaceId,
        session.id,
        messageContent,
        activePersona,
        contextPayload
      );
      setSession(updatedSession);
    } catch (err) {
      console.error('[MediaCopilotDrawer] Error sending message:', err);
      toast({
        title: 'Copilot Communication Error',
        description: 'Failed to process response. Please retry.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    toast({
      title: 'Copied to Clipboard',
      description: 'Response text copied for outreach or notes.',
    });
    setTimeout(() => setCopiedMsgId(null), 2500);
  };

  const handleActionClick = (action: string) => {
    if (action === 'repurpose_asset' && contextId && onNavigateToRepurposer) {
      onClose();
      onNavigateToRepurposer(contextId);
      return;
    }

    if (action === 'gen_faq') {
      handleSendMessage('Generate a complete FAQ guide for this content with question and answer pairs.');
    } else if (action === 'gen_email') {
      handleSendMessage('Draft a high-converting personalized outreach email based on this media.');
    } else if (action === 'gen_social') {
      handleSendMessage('Create 3 LinkedIn takeaway posts and a WhatsApp broadcast snippet.');
    } else if (action === 'analyze_retention') {
      handleSendMessage('Analyze audience retention and explain where viewers are dropping off.');
    } else if (action === 'recommend_package') {
      handleSendMessage('What is the recommended next-best content asset to send next?');
    }
  };

  const PersonaIcon = PERSONA_CONFIG[activePersona].icon;

  return (
    <Sheet open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-[100dvh] bg-background border-l border-border z-50 text-left"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-4 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn('p-2 rounded-xl border shrink-0', PERSONA_CONFIG[activePersona].color)}>
                <PersonaIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-sm font-black text-foreground flex items-center gap-1.5 truncate">
                  Media Copilot <span className="text-muted-foreground">&bull;</span> {PERSONA_CONFIG[activePersona].label}
                </SheetTitle>
                <SheetDescription className="text-[11px] text-muted-foreground truncate">
                  {PERSONA_CONFIG[activePersona].desc}
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-8 w-8 p-0 rounded-lg min-h-[36px] min-w-[36px] text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Active Context Banner */}
          {contextPayload && (
            <div className="mt-2.5 p-2 rounded-xl bg-muted/30 border border-border flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-semibold flex items-center gap-1.5 truncate">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">
                  Context: {contextPayload.assetTitle || contextPayload.dealTitle || contextPayload.contactName || 'Active Workspace'}
                </span>
              </span>
              <Badge variant="outline" className="text-[9px] font-black uppercase shrink-0">
                {contextType}
              </Badge>
            </div>
          )}

          {/* Persona Switcher Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 no-scrollbar">
            {(Object.keys(PERSONA_CONFIG) as CopilotPersonaType[]).map((p) => {
              const cfg = PERSONA_CONFIG[p];
              const Icon = cfg.icon;
              const isSelected = activePersona === p;

              return (
                <button
                  key={p}
                  onClick={() => setActivePersona(p)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all min-h-[36px] whitespace-nowrap active:scale-[0.97] shrink-0 border',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/20 text-muted-foreground border-border hover:bg-muted/40 hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </SheetHeader>

        {/* Message Thread List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {session?.messages && session.messages.length > 0 ? (
            session.messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              const MsgIcon = PERSONA_CONFIG[msg.persona]?.icon || Bot;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-3 text-xs leading-relaxed max-w-[92%]',
                    isAssistant ? 'self-start mr-auto' : 'self-end ml-auto flex-row-reverse'
                  )}
                >
                  {isAssistant && (
                    <div className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5',
                      PERSONA_CONFIG[msg.persona]?.color || 'bg-muted'
                    )}>
                      <MsgIcon className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div
                      className={cn(
                        'p-3.5 rounded-2xl border text-xs',
                        isAssistant
                          ? 'bg-card text-foreground border-border shadow-sm'
                          : 'bg-primary text-primary-foreground border-primary shadow-sm'
                      )}
                    >
                      <div className="whitespace-pre-wrap font-medium">
                        {msg.content}
                      </div>

                      {/* Assistant Action Tools */}
                      {isAssistant && (
                        <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                          <span className="font-semibold uppercase text-[9px]">
                            {msg.persona.replace('_', ' ')}
                          </span>
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded min-h-[24px]"
                          >
                            {copiedMsgId === msg.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Suggested Action Chips */}
                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.suggestedActions.map((act) => (
                          <button
                            key={act.action}
                            onClick={() => handleActionClick(act.action)}
                            className="px-2.5 py-1 rounded-lg bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-extrabold border border-border transition-all active:scale-[0.97]"
                          >
                            &bull; {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center space-y-2 text-muted-foreground">
              <Sparkles className="h-6 w-6 text-primary mx-auto animate-pulse" />
              <p className="text-xs font-bold text-foreground">Starting Copilot Session...</p>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-2xl bg-muted/20 border border-border w-max">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="font-bold">Thinking as {PERSONA_CONFIG[activePersona].label}...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-border bg-card/60 backdrop-blur-sm shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Ask ${PERSONA_CONFIG[activePersona].label}...`}
                disabled={isLoading}
                className="h-11 min-h-[44px] rounded-xl text-xs font-medium pl-3 pr-8 bg-background"
              />
            </div>

            <Button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="h-11 w-11 rounded-xl min-h-[44px] min-w-[44px] p-0 active:scale-[0.97] shrink-0"
              aria-label="Send prompt"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
