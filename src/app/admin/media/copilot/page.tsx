'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Dedicated Media Copilot & AI Studio:
 *    - Implements Section 158 of `media_ux.md` providing a full-screen generative AI workbench.
 *    - Split-pane layout:
 *      - Left Pane: Multi-persona conversational agent (Librarian, Analyst, Strategist, Repurposer, CRM Intel, Optimizer).
 *      - Right Pane: Derivative Asset Manager displaying omnichannel repurposed content across the workspace.
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    - Seamlessly responsive on mobile devices with tabs switching between Copilot Chat and Derivative Library.
 *    - All buttons, selectors, and tabs enforce `min-h-[44px] min-w-[44px]` with Emil Kowalski micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import * as React from 'react';
import { useFirestore } from '@/lib/firestore-context';
import { useWorkspace } from '@/context/WorkspaceContext';
import type {
  CopilotPersonaType,
  MediaDerivative,
  CopilotSession,
} from '@/lib/types/media-2.0';
import {
  getOrCreateCopilotSessionAction,
  sendCopilotMessageAction,
} from '@/lib/media/copilot-service';
import {
  listWorkspaceDerivativesAction,
  deleteDerivativeAction,
  exportDerivativeAction,
} from '@/lib/media/repurposing-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Sparkles,
  TrendingUp,
  Target,
  Layers,
  Users,
  Zap,
  BookOpen,
  Send,
  Copy,
  Check,
  Download,
  Search,
  RefreshCw,
} from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { cn } from '@/lib/utils';

const PERSONAS: Array<{
  type: CopilotPersonaType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  {
    type: 'STRATEGIST',
    label: 'Strategist',
    desc: 'Next-best content recommendations and sales package delivery',
    icon: Target,
    color: 'text-primary bg-primary/10 border-primary/20',
  },
  {
    type: 'ANALYST',
    label: 'Analyst',
    desc: 'Audience drop-off analysis and funnel conversion explanations',
    icon: TrendingUp,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  {
    type: 'REPURPOSER',
    label: 'Repurposer',
    desc: 'Deconstructs long-form media into FAQs, social posts & clips',
    icon: Layers,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  },
  {
    type: 'CRM_INTELLIGENCE',
    label: 'CRM Intel',
    desc: 'Synthesizes viewer watch history with deal stage velocity',
    icon: Users,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    type: 'LIBRARIAN',
    label: 'Librarian',
    desc: 'Audits asset metadata health, collections & duplicate files',
    icon: BookOpen,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    type: 'OPTIMIZER',
    label: 'Optimizer',
    desc: 'Optimizes dynamic CTA gating timing & thumbnail click rates',
    icon: Zap,
    color: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
  },
];

export default function MediaCopilotStudioPage() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [activePersona, setActivePersona] = React.useState<CopilotPersonaType>('STRATEGIST');
  const [session, setSession] = React.useState<CopilotSession | null>(null);
  const [inputText, setInputText] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [copiedMsgId, setCopiedMsgId] = React.useState<string | null>(null);

  // Derivative Hub States
  const [derivatives, setDerivatives] = React.useState<MediaDerivative[]>([]);
  const [selectedDerivativeFilter, setSelectedDerivativeFilter] = React.useState<string>('ALL');
  const [derivativeSearch, setDerivativeSearch] = React.useState('');
  const [activeDerivative, setActiveDerivative] = React.useState<MediaDerivative | null>(null);
  const [_isLoadingDerivatives, setIsLoadingDerivatives] = React.useState(true);

  // Mobile View Switcher (Chat vs Derivatives)
  const [mobileTab, setMobileTab] = React.useState<'chat' | 'derivatives'>('chat');

  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  // Load Copilot Session
  const loadSession = React.useCallback(async () => {
    if (!firestore || !activeWorkspaceId) return;
    try {
      const s = await getOrCreateCopilotSessionAction(
        firestore,
        activeWorkspaceId,
        'global',
        undefined,
        activePersona
      );
      setSession(s);
    } catch (err) {
      console.error('[MediaCopilotStudioPage] Error loading session:', err);
    }
  }, [firestore, activeWorkspaceId, activePersona]);

  // Load Workspace Derivatives
  const loadDerivatives = React.useCallback(async () => {
    if (!firestore || !activeWorkspaceId) return;
    setIsLoadingDerivatives(true);
    try {
      const list = await listWorkspaceDerivativesAction(firestore, activeWorkspaceId);
      setDerivatives(list);
      if (list.length > 0 && !activeDerivative) {
        setActiveDerivative(list[0]);
      }
    } catch (err) {
      console.error('[MediaCopilotStudioPage] Error loading derivatives:', err);
    } finally {
      setIsLoadingDerivatives(false);
    }
  }, [firestore, activeWorkspaceId, activeDerivative]);

  React.useEffect(() => {
    loadSession();
    loadDerivatives();
  }, [loadSession, loadDerivatives]);

  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, isSending]);

  // Send Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !firestore || !activeWorkspaceId || !session) return;

    setInputText('');
    setIsSending(true);

    try {
      const updated = await sendCopilotMessageAction(
        firestore,
        activeWorkspaceId,
        session.id,
        text,
        activePersona
      );
      setSession(updated);
    } catch (err) {
      console.error('[handleSendMessage] Error:', err);
      toast({
        title: 'Error Communicating with Copilot',
        description: 'Failed to process prompt. Please retry.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopy = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    toast({
      title: 'Copied to Clipboard',
      description: 'Response content copied.',
    });
    setTimeout(() => setCopiedMsgId(null), 2500);
  };

  const handleDeleteDerivative = async (id: string) => {
    if (!firestore || !activeWorkspaceId) return;
    try {
      await deleteDerivativeAction(firestore, activeWorkspaceId, id);
      toast({
        title: 'Derivative Removed',
        description: 'Asset record deleted.',
      });
      await loadDerivatives();
      if (activeDerivative?.id === id) {
        setActiveDerivative(null);
      }
    } catch (err) {
      console.error('[handleDeleteDerivative] Error:', err);
    }
  };

  const handleDownloadDerivative = (
    derivative: MediaDerivative,
    format: 'markdown' | 'txt' | 'json'
  ) => {
    const content = exportDerivativeAction(derivative, format);
    const ext = format === 'markdown' ? 'md' : format;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${derivative.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${ext}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Derivatives
  const filteredDerivatives = React.useMemo(() => {
    let list = [...derivatives];
    if (selectedDerivativeFilter !== 'ALL') {
      list = list.filter((d) => d.type === selectedDerivativeFilter);
    }
    if (derivativeSearch.trim()) {
      const q = derivativeSearch.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.sourceTitle.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q)
      );
    }
    return list;
  }, [derivatives, selectedDerivativeFilter, derivativeSearch]);

  const currentPersonaConfig = PERSONAS.find((p) => p.type === activePersona) || PERSONAS[0];
  const PersonaIcon = currentPersonaConfig.icon;

  return (
    <PageContainerFluid>
      <div className="space-y-6 pb-20 w-full text-left">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                Phase 7 Studio
              </Badge>
              <Badge variant="outline" className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                Autonomous Copilot
              </Badge>
            </div>
            <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" /> Media Copilot & Repurposing Studio
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Multi-persona conversational AI assistant and omnichannel derivative asset generator.
            </p>
          </div>

          {/* Mobile Screen Switcher */}
          <div className="flex sm:hidden items-center gap-1.5 p-1 bg-muted/40 rounded-2xl border border-border">
            <button
              onClick={() => setMobileTab('chat')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] active:scale-[0.97]',
                mobileTab === 'chat'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              Copilot Chat
            </button>
            <button
              onClick={() => setMobileTab('derivatives')}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] active:scale-[0.97]',
                mobileTab === 'derivatives'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              Derivatives ({derivatives.length})
            </button>
          </div>
        </div>

        {/* Persona Selector Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const isSelected = activePersona === p.type;

            return (
              <button
                key={p.type}
                onClick={() => setActivePersona(p.type)}
                className={cn(
                  'p-3 rounded-2xl border transition-all text-left min-h-[44px] flex flex-col justify-between select-none active:scale-[0.97]',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm'
                    : 'border-border bg-card hover:border-primary/20'
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className={cn('p-1.5 rounded-lg border', p.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {isSelected && (
                    <Badge className="text-[8px] font-black uppercase px-1 py-0">Active</Badge>
                  )}
                </div>
                <div>
                  <span className="text-xs font-extrabold text-foreground block truncate">
                    {p.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                    {p.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Split-Pane Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Pane: Copilot Conversation Stream (Cols 7 on Desktop) */}
          <div
            className={cn(
              'lg:col-span-7 flex flex-col rounded-3xl border border-border bg-card shadow-sm overflow-hidden h-[680px]',
              mobileTab === 'derivatives' && 'hidden sm:flex'
            )}
          >
            {/* Chat Top Banner */}
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn('p-2 rounded-xl border', currentPersonaConfig.color)}>
                  <PersonaIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-wider">
                    {currentPersonaConfig.label} Agent
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    {currentPersonaConfig.desc}
                  </p>
                </div>
              </div>

              <Badge variant="outline" className="text-[9px] font-black uppercase">
                {session?.messages.length || 0} Messages
              </Badge>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {session?.messages && session.messages.length > 0 ? (
                session.messages.map((msg) => {
                  const isAssistant = msg.role === 'assistant';
                  const MsgIcon = PERSONAS.find((p) => p.type === msg.persona)?.icon || Bot;

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex gap-3 text-xs leading-relaxed max-w-[90%]',
                        isAssistant ? 'self-start mr-auto' : 'self-end ml-auto flex-row-reverse'
                      )}
                    >
                      {isAssistant && (
                        <div className="h-7 w-7 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
                          <MsgIcon className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div
                          className={cn(
                            'p-3.5 rounded-2xl border text-xs',
                            isAssistant
                              ? 'bg-muted/30 text-foreground border-border shadow-sm'
                              : 'bg-primary text-primary-foreground border-primary shadow-sm'
                          )}
                        >
                          <div className="whitespace-pre-wrap font-medium">
                            {msg.content}
                          </div>

                          {isAssistant && (
                            <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                              <span className="font-semibold uppercase text-[9px]">
                                {msg.persona.replace('_', ' ')}
                              </span>
                              <button
                                onClick={() => handleCopy(msg.id, msg.content)}
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
                                onClick={() => handleSendMessage(`Please ${act.label.toLowerCase()}`)}
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

              {isSending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-2xl bg-muted/20 border border-border w-max">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="font-bold">Consulting {currentPersonaConfig.label}...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-border bg-card/60 backdrop-blur-sm shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Ask ${currentPersonaConfig.label} about content, velocity, or repurposing...`}
                  disabled={isSending}
                  className="h-11 min-h-[44px] rounded-xl text-xs font-medium pl-3 bg-background"
                />

                <Button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="h-11 w-11 rounded-xl min-h-[44px] min-w-[44px] p-0 active:scale-[0.97] shrink-0"
                  aria-label="Send prompt"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Right Pane: Repurposed Derivatives Library (Cols 5 on Desktop) */}
          <div
            className={cn(
              'lg:col-span-5 flex flex-col rounded-3xl border border-border bg-card shadow-sm overflow-hidden h-[680px]',
              mobileTab === 'chat' && 'hidden sm:flex'
            )}
          >
            {/* Derivatives Header & Search */}
            <div className="p-4 border-b border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black text-foreground uppercase tracking-wider">
                    Derivative Assets Hub
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-black">
                  {derivatives.length} Total
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={derivativeSearch}
                    onChange={(e) => setDerivativeSearch(e.target.value)}
                    placeholder="Search derivatives..."
                    className="h-9 min-h-[36px] rounded-xl text-xs pl-8 bg-background"
                  />
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadDerivatives}
                  className="h-9 px-2.5 min-h-[36px] rounded-xl text-xs font-bold"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Type Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
                {['ALL', 'FAQ', 'EMAIL_OUTREACH', 'SOCIAL_SNIPPETS', 'SHORT_CLIPS', 'QUOTE_CARDS', 'SALES_BRIEF'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedDerivativeFilter(f)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all whitespace-nowrap active:scale-[0.97] border',
                      selectedDerivativeFilter === f
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:text-foreground'
                    )}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Derivatives List or Active Preview */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeDerivative ? (
                /* Selected Derivative Preview Box */
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                    <div>
                      <h4 className="text-xs font-black text-foreground truncate">
                        {activeDerivative.title}
                      </h4>
                      <p className="text-[10px] text-muted-foreground truncate">
                        Source: {activeDerivative.sourceTitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(activeDerivative.content);
                          toast({ title: 'Copied to Clipboard' });
                        }}
                        className="h-8 px-2.5 min-h-[32px] rounded-lg text-[11px] font-bold"
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadDerivative(activeDerivative, 'markdown')}
                        className="h-8 px-2.5 min-h-[32px] rounded-lg text-[11px] font-bold"
                      >
                        <Download className="h-3 w-3 mr-1" /> Export
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveDerivative(null)}
                        className="h-8 px-2 min-h-[32px] rounded-lg text-xs font-bold"
                      >
                        Back
                      </Button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/20 border border-border text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-[460px] overflow-y-auto">
                    {activeDerivative.content}
                  </div>
                </div>
              ) : filteredDerivatives.length > 0 ? (
                filteredDerivatives.map((deriv) => (
                  <div
                    key={deriv.id}
                    onClick={() => setActiveDerivative(deriv)}
                    className="p-3.5 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all cursor-pointer space-y-1.5 active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[9px] font-black uppercase">
                        {deriv.type.replace('_', ' ')}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(deriv.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs font-extrabold text-foreground truncate">
                      {deriv.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Source: {deriv.sourceTitle}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center space-y-2 text-muted-foreground">
                  <Layers className="h-6 w-6 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-extrabold text-foreground">No Derivatives Found</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    Open an asset in Media Library and click &apos;Repurpose with AI&apos; to generate marketing materials.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContainerFluid>
  );
}
