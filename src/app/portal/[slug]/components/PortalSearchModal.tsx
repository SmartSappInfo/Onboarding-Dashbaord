'use client';

/**
 * {{Org_name}} Experience Platform — Instant Content Search Modal
 *
 * Full-text search dialog with keyboard shortcut (Cmd+K / Ctrl+K),
 * real-time autocomplete, category filters, and direct result navigation.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePortalTheme } from './PortalThemeProvider';
import {
  Search,
  FileText,
  Sparkles,
  FolderArchive,
  Globe,
  Share2,
  Video,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';
import { searchPortalContentAction } from '@/app/actions/content-actions';
import type { ContentSearchResult, ContentItemType } from '@/lib/types/content';

interface PortalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  portalSlug: string;
}

const TYPE_ICONS: Record<ContentItemType, React.ComponentType<{ className?: string }>> = {
  article: FileText,
  lesson: Sparkles,
  resource: FolderArchive,
  page: Globe,
  announcement: Share2,
  video: Video,
  file: FolderArchive,
  embed: Globe,
};

export function PortalSearchModal({
  open,
  onOpenChange,
  portalId,
  portalSlug,
}: PortalSearchModalProps) {
  const router = useRouter();
  const { mode, activeColors } = usePortalTheme();

  const [queryText, setQueryText] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [results, setResults] = React.useState<ContentSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Debounced search
  React.useEffect(() => {
    if (!queryText.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const res = await searchPortalContentAction(portalId, queryText.trim(), {
        type: selectedType !== 'all' ? (selectedType as ContentItemType) : undefined,
      });

      if (res.success && res.data) {
        setResults(res.data);
      }
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [queryText, selectedType, portalId]);

  // Global Cmd+K keyboard shortcut listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelectResult = (itemUrl: string) => {
    onOpenChange(false);
    router.push(itemUrl);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-portal-theme={mode}
        className={cn(
          "max-w-2xl rounded-3xl p-0 overflow-hidden gap-0 border-2 shadow-2xl transition-colors",
          "bg-[var(--portal-surface)] text-[var(--portal-text)] border-[var(--portal-border)]",
          mode === 'dark' ? 'dark' : ''
        )}
      >
        <DialogHeader className="p-4 pb-3 border-b border-[var(--portal-border)] bg-[var(--portal-surface)]">
          {/* Accessible DialogTitle for screen readers satisfying WAI-ARIA and eliminating console errors */}
          <DialogTitle className="sr-only">Search Portal Content & Resources</DialogTitle>

          <div className="relative flex items-center">
            <Search className="absolute left-3 w-5 h-5 text-[var(--portal-muted)]" />
            <Input
              value={queryText}
              onChange={e => setQueryText(e.target.value)}
              placeholder="Type to search lessons, articles, documentation, or toolkits..."
              className="pl-11 pr-10 h-12 rounded-2xl text-sm border-0 focus-visible:ring-0 shadow-none font-medium bg-transparent text-[var(--portal-text)] placeholder:text-[var(--portal-muted)]"
              autoFocus
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                className="absolute right-3 p-1 rounded-lg text-[var(--portal-muted)] hover:text-[var(--portal-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 pt-2 px-1 overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'article', label: 'Articles' },
              { id: 'page', label: 'Docs' },
              { id: 'lesson', label: 'Lessons' },
              { id: 'resource', label: 'Downloads' },
            ].map(t => {
              const isActive = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t.id)}
                  className={cn(
                    "text-[11px] px-3 py-1 rounded-xl font-bold transition-all shrink-0 active:scale-[0.97]",
                    isActive
                      ? "text-white shadow-xs"
                      : "bg-[var(--portal-bg)] text-[var(--portal-muted)] hover:text-[var(--portal-text)] hover:bg-[var(--portal-surface)]"
                  )}
                  style={{
                    backgroundColor: isActive ? activeColors.primary : undefined,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Results Body */}
        <div className="max-h-[380px] overflow-y-auto p-4 space-y-2 bg-[var(--portal-bg)]/50">
          {isSearching ? (
            <div className="py-8 text-center space-y-2">
              <Loader2
                className="w-6 h-6 animate-spin mx-auto"
                style={{ color: activeColors.primary }}
              />
              <p className="text-xs text-[var(--portal-muted)]">Searching knowledge base...</p>
            </div>
          ) : queryText.trim() === '' ? (
            <div className="py-12 text-center text-xs text-[var(--portal-muted)] space-y-1">
              <p className="font-semibold text-[var(--portal-text)]">Instant Search</p>
              <p>Type keywords to search across all portal documentation and learning materials.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--portal-muted)]">
              No content matching &quot;<strong className="text-[var(--portal-text)]">{queryText}</strong>&quot;
            </div>
          ) : (
            results.map(({ item, snippet, matchedFields: _matchedFields }) => {
              const IconComp = TYPE_ICONS[item.type] || FileText;
              const targetUrl = `/portal/${portalSlug}/content/${item.type}/${item.slug}`;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectResult(targetUrl)}
                  className="w-full p-3.5 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface)] hover:border-[var(--portal-primary)] transition-all text-left flex items-start justify-between gap-3 group active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        backgroundColor: `${activeColors.primary}20`,
                        color: activeColors.primary,
                      }}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[var(--portal-text)] group-hover:text-[var(--portal-primary)] transition-colors truncate">
                          {item.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] uppercase font-bold px-1.5 py-0 border-[var(--portal-border)] text-[var(--portal-muted)]"
                        >
                          {item.type}
                        </Badge>
                      </div>

                      {snippet && (
                        <p className="text-[11px] text-[var(--portal-muted)] line-clamp-2 leading-relaxed">
                          {snippet}
                        </p>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    className="w-4 h-4 text-[var(--portal-muted)] group-hover:text-[var(--portal-primary)] shrink-0 transition-transform group-hover:translate-x-0.5 mt-1"
                  />
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
