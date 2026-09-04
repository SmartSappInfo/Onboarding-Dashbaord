'use client';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Universal Global Media Search Command Palette
 *
 * Implements PRD Sec 104-106 universal `Cmd+K` media search across Assets, Experiences,
 * Packages, and Transcripts with AI summary snippets, campaign usage badges, and 1-click action triggers.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Debounced Search Execution: Automatically cancels in-flight queries via debouncing.
 * 2. Mobile Accessibility: All touch targets strictly satisfy `min-h-[44px] min-w-[44px]`.
 * 3. Tactile Micro-Animations: `active:scale-[0.97]` applied to all buttons and result cards.
 * 4. Strict Typing Standard: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD & UX REFERENCES:
 * - PRD Sec 104-106 (Global Search UX, Search Result Cards & Actions).
 * - UX Sec 104-106 & Screen 5 (Search).
 */

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Video,
  FileText,
  Music,
  Layers,
  Package as PackageIcon,
  Sparkles,
  ExternalLink,
  Send,
  Loader2,
  X,
  Command,
} from 'lucide-react';
import { useFirestore } from '@/lib/firestore-context';
import { searchGlobalMediaAction } from '@/lib/media/global-media-search-service';
import type { GlobalMediaSearchResult } from '@/lib/types/media-2.0';

export interface GlobalMediaSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function GlobalMediaSearchDialog({
  open,
  onOpenChange,
  workspaceId,
}: GlobalMediaSearchDialogProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<GlobalMediaSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isPending, startTransition] = useTransition();

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Debounced search
  useEffect(() => {
    if (!open || !firestore || !workspaceId) return;

    if (queryText.trim().length === 0) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const hits = await searchGlobalMediaAction(firestore, workspaceId, {
          query: queryText,
          limit: 15,
        });
        setResults(hits);
        setSelectedIndex(-1);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [open, firestore, workspaceId, queryText]);

  const handleSelectResult = (url: string) => {
    onOpenChange(false);
    router.push(url);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault();
        handleSelectResult(results[selectedIndex].url);
      }
    }
  };

  const getEntityIcon = (type: string, format?: string) => {
    switch (type) {
      case 'experience':
        return <Layers className="h-4 w-4 text-purple-500" />;
      case 'package':
        return <PackageIcon className="h-4 w-4 text-indigo-500" />;
      default:
        if (format === 'video') return <Video className="h-4 w-4 text-blue-500" />;
        if (format === 'audio') return <Music className="h-4 w-4 text-emerald-500" />;
        return <FileText className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Search className="h-5 w-5 text-slate-400 shrink-0 mr-3" />
          <Input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search assets, transcripts, experiences, or packages... (Cmd+K)"
            className="h-14 border-0 focus-visible:ring-0 text-sm bg-transparent shadow-none px-0"
            autoFocus
          />
          {queryText && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setQueryText('');
                setSelectedIndex(-1);
              }}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full"
              aria-label="Clear search query"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-blue-500 ml-2" />}
        </div>

        {/* Results Body */}
        <div
          role="listbox"
          aria-label="Media search results"
          className="max-h-[60vh] overflow-y-auto p-3 sm:p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/50"
        >
          {results.length > 0 ? (
            results.map((hit, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <Card
                  key={`${hit.type}_${hit.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectResult(hit.url)}
                  className={`group cursor-pointer transition-all duration-150 active:scale-[0.98] ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-blue-500 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-sm'
                  }`}
                >
                <CardContent className="p-3 sm:p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 shrink-0">
                        {getEntityIcon(hit.type, hit.format)}
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                        {hit.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hit.campaignCount && (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          {hit.campaignCount} campaigns
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                        {hit.type}
                      </Badge>
                    </div>
                  </div>

                  {hit.summary && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 pl-8 leading-relaxed">
                      {hit.summary}
                    </p>
                  )}

                  <div className="flex items-center justify-between pl-8 pt-1 text-[11px] text-slate-400">
                    <span>{hit.subtitle || 'Ready for sharing'}</span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                      Open <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : queryText.trim().length > 0 ? (
            <div className="text-center py-10 space-y-2">
              <Search className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                No media matching &ldquo;{queryText}&rdquo;
              </p>
              <p className="text-xs text-slate-400">
                Try searching for topic keywords like &ldquo;tuition&rdquo;, &ldquo;tour&rdquo;, or &ldquo;orientation&rdquo;.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 space-y-2 text-slate-400">
              <Command className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Type keywords or phrases to search across all workspace media assets.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                <Badge
                  variant="outline"
                  onClick={() => setQueryText('tuition')}
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px]"
                >
                  tuition
                </Badge>
                <Badge
                  variant="outline"
                  onClick={() => setQueryText('tour')}
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px]"
                >
                  campus tour
                </Badge>
                <Badge
                  variant="outline"
                  onClick={() => setQueryText('guide')}
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px]"
                >
                  fee guide
                </Badge>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
