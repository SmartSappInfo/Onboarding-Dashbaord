'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Semantic Media Search UI:
 *    Natural-language vector/text search input querying video transcripts and OCR documents,
 *    returning ranked `SemanticSearchHit` results with direct jump-to-timestamp links.
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    All search triggers and jump buttons strictly enforce `min-h-[44px] min-w-[44px]`
 *    touch target bounds with tactile micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { SemanticSearchHit } from '@/lib/types/media-2.0';
import { searchMediaSemanticallyAction } from '@/lib/media/content-intelligence-service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, Play, Loader2 } from 'lucide-react';

export function SemanticMediaSearch() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<SemanticSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!firestore || !queryText.trim() || isSearching) return;
    setIsSearching(true);

    try {
      const hits = await searchMediaSemanticallyAction(firestore, activeWorkspaceId || 'global', queryText.trim());
      setResults(hits);
      setSearched(true);
    } catch (err: unknown) {
      console.error('[SemanticMediaSearch] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const formatTimestamp = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6 text-left">
      {/* Search Input Box */}
      <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
            Vector AI Search
          </Badge>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ask a question about your media (e.g. What are the tuition fees for 2026?)..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 h-11 text-xs rounded-xl bg-background border-border"
            />
          </div>
          <Button
            disabled={!queryText.trim() || isSearching}
            onClick={handleSearch}
            className="rounded-xl font-extrabold text-xs h-11 px-5 min-h-[44px] gap-2 shadow-md active:scale-[0.97]"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Ask AI
          </Button>
        </div>
      </div>

      {/* Search Results Feed */}
      {isSearching ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-bold">Searching media transcripts & vectors...</span>
        </div>
      ) : searched && results.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border border-dashed rounded-2xl bg-muted/10 space-y-1">
          <p className="text-xs font-bold text-foreground">No Matching Clips Found</p>
          <p className="text-[11px]">Try rephrasing your search query or indexing more video transcripts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((hit, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] font-mono uppercase bg-muted text-muted-foreground">
                    {hit.mediaType}
                  </Badge>
                  <span className="text-xs font-bold text-foreground truncate">{hit.assetName}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  &ldquo;{hit.cueText}&rdquo;
                </p>
              </div>

              <Button
                onClick={() => window.open(hit.jumpUrl, '_blank')}
                className="rounded-xl font-bold text-xs h-10 px-4 min-h-[44px] gap-1.5 shrink-0 active:scale-[0.97]"
              >
                <Play className="h-3.5 w-3.5 fill-current" /> Jump to {formatTimestamp(hit.startTime)}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SemanticMediaSearch;
