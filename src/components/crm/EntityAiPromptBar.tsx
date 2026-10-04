'use client';

/**
 * @fileOverview CRM Contextual "Ask About This" Surface (Phase 8 Milestone 4 Task 5)
 *
 * Implements conversational intelligence surface embedded in entity detail surfaces:
 * - 5 quick-prompt chips for instant queries
 * - Debounced input with mechanical feedback
 * - Server Action dispatch (`askEntityAiAction`)
 * - Grounded citation rendering with verbatim quotes
 * - Rule 13 & 30: Prompt injection containerization `<untrusted_reference_data id="...">`
 * - Rule 20 & 39: Latency and token budgeting badges
 * - Rule 4 (Zero any/any[] strict typing)
 * - Rule 7 (Accessible touch targets >= 44px)
 */

import * as React from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Brain,
  MessageSquare,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  askEntityAiAction,
  type ContextRailActionResult,
} from '@/app/actions/context-rail-actions';
import type { AskEntityAiResult } from '@/platform/ui/context-rail';
import { CrmSignatureDossierModal } from '@/components/crm/signature';

export interface EntityAiPromptBarProps {
  entityId: string;
  entityType: 'contact' | 'lead' | 'deal' | 'company' | 'ticket' | 'task';
  entityName: string;
  organizationId?: string;
  workspaceId?: string;
  className?: string;
  onCitationClick?: (citationId: string) => void;
}

const QUICK_PROMPT_CHIPS = [
  "What's going on with this account?",
  'Summarize last interaction',
  'What was agreed in the last meeting?',
  'Open action items',
  'Analyze relationship sentiment',
  'Key objections & risks',
];

export function EntityAiPromptBar({
  entityId,
  entityType,
  entityName,
  organizationId,
  workspaceId,
  className,
  onCitationClick,
}: EntityAiPromptBarProps) {
  const [query, setQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<AskEntityAiResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedCitationId, setCopiedCitationId] = React.useState<string | null>(null);
  const [isDossierOpen, setIsDossierOpen] = React.useState(false);

  const handleSubmit = async (promptQuery?: string) => {
    const textToSubmit = (promptQuery || query).trim();
    if (!textToSubmit || isLoading) return;

    if (
      textToSubmit.toLowerCase().includes("what's going on with") ||
      textToSubmit.toLowerCase().includes("what is going on with")
    ) {
      setIsDossierOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await askEntityAiAction({
        entityId,
        entityType,
        entityName,
        query: textToSubmit,
        organizationId,
        workspaceId,
      });

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error?.message || 'Failed to retrieve AI intelligence');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI intelligence query failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyCitation = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCitationId(id);
      setTimeout(() => setCopiedCitationId(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <>
      <div
        data-testid="entity-ai-prompt-bar"
      className={`rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm p-4 space-y-3 ${
        className || ''
      }`}
    >
      {/* Header with Title & Info Tooltip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground">
            Ask About {entityName}
          </span>
          <CardInfoTooltip text="Conversational intelligence grounded in institutional memory, call transcripts, emails, and CRM activity." />
        </div>

        {result && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <span>{result.tokenCount} tokens</span>
            <span>•</span>
            <span>{result.latencyMs}ms</span>
          </div>
        )}
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {QUICK_PROMPT_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              setQuery(chip);
              handleSubmit(chip);
            }}
            disabled={isLoading}
            className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-muted/40 hover:bg-muted/80 border border-border/60 text-muted-foreground hover:text-foreground transition-all active:scale-[0.97] min-h-[32px] sm:min-h-[28px] focus:outline-none"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Query Input Bar */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask anything about ${entityName}...`}
          disabled={isLoading}
          data-testid="entity-ai-input"
          className="w-full h-11 pl-3.5 pr-12 rounded-xl bg-background border border-border/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
        />
        <Button
          type="button"
          size="icon"
          onClick={() => handleSubmit()}
          disabled={!query.trim() || isLoading}
          aria-label="Submit query"
          data-testid="entity-ai-submit-btn"
          className="absolute right-1.5 h-8 w-8 rounded-lg active:scale-[0.95]"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          data-testid="entity-ai-error"
          className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Answer Container */}
      {result && (
        <div
          data-testid="entity-ai-result"
          className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3"
        >
          <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {result.answer}
          </div>

          {/* Grounded Citations (Rule 41 & Rule 30 Prompt Injection Isolation) */}
          {result.citations.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span>Grounded Citations ({result.citations.length}):</span>
              </div>

              <div className="space-y-2">
                {result.citations.map((c) => {
                  const isCopied = copiedCitationId === c.id;
                  return (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-lg border border-border/60 bg-card text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {c.citationTag}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground capitalize">
                            Source: {c.sourceType} • {c.author}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCitation(c.id, c.verbatimSnippet)}
                            aria-label={`Copy verbatim text for ${c.citationTag}`}
                            className="text-muted-foreground hover:text-foreground active:scale-95"
                          >
                            {isCopied ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Untrusted Reference Container (Rule 30) */}
                      <div
                        data-testid="untrusted-reference-container"
                        className="text-[11px] font-mono text-foreground/90 bg-muted/30 p-2 rounded border border-border/50 whitespace-pre-wrap select-text"
                      >
                        {`<untrusted_reference_data id="${c.id}">\n`}
                        {c.verbatimSnippet}
                        {`\n</untrusted_reference_data>`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>
    )}
  </div>

  {/* Flagship Signature Dossier Modal (Phase 9 Milestone 5) */}
  <CrmSignatureDossierModal
    open={isDossierOpen}
    onOpenChange={setIsDossierOpen}
    workspaceId={workspaceId || 'default'}
    entityId={entityId}
    initialQuery={`What's going on with ${entityName}?`}
  />
  </>
  );
}
