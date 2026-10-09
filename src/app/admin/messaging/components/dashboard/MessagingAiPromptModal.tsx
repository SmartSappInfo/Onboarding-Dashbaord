'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — Interactive AI Assistant Modal
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Strictly adheres to theme.md Section 8 (Standardized Modal Architecture):
 *   - Surface geometry: sm:rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl.
 *   - Demarcated header: <DialogHeader demarcated> with single-circle CardInfoTooltip.
 *   - Zero raw descriptions: Guidance routes through CardInfoTooltip + <DialogDescription className="sr-only">.
 *   - Demarcated footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 with tactile active:scale-[0.97] buttons.
 * - Conforms to agents_mcp_rules.md:
 *   - Rule 13 (Trust Boundary Matrix): Prompt treated as UNTRUSTED_USER_INPUT.
 *   - Rule 19 (HITL Approval Gate): Routes to Composer for human review; NEVER auto-dispatches.
 *   - Rule 8 (Input Sanitization): Safe encoding, zero raw HTML injection.
 * - Strict typing: Zero any or any[].
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Sparkles, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';

export type PromptTone = 'formal' | 'friendly' | 'urgent' | 'concise';

export interface MessagingAiPromptModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  entityTermSingular?: string;
  entityTermPlural?: string;
  initialPrompt?: string;
  customStarters?: string[];
}

export function MessagingAiPromptModal({
  isOpen,
  onOpenChange,
  entityTermSingular = 'School',
  entityTermPlural = 'Recipients',
  initialPrompt = '',
  customStarters,
}: MessagingAiPromptModalProps) {
  const router = useRouter();
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [selectedTone, setSelectedTone] = React.useState<PromptTone>('friendly');

  // Reset prompt when modal reopens with a new initial prompt
  React.useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  const curatedStarters = React.useMemo(() => [
    `Draft a fee reminder message for ${entityTermPlural}`,
    `Draft an emergency ${entityTermSingular.toLowerCase()} closure notice`,
    `Write a warm welcome message for new ${entityTermPlural}`,
    `Analyze recent campaign performance and recommend improvements`,
  ], [entityTermSingular, entityTermPlural]);

  const activeStarters = React.useMemo(() => {
    if (customStarters && customStarters.length > 0) {
      return customStarters;
    }
    return curatedStarters;
  }, [customStarters, curatedStarters]);

  const tones: Array<{ id: PromptTone; label: string; icon: string }> = [
    { id: 'friendly', label: 'Friendly', icon: '😊' },
    { id: 'formal', label: 'Formal', icon: '🏛️' },
    { id: 'urgent', label: 'Urgent', icon: '🚨' },
    { id: 'concise', label: 'Concise', icon: '⚡' },
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    // Bounded prompt query to prevent URI Too Long errors (CWE-1236 / Rule 13)
    const boundedPrompt = trimmed.slice(0, 500);
    const fullQuery = `${boundedPrompt} [Tone: ${selectedTone}]`;
    const targetUrl = `/admin/messaging/composer?prompt=${encodeURIComponent(fullQuery)}`;

    onOpenChange(false);
    router.push(targetUrl);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* Demarcated Header */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-card-foreground flex items-center gap-2">
              SmartSapp AI Assistant
            </DialogTitle>
            <CardInfoTooltip
              text="Ask AI to draft messages, refine campaigns, or analyze communication performance across all channels."
            />
            <DialogDescription className="sr-only">
              Ask AI to draft messages or analyze messaging campaigns
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Prompt Textarea */}
          <div className="space-y-2">
            <label
              htmlFor="ai-prompt-input"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between"
            >
              <span>Your Instructions or Topic</span>
              <span className="text-[11px] font-normal text-muted-foreground/80">
                {prompt.length}/500 characters
              </span>
            </label>
            <div className="relative rounded-xl border border-border/80 bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all">
              <textarea
                id="ai-prompt-input"
                rows={3}
                maxLength={500}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
                placeholder="What would you like to draft or analyze? (e.g., Draft a fee reminder message for next term...)"
                className="w-full bg-transparent px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none"
              />
              {prompt.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPrompt('')}
                  aria-label="Clear prompt"
                  className="absolute right-3 top-3 h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tone Selector */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tone & Style
            </span>
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => {
                const isSelected = selectedTone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-selected={isSelected ? 'true' : 'false'}
                    onClick={() => setSelectedTone(t.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.97] min-h-[36px] sm:min-h-[32px] border cursor-pointer',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground border-border/60'
                    )}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Curated Prompt Starters */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span>Suggested Starters</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeStarters.map((starter, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(starter)}
                  className="text-left p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-border text-xs text-foreground/90 transition-all active:scale-[0.98] cursor-pointer flex items-start gap-2 group"
                >
                  <span className="text-muted-foreground/60 group-hover:text-blue-500 transition-colors pt-0.5">
                    •
                  </span>
                  <span className="line-clamp-2 leading-relaxed">{starter}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Demarcated Footer */}
        <DialogFooter demarcated>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl min-h-[44px] active:scale-[0.97] text-xs font-medium cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!prompt.trim()}
            onClick={() => handleSubmit()}
            className="rounded-xl min-h-[44px] active:scale-[0.97] gap-2 text-xs font-medium bg-primary text-primary-foreground shadow-sm cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Open in Message Composer</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
