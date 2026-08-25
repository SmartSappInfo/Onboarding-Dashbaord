'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for In-Reader AI Document Assistant:
 *    Interactive conversation drawer for `/d/[slug]` readers allowing questions,
 *    summaries, and page-grounded answers with exact clickable citations (PRD Sections 2600–2625).
 * 2. Clickable Page Navigation Invariant:
 *    When a reader clicks an AI citation badge (e.g. "[Page 3]"), `onPageSelect(pageNumber)`
 *    is dispatched to instantly turn the viewer to the cited page.
 * 3. Emil Kowalski Animation Standards:
 *    Slide-in drawer transitions (`translate-x-0`), smooth message bubbling,
 *    and tactile button active scaling (`active:scale-[0.97]`).
 * 4. Mobile Ergonomics & Viewport Invariants:
 *    All buttons and inputs enforce `min-h-[44px]` touch targets with virtual keyboard resilience.
 * 5. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  BookOpen,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import type { DocumentAiMessage, DocumentAiCitation } from '@/lib/types/document-types';
import { askDocumentQuestionAction } from '@/lib/documents/ai-document-actions';
import { useToast } from '@/hooks/use-toast';

interface ViewerAiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  documentId: string;
  documentTitle: string;
  onPageSelect: (pageNumber: number) => void;
}

const STARTER_PROMPTS = [
  'What are the main topics in this document?',
  'What are the key deadlines or important dates?',
  'How do I apply or register?',
];

export function ViewerAiAssistant({
  isOpen,
  onClose,
  workspaceId,
  documentId,
  documentTitle,
  onPageSelect,
}: ViewerAiAssistantProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<DocumentAiMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: `Hello! I'm your AI reading assistant for "${documentTitle}". Ask me anything about this publication, and I'll cite the exact pages for you!`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (questionText?: string) => {
    const query = questionText || inputValue.trim();
    if (!query || isLoading) return;

    const userMessage: DocumentAiMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await askDocumentQuestionAction(workspaceId, documentId, query, messages);
      if (res.success && res.response) {
        const assistantMessage: DocumentAiMessage = {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: res.response.answer,
          citations: res.response.citations,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        toast({ variant: 'destructive', title: 'Assistant Error', description: res.error || 'Failed to get answer.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to connect with AI assistant.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="AI Document Assistant"
      className="fixed inset-y-0 right-0 w-full sm:w-96 max-w-full bg-background/95 backdrop-blur-xl border-l border-border/60 shadow-2xl z-50 flex flex-col transition-all duration-300 animate-in slide-in-from-right"
    >
      {/* ── Drawer Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-4 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground">AI Document Assistant</h3>
            <p className="text-[10px] text-muted-foreground line-clamp-1">{documentTitle}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-11 w-11 rounded-xl min-h-[44px] min-w-[44px]"
          title="Close Assistant"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Conversation Stream ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium px-1">
              {msg.role === 'user' ? (
                <>
                  <span>You</span>
                  <User className="h-3 w-3 text-primary" />
                </>
              ) : (
                <>
                  <Bot className="h-3 w-3 text-primary" />
                  <span>Document AI</span>
                </>
              )}
            </div>

            <div
              className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'bg-muted/40 border border-border/60 text-foreground'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Citations list if present */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-border/40 space-y-1.5">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <BookOpen className="h-3 w-3 text-primary" /> Cited Sections:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {msg.citations.map((c, idx) => (
                      <button
                        key={idx}
                        onClick={() => onPageSelect(c.pageNumber)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-background/80 hover:bg-primary/10 hover:text-primary text-[11px] font-bold text-foreground border border-border/60 transition-all min-h-[44px] active:scale-[0.97]"
                        title={`Jump to Page ${c.pageNumber}: "${c.textSnippet}"`}
                      >
                        <span>Page {c.pageNumber}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-muted/30 border border-border/40 text-muted-foreground text-xs animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Analyzing publication and generating citations...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Starter Prompts ───────────────────────────────────────────── */}
      {messages.length === 1 && (
        <div className="px-4 py-3 border-t border-border/40 space-y-2 bg-muted/10">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Suggested Questions:
          </div>
          <div className="flex flex-col gap-1.5">
            {STARTER_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                className="text-left text-[11px] px-3.5 py-2.5 rounded-xl bg-background hover:bg-muted/30 border border-border/50 font-medium text-foreground transition-all flex items-center justify-between group min-h-[44px] active:scale-[0.98]"
              >
                <span className="line-clamp-1">{prompt}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input Bar ────────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-border/60 bg-background/90 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask anything about this document..."
            disabled={isLoading}
            className="rounded-xl h-11 text-xs border-border/60 min-h-[44px]"
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="h-11 w-11 rounded-xl min-h-[44px] shrink-0 active:scale-[0.97] transition-all"
            title="Send Question"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
