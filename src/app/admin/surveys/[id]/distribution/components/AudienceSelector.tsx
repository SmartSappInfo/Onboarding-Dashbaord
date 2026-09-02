'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Dynamic Audience Selector
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Tag Selection Single Source of Truth:
 *    - Must exclusively route through <TagSelector> in client/draft mode (omitting contactId/contactType).
 * 2. Strict Zero-Any Invariant.
 * 3. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 */

import * as React from 'react';
import { TagSelector } from '@/components/tags/TagSelector';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, Loader2, RefreshCw } from 'lucide-react';
import { estimateAudienceSizeAction } from '@/lib/surveys/survey-campaign-actions';
import { useWorkspace } from '@/context/WorkspaceContext';

export interface AudienceSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  onAudienceCountChange?: (count: number) => void;
}

export function AudienceSelector({
  selectedTagIds,
  onTagsChange,
  onAudienceCountChange,
}: AudienceSelectorProps) {
  const { activeWorkspaceId } = useWorkspace();
  const [isEstimating, setIsEstimating] = React.useState(false);
  const [estimatedCount, setEstimatedCount] = React.useState<number | null>(null);

  const fetchEstimate = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsEstimating(true);
    try {
      const res = await estimateAudienceSizeAction(activeWorkspaceId, selectedTagIds.length > 0 ? selectedTagIds : undefined);
      setEstimatedCount(res.count);
      if (onAudienceCountChange) {
        onAudienceCountChange(res.count);
      }
    } catch {
      setEstimatedCount(0);
    } finally {
      setIsEstimating(false);
    }
  }, [activeWorkspaceId, selectedTagIds, onAudienceCountChange]);

  React.useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  return (
    <div className="space-y-4 p-4 rounded-2xl border border-border/70 bg-card/60">
      <div className="flex items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <Label className="text-sm font-bold text-foreground">Audience Segmentation</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">Filter recipient contacts by workspace tags</p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Badge variant="secondary" className="font-mono text-xs font-semibold px-2 py-0.5">
            {isEstimating ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            {estimatedCount !== null ? `~${estimatedCount} Contacts` : 'Calculating...'}
          </Badge>
          <button
            type="button"
            onClick={fetchEstimate}
            aria-label="Refresh audience estimation"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.97]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Filter contacts by Workspace Contact Tags (Leave empty to target all contacts):
        </Label>
        <TagSelector
          currentTagIds={selectedTagIds}
          onTagsChange={onTagsChange}
        />
      </div>
    </div>
  );
}
