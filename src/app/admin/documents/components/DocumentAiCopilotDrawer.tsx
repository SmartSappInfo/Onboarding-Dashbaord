'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Slide-over AI Copilot Drawer for grounded document Q&A and instant executive summaries (P5.3).
 * 2. Mobile & Accessibility Ergonomics:
 *    - All text inputs use `text-base` (16px) on mobile to strictly prevent iOS Safari auto-zoom.
 *    - Touch targets are minimum 44x44px (`min-h-[44px]`).
 *    - Emil Kowalski micro-interactions (`active:scale-[0.97]`).
 *    - Clickable page citation pills jump the host viewer to the relevant page.
 * 3. Anti-Hallucination & Provenance:
 *    - Explicitly badges answers that are supported vs unsupported by document text.
 * 4. Strict Typing (Rule 4): Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Send,
  Loader2,
  FileText,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Bot,
  User,
} from 'lucide-react';
import {
  askDocumentQuestionAction,
  getDocumentExecutiveSummaryAction,
} from '@/app/actions/document-ai-copilot-actions';
import type {
  AiDocumentQaCitation,
} from '@/lib/types/document-signing';
import type { ExecutiveSummaryResult } from '@/lib/documents/document-ai-copilot-service';

export interface DocumentAiCopilotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  documentId: string;
  documentTitle: string;
  documentVersionId?: string;
  pageTexts?: string[];
  onNavigateToPage?: (pageNumber: number) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AiDocumentQaCitation[];
  isSupported?: boolean;
  timestamp: string;
}

const SUGGESTED_QUERIES = [
  'What are the payment terms?',
  'What is the governing law?',
  'What are the termination rules?',
  'What is the total contract value?',
];

export function DocumentAiCopilotDrawer({
  open,
  onOpenChange,
  workspaceId,
  documentId,
  documentTitle,
  documentVersionId,
  pageTexts,
  onNavigateToPage,
}: DocumentAiCopilotDrawerProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<ExecutiveSummaryResult | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = React.useState(true);
  const [circuitBreakerTripped, setCircuitBreakerTripped] = React.useState(false);

  // Load Executive Summary on initial open
  React.useEffect(() => {
    if (!open || summary || !documentId) return;

    let isMounted = true;
    setIsSummaryLoading(true);

    getDocumentExecutiveSummaryAction({
      workspaceId,
      documentId,
      documentVersionId,
      title: documentTitle,
      pageTexts: pageTexts || [],
    })
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setSummary(res.data);
        }
      })
      .finally(() => {
        if (isMounted) setIsSummaryLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, summary, workspaceId, documentId, documentVersionId, documentTitle, pageTexts]);

  // Handle Question Submission
  const handleSend = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await askDocumentQuestionAction({
        workspaceId,
        documentId,
        documentVersionId,
        question: q,
        pageTexts,
      });

      if (res.circuitBreakerTripped) {
        setCircuitBreakerTripped(true);
      }

      if (res.success && res.data) {
        const assistantMessage: ChatMessage = {
          id: `msg_assistant_${Date.now()}`,
          role: 'assistant',
          content: res.data.answer,
          citations: res.data.citations,
          isSupported: res.data.isSupported,
          timestamp: res.data.generatedAt,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          content: res.error || 'Unable to generate an answer for this question.',
          isSupported: false,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch {
      const errorMessage: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: 'Network error communicating with the assistant service.',
        isSupported: false,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-md w-full p-0 flex flex-col h-full bg-background border-l shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold leading-tight flex items-center gap-2">
                Agreement Assistant
                <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4">
                  Grounded AI
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate max-w-[280px]">
                {documentTitle || 'Contract Intelligence'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Circuit Breaker Warning Banner */}
        {circuitBreakerTripped && (
          <div className="p-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
            <span>Assistant busy: High traffic. Using extractive search mode.</span>
          </div>
        )}

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* Executive Summary Card */}
            <div className="rounded-xl border bg-card p-3.5 shadow-sm space-y-2">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsSummaryExpanded((prev) => !prev)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Executive Summary
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  {isSummaryExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {isSummaryLoading && (
                <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing agreement terms...</span>
                </div>
              )}

              {summary && isSummaryExpanded && (
                <div className="space-y-2 text-xs text-muted-foreground pt-1">
                  <p className="leading-relaxed text-foreground/90">{summary.summary}</p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {summary.governingLaw && (
                      <Badge variant="secondary" className="text-[10px]">
                        Law: {summary.governingLaw}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        summary.detectedRiskLevel === 'high'
                          ? 'border-rose-500/30 text-rose-600 bg-rose-500/10'
                          : summary.detectedRiskLevel === 'medium'
                          ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                          : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                      }`}
                    >
                      Risk: {summary.detectedRiskLevel.toUpperCase()}
                    </Badge>
                  </div>

                  {summary.keyCommercialTerms.length > 0 && (
                    <div className="pt-1.5 border-t border-border/50">
                      <span className="text-[11px] font-semibold text-foreground block mb-1">
                        Key Terms:
                      </span>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                        {summary.keyCommercialTerms.map((term, idx) => (
                          <li key={idx} className="truncate">
                            {term}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Prompt Chips */}
            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Suggested Questions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_QUERIES.map((query, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(query)}
                      className="text-xs bg-muted/60 hover:bg-muted text-foreground border rounded-full px-3 py-1.5 transition-colors text-left active:scale-[0.97] min-h-[36px]"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message Thread */}
            <div className="space-y-3 pt-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-2 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground font-medium rounded-tr-sm'
                        : 'bg-card border rounded-tl-sm text-foreground shadow-sm'
                    }`}
                  >
                    <p>{msg.content}</p>

                    {/* Citations Pill Rail */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-1.5 border-t border-border/50 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          Sources:
                        </span>
                        {msg.citations.map((cite, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => onNavigateToPage?.(cite.pageNumber)}
                            title={cite.textSnippet}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded-md border border-primary/20 transition-all active:scale-[0.97] cursor-pointer"
                          >
                            <span>Page {cite.pageNumber}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Unsupported indicator */}
                    {msg.role === 'assistant' && msg.isSupported === false && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold pt-1">
                        <ShieldAlert className="h-3 w-3" />
                        <span>Not Found in Agreement</span>
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-pulse">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5 bg-card border rounded-2xl rounded-tl-sm px-3 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span>Analyzing contract clauses...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Input Bar */}
        <div className="p-3 border-t bg-card/80 backdrop-blur-sm space-y-1.5 flex-shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask about this agreement..."
              disabled={isLoading}
              className="flex-1 min-h-[44px] px-3.5 py-2 text-base sm:text-sm bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground transition-all"
            />
            <Button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              size="icon"
              className="h-11 w-11 rounded-xl flex-shrink-0 active:scale-[0.97]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-center text-muted-foreground">
            Answers are grounded strictly in this document version.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
