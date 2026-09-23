'use client';

/**
 * {{Org_name}} Experience Platform — Lesson AI Tutor Component
 *
 * Ambient, contextual AI learning companion embedded directly in the course player.
 * Can be rendered as a docked right-hand panel on desktop (non-modal) or as a bottom sheet on mobile.
 * Supports quick prompt chips, contextual lesson grounding, practice quizzes, and real-world examples.
 *
 * Architecture Notes:
 * - Fully accessible and responsive with tactile feedback (active:scale-[0.98]).
 * - Non-blocking: central video and reading canvas remain fully visible and interactive.
 * - Strict typing (Zero any / any[]).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { askAiTutorAction } from '@/app/actions/ai-experience-actions';
import type { AiTutorMessage } from '@/lib/types/ai-experience';
import { getErrorMessage } from '@/lib/errors/report-error';
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  PanelRightClose,
  X,
} from 'lucide-react';

export interface AiTutorChatContentProps {
  portalSlug: string;
  courseSlug: string;
  lessonSlug: string;
  portalId: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  organizationId: string;
  userId: string;
  onClose?: () => void;
  isDocked?: boolean;
}

/**
 * Dedicated, full-height AI Tutor Chat component that can be embedded into
 * a desktop sidebar or rendered inside a mobile sheet.
 */
export function AiTutorChatContent({
  portalSlug,
  courseSlug,
  lessonSlug,
  portalId,
  courseId,
  lessonId,
  lessonTitle,
  organizationId,
  userId,
  onClose,
  isDocked = false,
}: AiTutorChatContentProps) {
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<AiTutorMessage[]>([
    {
      id: 'init_welcome',
      sender: 'ai',
      text: `Hello! I am your AI learning tutor for **${lessonTitle}**.\n\nHow can I help you master this lesson today?`,
      suggestedActions: [
        '💡 Explain key concepts simply',
        '📝 Test my knowledge with a quiz',
        '🌍 Give me a practical case study',
        '🚀 What should I do next?',
      ],
      timestamp: new Date().toISOString(),
    },
  ]);

  const [inputVal, setInputVal] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: AiTutorMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsSending(true);

    try {
      const res = await askAiTutorAction(
        {
          organizationId,
          portalId,
          courseId,
          lessonId,
          lessonTitle,
          userId,
          userMessage: text.trim(),
        },
        portalSlug,
        courseSlug,
        lessonSlug
      );

      if (!res.success) throw new Error(res.error);

      const aiMsg: AiTutorMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'ai',
        text: res.data?.aiResponse || 'Here is what you need to know about this lesson.',
        suggestedActions: res.data?.suggestedActions,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: unknown) {
      toast({
        title: 'Tutor Error',
        description: getErrorMessage(err) || 'Failed to reach AI Tutor.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputVal);
  };

  return (
    <div className="flex flex-col h-full w-full bg-card overflow-hidden select-text">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-foreground truncate">
                AI Learning Tutor
              </span>
              <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 font-bold py-0 px-1.5 border-0 shrink-0">
                Online
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground truncate max-w-[200px] sm:max-w-[240px]">
              Grounding: {lessonTitle}
            </p>
          </div>
        </div>

        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0 active:scale-[0.96]"
            aria-label={isDocked ? 'Collapse AI Panel' : 'Close AI Tutor'}
          >
            {isDocked ? <PanelRightClose className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </Button>
        )}
      </div>

      {/* ── Message Stream ──────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3.5 bg-muted/10 min-h-0">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                msg.sender === 'user'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div className={`space-y-1.5 max-w-[84%] sm:max-w-[82%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-primary text-white rounded-tr-xs shadow-2xs'
                    : 'bg-card border border-border text-foreground rounded-tl-xs shadow-2xs whitespace-pre-wrap'
                }`}
              >
                {msg.text}
              </div>

              {/* Suggested Action Chips */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {msg.suggestedActions.map((action, aIdx) => (
                    <button
                      key={aIdx}
                      type="button"
                      onClick={() => sendMessage(action)}
                      className="text-[10px] font-semibold bg-card border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground px-2 py-0.5 rounded-lg transition-all flex items-center gap-1 shadow-2xs active:scale-[0.97]"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 pl-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span className="text-[11px]">Formulating response...</span>
          </div>
        )}
      </div>

      {/* ── Input Footer ────────────────────────────────────────────────── */}
      <form onSubmit={handleFormSubmit} className="p-3 border-t border-border bg-card flex items-center gap-2 shrink-0">
        <Input
          placeholder="Ask a question or request a summary..."
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          disabled={isSending}
          className="h-9 sm:h-10 text-xs rounded-xl bg-muted/20 focus-visible:ring-primary"
        />
        <Button
          type="submit"
          disabled={isSending || !inputVal.trim()}
          size="icon"
          className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl bg-primary text-white hover:bg-primary/90 shrink-0 shadow-2xs active:scale-[0.96]"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
}

export interface LessonAiTutorDrawerProps extends AiTutorChatContentProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Backwards-compatible slide-over sheet drawer for the AI Tutor (primarily used on mobile).
 */
export function LessonAiTutorDrawer({
  isOpen,
  onClose,
  ...rest
}: LessonAiTutorDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[84vh] max-h-[720px] rounded-t-3xl p-0 flex flex-col overflow-hidden border-t-2 border-border shadow-2xl"
      >
        <AiTutorChatContent {...rest} onClose={onClose} isDocked={false} />
      </SheetContent>
    </Sheet>
  );
}
