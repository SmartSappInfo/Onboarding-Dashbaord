'use client';

import * as React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { generateQuickNotesDigest } from '@/lib/quick-notes-ai-actions';
import type { QuickNotesDigest } from '@/ai/flows/quick-notes-digest-flow';

export interface DigestNote {
  title?: string;
  plainText: string;
  createdAt?: string;
}

export interface DigestButtonProps {
  notes: DigestNote[];
  scopeLabel: string;
  workspaceId: string | null | undefined;
  userId: string | undefined;
  disabled?: boolean;
}

export default function DigestButton({ notes, scopeLabel, workspaceId, userId, disabled }: DigestButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [digest, setDigest] = React.useState<QuickNotesDigest | null>(null);

  const run = async () => {
    if (!userId || !workspaceId) return;
    setOpen(true);
    setLoading(true);
    setDigest(null);
    try {
      const result = await generateQuickNotesDigest({ notes, scopeLabel, workspaceId, userId });
      if (result.success) {
        setDigest(result.data);
      } else {
        toast({ title: 'Digest failed', description: result.error, variant: 'destructive' });
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={run}
        disabled={disabled || !userId || !workspaceId || notes.length === 0}
        title={notes.length === 0 ? 'No notes to summarise' : 'Summarise these notes'}
      >
        <Sparkles className="h-4 w-4" />
        Digest
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg tracking-tight">Digest · {scopeLabel}</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Summarising {notes.length} notes…
            </div>
          ) : digest ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">{digest.overview}</p>

              {digest.themes.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Themes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {digest.themes.map((t) => (
                      <Badge key={t} variant="outline" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {digest.outstandingActions.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Outstanding actions
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                    {digest.outstandingActions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
