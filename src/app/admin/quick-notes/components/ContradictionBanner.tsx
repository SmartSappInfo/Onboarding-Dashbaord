'use client';

import * as React from 'react';
import { AlertTriangle, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ContradictionDetails } from '@/lib/quick-notes-types';

interface ContradictionBannerProps {
  contradiction: ContradictionDetails;
  onReview?: () => void;
  onDismiss?: () => void;
}

export function ContradictionBanner({
  contradiction,
  onReview,
  onDismiss,
}: ContradictionBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-start justify-between gap-3 text-xs animate-in fade-in duration-200">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-destructive/20 text-destructive shrink-0 mt-0.5">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-destructive">Conflicting Knowledge Detected</span>
            <Badge variant="outline" className="text-[9px] uppercase font-bold text-destructive border-destructive/30">
              {contradiction.severity} Severity
            </Badge>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {contradiction.explanation || `Thesis "${contradiction.thesis?.claim || contradiction.thesisClaim || 'Target Note'}" conflicts with "${contradiction.antithesis?.claim || contradiction.antithesisClaim || 'Candidate Note'}".`}
          </p>
          <div className="text-[11px] text-foreground font-semibold">
            Conflicting record: <em>"{contradiction.antithesis?.sourceTitle || contradiction.conflictTopic || 'Other Note'}"</em>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onReview && (
          <Button
            size="sm"
            variant="outline"
            onClick={onReview}
            className="h-7 text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
          >
            Review Evidence
            <ChevronRight className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
