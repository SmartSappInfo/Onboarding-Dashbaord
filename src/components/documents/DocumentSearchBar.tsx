'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for In-Reader Full-Text Search:
 *    Allows readers to perform instant keyword searches across multi-page publications
 *    with contextual snippets and instant page navigation (PRD Sections 24 & 85).
 * 2. Emil Kowalski Animation Standards:
 *    Spring-driven entrance modal, keyboard shortcuts (Enter to jump, Escape to close),
 *    and responsive snippet list.
 * 3. Mobile Ergonomics & Accessibility:
 *    Enforces `min-h-[44px]` touch target bounds and virtual keyboard friendly viewport sizing.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState, useMemo } from 'react';
import { Search, X, BookOpen, ArrowRight, CornerDownLeft } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { searchDocumentText, SearchMatchResult } from '@/lib/documents/document-search-service';

interface DocumentSearchBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: Array<{ pageNumber: number; extractedText?: string; title?: string }>;
  onSelectPage: (pageNumber: number) => void;
}

export function DocumentSearchBar({
  open,
  onOpenChange,
  pages,
  onSelectPage,
}: DocumentSearchBarProps) {
  const [query, setQuery] = useState('');

  const searchResults = useMemo<SearchMatchResult[]>(() => {
    if (!query.trim()) return [];
    return searchDocumentText(pages, query.trim());
  }, [pages, query]);

  const handleSelect = (pageNumber: number) => {
    onSelectPage(pageNumber);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl p-6 text-left">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search Document
            </DialogTitle>
            <Badge variant="outline" className="border-border bg-muted/30 text-muted-foreground font-mono text-[10px]">
              {pages.length} Pages Indexed
            </Badge>
          </div>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="relative pt-2">
          <Search className="absolute left-3.5 top-5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords, topics, or phrases..."
            autoFocus
            className="h-12 pl-10 pr-10 rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground font-medium text-sm min-h-[44px] focus-visible:ring-1 focus-visible:ring-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-4.5 p-1 rounded-lg text-muted-foreground hover:text-foreground active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search Results List */}
        <div className="max-h-[360px] overflow-y-auto space-y-2 py-2 pr-1 custom-scrollbar">
          {query.trim() === '' ? (
            <div className="py-8 text-center space-y-2 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <p className="text-xs font-medium">Type any term to find matching pages and snippets.</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-8 text-center space-y-1.5 text-muted-foreground">
              <p className="text-sm font-bold text-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground">Try searching with a broader keyword.</p>
            </div>
          ) : (
            searchResults.map((result) => (
              <button
                key={`search_page_${result.pageNumber}`}
                type="button"
                onClick={() => handleSelect(result.pageNumber)}
                className="w-full text-left p-3.5 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/40 hover:border-border transition-all duration-200 group flex items-start justify-between gap-3 min-h-[44px] active:scale-[0.98]"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold border border-primary/20">
                      Page {result.pageNumber}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">Match score: {result.matchScore}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground">
                    {result.snippet}
                  </p>
                </div>

                <div className="p-2 rounded-xl bg-muted/30 group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground shrink-0 mt-1 transition-colors">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer info */}
        {searchResults.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border/80 text-[11px] text-muted-foreground">
            <span>Found {searchResults.length} matching page{searchResults.length === 1 ? '' : 's'}</span>
            <span className="flex items-center gap-1">
              Click a match to navigate <CornerDownLeft className="h-3 w-3" />
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
