'use client';

/**
 * {{Org_name}} Experience Platform — Lesson AI Tutor Chat Drawer
 *
 * Ambient, contextual AI learning companion embedded directly in the course player.
 * Supports quick prompt chips, contextual lesson grounding, practice quizzes, and real-world examples.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { askAiTutorAction } from '@/app/actions/ai-experience-actions';
import type { AiTutorMessage } from '@/lib/types/ai-experience';
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  Lightbulb,
  HelpCircle,
  BookOpen,
  ArrowRight,
  X,
} from 'lucide-react';

interface LessonAiTutorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  portalSlug: string;
  courseSlug: string;
  lessonSlug: string;
  portalId: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  organizationId: string;
  userId: string;
}

export function LessonAiTutorDrawer({
  isOpen,
  onClose,
  portalSlug,
  courseSlug,
  lessonSlug,
  portalId,
  courseId,
  lessonId,
  lessonTitle,
  organizationId,
  userId,
}: LessonAiTutorDrawerProps) {
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
    } catch (err: any) {
      toast({ title: 'Tutor Error', description: err?.message || 'Failed to reach AI Tutor.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputVal);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl p-0 h-[85vh] max-h-[640px] flex flex-col justify-between overflow-hidden shadow-2xl border-2 border-border">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-extrabold flex items-center gap-1.5">
                AI Learning Tutor
                <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 font-bold py-0">Online</Badge>
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[280px]">
                Grounding: {lessonTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Message Stream */}
        <div ref={scrollRef} className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-muted/10">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                  msg.sender === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-indigo-600/10 text-indigo-600'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div className={`space-y-2 max-w-[82%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-primary text-white rounded-tr-xs'
                      : 'bg-card border border-border text-foreground rounded-tl-xs shadow-2xs whitespace-pre-wrap'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Suggested Action Chips */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.suggestedActions.map((action, aIdx) => (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => sendMessage(action)}
                        className="text-[11px] font-semibold bg-card border border-border hover:border-primary/40 hover:bg-primary/5 text-foreground px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 shadow-2xs"
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Thinking & formulating explanation...</span>
            </div>
          )}
        </div>

        {/* Input Footer */}
        <form onSubmit={handleFormSubmit} className="p-3 sm:p-4 border-t border-border bg-card flex items-center gap-2">
          <Input
            placeholder="Ask a question or request a practical example..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            disabled={isSending}
            className="h-10 text-xs rounded-xl bg-muted/20"
          />
          <Button
            type="submit"
            disabled={isSending || !inputVal.trim()}
            size="icon"
            className="h-10 w-10 rounded-xl bg-primary text-white hover:bg-primary/90 shrink-0 shadow-2xs"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
