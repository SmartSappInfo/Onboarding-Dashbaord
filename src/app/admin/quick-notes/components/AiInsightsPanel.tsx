'use client';

import * as React from 'react';
import { Sparkles, Loader2, Plus, Check, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { extractPlainText } from '@/lib/quick-notes-domain';
import { generateQuickNoteInsight, createTaskFromActionItem } from '@/lib/quick-notes-ai-actions';
import type { NoteDocument, QuickNoteAiMeta, QuickNoteLinks } from '@/lib/quick-notes-types';
import type { QuickNoteInsight } from '@/ai/flows/summarize-quick-note-flow';

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  negative: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  urgent: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
};

export interface AiInsightsPanelProps {
  noteId: string;
  title: string;
  content: NoteDocument | null;
  userId: string;
  workspaceId: string;
  organizationId: string;
  links?: QuickNoteLinks;
  cached?: QuickNoteAiMeta;
  onApplyTags: (tags: string[]) => void;
}

export default function AiInsightsPanel({
  noteId,
  title,
  content,
  userId,
  workspaceId,
  organizationId,
  links,
  cached,
  onApplyTags,
}: AiInsightsPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [creatingItem, setCreatingItem] = React.useState<string | null>(null);
  const [insight, setInsight] = React.useState<QuickNoteInsight | null>(
    cached?.summary
      ? {
          summary: cached.summary,
          suggestedTags: cached.suggestedTags ?? [],
          sentiment: cached.sentiment ?? 'neutral',
          actionItems: cached.actionItems ?? [],
        }
      : null
  );

  const generate = async () => {
    setLoading(true);
    try {
      const plainText = extractPlainText(content);
      const result = await generateQuickNoteInsight({ noteId, workspaceId, title, plainText, userId });
      if (result.success) {
        setInsight(result.data);
      } else {
        toast({ title: 'AI insight failed', description: result.error, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (text: string) => {
    setCreatingItem(text);
    try {
      const result = await createTaskFromActionItem({ text, workspaceId, organizationId, userId, links });
      if (result.success) {
        toast({ title: 'Task created from action item' });
      } else {
        toast({ title: "Couldn't create task", description: result.error, variant: 'destructive' });
      }
    } finally {
      setCreatingItem(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI insights
        </span>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {insight ? 'Regenerate' : 'Generate'}
        </Button>
      </div>

      {insight && (
        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm text-muted-foreground">{insight.summary}</p>
            <Badge className={cn('shrink-0 border-0 text-[10px] capitalize', SENTIMENT_STYLES[insight.sentiment])}>
              {insight.sentiment}
            </Badge>
          </div>

          {insight.suggestedTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {insight.suggestedTags.map((tag) => (
                <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                  {tag}
                </Badge>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 gap-1 text-[11px] text-primary"
                onClick={() => onApplyTags(insight.suggestedTags)}
              >
                <Check className="h-3 w-3" />
                Apply tags
              </Button>
            </div>
          )}

          {insight.actionItems.length > 0 && (
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <ListChecks className="h-3 w-3" />
                Action items
              </span>
              <ul className="space-y-1">
                {insight.actionItems.map((item, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs text-foreground">
                    <span className="flex-1">{item}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 shrink-0 gap-1 text-[11px]"
                      onClick={() => createTask(item)}
                      disabled={creatingItem === item}
                    >
                      {creatingItem === item ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Task
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
